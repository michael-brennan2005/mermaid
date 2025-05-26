var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var wasmInstance;
var wasmMemory = new WebAssembly.Memory({ initial: 17, maximum: 1024 });
function freeSpan(span) {
    // @ts-ignore
    wasmInstance.exports.free(span.ptr);
}
function wasmString(string) {
    var encoder = new TextEncoder();
    var stringBytes = encoder.encode(string);
    // @ts-ignore
    var ptr = wasmInstance.exports.allocate(stringBytes.length + 1);
    new Uint8Array(wasmMemory.buffer, ptr, stringBytes.length).set(stringBytes);
    new Uint8Array(wasmMemory.buffer, ptr + stringBytes.length, 1)[0] = 0;
    return {
        ptr: ptr,
        len: stringBytes.length + 1
    };
}
function log(addr, len) {
    var view = new DataView(wasmMemory.buffer, addr, len);
    var str = new TextDecoder().decode(view);
    console.log(str);
}
function logPanic(addr, len) {
    console.log("Panic from WASM Module VVVVVV");
    log(addr, len);
}
(function () {
    var $ = function (selector) { return document.querySelector(selector); };
    var env = {
        __stack_pointer: 0,
        memory: wasmMemory,
        logPanic: logPanic,
        logDebug: log
    };
    function init() {
        return __awaiter(this, void 0, void 0, function () {
            var source, e_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, WebAssembly.instantiateStreaming(fetch('teddy.wasm'), { env: env })];
                    case 1:
                        source = _a.sent();
                        wasmInstance = source.instance;
                        console.log("WASM module loaded");
                        return [2 /*return*/, {
                                wasmTest: wasmInstance.exports.wasmTest,
                                wasmTest2: wasmInstance.exports.wasmTest2,
                                compile: wasmInstance.exports.compile,
                            }];
                    case 2:
                        e_1 = _a.sent();
                        console.error("WASM loading failed: ".concat(e_1.message));
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    init().then(function (wasm) {
        // @ts-ignore
        wasm.compile();
        // // Get references to the input textarea, compile button, and output area
        // const inputElem = $('#input');
        // const compileBtn = $('#compileBtn');
        // $('#compileBtn').addEventListener('click', () => {
        //     console.log(inputElem.value);
        //     const str = wasmString(inputElem.value);
        //     // @ts-ignore
        //     wasmInstance.exports.compile(str.ptr, str.len);
        // });
        // wasmString("Hello, world!");
    });
})();
