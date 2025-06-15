# KEEP YOURSELF SANE
Please do not refactor the renderer code until after 3d support and tape pruning

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
TODO (DONE): camera implementation/setting up a more legitimate render pass
TODO (DONE): rework how webgpu stuff is organized
    - Like how oceanman is organized w/ central renderer struct that holds data, has functions
    for doing a full pass (that calls into subpasses), etc.
    - Also atp WASM and WebGPU stuff are completely seperated - wasm is compiler and compiler only, so take that into account
    - Something nice would be to centralize bindgroup/bindgroup layout stuff, make it independent of passes - BindGroupManager
    - Shaders need their own folder sorry bud
TODO (DONE): subinterval evaluation
TODO (DONE): better webgpu labels
TODO (DONE): wgsl shader cleanup

## TODO - Maybe do these things after getting 3d support
TODO: 2D implementation strat from paper (camera modifies 2d matrix, output texture is always size of canvas)
TODO: error handling UI
TODO: UI cleanup - little description, toggle switch for 2D/3D

## TODO - implement the rest of mpr
TODO: 3d support
TODO: tape pruning

## TODO - renderer/ts
TODO: timings for rendering and parsing
TODO: phone support
    - Does any phone browser even haave webgpu support

## TODO - compiler/zig
TODO: support numbers in form of ".32"
TODO: let variable bindings, proper scripting language vibe
TODO: constants - like PI (may be unneccessary with variable bindings lowkey)
TODO: line and column info for errors
TODO: profile, profile, profile
    - why does parsing take so long
    - creating new buffer for every new tape seems like a lot of overhead, investigate/maybe replace with fixed size buffer or something
        - Idea could be if new buffer size > old buffer resize, otherwise reuse old buffer, introduce uniform to track tapelength
TODO: Cleaning up parsing
    - Token.Op -> Opcode functoins (fromFunc1 and fromFunc2) seem icky, maybe make more sense for one
    function that handles args, constants, binops, etc. Token -> Opcode
    - May be better for Token.Op to be split into multiple - func1s and func2s are all parsed same,
    but ops are not (diff. precedence levels). Would eliminate need for advanceIfOp function
    - Can SSA just be given the tokenization iterator instead of a full slice of tokens
TODO: Prickly OCD thing but shader uses hex opcodes whereas frontend Type.Opcode uses decimal opcodes
TODO: code quality - alloc vs gpa for std.mem.Allocator

# Strategic scratchpad - stuff im working on rn
- Refactoring
    - Do not share any code w/ 2d and 3d - giving myself a month minimum ban from trying to figure out commonalities
    - Small iterations, always have something working and on-screen
    
# Strategic scratchpad - archive

- 3D shader is now deffo broken because we dont have camera
    - Also, you could like, radically simplify the code for testing/debugging, comment out a LOT

- We desperately need configurable resolution
    - KISS: maybe keep canvas to a square right now, have fixed output texture?

    - 256 compute limit means we are always evaluating 16x16 region
    - RegionArrays should be configurable too, our region subdivisions, how many levels it goes, etc.
        - Dynamic-ify the whole process, how many levels of subevaluation goes on, etc.
            - Could have it so you keep adding levels so long as (subinterval_count) < total pixels in output texture
    - Do we need something that like tells us how many texels map to a unit in "interval-space"
    - I think this could better be summed up as "eliminate magic numbers"
    - Paper has interesting idea in that there really isnt a camera, rather the region that gets
    evaluated is shifted
        - Idea could be the output texture from compute always matches size of canvas, camera modifies size of initial region (zooming) and origin (panning) 

- IF we hit the maxComputeWorkgroupsPerDimension limit, we could probably rework our compute 3d to not just be a 1d pass, like how 2d is
    - Looks like for 3D resources can be either 3D or 2D (take in surface type in constructor), pass is different (and so is shader)
- HIGH KEY feel that rendering should be organized on 2d/3d lines
    - For now this is a good idea but we should take steps to reduce code duplication

- Is minbindingsize for buffer bindings important/necessary for good performance

- How does the filltexel know how "unit space" maps to "texture space"
- Thought process, assume 1 unit -> 1 pixel
    - Region setting becomes x = [0, canvasWidth], y = [0, canvasHeight]

    - Transform still works as normal, just that you're probably going to be zooming in a lot and panning over large distances
    - But now, to find texel bounds, we just multiply by mat^-1

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
    
    - Subinterval eval
        - Big list for ActiveTiles, atomic integer allows individual compute calls to do their thing
        - There's indirect buffer workgroup dispatching (buffer determines x,y,z) may be to our
        advantage here
        - IDEA: Shader is built for 64x64 interval evaluations, every time, BUT, unlike now, a bindgroup
        passes in what the total region is.
        - Compute shader
            - I am not properly understanding how workgroups and dispatch workgroups run
                - We need a 64x64 workgroup!!!
                - Then the dispatch workgroups would be (1,1,1) for our first run, (activeTiles.len, 1, 1) for our second, (activeSubtiles.len, 1, 1) for our third
                - How does each shader call get its interval to evaluate?
                    - Use the dispatchWorkgroups(x,y,z) X id to index an intervalsList, use workgroup_id (is that a thing) to get the subinterval from that
            - Bind group needs two array<Interval> - one input (that shader is using to figure out the interval to eval), one output (to push to in case subinterval needs to be eval'd)

    - PLAN FOR TMR (6-4-2025):
        - gpu code is dogshit and i refuse to try and debug with how it currently is laid out
        - webgpu refactor plan
            - need a high level Renderer object that abstracts all state, clean API for Svelte component/frontend
                - Should replace WebGPUState, constructors for resources + passes can just get device and queue passed in its nicer that way
            - Get with program and give each class its own file with a default export
            - All resources get their own classes, they can own & instantiate their bindgrouplayouts
                - Camera is good
                - RegionArrays is (probably) good
                - Give Tape + output texture its own class
                    - This will need 2 bind group/layout pairs - one for compute (Tape + Output texture), one for render (output texture)
            - Render and compute passes are good, just remove resource stuff.
        - Start testing subinterval eval - probably a good idea to disable current render loop and have a button that does one full pass, so its easy to capture & debug
        - Clean up svelte code, not sure if this is better to do before or after testing subinterval eval

    - Can we only compute when equation is changed?
        - May not work for 3d stuff where heightmap is specific to wherever the camera is at, idk

