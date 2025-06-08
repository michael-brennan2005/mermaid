import type Camera from '../common/camera';
import type EvaluationState from './evaluation-state';
import type { SurfaceType } from './surface-type';

import utilsShader from './utils.wgsl?raw';
import renderShader3D from '../3d/render.wgsl?raw';
import renderShader2D from '../2d/render.wgsl?raw';

export default class Render {
    surfaceType: SurfaceType;
    pipeline: GPURenderPipeline;
    
    constructor(device: GPUDevice, surfaceType: SurfaceType, canvasFormat: GPUTextureFormat, camera: Camera, evaluationState: EvaluationState ) {
        this.surfaceType = surfaceType;
        
        const shader = device.createShaderModule({
            code: `${utilsShader}\n${surfaceType == "2D" ? renderShader2D : renderShader3D}`
        });

        this.pipeline = device.createRenderPipeline({
            label: `Render${surfaceType} - pipeline`,
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