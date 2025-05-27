let wasmInstance: WebAssembly.Instance;
const wasmMemory = new WebAssembly.Memory({ initial: 17, maximum: 1024 });

type Span = {
    ptr: number,
    len: number
};

function freeSpan(span: Span) {
    // @ts-ignore
    wasmInstance.exports.free(span.ptr);
}

function wasmString(string: string): Span {
    const encoder = new TextEncoder();
    const stringBytes = encoder.encode(string);
    
    // @ts-ignore
    const ptr = wasmInstance.exports.allocate(stringBytes.length + 1);

    new Uint8Array(wasmMemory.buffer, ptr, stringBytes.length).set(stringBytes);        
    new Uint8Array(wasmMemory.buffer, ptr + stringBytes.length, 1)[0] = 0;

    return {
        ptr: ptr,
        len: stringBytes.length + 1 
    };
}

function log(addr: number, len: number) {
    const view = new DataView(wasmMemory.buffer, addr, len);
    const str = new TextDecoder().decode(view);
    console.log(str);
}

function logPanic(addr: number, len: number) {
    console.log("Panic from WASM Module VVVVVV");
    log(addr, len);
}

(() => {
    const $ = (selector) => document.querySelector(selector);

    const env = {
        __stack_pointer: 0,
        memory: wasmMemory,
        consoleLog: log,
    };

    async function init() {
        try {
            let source = await WebAssembly.instantiateStreaming(
                fetch('teddy.wasm'),
                { env: env });
            wasmInstance = source.instance;

            console.log("WASM module loaded");

            return {
                wasmTest: wasmInstance.exports.wasmTest,
                wasmTest2: wasmInstance.exports.wasmTest2,
                compile: wasmInstance.exports.compile,
            }
        } catch (e) {
            console.error(`WASM loading failed: ${e.message}`);
        }
    }

    

    init().then((wasm) => {
        const str = wasmString("x + y");

        // @ts-ignore
        let addr: number = wasm.compile(str.ptr, str.len - 1);
        console.log(`Now on JS side - ptr is: ${addr}`)

        const encodedNumber = new DataView(wasmMemory.buffer, addr, 4).getUint32(0, true); // true for little-endian, match Zig's default
        console.log(`Decoded u32 from WASM memory - # of insts: ${encodedNumber}`);

        const instData = new DataView(wasmMemory.buffer, (addr + 4), encodedNumber * 8) // each instruction is 8 bytes

        for (let i = 0; i < encodedNumber; i += 1) {
            const start = i * 8;
            console.log(`Opcode: ${instData.getUint8(start)}, Output: ${instData.getUint8(start + 1)}, Input1: ${instData.getUint8(start + 2)}, Input2: ${instData.getUint8(start + 3)}, Floating Point: ${instData.getFloat32(start + 4, true)}`)
        }
    });
})();

