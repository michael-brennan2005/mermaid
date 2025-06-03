import { WebGPUState } from "./webgpu";
import computeShader from './compute.wgsl?raw';

export class RegionArrays {
    buffers: GPUBuffer[];
    bindGroups: GPUBindGroup[];
    bindGroupLayout: GPUBindGroupLayout;

    constructor(gpu: WebGPUState) {
        // 2 intervals, 2 f32s each => 16 bytes
        const regionSize = 16;

        // Each buffer/region array is used both to store regions AND be used in an 
        // dispatchWorkgroupsIndirect call, hence the 12 bytes instead of just 4
        this.buffers = [
            gpu.device.createBuffer({
                label: "Region array - 1st pass input",
                size: 12 + regionSize, // u32 for length, one initial region
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            }),
            gpu.device.createBuffer({
                label: "Region array - 1st pass output, 2nd pass input",
                size: 12 + regionSize * (16 * 16), // u32 for length, worst case (16^2) subintervals to evaluate
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            }),
            gpu.device.createBuffer({
                label: "Region array - 2nd pass output, 3rd pass input",
                size: 12 + regionSize * (16 * 16 * 16), // u32 for length, worst case (16^3) subintervals to evaluate,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            }),
        ];

        this.bindGroupLayout = gpu.device.createBindGroupLayout({
            label: "Region array bind group layout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "storage"
                    }
                },
            ]
        });

        this.bindGroups = [];
        
        for (const buffer of this.buffers) {
            this.bindGroups.push(gpu.device.createBindGroup({
                label: `BindGroup for "${buffer.label}"`,
                layout: this.bindGroupLayout,
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: buffer
                        }
                    },
                ],
            }));
            
            gpu.device.queue.writeBuffer(buffer, 4, new Uint32Array([1,1]), 0, 2);
        }
    }
}

export class ComputePipeline {
    tapeBuffer: GPUBuffer;
    outputTexture: GPUTexture;

    bindGroup: GPUBindGroup;
    bindGroupLayout: GPUBindGroupLayout;

    // Initial (first 2) makes subintervals for further evaluation, final pass does not
    pipelineInitial: GPUComputePipeline;
    pipelineFinal: GPUComputePipeline;

    constructor(gpu: WebGPUState) {
        this.bindGroupLayout = gpu.device.createBindGroupLayout({
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
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "read-only-storage"
                    }
                },
            ]
        });


        const MAX_INSTS = 100000;

        this.tapeBuffer = gpu.device.createBuffer({
            label: `Tape buffer`,
            // 4 bytes for tape length, (MAX_INSTS * 8) bytes for instructions
            size: 4 + (MAX_INSTS * 8),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
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

        this.bindGroup = gpu.device.createBindGroup({
            label: "Compute bind group",
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: this.outputTexture.createView({
                        dimension: "2d",
                    })
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.tapeBuffer
                    }
                },
            ]
        });

        this.pipelineInitial = gpu.device.createComputePipeline({
            label: "Compute pipeline - initial",
            layout: gpu.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            compute: {
                module: gpu.device.createShaderModule({
                    code: computeShader
                }),
                constants: {
                    // @ts-ignore
                    output_subinterval: true
                }
            },
        });

        this.pipelineFinal = gpu.device.createComputePipeline({
            label: "Compute pipeline - final",
            layout: gpu.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout]
            }),
            compute: {
                module: gpu.device.createShaderModule({
                    code: computeShader
                }),
                constants: {
                    // @ts-ignore
                    output_subinterval: false
                }
            },
        });
    }

    uploadTape(gpu: WebGPUState, newTape: Uint8Array) {
        const tapeLength = newTape.length / 8;

        console.log('About to write:', {
            bufferLabel: this.tapeBuffer.label,
            bufferSize: this.tapeBuffer.size,
            dataLength: newTape.length,
            dataOffset: newTape.byteOffset,
            firstBytes: Array.from(newTape.slice(0, 4))
        });

        console.log(`New tape length: ${tapeLength}`);
        
        gpu.device.queue.writeBuffer(this.tapeBuffer, 0, new Uint32Array([tapeLength]), 0, 1);
        gpu.device.queue.writeBuffer(this.tapeBuffer, 4, newTape.buffer, newTape.byteOffset, newTape.length);
    }

    encode(encoder: GPUCommandEncoder, regionArrays: RegionArrays) {
        const pass = encoder.beginComputePass({ label: "Compute pass" });
        pass.setBindGroup(0, this.bindGroup);
        
        
        // First pass
        pass.setPipeline(this.pipelineInitial);
        pass.setBindGroup(1, regionArrays.bindGroups[0]);
        pass.setBindGroup(2, regionArrays.bindGroups[1]);
        pass.dispatchWorkgroups(1);

        // Second pass
        pass.setBindGroup(1, regionArrays.bindGroups[1]);
        pass.setBindGroup(2, regionArrays.bindGroups[2]);
        pass.dispatchWorkgroupsIndirect(regionArrays.buffers[1], 0);

        // Third pass
        pass.setPipeline(this.pipelineFinal);
        pass.setBindGroup(1, regionArrays.bindGroups[2]);
        pass.setBindGroup(2, regionArrays.bindGroups[0]); // wont be modified because of different pipeline
        pass.dispatchWorkgroupsIndirect(regionArrays.buffers[2], 0);
        
        pass.end();
    }
}