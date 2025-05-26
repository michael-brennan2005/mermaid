let wasmInstance: WebAssembly.Instance;
const wasmMemory = new WebAssembly.Memory({ initial: 17, maximum: 1000 });

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

(() => {
    const $ = (selector) => document.querySelector(selector);

    const env = {
        __stack_pointer: 0,
        memory: wasmMemory
    };

    async function init() {
        try {
            let source = await WebAssembly.instantiateStreaming(
                fetch('teddy.wasm'),
                { env: env });
            wasmInstance = source.instance;

            console.log("WASM module loaded");

            return {
                compile: wasmInstance.exports.compile
            }
        } catch (e) {
            console.error(`WASM loading failed: ${e.message}`);
        }
    }

    

    init().then((wasm) => {
        // Get references to the input textarea, compile button, and output area
        const inputElem = $('#input');
        const compileBtn = $('#compileBtn');
        $('#compileBtn').addEventListener('click', () => {
            console.log(inputElem.value);
            const str = wasmString(inputElem.value);
            // @ts-ignore
            wasmInstance.exports.compile(str.ptr, str.len);
        });

        wasmString("Hello, world!");
    });
})();
// const $ = (selector) => document.querySelector(selector);

