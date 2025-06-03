import { mat4, mat4d, type Mat4, type Mat4d } from "wgpu-matrix";
import type { WebGPUState } from "./webgpu";

import renderShader from './render.wgsl?raw';

export class Camera {
    buffer: GPUBuffer;
    bindGroup: GPUBindGroup;
    bindGroupLayout: GPUBindGroupLayout;

    constructor(gpu: WebGPUState) {
        this.buffer = gpu.device.createBuffer({
            // 2 Mat4's - one view, one perspective
            size: (4 * 32),
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
        });

        this.bindGroupLayout = gpu.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: "uniform",
                        hasDynamicOffset: false,
                        minBindingSize: (4 * 32)
                    }
                }
            ]            
        });

        this.bindGroup = gpu.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.buffer
                    }
                }
            ]
        });
    }

    setViewMatrix(gpu: WebGPUState, mat: Mat4) {
        gpu.device.queue.writeBuffer(this.buffer, 0, mat, 0, 16);
    }
    
    setPerspectiveMatrix(gpu: WebGPUState, mat: Mat4) {
        gpu.device.queue.writeBuffer(this.buffer, 16 * 4, mat, 0, 16);
    }
}

export class RenderPipeline {
    pipeline: GPURenderPipeline;
    bindGroup: GPUBindGroup;
    bindGroupLayout: GPUBindGroupLayout;

    constructor(gpu: WebGPUState, camera: Camera, inputTexture: GPUTexture) {
        this.bindGroupLayout = gpu.device.createBindGroupLayout({
            label: "Render bind group layout - input texture",
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

        this.bindGroup = gpu.device.createBindGroup({
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: inputTexture.createView()
                }
            ]
        });

        const shader = gpu.device.createShaderModule({
            code: renderShader
        });

        this.pipeline = gpu.device.createRenderPipeline({
            label: "Blit pipeline",
            layout: gpu.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroupLayout, camera.bindGroupLayout]
            }),
            vertex: {
                module: shader,
                entryPoint: "vs_main"
            },
            fragment: {
                module: shader,
                entryPoint: "fs_main",
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
    }

    encode(encoder: GPUCommandEncoder, camera: Camera, outputView: GPUTextureView) {
        const renderPass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: outputView,
                    clearValue: { r: 1, g: 0, b: 0, a: 1 },
                    loadOp: "clear",
                    storeOp: "store"
                }
            ]
        });

        renderPass.setPipeline(this.pipeline);
        renderPass.setBindGroup(0, this.bindGroup);
        renderPass.setBindGroup(1, camera.bindGroup);   
        renderPass.draw(6, 1, 0, 0); // Draw 2 triangles (6 vertices) for the quad
        renderPass.end();
    }
}