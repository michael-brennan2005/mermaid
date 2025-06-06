import { mat4, vec3, type Mat4 } from "wgpu-matrix";
import Camera from "./resources/camera";
import { RegionArrays } from "./resources/region-arrays";
import EvaluationState2D from "./resources/evaluation-state-2d";
import Compute2D from "./passes/compute-2d";
import { Render2D } from "./passes/render-2d";
import { render } from "svelte/server";
import type EvaluationState3D from "./resources/evaluation-state-3d";

export type SurfaceType = "3D" | "2D";

export class Renderer {
    device!: GPUDevice;
    canvas!: {
        element: HTMLCanvasElement;
        context: GPUCanvasContext;
        format: GPUTextureFormat;
    }

    camera!: Camera;
    regionArrays!: RegionArrays;
    evaluationState2D!: EvaluationState2D;
    evaluationState3D!: EvaluationState3D;

    compute!: Compute2D;
    render2D!: Render2D;

    private constructor() { }

    static async init(canvas: HTMLCanvasElement): Promise<Renderer> {
        if (!navigator.gpu) throw Error("navigator.gpu not found");

        const renderer = new Renderer();

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
        
        renderer.camera = new Camera(renderer.device);
        renderer.camera.setViewMatrix(renderer.device.queue, mat4.lookAt(
            vec3.create(0, 0, 5),
            vec3.create(0, 0, 0),
            vec3.create(0, 1, 0)
        ));
        renderer.camera.setPerspectiveMatrix(renderer.device.queue, mat4.perspective(Math.PI / 4.0, (canvas.width / canvas.height), 0.1, 10.0));

        renderer.regionArrays = new RegionArrays(renderer.device, "2D");
        renderer.evaluationState2D = new EvaluationState2D(renderer.device);

        renderer.compute = new Compute2D(renderer.device, renderer.regionArrays, renderer.evaluationState2D);
        renderer.render2D = new Render2D(renderer.device, renderer.canvas.format, renderer.camera, renderer.evaluationState2D);

        return renderer;
    }

    setTape(buffer: Uint8Array) {
        this.evaluationState2D.setTape(this.device, buffer);
    }

    evaluateAndRender() {
        this.regionArrays.clearArrays(this.device);
        this.regionArrays.setInitialRegion(this.device, -16.0, 16.0, -16.0, 16.0, 0.0, 0.0);
        const encoder = this.device.createCommandEncoder({
            label: "Renderer - evaluate command encoder"
        });

        this.compute.encode(
            encoder,
            this.evaluationState2D,
            this.regionArrays
        );

        this.render2D.encode(
            encoder,
            this.canvas.context.getCurrentTexture().createView({}),
            this.camera,
            this.evaluationState2D
        );

        const cmds = encoder.finish({
            label: "Renderer - evaluate command buffer"
        });

        this.device.queue.submit([cmds]);
    }

    evaluate() {
        const encoder = this.device.createCommandEncoder({
            label: "Renderer - evaluate command encoder"
        });

        this.compute.encode(
            encoder,
            this.evaluationState2D,
            this.regionArrays
        );

        const cmds = encoder.finish({
            label: "Renderer - evaluate command buffer"
        });

        this.device.queue.submit([cmds]);

    }

    render() {
        const encoder = this.device.createCommandEncoder({
            label: "Renderer - render command encoder"
        });

        this.render2D.encode(
            encoder,
            this.canvas.context.getCurrentTexture().createView({}),
            this.camera,
            this.evaluationState
        );

        const cmds = encoder.finish({
            label: "Renderer - render command buffer"
        });

        this.device.queue.submit([cmds]);
    }

    setCamera(view?: Mat4, perspective?: Mat4) {
        if (view) {
            this.camera.setViewMatrix(this.device.queue, view);
        }

        if (perspective) {
            this.camera.setPerspectiveMatrix(this.device.queue, perspective);
        }
    }
}

export default Renderer;