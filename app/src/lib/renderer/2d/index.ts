import { mat4, vec3, type Mat4 } from "wgpu-matrix";
import Camera from "../common/camera";
import RegionArrays from "../common/region-arrays";
import EvaluationState from "./evaluation-state";
import Compute from "./compute";
import Render from "./render";

export class Renderer {
    device!: GPUDevice;
    canvas!: {
        element: HTMLCanvasElement;
        context: GPUCanvasContext;
        format: GPUTextureFormat;
    }

    camera!: Camera;
    regionArrays!: RegionArrays;
    evaluationState!: EvaluationState;

    compute!: Compute;
    render2D!: Render;

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
        renderer.evaluationState = new EvaluationState(renderer.device);

        renderer.compute = new Compute(renderer.device, renderer.regionArrays, renderer.evaluationState);
        renderer.render2D = new Render(renderer.device, renderer.canvas.format, renderer.camera, renderer.evaluationState);

        return renderer;
    }

    setTape(buffer: Uint8Array) {
        this.evaluationState.setTape(this.device, buffer);
    }

    evaluateAndRender() {
        this.regionArrays.clearArrays(this.device);
        this.regionArrays.setInitialRegion(this.device, -16.0, 16.0, -16.0, 16.0, 0.0, 0.0);
        const encoder = this.device.createCommandEncoder({
            label: "Renderer - evaluate command encoder"
        });

        this.compute.encode(
            encoder,
            this.evaluationState,
            this.regionArrays
        );

        this.render2D.encode(
            encoder,
            this.canvas.context.getCurrentTexture().createView({}),
            this.camera,
            this.evaluationState
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
            this.evaluationState,
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