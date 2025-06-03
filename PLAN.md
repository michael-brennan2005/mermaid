# NOTES

FINAL grammar:
expr: term "+" expr | term "-" expr | term
term: factor "*"" term | factor "/" term | factor
factor: "(" expr ")" | number | var | func1 | func2
number: "0-9"+ ("." "0-9"+)?
var: "x" | "y" | "z"
func1: ("sqrt" | "sin" | "cos" | "asin" | "acos" | "atan" | "exp" | "log" | "abs") "(" expr ")"
func2: ("min" | "max") "(" expr "," expr ")"

strat: Build out full pipeline, keeping a super simple grammar. Hit architecture (and big picture) 
issues early. Also stick to 2D; GPU stuff is hard already so lets not complicate with 3rd dimension

Subexpression optimization: Hash map of instructions -> which instruction
    
There is a very weird endianess/encoding thing: webgpu doesnt have u8, only u32 types, and those
are interpreted little-endian, so it messes with our encoding in backend.zig. Solution - encode 4
bytes at a time in reverse order

- Clause encoding
        - Fix everything at 8 bytes (so lots of padding, maybe a TODO: thing in future)
        - Opcode (1 byte)
        - Output slot (1 byte)
        - Two input slots (1 byte, 1 byte)
        - OR immediate constant (4 bytes).

# BIG TODO LIST

TODO (DONE): better name for arg?
TODO (DONE): centralize the op and arg types
TODO (DONE): is there a hash set in zig
TODO (DONE): naming conventions
TODO (DONE): consts and vars should be instructions
TODO (DONE): we should try and comapct these to single functions instead of OOP vibe we got going on
TODO (DONE): Write down how instruction encoding works w.r.t u32 and WGSL shenangians, seems like an easy thing to forget
TODO (DONE): Make RegAlloc emit encoded instructions & eliminate inst encoding step
TODO (DONE): Fix/build subexpression elimination
TODO (DONE): Go and implement the rest of the grammar
TODO (DONE): simplify advance functions in the parser
TODO (DONE): Refactor script.ts, give compute and render pipeline their own structs, init functions for webgpu, maybe break into multiple files and setup a webpack (hell nah)
TODO (DONE): Proper UI and connect input to compilation
TODO (DONE): code quality - zig->js encoding cleanup
TODO (DONE): implement the rest of the interval math in shader
TODO (DONE): error handling
TODO (DONE): deploy this on your site
TODO (DONE): get a proper hot reloading dev setup, single command and stuff
TODO (DONE): re-hook up error messages, as well as webgpu not supported

## IN FLIGHT 
TODO: camera implementation/setting up a more legitimate render pass

## Tier 2 issues - implement the rest of mpr
TODO: 3d support
TODO: subinterval evaluation
    - Need to figure out how the data flow works, how subintervals get stored somewhere, how
    subsequent dispatch call works
TODO: tape pruning
TODO: code quality - alloc vs gpa for std.mem.Allocator

## Tier 3 - frontend/ui stuff
TODO: timings for rendering and parsing
TODO: phone support
    - Does any phone browser even haave webgpu support

## Tier 3 - Compiler stuff
TODO: support numbers in form of ".32"
TODO: let variable bindings, proper scripting language vibe
TODO: constants - like PI (may be unneccessary with variable bindings lowkey)
TODO: line and column info for errors

## Tier 3 - Refactor stuff
TODO: rework how webgpu stuff is organized
    - Like how oceanman is organized w/ central renderer struct that holds data, has functions
    for doing a full pass (that calls into subpasses), etc.
    - Also atp WASM and WebGPU stuff are completely seperated - wasm is compiler and compiler only, so take that into account
    - Something nice would be to centralize bindgroup/bindgroup layout stuff, make it independent of passes - BindGroupManager
    - Shaders need their own folder sorry bud
    
TODO: profile, profile, profile
    - why does parsing take so long
    - creating new buffer for every new tape seems like a lot of overhead, investigate/maybe replace with fixed size buffer or something
        - Idea could be if new buffer size > old buffer resize, otherwise reuse old buffer, introduce uniform to track tapelength
TODO: better webgpu labels
TODO: Cleaning up parsing
    - Token.Op -> Opcode functoins (fromFunc1 and fromFunc2) seem icky, maybe make more sense for one
    function that handles args, constants, binops, etc. Token -> Opcode
    - May be better for Token.Op to be split into multiple - func1s and func2s are all parsed same,
    but ops are not (diff. precedence levels). Would eliminate need for advanceIfOp function
    - Can SSA just be given the tokenization iterator instead of a full slice of tokens
TODO: Prickly OCD thing but shader uses hex opcodes whereas frontend Type.Opcode uses decimal opcodes
TODO: wgsl shader cleanup

# Strategic scratchpad
    - KISS: Just do one 64x64 tile pass, and also no tape pruning. No image transformation either (no camera) 
        - This means our bindgroup can just be the output image and encoded tape
    - KISS: Do webgpu in JS-land, profile & rewrite later usign Zig and making compatibility layer
    - WASM support is a bitch so let's just focus on that, better now than later having to rewrite a bunch of native code -> wasm. Also its insanely fast compilation I enjoy it
        - Fun toolchain exploring!
    - Rn - use invocation id to create intervals, but for future we
        - 64 x 64 dispatch assumed constant
        - so x_interval = [id.x - 32, id.x - 32 + 1], y_interval = [id.y - 32, id.y - 32 + 1]
    - STRAT: eliminating instruction encoding pass
        - RegAlloc works in reverse order of instructions, having it take a writer is not the
        approach.
        - IDEA: RegAlloc allocates a buffer of u64s, 1 per instruction (each clause takes 8 bytes),
        instead of outputting Types.Inst it writes directly to that buffer (using current encodeInst function)
    - No seperate error handling route cause that creates a weird dependency/codepath issue
        - compile needs to return union
        - Successful compilation: <0x0> <4 bytes for inst length> <instructions>
        - Error: <0x1> <4 bytes for message length> <message length>
        - Rn - this is a dogshit way of implementing it with encodeError in main.zig and frontend.RegAlloc.do doing encoding there, fiigure out nice way for this
            - Seems a central pattern could be <type code><# of bytes><data>, which JS/TS interprets however

        - Encoding 
            - DW about performance stuff right now because its really just all conjecture/not all that trained instincts
            - Centralized format of <1 byte for message type><4 bytes for payload size><payload>
                - Keep encoding in main.zig and WasmInstance
            - Should slices be deep copied or returned references?
                - Question of how exposed Zig-side should be and I think it makes sense for details 
                to be exposed, right now we have very simple values but in future there may be cases
                where deep copying doesnt make sense
                - Also reduces copying which is nice, we already have easy access to wasm memory 
             - PLEASE PLEASE PLEASE do not try and work on a generalized zig->js type converter until 
             we need it
