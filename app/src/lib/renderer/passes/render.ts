import EvaluationState from "../resources/evaluation-state";
import Camera from "../resources/camera";

import renderShader from '../shaders/render.wgsl?raw';

export class Render2D {
    pipeline: GPURenderPipeline;
    
    constructor(device: GPUDevice, canvasFormat: GPUTextureFormat, camera: Camera, evaluationState: EvaluationState) {
        const shader = device.createShaderModule({
            code: renderShader
        });

        this.pipeline = device.createRenderPipeline({
            label: "Render2D - pipeline",
            layout: device.createPipelineLayout({
                bindGroupLayouts: [
                    evaluationState.render.bindGroupLayout, 
                    camera.bindGroupLayout]
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
                        format: canvasFormat
                    }
                ]
            },
            primitive: {
                topology: "triangle-list"
            }
        });
    }

    encode(encoder: GPUCommandEncoder, output: GPUTextureView, camera: Camera, evaluationState: EvaluationState) {
        const renderPass = encoder.beginRenderPass({
            colorAttachments: [
                {
                    view: output,
                    clearValue: { r: 1, g: 0, b: 0, a: 1 },
                    loadOp: "clear",
                    storeOp: "store"
                }
            ]
        });

        renderPass.setPipeline(this.pipeline);

        renderPass.setBindGroup(0, evaluationState.render.bindGroup);
        renderPass.setBindGroup(1, camera.bindGroup);

        renderPass.draw(6, 1, 0, 0); // Draw 2 triangles (6 vertices) for the quad
        renderPass.end();
    }
}