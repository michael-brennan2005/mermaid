import type RegionArrays from '../common/region-arrays';
import computeShader from './compute.wgsl?raw';
import type EvaluationState from './evaluation-state';

export default class Compute {
    // Initial (first 2) makes subintervals for further evaluation, final pass does not
    pipelines: GPUComputePipeline[];

    private static pipeline(device: GPUDevice, regionArrays: RegionArrays, evaluationState: EvaluationState, outputSubintervals: boolean, fillR: number, fillG: number, fillB: number): GPUComputePipeline {
        return device.createComputePipeline({
            label: "Compute2D - pipeline",
            layout: device.createPipelineLayout({
                bindGroupLayouts: [
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
                    fill_r: fillR,
                    fill_g: fillG,
                    fill_b: fillB
                }
            },
        });
    }

    constructor(device: GPUDevice, regionArrays: RegionArrays, evaluationState: EvaluationState) {
        this.pipelines = [];
        this.pipelines.push(Compute.pipeline(device, regionArrays, evaluationState, true, 1.0, 1.0, 1.0));
        this.pipelines.push(Compute.pipeline(device, regionArrays, evaluationState, true, 1.0, 1.0, 1.0));
        this.pipelines.push(Compute.pipeline(device, regionArrays, evaluationState, false, 1.0, 1.0, 1.0));
    }

    encode(encoder: GPUCommandEncoder, evaluationState: EvaluationState, regionArrays: RegionArrays) {
        // First pass
        const pass1 = encoder.beginComputePass({ label: "Compute2D - pass 1" });
        pass1.setPipeline(this.pipelines[0]);
        pass1.setBindGroup(0, evaluationState.compute.bindGroup);
        pass1.setBindGroup(1, regionArrays.inputBindGroups[0]);
        pass1.setBindGroup(2, regionArrays.outputBindGroups[1]);
        pass1.dispatchWorkgroups(1);
        pass1.end();

        // Second pass
        const pass2 = encoder.beginComputePass({ label: "Compute2D - pass 2" });
        pass2.setPipeline(this.pipelines[1]);
        pass2.setBindGroup(0, evaluationState.compute.bindGroup);
        pass2.setBindGroup(1, regionArrays.inputBindGroups[1]);
        pass2.setBindGroup(2, regionArrays.outputBindGroups[2]);
        pass2.dispatchWorkgroupsIndirect(regionArrays.buffers[1], 0);
        pass2.end();

        // Third pass
        const pass3 = encoder.beginComputePass({ label: "Compute2D - pass 3" });
        pass3.setPipeline(this.pipelines[2]);
        pass3.setBindGroup(0, evaluationState.compute.bindGroup);
        pass3.setBindGroup(1, regionArrays.inputBindGroups[2]);
        pass3.setBindGroup(2, regionArrays.outputBindGroups[0]); // wont be modified because of different pipeline
        pass3.dispatchWorkgroupsIndirect(regionArrays.buffers[2], 0);
        pass3.end();
    }
}