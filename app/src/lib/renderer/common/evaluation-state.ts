import { mat3, mat4, type Mat4 } from "wgpu-matrix";
import { BindGroupBuilder } from "./bind-group-builder";
import type { SurfaceType } from "./surface-type";

// Could lowkey use a better name - this is the insturction tape, output texture, 
// and evaluation region transform
export default class EvaluationState {
    surfaceType: SurfaceType;

    tapeBuffer: GPUBuffer;
    outputTexture: GPUTexture;
    outputLocksBuffer?: GPUBuffer;

    // Transform <-> camera
    transformBuffer: GPUBuffer;

    // Render bind group - just output texture
    // Compute bind group - instruction tape, output texture, region transform, and (if 3d) output locks buffer
    render!: {
        bindGroup: GPUBindGroup;
        bindGroupLayout: GPUBindGroupLayout;
    };

    compute!: {
        bindGroup: GPUBindGroup;
        bindGroupLayout: GPUBindGroupLayout;
    };

    constructor(device: GPUDevice, surfaceType: SurfaceType, canvas: HTMLCanvasElement) {
        this.surfaceType = surfaceType;

        const MAX_INSTS = 100000;
        const OUTPUT_TEXTURE_SIZE = {
            width: canvas.width,
            height: canvas.height
        };

        const outputFormat: GPUTextureFormat = surfaceType == "2D" ? "rgba8unorm" : "r32uint";
        const outputSampleType: GPUTextureSampleType = surfaceType == "2D" ? "float" : "uint";

        this.outputTexture = device.createTexture({
            label: "EvaluationState - output texture",
            size: [OUTPUT_TEXTURE_SIZE.width, OUTPUT_TEXTURE_SIZE.height],
            format: outputFormat,
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
        });

        this.outputLocksBuffer = surfaceType == "3D" ? device.createBuffer({
            label: "EvaluationState - output locks",
            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.STORAGE,
            size: OUTPUT_TEXTURE_SIZE.width * OUTPUT_TEXTURE_SIZE.height * 4,
        }) : undefined;

        this.tapeBuffer = device.createBuffer({
            label: `EvaluationState - tape buffer`,
            // 4 bytes for tape length, (MAX_INSTS * 8) bytes for instructions
            size: 4 + (MAX_INSTS * 8),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        this.transformBuffer = device.createBuffer({
            label: `EvaluationState - transform buffer`,
            // Max size is 1 4x4 matrix, used by 3D pass or 2D pass
            size: (1 * 4 * 16),
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        this.buildBindGroups(device, outputSampleType);
    }

    // Resize output texture to be width & height of provided canvas
    resizeTexture(device: GPUDevice, width: number, height: number) {
        this.outputTexture.destroy();

        const outputFormat: GPUTextureFormat = this.surfaceType == "2D" ? "rgba8unorm" : "r32uint";
        const outputSampleType: GPUTextureSampleType = this.surfaceType == "2D" ? "float" : "uint";

        this.outputTexture = this.outputTexture = device.createTexture({
            label: "EvaluationState - output texture",
            size: [width, height],
            format: outputFormat,
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
        });

        this.buildBindGroups(device, outputSampleType);
    }

    
    private buildBindGroups(device: GPUDevice, outputSampleType: GPUTextureSampleType) {
        const [renderBindGroupLayout, renderBindGroup] = new BindGroupBuilder()
            .texture(this.outputTexture, GPUShaderStage.FRAGMENT, outputSampleType)
            .build(device);

        let computeBindGroupBuilder = new BindGroupBuilder()
            .buffer(this.tapeBuffer, GPUShaderStage.COMPUTE, "read-only-storage")    
            .storageTexture(this.outputTexture, GPUShaderStage.COMPUTE, "write-only")
            .buffer(this.transformBuffer, GPUShaderStage.COMPUTE, "uniform");

        if (this.outputLocksBuffer) {
            computeBindGroupBuilder = computeBindGroupBuilder.buffer(this.outputLocksBuffer, GPUShaderStage.COMPUTE, "storage") 
        }

        const [computeBindGroupLayout, computeBindGroup] = computeBindGroupBuilder
            .build(device);

        this.render = {
            bindGroup: renderBindGroup,
            bindGroupLayout: renderBindGroupLayout
        }

        this.compute = {
            bindGroup: computeBindGroup,
            bindGroupLayout: computeBindGroupLayout,
        };
    }

    setTape(device: GPUDevice, buffer: Uint8Array) {
        const tapeLength = buffer.length / 8;

        // console.log('About to write:', {
        //     bufferLabel: this.tapeBuffer.label,
        //     bufferSize: this.tapeBuffer.size,
        //     dataLength: buffer.length,
        //     dataOffset: buffer.byteOffset,
        //     firstBytes: Array.from(buffer.slice(0, 4))
        // });

        // console.log(`New tape length: ${tapeLength}`);

        device.queue.writeBuffer(this.tapeBuffer, 0, new Uint32Array([tapeLength]), 0, 1);
        device.queue.writeBuffer(this.tapeBuffer, 4, buffer.buffer, buffer.byteOffset, buffer.length);
    }

    set2DTransform(device: GPUDevice, scale: number, x: number, y: number) {
        // THIS MAY NEED TO BE FLIPPED
        const transform = mat3.create(
           scale,  0.0,    x,
           0.0,    scale,  y,
           0.0,    0.0,    1              
       );
       
       device.queue.writeBuffer(this.transformBuffer, 0, transform, 12);
    }

    set3DTransform(device: GPUDevice, perspective: Mat4, view: Mat4) {
        const transform = mat4.multiply(perspective, view);

        device.queue.writeBuffer(this.transformBuffer, 0, transform, 16);
    }
}