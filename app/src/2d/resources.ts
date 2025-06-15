// Abstractions over WebGPU resource creation.
export const DEFAULT_TEXTURE_FORMAT = "rgba8unorm";

export interface BindGroupTemplate {
    [binding: number]: {
        type: 'storage-texture' | 'uniform-buffer' | 'read-only-storage' | 'storage' | 'sampled-texture' | 'sampler';
        access?: 'read' | 'write' | 'read-write';
        format?: string;
        visibility?: GPUShaderStage;
    };
}

// This should not be instantiated but rather accessed through the Renderer object.
export class BindGroupManager {
    private device: GPUDevice;
    private templateCache = new Map<string, GPUBindGroupLayout>();

    constructor(device: GPUDevice) {
        this.device = device;
    }

    createTemplate(template: BindGroupTemplate): BindGroupTemplate {
        const key = JSON.stringify(template);

        if (!this.templateCache.has(key)) {
            const entries = Object.entries(template).map(([binding, desc]) => ({
                binding: parseInt(binding),
                visibility: desc.visibility || (GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT),
                ...this.getBindingType(desc)
            }));

            const layout = this.device.createBindGroupLayout({ entries });
            this.templateCache.set(key, layout);
        }

        return template; // Return template for type safety
    }

    bind<T extends BindGroupTemplate>(
        template: T,
        resources: { [K in keyof T]: GPUTextureView | GPUBuffer | GPUSampler }
    ): GPUBindGroup {
        const key = JSON.stringify(template);
        const layout = this.templateCache.get(key)!;

        const entries = Object.entries(resources).map(([binding, resource]) => {
            const bindingNum = parseInt(binding);
            const templateEntry = template[bindingNum];
            
            let bindingResource: GPUBindingResource;
            
            // Check if this is a buffer type and wrap accordingly
            if (templateEntry.type === 'uniform-buffer' || 
                templateEntry.type === 'storage' || 
                templateEntry.type === 'read-only-storage') {
                bindingResource = { buffer: resource as GPUBuffer };
            } else {
                bindingResource = resource as GPUBindingResource;
            }

            return {
                binding: bindingNum,
                resource: bindingResource
            };
        });

        return this.device.createBindGroup({ layout, entries });
    }

    getLayout(template: BindGroupTemplate): GPUBindGroupLayout {
        const key = JSON.stringify(template);
        return this.templateCache.get(key)!;
    }

    private getBindingType(desc: any): Partial<GPUBindGroupLayoutEntry> {
        switch (desc.type) {
            case 'storage-texture':
                let access: GPUStorageTextureAccess;
                switch (desc.access) {
                    case 'read':
                        access = 'read-only';
                        break;
                    case 'write':
                        access = 'write-only';
                        break;
                    case 'read-write':
                        access = 'read-write';
                        break;
                    default:
                        access = 'write-only'; // default
                }

                return {
                    storageTexture: {
                        access,
                        format: desc.format || DEFAULT_TEXTURE_FORMAT
                    }
                };
            case 'uniform-buffer':
                return { buffer: { type: 'uniform' } };
            case 'storage':
                return { buffer: { type: 'storage' } };
            case 'read-only-storage':
                return { buffer: { type: 'read-only-storage' } };
            case 'sampled-texture':
                return { texture: {} };
            case 'sampler':
                return { sampler: {} };
            default:
                throw new Error(`Unknown binding type ${desc.type}`);
        }
    }
}

// Helper method to make declaring buffers more concise.
export function buffer(device: GPUDevice, params: { size: number, label?: string, usage?: number }): GPUBuffer {
    return device.createBuffer({
        size: params.size,
        usage: params.usage || (GPUBufferUsage.UNIFORM | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST),
        label: params.label
    });
}

// Helper method to make declaring textures more concise.
export function texture(device: GPUDevice, params: { size: [number, number], format: GPUTextureFormat, label?: string, usage?: number}): GPUTexture {
    return device.createTexture({
        size: params.size,
        format: params.format,
        usage: params.usage || (GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING),
        label: params.label
    });
}

// Helper method to make declaring shaders more concise. Will concatenate all the sources together (redneck imports).
export function shader(device: GPUDevice, params: { source: string, label?: string }): GPUShaderModule {
    return device.createShaderModule({
        label: params.label,
        code: params.source,
    });
}

// Helper method to make declaring compute pipelines more concise.
export function computePipeline(device: GPUDevice, params: { shader: GPUShaderModule, layouts: Iterable<GPUBindGroupLayout>, label?: string }): GPUComputePipeline {
    return device.createComputePipeline({
        label: params.label,
        layout: device.createPipelineLayout({
            bindGroupLayouts: params.layouts
        }),
        compute: {
            module: params.shader,
            entryPoint: "main"
        }
    });
}

// Helper method to make declaring render pipelines more concise.
export function renderPipeline(device: GPUDevice, params: { shader: GPUShaderModule, layouts: Iterable<GPUBindGroupLayout>, canvasFormat: GPUTextureFormat, label?: string }): GPURenderPipeline {
    return device.createRenderPipeline({
        label: params.label,
        layout: device.createPipelineLayout({
            bindGroupLayouts: params.layouts
        }),
        vertex: {
            module: params.shader,
            entryPoint: "vs_main"
        },
        fragment: {
            module: params.shader,
            entryPoint: "fs_main",
            targets: [
                {
                    format: params.canvasFormat
                }
            ]
        },
        primitive: {
            topology: "triangle-list"
        }
    });
}