<script lang="ts">
    import { onMount } from "svelte";
    import { WasmModule }  from "./wasm";
    import { mat4, vec3 } from "wgpu-matrix";
    import Renderer from "./renderer";

    let initialized = false;
    let canvas: HTMLCanvasElement;
    
    let wasm: WasmModule;
    let renderer: Renderer;
    
    onMount(async () => {
        wasm = await WasmModule.init();
        renderer = await Renderer.init(canvas);
        
        initialized = true;

        // Use requestAnimationFrame for smoother and more efficient updates
        function animationLoop() {
            compile();
            renderer.evaluateAndRender();
            requestAnimationFrame(animationLoop);
        }

        // Start the animation loop when the component is mounted
        requestAnimationFrame(animationLoop);
    });

    let userInput = $state("x*x + y*y - 64");

    let canvasSize = $state({
        width: 0,
        height: 0,
    });

    const render = (() => {
        if (!initialized) { return; }
        
        renderer.render();
    });

    const compile = (() => {
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

            renderer.setTape(wasm.getUint8Array(buf.insts, 0));
        }
    });

    // MARK: camera stuff
    let panning = false;
    let x = 0;
    let y = 0;

    const delta = 0.01;
    
    const handlePanStart = () => {
        panning = true;
    };

    const handlePanEnd = () => {
        panning = false;
    }

    const handlePan = (event: { movementX: number, movementY: number}) => {
        if (!panning) { return; }
        
        x += event.movementX * delta;
        y -= event.movementY * delta;

        const view = mat4.lookAt(
            vec3.create(x, y, 5),
            vec3.create(x, y, 0),
            vec3.create(0, 1, 0)
        );
        const perspective = mat4.perspective(Math.PI / 4.0, (canvasSize.width / canvasSize.height), 0.1, 10.0);

        if (!initialized) { return; }
        renderer.setCamera(view, perspective);
    }
</script>

<div class="w-full h-full flex flex-row gap-4">
    <div class="flex-1 flex flex-col">
        <textarea
        name="equation"
        type="text"
        bind:value={userInput}
        class="flex-1 resize-none"
        ></textarea>
    </div>
    <div class="flex-1 flex flex-col">
        <canvas
            onmousedown={handlePanStart}
            onmouseup={handlePanEnd}
            onmousemove={handlePan}
            onmouseleave={handlePanEnd}

            bind:this={canvas}
            bind:clientHeight={canvasSize.height}
            bind:clientWidth={canvasSize.width}
            class="bg-black grow"
        >
        </canvas>
        <p>{canvasSize.width}x{canvasSize.height}</p>
    </div>
</div>