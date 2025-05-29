"use strict";
let wasmInstance;
const wasmMemory = new WebAssembly.Memory({ initial: 17, maximum: 1024 });
function freeSpan(span) {
    // @ts-ignore
    wasmInstance.exports.free(span.ptr);
}
function wasmString(string) {
    const encoder = new TextEncoder();
    const stringBytes = encoder.encode(string);
    // @ts-ignore
    const ptr = wasmInstance.exports.allocate(stringBytes.length + 1);
    new Uint8Array(wasmMemory.buffer, ptr, stringBytes.length).set(stringBytes);
    new Uint8Array(wasmMemory.buffer, ptr + stringBytes.length, 1)[0] = 0;
    return {
        ptr: ptr,
        len: stringBytes.length + 1
    };
}
function log(addr, len) {
    const view = new DataView(wasmMemory.buffer, addr, len);
    const str = new TextDecoder().decode(view);
    console.log(str);
}
function logPanic(addr, len) {
    console.log("Panic from WASM Module VVVVVV");
    log(addr, len);
}
const outputImageWidth = 1024;
const outputImageHeight = 1024;
const outputImageScale = (1024 / 64);
(() => {
    const $ = (selector) => document.querySelector(selector);
    const env = {
        __stack_pointer: 0,
        memory: wasmMemory,
        consoleLog: log,
    };
    async function init() {
        try {
            let source = await WebAssembly.instantiateStreaming(fetch('teddy.wasm'), { env: env });
            wasmInstance = source.instance;
            console.log("WASM module loaded");
            return {
                wasmTest: wasmInstance.exports.wasmTest,
                wasmTest2: wasmInstance.exports.wasmTest2,
                compile: wasmInstance.exports.compile,
            };
        }
        catch (e) {
            console.error(`WASM loading failed: ${e.message}`);
        }
    }
    init().then(async (wasm) => {
        // MARK: frontend compilation to instructions
        const expr = "0 - 1.0";
        const startTime = performance.now(); // Record the start time
        const str = wasmString(expr);
        const endTime = performance.now(); // Record the end time
        console.log(`wasmString("${expr}") took ${(endTime - startTime)} ms`);
        // @ts-ignore
        let addr = wasm.compile(str.ptr, str.len - 1);
        console.log(`Now on JS side - ptr is: ${addr}`);
        const debugging = new Uint8Array(wasmMemory.buffer, addr, 4 + (6 * 8));
        console.log(`JS SIDE: data is ${debugging}`);
        const encodedNumber = new DataView(wasmMemory.buffer, addr, 4).getUint32(0, true); // true for little-endian, match Zig's default
        console.log(`Decoded u32 from WASM memory - # of insts: ${encodedNumber}`);
        const tapeData = new DataView(wasmMemory.buffer, (addr + 4), encodedNumber * 8); // each instruction is 8 bytes
        for (let i = 0; i < encodedNumber; i += 1) {
            const start = i * 8;
            console.log(`Opcode: ${tapeData.getUint8(start + 3)}, Output: ${tapeData.getUint8(start + 2)}, Input1: ${tapeData.getUint8(start + 1)}, Input2: ${tapeData.getUint8(start + 0)}, Floating Point: ${tapeData.getFloat32(start + 4, true)}`);
        }
        // MARK: webgpu initialization
        if (!navigator.gpu)
            throw Error("WebGPU not supported");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter)
            throw Error("Couldn't get WebGPU adapater");
        const device = await adapter.requestDevice();
        device.lost.then(() => {
            throw Error("WebGPU logical deviceddd was lost");
        });
        const canvas = $("canvas");
        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
        console.log(canvasFormat);
        const context = canvas.getContext('webgpu');
        context.configure({
            device,
            format: navigator.gpu.getPreferredCanvasFormat()
        });
        console.log("WebGPU stuff initialized");
        // MARK: resource creation
        const tapeBuffer = device.createBuffer({
            label: "Tape buffer",
            size: encodedNumber * 8,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        // Print out the contents of tapeData.buffer for debugging purposes
        // We'll create a Uint8Array view to print the raw bytes in a readable format
        const tapeBytes = new Uint8Array(tapeData.buffer, tapeData.byteOffset, tapeData.byteLength);
        console.log("Raw tapeData.buffer bytes:", Array.from(tapeBytes));
        device.queue.writeBuffer(tapeBuffer, 0, tapeBytes, 0, encodedNumber * 8);
        const outputTexture = device.createTexture({
            label: "Output texture",
            size: [outputImageWidth, outputImageHeight],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
        });
        // MARK: pipeline, bindgroup, sahder creation
        const shader = await fetch("shader.wgsl");
        const shaderSource = await shader.text();
        const computeBindGroupLayout = device.createBindGroupLayout({
            label: "Compute bind group layout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "read-only-storage"
                    }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    storageTexture: {
                        format: "rgba8unorm",
                        access: "write-only",
                        viewDimension: "2d"
                    }
                }
            ]
        });
        const computeBindGroup = device.createBindGroup({
            label: "Compute bind group",
            layout: computeBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: tapeBuffer
                    }
                },
                {
                    binding: 1,
                    resource: outputTexture.createView({
                        dimension: "2d",
                    })
                }
            ]
        });
        const computePipeline = device.createComputePipeline({
            label: "Compute pipeline",
            layout: device.createPipelineLayout({
                bindGroupLayouts: [computeBindGroupLayout]
            }),
            compute: {
                module: device.createShaderModule({
                    code: shaderSource
                })
            },
        });
        const renderPipeline = device.createRenderPipeline({
            label: "Blit pipeline",
            layout: "auto",
            vertex: {
                module: device.createShaderModule({
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
                module: device.createShaderModule({
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
                        format: navigator.gpu.getPreferredCanvasFormat()
                    }
                ]
            },
            primitive: {
                topology: "triangle-list"
            }
        });
        // Create a bind group for the render pipeline
        const renderBindGroup = device.createBindGroup({
            layout: renderPipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: outputTexture.createView()
                }
            ]
        });
        // MARK: pass run
        while (true) {
            console.log("Having a go!");
            const encoder = device.createCommandEncoder({ label: "Compute & render encoder" });
            const computePass = encoder.beginComputePass({ label: "Compute builtin pass " });
            computePass.setPipeline(computePipeline);
            computePass.setBindGroup(0, computeBindGroup);
            computePass.dispatchWorkgroups(64, 64);
            computePass.end();
            const renderPass = encoder.beginRenderPass({
                colorAttachments: [
                    {
                        view: context.getCurrentTexture().createView(),
                        clearValue: { r: 0, g: 0, b: 0, a: 1 },
                        loadOp: "clear",
                        storeOp: "store"
                    }
                ]
            });
            renderPass.setPipeline(renderPipeline);
            renderPass.setBindGroup(0, renderBindGroup);
            renderPass.draw(6, 1, 0, 0); // Draw 2 triangles (6 vertices) for the quad
            renderPass.end();
            const commandBuffer = encoder.finish();
            device.queue.submit([commandBuffer]);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    });
})();
