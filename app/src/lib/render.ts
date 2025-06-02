import initWasm from '../assets/mermaid.wasm?init';
import computeShader from './shaders/compute.wgsl?raw';

export type Span = {
    ptr: number,
    len: number
};

export type CompilationResult = 
    { type: "error", msg: Span } |
    { type: "success", insts: Span };

export class WasmModule {
    private instance!: WebAssembly.Instance;
    private memory = new WebAssembly.Memory({ initial: 17, maximum: 1024 });

    private exports!: {
        allocate: (len: number) => number;
        free: (ptr: number) => void;
        compile: (ptr: number, len: number) => number;
    }

    // No async constructors :(
    async init() {
        const env = {
            __stack_pointer: 0,
            memory: this.memory,
            consoleLog: (ptr: number, len: number) => {
                console.log(`[ZIG] ${this.getString({ len, ptr })}`);
            },
        };

        try {
            this.instance = await initWasm({
                env
            });

            this.exports = {
                // @ts-ignore
                free: this.instance.exports.free,
                // @ts-ignore
                allocate: this.instance.exports.allocate,
                // @ts-ignore
                compile: this.instance.exports.compile,
            }

        } catch (e: any) {
            console.error(`WASM loading failed: ${e.message}`);
        }

        console.log("WASM module loaded");
    }

    free(span: Span) {
        this.exports.free(span.ptr);
    }

    allocate(len: number): Span {
        // TODO: proper error handling
        return {
            len,
            ptr: this.exports.allocate(len)
        }
    }

    // First 4 bytes of returned buffer is # of 8-byte instructions, rest of the buffer is those
    // 8 byte instructions
    compile(str: string): CompilationResult {
        const encoder = new TextEncoder();
        const stringBytes = encoder.encode(str);

        const buf = this.exports.allocate(stringBytes.length + 1);

        new Uint8Array(this.memory.buffer, buf, stringBytes.length).set(stringBytes);
        new Uint8Array(this.memory.buffer, buf + stringBytes.length, 1)[0] = 0;

        let addr: number = this.exports.compile(buf, stringBytes.length);
        let type: number = new DataView(this.memory.buffer, addr, 1).getUint8(0)
    
        if (type === 0x0) {
            console.log("First byte is 0 - success");
            const data = new DataView(this.memory.buffer, addr + 1, 8);

            return {
                type: "success",
                insts: {
                    len: data.getUint32(0, true),
                    ptr: data.getUint32(4, true)
                }
            }
        } else {
            console.log("First byte is 1 - error");
            const data = new DataView(this.memory.buffer, addr + 1, 8);

            return {
                type: "error",
                msg: {
                    len: data.getUint32(0, true),
                    ptr: data.getUint32(4, true)
                }
            }
        }
    }

    getDataView(span: Span, offset: number): DataView {
        return new DataView(this.memory.buffer, span.ptr + offset, span.len - offset);
    }

    getUint8Array(span: Span, offset: number): Uint8Array {
        return new Uint8Array(this.memory.buffer, span.ptr + offset, span.len - offset);
    }

    getString(span: Span): string {
        const view = this.getDataView(span, 0);
        return new TextDecoder().decode(view);
    }
}

export class WebGPUState {
    device!: GPUDevice;
    canvas!: HTMLCanvasElement;
    canvasContext!: GPUCanvasContext;
    canvasFormat!: GPUTextureFormat;

    // No async constructors :(
    async init(canvas: HTMLCanvasElement) {
        if (!navigator.gpu) throw Error("WebGPU not supported");

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw Error("Couldn't get WebGPU adapater");

        this.device = await adapter.requestDevice();
        this.device.lost.then(() => {
            throw Error("WebGPU logical device was lost")
        });

        this.canvas = canvas;
        this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();

        this.canvasContext = this.canvas.getContext('webgpu')!;
        this.canvasContext.configure({
            device: this.device,
            format: this.canvasFormat
        });
    }
}

export class ComputePipeline {
    tapeBindGroupLayout!: GPUBindGroupLayout;
    outputBindGroupLayout!: GPUBindGroupLayout;

    tape?: {
        buffer: GPUBuffer,
        bindGroup: GPUBindGroup
    }

    outputTexture!: GPUTexture;
    outputBindGroup!: GPUBindGroup;

    pipeline!: GPUComputePipeline;

    // No async constructors :(
    async init(gpu: WebGPUState) {
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
            throw new Error("No tape defined");
        }

        const pass = encoder.beginComputePass({ label: "Compute pass" });
        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, this.outputBindGroup);
        pass.setBindGroup(1, this.tape.bindGroup);
        pass.dispatchWorkgroups(64, 64);
        pass.end();
    }
}

export class RenderPipleine {
    pipeline!: GPURenderPipeline;
    bindGroup!: GPUBindGroup;

    async init(gpu: WebGPUState, inputTexture: GPUTexture) {
        this.pipeline = gpu.device.createRenderPipeline({
            label: "Blit pipeline",
            layout: "auto",
            vertex: {
                module: gpu.device.createShaderModule({
                    code: `
                        @vertex
                        fn main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
                            var pos = array<vec2<f32>, 6>(
                                vec2<f32>(-1.0, -1.0),
                                vec2<f32>( 1.0, -1.0),
                                vec2<f32>(-1.0,  1.0),
                                vec2<f32>(-1.0,  1.0),
                                vec2<f32>( 1.0, -1.0),
                                vec2<f32>( 1.0,  1.0)
                            );
                            return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
                        }
                    `
                }),
                entryPoint: "main"
            },
            fragment: {
                module: gpu.device.createShaderModule({
                    code: `
                        @group(0) @binding(0) var myTexture: texture_2d<f32>;
    
                        @fragment
                        fn main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
                            // Convert pixel coordinates to normalized [0,1] UVs
                            let texSize = vec2<f32>(textureDimensions(myTexture, 0));
                            let uv = pos.xy / texSize;
                            return textureLoad(myTexture, vec2<i32>(pos.xy), 0);
                        }
                    `
                }),
                entryPoint: "main",
                targets: [
                    {
                        format: gpu.canvasFormat
                    }
                ]
            },
            primitive: {
                topology: "triangle-list"
            }
        });

        this.bindGroup = gpu.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: inputTexture.createView()
                }
            ]
        });
    }

    encode(encoder: GPUCommandEncoder, outputView: GPUTextureView) {
        const renderPass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: outputView,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: "clear",
                    storeOp: "store"
                }
            ]
        });

        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.draw(6, 1, 0, 0); // Draw 2 triangles (6 vertices) for the quad
        renderPass.end();
    }
}