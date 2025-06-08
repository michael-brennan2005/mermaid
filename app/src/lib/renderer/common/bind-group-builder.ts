// This class is not immutable! class methods return the object just for api convenience
export class BindGroupBuilder {
    label?: string;

    entries: GPUBindGroupEntry[] = [];
    layout: GPUBindGroupLayoutEntry[] = [];

    constructor(label?: string) {
        this.label = label;
    }

    texture(texture: GPUTexture, visibility: number, sampleType: GPUTextureSampleType): BindGroupBuilder {
        this.entries.push({
            binding: this.entries.length,
            resource: texture.createView(),
        });

        this.layout.push({
            binding: this.layout.length,
            visibility: visibility,
            texture: {
                sampleType: sampleType,
                viewDimension: "2d",
                multisampled: false
            }
        });

        return this;
    }

    storageTexture(texture: GPUTexture, visibility: number, access: GPUStorageTextureAccess): BindGroupBuilder {
        this.entries.push({
            binding: this.entries.length,
            resource: texture.createView(),
        });

        this.layout.push({
            binding: this.layout.length,
            visibility: visibility,
            storageTexture: {
                format: texture.format,
                access: access,
                viewDimension: "2d",
            }
        });

        return this;
    }

    buffer(buffer: GPUBuffer, visibility: number, type: GPUBufferBindingType): BindGroupBuilder {
        this.entries.push({
            binding: this.entries.length,
            resource: {
                buffer: buffer
            },
        });

        this.layout.push({
            binding: this.layout.length,
            visibility: visibility,
            buffer: {
                type: type
            }
        });

        return this;
    }

    build(device: GPUDevice): [GPUBindGroupLayout, GPUBindGroup] {
        const layout = this.buildLayout(device);
        const binding = this.buildBindGroup(device, layout);

        return [layout, binding];
    }

    buildLayout(device: GPUDevice): GPUBindGroupLayout {
        const layout = device.createBindGroupLayout({
            label: this.label ? `BindGroupLayout for ${this.label}` : undefined,
            entries: this.layout
        });

        return layout;
    }

    buildBindGroup(device: GPUDevice, layout: GPUBindGroupLayout): GPUBindGroup {
        const binding = device.createBindGroup({
            label: this.label ? `BindGroup for ${this.label}` : undefined,
            layout: layout,
            entries: this.entries
        });

        return binding;
    }
}