import type { Camera } from "../resources/camera";
import EvaluationState2D from "../resources/evaluation-state-2d";
import type EvaluationState3D from "../resources/evaluation-state-3d";
import  { RegionArrays } from "../resources/region-arrays";

import computeShader from '../shaders/compute-3d.wgsl?raw';

export class Compute3D {
    // Initial (first 2) makes subintervals for further evaluation, final pass does not
    pipelines: GPUComputePipeline[];

    private static pipeline(device: GPUDevice, camera: Camera, regionArrays: RegionArrays, evaluationState: EvaluationState2D, outputSubintervals: boolean): GPUComputePipeline {
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
                    code: computeShader
                }),
                constants: {
                    // @ts-ignore
                    output_subinterval: outputSubintervals,
                }
            },
        });
    }

    constructor(device: GPUDevice, camera: Camera, regionArrays: RegionArrays, evaluationState: EvaluationState3D) {
        this.pipelines = [];
        this.pipelines.push(Compute3D.pipeline(device, camera, regionArrays, evaluationState, true));
        this.pipelines.push(Compute3D.pipeline(device, camera, regionArrays, evaluationState, true));
        this.pipelines.push(Compute3D.pipeline(device, camera, regionArrays, evaluationState, false));
    }

    encode(encoder: GPUCommandEncoder, evaluationState: EvaluationState2D, regionArrays: RegionArrays) {
        // First pass
        const pass1 = encoder.beginComputePass({ label: "Compute3D - pass 1" });
        pass1.setPipeline(this.pipelines[0]);
        pass1.setBindGroup(0, evaluationState.compute.bindGroup);
        pass1.setBindGroup(1, regionArrays.inputBindGroups[0]);
        pass1.setBindGroup(2, regionArrays.outputBindGroups[1]);
        pass1.dispatchWorkgroups(1);
        pass1.end();

        // Second pass
        const pass2 = encoder.beginComputePass({ label: "Compute3D - pass 2" });
        pass2.setPipeline(this.pipelines[1]);
        pass2.setBindGroup(0, evaluationState.compute.bindGroup);
        pass2.setBindGroup(1, regionArrays.inputBindGroups[1]);
        pass2.setBindGroup(2, regionArrays.outputBindGroups[2]);
        pass2.dispatchWorkgroupsIndirect(regionArrays.buffers[1], 0);
        pass2.end();

        // Third pass
        const pass3 = encoder.beginComputePass({ label: "Compute3D - pass 3" });
        pass3.setPipeline(this.pipelines[2]);
        pass3.setBindGroup(0, evaluationState.compute.bindGroup);
        pass3.setBindGroup(1, regionArrays.inputBindGroups[2]);
        pass3.setBindGroup(2, regionArrays.outputBindGroups[0]); // wont be modified because of different pipeline
        pass3.dispatchWorkgroupsIndirect(regionArrays.buffers[2], 0);
        pass3.end();
    }
}

export default Compute3D;