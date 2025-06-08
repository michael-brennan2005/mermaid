import type { Camera } from "../common/camera";
import RegionArrays from "../common/region-arrays";

import computeShader from './compute.wgsl?raw';
import utilsShader from '../common/utils.wgsl?raw';
import intervalsShader from '../common/intervals.wgsl?raw';

import EvaluationState from "../common/evaluation-state";

export default class Compute {
    // Initial (first 2) makes subintervals for further evaluation, final pass does not
    pipelines: GPUComputePipeline[];

    private static pipeline(device: GPUDevice, camera: Camera, regionArrays: RegionArrays, evaluationState: EvaluationState, outputSubintervals: boolean): GPUComputePipeline {
        return device.createComputePipeline({
            label: "Compute3D - pipeline",
            layout: device.createPipelineLayout({
                bindGroupLayouts: [
                    camera.bindGroupLayout,
                    evaluationState.compute.bindGroupLayout,
                    regionArrays.inputBindGroupLayout,
                    regionArrays.outputBindGroupLayout
                ]
            }),
            compute: {
                module: device.createShaderModule({
                    code: `${utilsShader}\n${intervalsShader}\n${computeShader}`
                }),
                constants: {
                    // @ts-ignore
                    output_subinterval: outputSubintervals,
                }
            },
        });
    }

    constructor(device: GPUDevice, camera: Camera, regionArrays: RegionArrays, evaluationState: EvaluationState) {
        if (evaluationState.surfaceType === "2D") {
            throw Error("Passed in 2D evalulation state to Compute3D pass");
        }

        this.pipelines = [];
        this.pipelines.push(Compute.pipeline(device, camera, regionArrays, evaluationState, true));
        this.pipelines.push(Compute.pipeline(device, camera, regionArrays, evaluationState, true));
        this.pipelines.push(Compute.pipeline(device, camera, regionArrays, evaluationState, false));
    }

    encode(encoder: GPUCommandEncoder, camera: Camera, evaluationState: EvaluationState, regionArrays: RegionArrays) {
        // First pass
        const pass1 = encoder.beginComputePass({ label: "Compute3D - pass 1" });
        pass1.setPipeline(this.pipelines[0]);
        pass1.setBindGroup(0, camera.bindGroup);
        pass1.setBindGroup(1, evaluationState.compute.bindGroup);
        pass1.setBindGroup(2, regionArrays.inputBindGroups[0]);
        pass1.setBindGroup(3, regionArrays.outputBindGroups[1]);
        pass1.dispatchWorkgroups(1);
        pass1.end();

        // Second pass
        const pass2 = encoder.beginComputePass({ label: "Compute3D - pass 2" });
        pass2.setPipeline(this.pipelines[1]);
        pass2.setBindGroup(0, camera.bindGroup);
        pass2.setBindGroup(1, evaluationState.compute.bindGroup);
        pass2.setBindGroup(2, regionArrays.inputBindGroups[1]);
        pass2.setBindGroup(3, regionArrays.outputBindGroups[2]);
        pass2.dispatchWorkgroupsIndirect(regionArrays.buffers[1], 0);
        pass2.end();

        // Third pass
        const pass3 = encoder.beginComputePass({ label: "Compute3D - pass 3" });
        pass3.setPipeline(this.pipelines[2]);
        pass3.setBindGroup(0, camera.bindGroup);
        pass3.setBindGroup(1, evaluationState.compute.bindGroup);
        pass3.setBindGroup(2, regionArrays.inputBindGroups[2]);
        pass3.setBindGroup(3, regionArrays.outputBindGroups[0]); // wont be modified because of different pipeline
        pass3.dispatchWorkgroupsIndirect(regionArrays.buffers[2], 0);
        pass3.end();

        encoder.copyBufferToTexture(
            {
                buffer: evaluationState.outputLocksBuffer!,
                offset: 0,
                bytesPerRow: 1024 * 4, // width in pixels * 4 bytes per pixel
                rowsPerImage: 1024
            },
            {
                texture: evaluationState.outputTexture,
                mipLevel: 0,
                origin: { x: 0, y: 0, z: 0 }
            },
            {
                width: 1024,
                height: 1024,
                depthOrArrayLayers: 1
            }
        );
    }
}
