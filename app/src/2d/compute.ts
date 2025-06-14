import type { Renderer } from "./renderer";
import { computePipeline, shader, type BindGroupManager } from "./resources";

// @ts-ignore
import computeShader from '../shaders/compute2d.wgsl?static';

// Responsible for running the interval evaluation and rendering.
export class Compute {
    pipeline: GPUComputePipeline;

    constructor(device: GPUDevice, bgm: BindGroupManager, renderer: Renderer) {
        this.pipeline = computePipeline(device, { 
            shader: shader(device, { source: computeShader }),
            layouts: [
                bgm.getLayout(renderer.outputBindGroupTemplateWrite)
            ] 
        });
    }

    do(outputTexture: GPUBindGroup, outputSize: [number, number], encoder: GPUCommandEncoder) {
        const pass = encoder.beginComputePass({});

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, outputTexture);
        
        const x = outputSize[0] / 8;
        const y = outputSize[1] / 8;

        pass.dispatchWorkgroups(x,y);
        pass.end();
    }
}