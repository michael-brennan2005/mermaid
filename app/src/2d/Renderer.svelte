<script lang="ts">
    import { onMount } from "svelte";
    import { WasmModule } from "../lib/wasm";
    import { Renderer } from "./renderer";
    import { BindGroupManager } from "./resources";
    import { Compute } from "./compute";

    let initialized = false;
    
    let canvas: HTMLCanvasElement;
    let wasm: WasmModule;
    let renderer: Renderer;    
    let compute: Compute;

    onMount(async () => {
        wasm = await WasmModule.init(false);
        
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw Error("Couldn't get WebGPU adapater");

        const device = await adapter.requestDevice();
        device.lost.then(() => {
            throw Error("WebGPU logical device was lost")
        });

        const bgm = new BindGroupManager(device);
        renderer = new Renderer(device, bgm, canvas);
        compute = new Compute(device, bgm, renderer);

        initialized = true;
        
        function animationLoop() {
            renderer.tick((texture, textureSize, encoder) => {
                compute.do(texture, textureSize, encoder);
            });

            requestAnimationFrame(animationLoop);
        }
        
        requestAnimationFrame(animationLoop);
    });

    let canvasSize = $state({
        width: 0,
        height: 0,
    });
</script>

<div class="w-full h-full flex flex-row gap-4">
    <div class="flex-1 flex flex-col">
        <canvas
            bind:this={canvas}
            bind:clientHeight={canvasSize.height}
            bind:clientWidth={canvasSize.width}
            class="bg-black grow"
        >
        </canvas>
        <p>{canvasSize.width}x{canvasSize.height}</p>
    </div>
</div>