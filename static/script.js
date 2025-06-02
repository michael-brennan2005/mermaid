"use strict";
class WasmModule {
    constructor() {
        this.memory = new WebAssembly.Memory({ initial: 17, maximum: 1024 });
    }
    // No async constructors :(
    async init() {
        const env = {
            __stack_pointer: 0,
            memory: this.memory,
            consoleLog: (ptr, len) => {
                console.log(`[ZIG] ${this.getString({ len, ptr })}`);
            },
        };
        try {
            let source = await WebAssembly.instantiateStreaming(fetch('teddy.wasm'), { env: env });
            this.instance = source.instance;
            this.exports = {
                // @ts-ignore
                free: source.instance.exports.free,
                // @ts-ignore
                allocate: source.instance.exports.allocate,
                // @ts-ignore
                compile: source.instance.exports.compile,
            };
        }
        catch (e) {
            console.error(`WASM loading failed: ${e.message}`);
        }
        console.log("WASM module loaded");
    }
    free(span) {
        this.exports.free(span.ptr);
    }
    allocate(len) {
        // TODO: proper error handling
        return {
            len,
            ptr: this.exports.allocate(len)
        };
    }
    // First 4 bytes of returned buffer is # of 8-byte instructions, rest of the buffer is those
    // 8 byte instructions
    compile(str) {
        const encoder = new TextEncoder();
        const stringBytes = encoder.encode(str);
        const buf = this.exports.allocate(stringBytes.length + 1);
        new Uint8Array(this.memory.buffer, buf, stringBytes.length).set(stringBytes);
        new Uint8Array(this.memory.buffer, buf + stringBytes.length, 1)[0] = 0;
        let addr = this.exports.compile(buf, stringBytes.length);
        let type = new DataView(this.memory.buffer, addr, 1).getUint8(0);
        if (type === 0x0) {
            console.log("First byte is 0 - success");
            const data = new DataView(this.memory.buffer, addr + 1, 8);
            return {
                type: "success",
                insts: {
                    len: data.getUint32(0, true),
                    ptr: data.getUint32(4, true)
                }
            };
        }
        else {
            console.log("First byte is 1 - error");
            const data = new DataView(this.memory.buffer, addr + 1, 8);
            return {
                type: "error",
                msg: {
                    len: data.getUint32(0, true),
                    ptr: data.getUint32(4, true)
                }
            };
        }
    }
    getDataView(span, offset) {
        return new DataView(this.memory.buffer, span.ptr + offset, span.len - offset);
    }
    getUint8Array(span, offset) {
        return new Uint8Array(this.memory.buffer, span.ptr + offset, span.len - offset);
    }
    getString(span) {
        const view = this.getDataView(span, 0);
        return new TextDecoder().decode(view);
    }
}
class WebGPUState {
    // No async constructors :(
    async init() {
        if (!navigator.gpu)
            throw Error("WebGPU not supported");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter)
            throw Error("Couldn't get WebGPU adapater");
        this.device = await adapter.requestDevice();
        this.device.lost.then(() => {
            throw Error("WebGPU logical device was lost");
        });
        this.canvas = document.querySelector("canvas");
        this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        this.canvasContext = this.canvas.getContext('webgpu');
        this.canvasContext.configure({
            device: this.device,
            format: this.canvasFormat
        });
    }
}
class ComputePipeline {
    // No async constructors :(
    async init(gpu) {
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
        this.outputTexture = gpu.device.createTexture({
            label: "Output texture",
            size: [outputImageWidth, outputImageHeight],
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
        const computeShader = await (async () => {
            const shader = await fetch("shader.wgsl");
            return await shader.text();
        })();
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
    uploadTape(gpu, tapeBuf) {
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
    encode(encoder) {
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
class RenderPipleine {
    async init(gpu, inputTexture) {
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
    encode(encoder, outputView) {
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
// Thanks, Claude!
function setupDebouncedTextarea(textarea, callback, delay = 300) {
    const controller = new AbortController();
    let timeoutId;
    textarea.addEventListener('input', (event) => {
        clearTimeout(timeoutId);
        const target = event.target;
        timeoutId = setTimeout(() => {
            if (!controller.signal.aborted) {
                callback(target.value);
            }
        }, delay);
    }, { signal: controller.signal });
    return controller; // Call controller.abort() to cleanup
}
const outputImageWidth = 512;
const outputImageHeight = 512;
const outputImageScale = (512 / 64);
(async () => {
    const wasm = new WasmModule();
    await wasm.init();
    const webgpu = new WebGPUState();
    await webgpu.init();
    const compute = new ComputePipeline();
    await compute.init(webgpu);
    const render = new RenderPipleine();
    await render.init(webgpu, compute.outputTexture);
    const inputArea = document.querySelector("#input");
    const compileErrorOutput = document.querySelector("#error-msg");
    const run = (text) => {
        const buf = wasm.compile(text);
        if (buf.type === "error") {
            console.log(`buf.msg ptr: ${buf.msg.ptr}, len: ${buf.msg.len}`);
            console.log(`So sad an error got reported ${wasm.getString(buf.msg)}`);
            compileErrorOutput.textContent = wasm.getString(buf.msg);
            compileErrorOutput.style.display = "block";
        }
        else {
            console.log(`buf.insts ptr: ${buf.insts.ptr}, len: ${buf.insts.len}`);
            compileErrorOutput.textContent = "";
            compileErrorOutput.style.display = "none";
            const tapeData = wasm.getDataView(buf.insts, 0);
            for (let i = 0; i < buf.insts.len; i += 8) {
                const opcode = tapeData.getUint8(i + 3);
                const output = tapeData.getUint8(i + 2);
                const rhs = tapeData.getUint8(i + 1);
                const lhs = tapeData.getUint8(i);
                console.log(`r${output} = op(${opcode}) r${lhs} r${rhs} (imm: ${tapeData.getFloat32(i + 4, true)})`);
            }
            compute.uploadTape(webgpu, wasm.getUint8Array(buf.insts, 0));
            const encoder = webgpu.device.createCommandEncoder({ label: "Compute & render encoder" });
            compute.encode(encoder);
            render.encode(encoder, webgpu.canvasContext.getCurrentTexture().createView());
            const commandBuffer = encoder.finish();
            webgpu.device.queue.submit([commandBuffer]);
        }
    };
    setupDebouncedTextarea(inputArea, (val) => {
        run(val);
    }, 100);
    run(inputArea.textContent); // called once here to render the initial textarea value 
})();
