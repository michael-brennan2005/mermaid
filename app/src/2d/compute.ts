import type { Renderer } from "./renderer";
import { buffer, computePipeline, shader, type BindGroupManager, type BindGroupTemplate } from "./resources";

// @ts-ignore
import computeShaderOutput from '../shaders/compute2d.wgsl OUTPUT_SUBINTERVALS ?static';
// @ts-ignore
import computeShaderNoOutput from '../shaders/compute2d.wgsl?static';
import type { Mat3 } from "wgpu-matrix";

// Responsible for running the interval evaluation and rendering.
export class Compute {
    private device: GPUDevice;
    private bgm: BindGroupManager;

    // Output means write ambiguous subintervals to region array, no output means do not.
    private pipelineOutput: GPUComputePipeline;
    private pipelineNoOutput: GPUComputePipeline;

    private resources: {
        // 1 3x3 matrix to map texel space -> eval space
        transform: GPUBuffer;
        // Tape to be evaluated - 4 bytes for type length then remaining space for instructions
        tape: GPUBuffer;
        // Region arrays to read and write from. These buffers have a 12 byte 'header' so they can
        // be used for indirect workgroup dispatch calls, then the remaining space is used for
        // storing regions (4 f32's for [x1, y1], and [x2, y2]).
        regionArrays: GPUBuffer[];
    }

    // State common to all compute dispatches - the tape buffer and transform buffer
    commonBindGroupTemplate: BindGroupTemplate;
    commonBindGroup: GPUBindGroup;

    // These hold the input and output regions for each compute dispatch -
    // How this is organized: say there are 3 region arrays, then the bind groups will be:
    // [RA[0], RA[1]], [RA[1], RA[2]], [RA[2], RA[3]]
    // The first region array in each list will be the input, and the second region array will be
    // the output. 
    regionBindGroupTemplate: BindGroupTemplate;
    regionBindGroups: GPUBindGroup[] = [];

    private WORKGROUP_SIZE = 16; // assumed to be equal for X and Y
    private LEVELS = 3; // how many dispatchWorkgroups to ultimately call, and thus resolution of final render
    private MAX_INSTS = 100000; // max number of instructions for tape
    
    constructor(device: GPUDevice, bgm: BindGroupManager, renderer: Renderer) {
        this.device = device;
        this.bgm = bgm;

        this.resources = {
            transform: buffer(device, { size: 4 * 4 * 3 }), // one mat3x3<f32> (which are 12 floats in wgpu for padding reasons),
            tape: buffer(device, { size: 4 + (this.MAX_INSTS * 8)}), // 4 bytes for tape length, rest for instructions 
            regionArrays: Array.from({ length: this.LEVELS }, (val, idx) => {
                const regionSize = 4 * 4; // region is 4 f32s

                // Each array has 12 bytes at start for indirect dispatch calls
                // Initial region array always has just 1 region
                // We allocate for worst case - all of the previous regions subintervals evaluated 
                // to ambiguous.
                // len(worst_case_regions(gen 0)) = 1
                // len(worst_case_regions(gen 1)) = len(worst_case_regions(gen(0))) * (WORKGROUP_SIZE^2)
                // len(worst_case_regions(gen 2)) = len(worst_case_regions(gen(1))) * (WORKGROUP_SIZE^2)
                // len(worst_case_regions(gen n)) = WORKGROUP_SIZE^(2n)
                return buffer(device, { 
                    size: 12 + (Math.pow(this.WORKGROUP_SIZE, 2 * idx)) * regionSize,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE
                });
            })
        }

        this.commonBindGroupTemplate = bgm.createTemplate({
            0: {
                type: "read-only-storage",
            },
            1: {
                type: "uniform-buffer",
            }
        });

        this.commonBindGroup = bgm.bind(this.commonBindGroupTemplate, {
            0: this.resources.tape,
            1: this.resources.transform
        });

        this.regionBindGroupTemplate = bgm.createTemplate({
            0: {
                type: "read-only-storage",
            },
            1: {
                type: "storage",
            }
        });

        for (let i = 0; i < this.LEVELS; i += 1) {
            this.regionBindGroups.push(bgm.bind(
                this.regionBindGroupTemplate,
                {
                    0: this.resources.regionArrays[i],
                    // For the last compute dispatch, this buffer will be our first region array
                    // (which holds just 1 region). however, the pipeline will be set to not output
                    // subintervals, so we won't run into any issues.
                    1: this.resources.regionArrays[(i + 1) % this.LEVELS]
                }
            ))
        }

        this.pipelineOutput = computePipeline(device, { 
            shader: shader(device, { source: computeShaderOutput }),
            layouts: [
                bgm.getLayout(renderer.outputBindGroupTemplateWrite),
                bgm.getLayout(this.commonBindGroupTemplate),
                bgm.getLayout(this.regionBindGroupTemplate)
            ] 
        });

        this.pipelineNoOutput = computePipeline(device, { 
            shader: shader(device, { source: computeShaderNoOutput }),
            layouts: [
                bgm.getLayout(renderer.outputBindGroupTemplateWrite),
                bgm.getLayout(this.commonBindGroupTemplate),
                bgm.getLayout(this.regionBindGroupTemplate)
            ] 
        });

    }

    do(outputTexture: GPUBindGroup, outputSize: [number, number], encoder: GPUCommandEncoder) {
        // Set the initial region - which is always just the size of the output texture
        this.device.queue.writeBuffer(
            this.resources.regionArrays[0],
            12, // write after indirect dispatch numbers
            new Float32Array([0.0, outputSize[0], 0.0, outputSize[1]]),
            0,
            4
        );

        for (let i = 0; i < this.LEVELS; i += 1) {
            this.device.queue.writeBuffer(
                this.resources.regionArrays[i],
                0,
                new Uint32Array([i == 0 ? 1 : 0,1,1]),
                0,
                3
            );
        }
        

        const pass = encoder.beginComputePass({});

        for (let i = 0; i < 1/**this.LEVELS**/; i += 1) {
            // All the passes except the last one will output subintervals to be further evaluated
            if (i < (this.LEVELS - 1)) {
                pass.setPipeline(this.pipelineOutput);
            } else {
                pass.setPipeline(this.pipelineNoOutput);
            }

            pass.setBindGroup(0, outputTexture);
            pass.setBindGroup(1, this.commonBindGroup);
            pass.setBindGroup(2, this.regionBindGroups[i]);
            
            // Use the first 12 bytes of each region array buffer to indirect dispatch
            pass.dispatchWorkgroupsIndirect(this.resources.regionArrays[i], 0);
        }
        
        pass.end();
    }

    setTape(tape: Uint8Array) {
        const tapeLength = tape.length / 8;

        // console.log('About to write:', {
        //     bufferLabel: this.tapeBuffer.label,
        //     bufferSize: this.tapeBuffer.size,
        //     dataLength: buffer.length,
        //     dataOffset: buffer.byteOffset,
        //     firstBytes: Array.from(buffer.slice(0, 4))
        // });

        // console.log(`New tape length: ${tapeLength}`);

        this.device.queue.writeBuffer(
            this.resources.tape, 0, new Uint32Array([tapeLength]), 0, 1);
        this.device.queue.writeBuffer(
            this.resources.tape, 4, tape.buffer, tape.byteOffset, tape.length);
    }

    setTransform(mat: Mat3) {
        this.device.queue.writeBuffer(
            this.resources.transform, 0, mat.buffer, mat.byteOffset, mat.length);
    }
}