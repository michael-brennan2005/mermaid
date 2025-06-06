import type { Mat4 } from "wgpu-matrix";

export class Camera {
    buffer: GPUBuffer;
    bindGroup: GPUBindGroup;
    bindGroupLayout: GPUBindGroupLayout;

    constructor(device: GPUDevice) {
        this.buffer = device.createBuffer({
            label: "Camera - buffer",
            // 2 Mat4's - one view, one perspective
            size: (4 * 32),
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
        });

        this.bindGroupLayout = device.createBindGroupLayout({
            label: "Camera - bind group layout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.COMPUTE,
                    buffer: {
                        type: "uniform",
                        hasDynamicOffset: false,
                        minBindingSize: (4 * 32)
                    }
                }
            ]            
        });

        this.bindGroup = device.createBindGroup({
            label: "Camera - bind group",
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

    setViewMatrix(queue: GPUQueue, mat: Mat4) {
        queue.writeBuffer(this.buffer, 0, mat, 0, 16);
    }
    
    setPerspectiveMatrix(queue: GPUQueue, mat: Mat4) {
        queue.writeBuffer(this.buffer, 16 * 4, mat, 0, 16);
    }
}

export default Camera;