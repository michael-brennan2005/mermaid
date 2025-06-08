import { BindGroupBuilder } from "./bind-group-builder";
import type { SurfaceType } from "./surface-type";

export default class RegionArrays {
    surfaceType: SurfaceType;

    buffers: GPUBuffer[];
    
    inputBindGroupLayout: GPUBindGroupLayout;
    inputBindGroups: GPUBindGroup[];

    outputBindGroupLayout: GPUBindGroupLayout;
    outputBindGroups: GPUBindGroup[];

    constructor(device: GPUDevice, surfaceType: SurfaceType) {
        this.surfaceType = surfaceType;

        // 2D - 2 intervals, 2 f32s each = 16 bytes
        // 3D - 3 intervals, 2 f32s each = 24 bytes 
        const regionSize = surfaceType == "2D" ? 16 : 24;

        // We use the length of each RegionArray to make the next workgroup dispatch call through
        // .dispatchWorkgroupsIndirect(); hence the 12 bytes since webgpu expects 3 u32s for (x,y,z)
        this.buffers = [
            device.createBuffer({
                label: "RegionArrays - 1st pass input buffer",
                size: 12 + regionSize, // u32 for length, one initial region
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.INDIRECT
            }),
            device.createBuffer({
                label: "RegionArrays - 1st pass output, 2nd pass input buffer",
                size: 12 + regionSize * (surfaceType == "2D" ? (16 * 16) : (6 * 6 * 6)), // u32 for length + worst case # of subintervals to evaluate
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.INDIRECT
            }),
            device.createBuffer({
                label: "RegionArrays - 2nd pass output, 3rd pass input",
                size: 12 + regionSize * Math.pow((surfaceType == "2D" ? (16 * 16) : (6 * 6 * 6)), 2), // u32 for length + worst case # of subintervals to evaluate
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.INDIRECT
            }),
        ];

        this.inputBindGroupLayout = new BindGroupBuilder("RegionArray input")
            .buffer(this.buffers[0], GPUShaderStage.COMPUTE, "read-only-storage")
            .buildLayout(device);
    

        this.outputBindGroupLayout = new BindGroupBuilder("RegionArray input")
            .buffer(this.buffers[0], GPUShaderStage.COMPUTE, "storage")
            .buildLayout(device);

        this.inputBindGroups = [];
        this.outputBindGroups = [];
        
        for (const buffer of this.buffers) {
            this.inputBindGroups.push(
                new BindGroupBuilder(`RegionArray input for ${buffer.label}`)
                    .buffer(buffer, GPUShaderStage.COMPUTE, "read-only-storage")
                    .buildBindGroup(device, this.inputBindGroupLayout));
            
            this.outputBindGroups.push(
                new BindGroupBuilder(`RegionArray output for ${buffer.label}`)
                    .buffer(buffer, GPUShaderStage.COMPUTE, "storage")
                    .buildBindGroup(device, this.outputBindGroupLayout));
            
            device.queue.writeBuffer(buffer, 0, new Uint32Array([1,1,1]), 0, 3);
        }
    }

    setInitialRegion(device: GPUDevice, xMin: number, xMax: number, yMin: number, yMax: number, zMin: number, zMax: number) {
        device.queue.writeBuffer(this.buffers[0], 0, new Uint32Array([1,1,1]), 0, 3);
        device.queue.writeBuffer(this.buffers[0], 12, new Float32Array([xMin, xMax, yMin, yMax]), 0, 4);
        
        if (this.surfaceType == "3D") {
            device.queue.writeBuffer(this.buffers[0], 28, new Float32Array([zMin, zMax]), 0, 2);    
        }
    }

    clearArrays(device: GPUDevice) {
        for (const buffer of this.buffers) {
            device.queue.writeBuffer(buffer, 0, new Uint32Array([0,1,1]), 0, 3);
        }
    }
}