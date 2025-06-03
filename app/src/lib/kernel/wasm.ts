import initWasm from '../../assets/mermaid.wasm?init';

export type Span = {
    ptr: number,
    len: number
};

export type CompilationResult = 
    { type: "error", msg: Span } |
    { type: "success", insts: Span };

export class WasmModule {
    private instance!: WebAssembly.Instance;
    private memory = new WebAssembly.Memory({ initial: 17, maximum: 1024 });

    private exports!: {
        allocate: (len: number) => number;
        free: (ptr: number) => void;
        compile: (ptr: number, len: number) => number;
    }

    // No async constructors :(
    async init() {
        const env = {
            __stack_pointer: 0,
            memory: this.memory,
            consoleLog: (ptr: number, len: number) => {
                console.log(`[ZIG] ${this.getString({ len, ptr })}`);
            },
        };

        try {
            this.instance = await initWasm({
                env
            });

            this.exports = {
                // @ts-ignore
                free: this.instance.exports.free,
                // @ts-ignore
                allocate: this.instance.exports.allocate,
                // @ts-ignore
                compile: this.instance.exports.compile,
            }

        } catch (e: any) {
            console.error(`WASM loading failed: ${e.message}`);
        }

        console.log("WASM module loaded");
    }

    free(span: Span) {
        this.exports.free(span.ptr);
    }

    allocate(len: number): Span {
        // TODO: proper error handling
        return {
            len,
            ptr: this.exports.allocate(len)
        }
    }

    // First 4 bytes of returned buffer is # of 8-byte instructions, rest of the buffer is those
    // 8 byte instructions
    compile(str: string): CompilationResult {
        const encoder = new TextEncoder();
        const stringBytes = encoder.encode(str);

        const buf = this.exports.allocate(stringBytes.length + 1);

        new Uint8Array(this.memory.buffer, buf, stringBytes.length).set(stringBytes);
        new Uint8Array(this.memory.buffer, buf + stringBytes.length, 1)[0] = 0;

        let addr: number = this.exports.compile(buf, stringBytes.length);
        let type: number = new DataView(this.memory.buffer, addr, 1).getUint8(0)
    
        if (type === 0x0) {
            console.log("First byte is 0 - success");
            const data = new DataView(this.memory.buffer, addr + 1, 8);

            return {
                type: "success",
                insts: {
                    len: data.getUint32(0, true),
                    ptr: data.getUint32(4, true)
                }
            }
        } else {
            console.log("First byte is 1 - error");
            const data = new DataView(this.memory.buffer, addr + 1, 8);

            return {
                type: "error",
                msg: {
                    len: data.getUint32(0, true),
                    ptr: data.getUint32(4, true)
                }
            }
        }
    }

    getDataView(span: Span, offset: number): DataView {
        return new DataView(this.memory.buffer, span.ptr + offset, span.len - offset);
    }

    getUint8Array(span: Span, offset: number): Uint8Array {
        return new Uint8Array(this.memory.buffer, span.ptr + offset, span.len - offset);
    }

    getString(span: Span): string {
        const view = this.getDataView(span, 0);
        return new TextDecoder().decode(view);
    }
}