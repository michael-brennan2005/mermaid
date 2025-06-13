<script lang="ts">
    import { onMount } from "svelte";
    import { WasmModule }  from "./wasm";
    import { mat4, vec3 } from "wgpu-matrix";
    import Renderer from "./renderer";

    const surfaceType = "2D";

    let initialized = false;
    let canvas: HTMLCanvasElement;
    
    let wasm: WasmModule;
    let renderer: Renderer;
    
    onMount(async () => {
        wasm = await WasmModule.init(false);
        renderer = await Renderer.init(canvas, surfaceType);
        
        initialized = true;

        // Use requestAnimationFrame for smoother and more efficient updates
        function animationLoop() {
            compile();
            renderer.evaluateAndRender(0,0);
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

    $effect(() => {
        const { width, height } = canvasSize;

        if (!initialized) return;
        renderer.resizeOutputTexture(width, height);
    });

    const compile = (() => {
        if (!initialized) { return; }
        
        const buf = wasm.compile(userInput);
        if (buf.type === "error") {
            // TODO: real error handling
            // console.log(`buf.msg ptr: ${buf.msg.ptr}, len: ${buf.msg.len}`);
            // console.log(
            //     `So sad an error got reported ${wasm.getString(buf.msg)}`,
            // );
        } else {
            // console.log(
            //     `buf.insts ptr: ${buf.insts.ptr}, len: ${buf.insts.len}`,
            // );

            // const tapeData = wasm.getDataView(buf.insts, 0);

            // for (let i = 0; i < buf.insts.len; i += 8) {
            //     const opcode = tapeData.getUint8(i + 3);
            //     const output = tapeData.getUint8(i + 2);
            //     const rhs = tapeData.getUint8(i + 1);
            //     const lhs = tapeData.getUint8(i);

            //     console.log(
            //         `r${output} = op(${opcode}) r${lhs} r${rhs} (imm: ${tapeData.getFloat32(i + 4, true)})`,
            //     );
            // }

            renderer.setTape(wasm.getUint8Array(buf.insts, 0));
        }
    });

    // MARK: camera stuff
    let panning = false;

    const handlePanStart = () => {
        panning = true;
    };

    const handlePanEnd = () => {
        panning = false;
    }

    type CameraState = {
        type: "2D",
        x: number,
        y: number,
        delta: number
    } | {
        type: "3D",
        rotationY: number,
        rotationX: number,
        radius: number,
        delta: number
    };

    let cameraState: CameraState = (surfaceType === "2D") ? {
        type: "2D",
        x: 0,
        y: 0,
        delta: 5
    } : {
        // Assuming for now we always want to rotate around (0,0,0)
        type: "3D",
        rotationY: 0, // rotation around Y axis
        rotationX: 0, // rotation around X axis
        radius: 5,
        delta: 0.01
    }

    const handlePan = (event: { movementX: number, movementY: number}) => {
        if (!panning) { return; }
        
        if (cameraState.type === "2D") {
            cameraState.x += event.movementX * cameraState.delta;
            cameraState.y -= event.movementY * cameraState.delta;
            
            if (!initialized) { return; }
            renderer.set2DTransform(1.0, cameraState.x, cameraState.y);
        } else {
            cameraState.rotationY += event.movementX * cameraState.delta;
            cameraState.rotationX -= event.movementY * cameraState.delta;

            const camX = cameraState.radius * Math.sin(cameraState.rotationY) * Math.cos(cameraState.rotationX);
            const camY = cameraState.radius * Math.sin(cameraState.rotationX);
            const camZ = cameraState.radius * Math.cos(cameraState.rotationY) * Math.cos(cameraState.rotationX);

            const eye = vec3.create(camX, camY, camZ);
            const center = vec3.create(0, 0, 0);
            const up = vec3.create(0, 1, 0);

            const view = mat4.lookAt(eye, center, up);
            const perspective = mat4.perspective(
                Math.PI / 4.0, 
                (canvasSize.width / canvasSize.height), 
                0.1, 
                100.0
            );

            if (!initialized) { return; }
            renderer.set3DTransform(view, perspective);
        }
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