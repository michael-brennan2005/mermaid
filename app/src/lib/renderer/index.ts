import { mat4, vec3, type Mat4 } from "wgpu-matrix";
import RegionArrays from "./common/region-arrays";
import EvaluationState from "./common/evaluation-state";
import Compute2D from "./2d/compute";
import Compute3D from "./3d/compute";
import Render from "./common/render";
import type { SurfaceType } from "./common/surface-type";

export class Renderer {
    surfaceType!: SurfaceType;

    device!: GPUDevice;
    canvas!: {
        element: HTMLCanvasElement;
        context: GPUCanvasContext;
        format: GPUTextureFormat;
    }

    regionArrays!: RegionArrays;
    evaluationState!: EvaluationState;

    compute!: { type: "2D", pass: Compute2D } | { type: "3D", pass: Compute3D };
    render!: Render;

    private constructor() { }

    static async init(canvas: HTMLCanvasElement, surfaceType: SurfaceType): Promise<Renderer> {
        if (!navigator.gpu) throw Error("navigator.gpu not found");

        const renderer = new Renderer();
        renderer.surfaceType = surfaceType;

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw Error("Couldn't get WebGPU adapater");

        renderer.device = await adapter.requestDevice();
        renderer.device.lost.then(() => {
            throw Error("WebGPU logical device was lost")
        });

        renderer.canvas = {
            element: canvas,
            context: canvas.getContext('webgpu')!,
            format: navigator.gpu.getPreferredCanvasFormat()
        };
        
        renderer.canvas.context.configure({
            device: renderer.device,
            format: renderer.canvas.format,
        });
        
        renderer.regionArrays = new RegionArrays(renderer.device, surfaceType);
        renderer.evaluationState = new EvaluationState(renderer.device, surfaceType, renderer.canvas.element);

        if (surfaceType == "2D") {
            renderer.compute = { type: "2D", pass: new Compute2D(renderer.device, renderer.regionArrays, renderer.evaluationState) };
        } else {
            renderer.compute = { type: "3D", pass: new Compute3D(renderer.device, renderer.regionArrays, renderer.evaluationState) };
        }

        renderer.render = new Render(renderer.device, surfaceType, renderer.canvas.format, renderer.evaluationState);

        return renderer;
    }

    setTape(buffer: Uint8Array) {
        this.evaluationState.setTape(this.device, buffer);
    }

    evaluateAndRender(width: number, height: number) {
        this.regionArrays.clearArrays(this.device);

        if (this.surfaceType == "2D") {
            this.regionArrays.setInitialRegion(this.device, 0.0, width, 0.0, height, 0.0, 0.0);
        } else {
            this.regionArrays.setInitialRegion(this.device, -16.0, 16.0, -16.0, 16.0, -16.0, 16.0);
        }

        const encoder = this.device.createCommandEncoder({
            label: "Renderer - evaluate command encoder"
        });

        if (this.compute.type == "2D") {
            this.compute.pass.encode(
                encoder,
                this.evaluationState,
                this.regionArrays
            );
        } else {
            this.compute.pass.encode(
                encoder,
                this.evaluationState,
                this.regionArrays
            );
        }

        this.render.encode(
            encoder,
            this.canvas.context.getCurrentTexture().createView({}),
            this.evaluationState
        );

        const cmds = encoder.finish({
            label: "Renderer - evaluate command buffer"
        });

        this.device.queue.submit([cmds]);
    }

    set3DTransform(perspective: Mat4, view: Mat4) {
        this.evaluationState.set3DTransform(this.device, perspective, view);
    }

    set2DTransform(scale: number, x: number, y: number) {
        this.evaluationState.set2DTransform(this.device, scale, x, y);
    }

    resizeOutputTexture(width: number, height: number) {
        this.evaluationState.resizeTexture(this.device, width, height);
    }
}

export default Renderer;