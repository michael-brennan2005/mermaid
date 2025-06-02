<script lang="ts">
    import { onMount } from "svelte";
    import {
        ComputePipeline,
        RenderPipleine,
        WasmModule,
        WebGPUState,
    } from "./render";

    // MARK: compilation/rendering
    let initialized = false;

    const wasm = new WasmModule();
    const webgpu = new WebGPUState();
    const compute = new ComputePipeline();
    const render = new RenderPipleine();

    let canvas: HTMLCanvasElement;

    onMount(async () => {
        await wasm.init();
        await webgpu.init(canvas);
        await compute.init(webgpu);
        await render.init(webgpu, compute.outputTexture);

        initialized = true;
    });

    let userInput = $state("");

    let canvasSize = $state({
        width: 0,
        height: 0,
    });

    $effect(() => {
        userInput;

        if (!initialized) { return; }

        const buf = wasm.compile(userInput);
        if (buf.type === "error") {
            console.log(`buf.msg ptr: ${buf.msg.ptr}, len: ${buf.msg.len}`);
            console.log(
                `So sad an error got reported ${wasm.getString(buf.msg)}`,
            );
        } else {
            console.log(
                `buf.insts ptr: ${buf.insts.ptr}, len: ${buf.insts.len}`,
            );

            const tapeData = wasm.getDataView(buf.insts, 0);

            for (let i = 0; i < buf.insts.len; i += 8) {
                const opcode = tapeData.getUint8(i + 3);
                const output = tapeData.getUint8(i + 2);
                const rhs = tapeData.getUint8(i + 1);
                const lhs = tapeData.getUint8(i);

                console.log(
                    `r${output} = op(${opcode}) r${lhs} r${rhs} (imm: ${tapeData.getFloat32(i + 4, true)})`,
                );
            }

            compute.uploadTape(webgpu, wasm.getUint8Array(buf.insts, 0));

            const encoder = webgpu.device.createCommandEncoder({
                label: "Compute & render encoder",
            });
            compute.encode(encoder);
            render.encode(
                encoder,
                webgpu.canvasContext.getCurrentTexture().createView(),
            );
            const commandBuffer = encoder.finish();
            webgpu.device.queue.submit([commandBuffer]);
        }
    });

    // MARK: camera stuff
    let panning = false;
    let x = 0;
    let y = 0;

    const delta = 0.1;
    const handlePanStart = () => {
        panning = true;
    };

    const handlePanEnd = () => {
        panning = false;
    }

    const handlePan = (event: { movementX: number, movementY: number}) => {
        if (!panning) { return; }
        console.log(`${event.movementX} | ${event.movementY}`)
    }
</script>

<!-- 
  Use flexbox to ensure textarea and the div (with canvas) always have the same width.
  We use 'flex-1' on both children to make them grow equally.
-->
<div class="w-full h-full flex flex-row gap-4">
    <textarea
        name="equation"
        type="text"
        bind:value={userInput}
        class="flex-1 resize-none"
    ></textarea>
    <div class="flex-1 flex flex-col">
        <canvas
            onmousedown={handlePanStart}
            onmouseup={handlePanEnd}
            onmousemove={handlePan}

            bind:this={canvas}
            bind:clientHeight={canvasSize.height}
            bind:clientWidth={canvasSize.width}
            class="bg-black grow"
        >
        </canvas>
        <p>{canvasSize.width}x{canvasSize.height}</p>
    </div>
</div>

<!--

const inputArea: HTMLTextAreaElement = document.querySelector("#input")!;
    const compileErrorOutput: HTMLHeadingElement = document.querySelector("#error-msg")!;

    const run = (text: string) => {
        const buf = wasm.compile(text);

        if (buf.type === "error") {
            console.log(`buf.msg ptr: ${buf.msg.ptr}, len: ${buf.msg.len}`);
            console.log(`So sad an error got reported ${wasm.getString(buf.msg)}`);

            compileErrorOutput.textContent = wasm.getString(buf.msg);
            compileErrorOutput.style.display = "block";
        } else {
            console.log(`buf.insts ptr: ${buf.insts.ptr}, len: ${buf.insts.len}`);
            compileErrorOutput.textContent = "";
            compileErrorOutput.style.display = "none";

            const tapeData = wasm.getDataView(buf.insts, 0);

            for (let i = 0; i < buf.insts.len; i += 8) {
                const opcode = tapeData.getUint8(i + 3);
                const output = tapeData.getUint8(i + 2);
                const rhs = tapeData.getUint8(i + 1);
                const lhs = tapeData.getUint8(i);

                console.log(`r${output} = op(${opcode}) r${lhs} r${rhs} (imm: ${tapeData.getFloat32(i + 4, true)})`);
            }

            compute.uploadTape(webgpu, wasm.getUint8Array(buf.insts, 0));

            const encoder = webgpu.device.createCommandEncoder({ label: "Compute & render encoder" });
            compute.encode(encoder);
            render.encode(encoder, webgpu.canvasContext.getCurrentTexture().createView());
            const commandBuffer = encoder.finish();
            webgpu.device.queue.submit([commandBuffer]);
        }
    }

    setupDebouncedTextarea(inputArea, (val) => {
        run(val);
    }, 100);

    run(inputArea.textContent!); // called once here to render the initial textarea value 



-->
