import { WebGPUState } from "./webgpu";
import computeShader from './compute.wgsl?raw';

export class ComputePipeline {
    tapeBindGroupLayout: GPUBindGroupLayout;
    outputBindGroupLayout: GPUBindGroupLayout;

    tape?: {
        buffer: GPUBuffer,
        bindGroup: GPUBindGroup
    }

    outputTexture: GPUTexture;
    outputBindGroup: GPUBindGroup;

    pipeline: GPUComputePipeline;

    constructor(gpu: WebGPUState) {
        this.outputBindGroupLayout = gpu.device.createBindGroupLayout({
            label: "Compute bind group layout - output",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        format: "rgba8unorm",
                        access: "write-only",
                        viewDimension: "2d"
                    }
                }
            ]
        });

        this.tapeBindGroupLayout = gpu.device.createBindGroupLayout({
            label: "Compute bind group layout - tape",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "read-only-storage"
                    }
                },
            ]
        });

        const OUTPUT_TEXTURE_SIZE = {
            width: 1024,
            height: 1024
        };

        this.outputTexture = gpu.device.createTexture({
            label: "Output texture",
            size: [OUTPUT_TEXTURE_SIZE.width, OUTPUT_TEXTURE_SIZE.height],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
        });

        this.outputBindGroup = gpu.device.createBindGroup({
            label: "Compute bind group - output",
            layout: this.outputBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: this.outputTexture.createView({
                        dimension: "2d",
                    })
                }
            ]
        });

        this.pipeline = gpu.device.createComputePipeline({
            label: "Compute pipeline",
            layout: gpu.device.createPipelineLayout({
                bindGroupLayouts: [this.outputBindGroupLayout, this.tapeBindGroupLayout]
            }),
            compute: {
                module: gpu.device.createShaderModule({
                    code: computeShader
                })
            },
        });
    }

    uploadTape(gpu: WebGPUState, tapeBuf: Uint8Array) {
        if (this.tape) {
            this.tape.buffer.destroy();
            // TODO: do we need to destroy bindgroup or is that simple GC'd

            this.tape = undefined;
        }

        const buffer = gpu.device.createBuffer({
            label: `Tape buffer ${Date.now().toString(16)}-${Math.floor(Math.random() * 1e8).toString(16)}`,
            size: tapeBuf.length,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        console.log('About to write:', {
            bufferLabel: buffer.label,
            bufferSize: buffer.size,
            dataLength: tapeBuf.length,
            dataOffset: tapeBuf.byteOffset,
            firstBytes: Array.from(tapeBuf.slice(0, 4))
        });

        gpu.device.queue.writeBuffer(buffer, 0, tapeBuf.buffer, tapeBuf.byteOffset, tapeBuf.length);

        const bindGroup = gpu.device.createBindGroup({
            label: "Compute bind group - tape",
            layout: this.tapeBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: buffer
                    }
                },
            ]
        });

        this.tape = {
            bindGroup,
            buffer
        };
    }

    encode(encoder: GPUCommandEncoder) {
        if (this.tape === undefined) {
            return; // cant throw an error because of how the current component logic is (TODO: this should also be handled lowk)
        }

        const pass = encoder.beginComputePass({ label: "Compute pass" });
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.outputBindGroup);
        pass.setBindGroup(1, this.tape.bindGroup);
        pass.dispatchWorkgroups(64, 64);
        pass.end();
    }
}