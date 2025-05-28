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


# BIG TODO LIST

TODO (DONE): better name for arg?
TODO (DONE): centralize the op and arg types
TODO (DONE): is there a hash set in zig
TODO (DONE): naming conventions
TODO (DONE): consts and vars should be instructions
TODO (DONE): we should try and comapct these to single functions instead of OOP vibe we got going on

TODO: Write down how instruction encoding works w.r.t u32 and WGSL shenangians, seems like an easy
thing to forget
TODO: support numbers in form of ".32"

# Strategic scratchpad
    - KISS: Just do one 64x64 tile pass, and also no tape pruning. No image transformation either (no camera) 
        - This means our bindgroup can just be the output image and encoded tape
    - KISS: Do webgpu in JS-land, profile & rewrite later usign Zig and making compatibility layer
    - WASM support is a bitch so let's just focus on that, better now than later having to rewrite a bunch of native code -> wasm. Also its insanely fast compilation I enjoy it
        - Fun toolchain exploring!
    - Look into issues about string encoding (js is maybe utf-16? Zig is ascii)
    - Clause encoding
        - Fix everything at 8 bytes (so lots of padding, maybe a TODO: thing in future)
        - Opcode (1 byte)
        - Output slot (1 byte)
        - Two input slots (1 byte, 1 byte)
        - OR immediate constant (4 bytes).
    - Rn - use invocation id to create intervals, but for future we
        - 64 x 64 dispatch assumed constant
        - so x_interval = [id.x - 32, id.x - 32 + 1], y_interval = [id.y - 32, id.y - 32 + 1]


# The road to v2 (5-28-2025)
    - STRAT: Hold off on tape pruning + 3D for now - focus on making something playful/usable
    - Zig work
        - Make RegAlloc emit encoded instructions & eliminate inst encoding step
        - Fix/build subexpression elimination
            - Not sure if we can actually do this with encoded instruction pass - would mean a hard
            limit of 256 SSA statements
                - Could probably work if we make SSA a version of encoded instruction but a u128 - double width for inputs, outputs, etc.
        - Error handling
            - Do this before grammar implementation (maybe)?
        - Go and implement the rest of the grammar
    - WebGPU/TS work
        - Refactor script.ts
            - break compute pipeline and render pipeline stuff into their own structs/namespaces, init functions for webgpu
        - Proper UI, connect input to compilation
        - Proper way of storing image width/height, scale, etc, explicit interval evaluation (vs.
        // using invocation_id)
        - Camera implementation
            - Would force us to come up with a legitimate render pass
    - Deployment
        - Figure out how to put this on your site - subdomain and making this a seperate thing seems
        best bet?
        