import { BindGroupBuilder } from "./bind-group-builder";
import type { SurfaceType } from "./surface-type";

// Could lowkey use a better name - this is the insturction tape and output texture
export default class EvaluationState {
    surfaceType: SurfaceType;

    tapeBuffer: GPUBuffer;
    outputTexture: GPUTexture;
    outputLocksBuffer?: GPUBuffer;

    // Render bind group - just output texture
    // Compute bind group - instruction tape, output texture, and (if 3d) output locks buffer
    render: {
        bindGroup: GPUBindGroup;
        bindGroupLayout: GPUBindGroupLayout;
    };

    compute: {
        bindGroup: GPUBindGroup;
        bindGroupLayout: GPUBindGroupLayout;
    };

    constructor(device: GPUDevice, surfaceType: SurfaceType) {
        this.surfaceType = surfaceType;

        const MAX_INSTS = 100000;
        const OUTPUT_TEXTURE_SIZE = {
            width: 1024,
            height: 1024
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

        const [renderBindGroupLayout, renderBindGroup] = new BindGroupBuilder()
            .texture(this.outputTexture, GPUShaderStage.FRAGMENT, outputSampleType)
            .build(device);

        let computeBindGroupBuilder = new BindGroupBuilder()
            .buffer(this.tapeBuffer, GPUShaderStage.COMPUTE, "read-only-storage")    
            .storageTexture(this.outputTexture, GPUShaderStage.COMPUTE, "write-only");

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
}