export class WebGPUState {
    device!: GPUDevice;
    canvas!: HTMLCanvasElement;
    canvasContext!: GPUCanvasContext;
    canvasFormat!: GPUTextureFormat;

    // No async constructors :(
    async init(canvas: HTMLCanvasElement) {
        if (!navigator.gpu) throw Error("WebGPU not supported");

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw Error("Couldn't get WebGPU adapater");

        this.device = await adapter.requestDevice();
        this.device.lost.then(() => {
            throw Error("WebGPU logical device was lost")
        });

        this.canvas = canvas;
        this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();

        this.canvasContext = this.canvas.getContext('webgpu')!;
        this.canvasContext.configure({
            device: this.device,
            format: this.canvasFormat
        });
    }
}