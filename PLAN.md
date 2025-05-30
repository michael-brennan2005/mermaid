# NOTES
Important command:
zig build && python3 -m http.server 8080 -d static/

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


Tier 1 issues (road to v2)
TODO: Refactor script.ts, give compute and render pipeline their own structs, init functions for webgpu, maybe break into multiple files and setup a webpack (hell nah)
TODO: Proper UI and connect input to compilation
TODO: figure out uniforms, storing image width/height, scale, etc.
TODO: camera implementation/setting up a more legitimate render pass
TODO: error handling
TODO: deploy this on your site

Tier 2 issues
TODO: 3d support
TODO: subinterval evaluation
    - Need to figure out how the data flow works, how subintervals get stored somewhere, how
    subsequent dispatch call works
TODO: tape pruning

Tier 3 issues
TODO: support numbers in form of ".32"
TODO: Cleaning up parsing
    - Token.Op -> Opcode functoins (fromFunc1 and fromFunc2) seem icky, maybe make more sense for one
    function that handles args, constants, binops, etc. Token -> Opcode
    - May be better for Token.Op to be split into multiple - func1s and func2s are all parsed same,
    but ops are not (diff. precedence levels). Would eliminate need for advanceIfOp function
TODO: would log be better off as a 2 argument function? log_a(b)
TODO: Prickly OCD thing but shader uses hex opcodes whereas frontend Type.Opcode uses decimal opcodes
TODO: let variable bindings, proper scripting language vibe
TODO: profile and find out why parsing takes forever

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
        - 
        
