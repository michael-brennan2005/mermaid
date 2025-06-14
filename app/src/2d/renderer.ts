import { BindGroupManager, renderPipeline, shader, texture, type BindGroupTemplate } from "./resources";
// @ts-ignore
import blitShader from "../shaders/blit.wgsl?static";

// The main API for rendering & manager for gpu state. 
export class Renderer {
    private device: GPUDevice;
    private bgm: BindGroupManager;

    private canvas: {
        element: HTMLCanvasElement;
        context: GPUCanvasContext;
        format: GPUTextureFormat;
    }

    private outputTexture: GPUTexture | undefined;
    outputFormat: GPUTextureFormat = "rgba8unorm";

    // rgba8unorm is not read-write supported :(
    outputBindGroupTemplateRead!: BindGroupTemplate;
    private outputBindGroupRead!: GPUBindGroup;

    outputBindGroupTemplateWrite!: BindGroupTemplate;
    private outputBindGroupWrite!: GPUBindGroup;
    
    blitPipeline: GPURenderPipeline;

    constructor(device: GPUDevice, bgm: BindGroupManager, canvas: HTMLCanvasElement) {
        this.device = device;
        this.bgm = bgm;

        this.canvas = {
            element: canvas,
            context: canvas.getContext('webgpu')!,
            format: navigator.gpu.getPreferredCanvasFormat()
        };

        const resizeObserver = new ResizeObserver(() => {
            const rect = canvas.getBoundingClientRect();

            // Set canvas internal resolution to match DOM size
            this.canvas.element.width = rect.width;
            this.canvas.element.height = rect.height;

            console.log(`New canvas width ${this.canvas.element.width} x ${this.canvas.element.height}`);
            this.createOutputTexture(this.canvas.element.width, this.canvas.element.height)
        });
        resizeObserver.observe(this.canvas.element);

        this.canvas.context.configure({
            device: this.device,
            format: this.outputFormat,
        });

        this.createOutputTexture(this.canvas.element.width, this.canvas.element.height);

        // Use the read-access bind group template for the blit pipeline
        this.blitPipeline = renderPipeline(this.device, {
            shader: shader(this.device, { source: blitShader }),
            canvasFormat: this.outputFormat,
            layouts: [this.bgm.getLayout(this.outputBindGroupTemplateRead)]
        });
    }

    createOutputTexture(width: number, height: number) {
        if (this.outputTexture !== undefined) {
            this.outputTexture.destroy();
        }

        this.outputTexture = texture(this.device, { size: [this.canvas.element.width, this.canvas.element.height], format: this.outputFormat });

        this.outputBindGroupTemplateWrite = this.bgm.createTemplate({
            0: {
                type: "storage-texture",
                access: "write",
                format: this.outputFormat,
            }
        });
        this.outputBindGroupWrite = this.bgm.bind(this.outputBindGroupTemplateWrite, {
            0: this.outputTexture!.createView({})
        });

        this.outputBindGroupTemplateRead = this.bgm.createTemplate({
            0: {
                type: "storage-texture",
                access: "read",
                format: this.outputFormat,
            }
        });
        this.outputBindGroupRead = this.bgm.bind(this.outputBindGroupTemplateRead, {
            0: this.outputTexture!.createView({})
        });
    }

    // The bind group contains a single binding at entry 0 containing the storage texture. 
    // Pass the write-access bind group to the callback, and use the read-access bind group for blitting
    tick(cb: (texture: GPUBindGroup, textureSize: [number, number], encoder: GPUCommandEncoder) => void) {
        if (!this.outputTexture) {
            return;
        }

        const encoder = this.device.createCommandEncoder({ label: "Renderer - tick() encoder" });

        // Update the (internal) output texture using the write-access bind group
        cb(this.outputBindGroupWrite, [this.outputTexture.width, this.outputTexture.height], encoder);

        // Blit to (canvas) output texture using the read-access bind group
        const canvasTexture = this.canvas.context.getCurrentTexture();
        
        const renderPass = encoder.beginRenderPass({
            colorAttachments: [{
                view: canvasTexture.createView(),
                loadOp: 'clear',
                storeOp: 'store'
            }]
        });
        
        renderPass.setPipeline(this.blitPipeline);
        renderPass.setBindGroup(0, this.outputBindGroupRead);
        renderPass.draw(3);
        renderPass.end();

        const cmds = encoder.finish({});
        this.device.queue.submit([cmds]);
    }
}