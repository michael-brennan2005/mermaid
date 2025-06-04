// Could lowkey use a better name - this is the insturction tape and output texture
export class EvaluationState {
    tapeBuffer: GPUBuffer;
    outputTexture: GPUTexture;

    // Render bind group - just output texture
    // Compute bind group - instruction tape and output texture
    render: {
        bindGroup: GPUBindGroup;
        bindGroupLayout: GPUBindGroupLayout;
    };

    compute: {
        bindGroup: GPUBindGroup;
        bindGroupLayout: GPUBindGroupLayout;
    };

    constructor(device: GPUDevice) {
        const MAX_INSTS = 100000;

        this.tapeBuffer = device.createBuffer({
            label: `EvaluationState - tape buffer`,
            // 4 bytes for tape length, (MAX_INSTS * 8) bytes for instructions
            size: 4 + (MAX_INSTS * 8),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        const OUTPUT_TEXTURE_SIZE = {
            width: 1024,
            height: 1024
        };

        this.outputTexture = device.createTexture({
            label: "EvaluationState - output texture",
            size: [OUTPUT_TEXTURE_SIZE.width, OUTPUT_TEXTURE_SIZE.height],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
        });
        
        const renderBindGroupLayout = device.createBindGroupLayout({
            label: "EvaluationState - render bind group layout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {
                        sampleType: "float",
                        viewDimension: "2d",
                        multisampled: false
                    }
                }
            ]
        });

        this.render = {
            bindGroupLayout: renderBindGroupLayout, 
            bindGroup: device.createBindGroup({
                label: "EvaluationState - render bind group",
                layout: renderBindGroupLayout,
                entries: [
                    {
                        binding: 0,
                        resource: this.outputTexture.createView()
                    }
                ]
            })
        };

        const computeBindGroupLayout = device.createBindGroupLayout({
            label: "EvaluationState - compute bind group layout",
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

        this.compute = {
            bindGroupLayout: computeBindGroupLayout,
            bindGroup: device.createBindGroup({
                label: "EvaluationState - compute bind group",
                layout: computeBindGroupLayout,
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
            })
        };
    }

    setTape(device: GPUDevice, buffer: Uint8Array) {
        const tapeLength = buffer.length / 8;

        console.log('About to write:', {
            bufferLabel: this.tapeBuffer.label,
            bufferSize: this.tapeBuffer.size,
            dataLength: buffer.length,
            dataOffset: buffer.byteOffset,
            firstBytes: Array.from(buffer.slice(0, 4))
        });

        console.log(`New tape length: ${tapeLength}`);
        
        device.queue.writeBuffer(this.tapeBuffer, 0, new Uint32Array([tapeLength]), 0, 1);
        device.queue.writeBuffer(this.tapeBuffer, 4, buffer.buffer, buffer.byteOffset, buffer.length);  
    }
}

export default EvaluationState;