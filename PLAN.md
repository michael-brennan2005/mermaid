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

Stages:
- Tokenization
- (MAYBE) parsing
    - Pretty sure we can go straight from tokenization to SSA so skip this step
- SSA generation
- Register allocation
    - Graph coloring vs. reverse linear scan
        - RLS has slides from matt keeter
- Uhhhh how the fuck does compute work
- ????
- Profit!

# BIG TODO LIST

TODO (DONE): better name for arg?
    - Arg is fine
TODO (DONE): centralize the op and arg types
TODO (DONE): is there a hash set in zig
    - There is not
TODO (DONE): naming conventions
TODO (DONE): consts and vars should be instructions
TODO (DONE): we should try and comapct these to single functions instead of OOP vibe we got going on

FOR FUTURE: Eliminate tokenization, one text -> SSA pass
FOR FUTURE: eliminate instruction encoding pass
FOR FUTURE: Look into immediate constant fixing 
FOR FUTURE: subexpression elimination w hashmap

# Strategic planning
    - KISS: Just do one 64x64 tile pass, and also no tape pruning. No image transformation either (no camera) 
        - This means our bindgroup can just be the output image and encoded tape
    - KISS: Do webgpu in JS-land, profile & rewrite later usign Zig and making compatibility layer
    - WASM support is a bitch so let's just focus on that, better now than later having to rewrite a bunch of native code -> wasm. Also its insanely fast compilation I enjoy it
        - Fun toolchain exploring!
    - Clause encoding
        - Fix everything at 8 bytes (so lots of padding, maybe a TODO: thing in future)
        - Opcode (1 byte)
        - Output slot (1 byte)
        - Two input slots (1 byte, 1 byte)
        - OR immediate constant (4 bytes).

