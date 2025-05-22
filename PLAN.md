# General
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

# 5-21-2025

// FOR NOW:
// expr: factor "+" expr | factor
// factor: number | var

TODO: better name for arg?
TODO: centralize the op and arg types
TODO: naming conventions

# 5-22-2025
Intervals are already ordered by start point (their SSA index)

TODO: we should try and comapct these to single functions instead of OOP vibe we got going on
TODO: is there a hash set in zig
TODO: consts and vars should be instructions

LinearScanRegisterAllocation
    active ← {}
    for each live interval i, in order of increasing start point do
        ExpireOldIntervals(i)
        register[i] ← a register removed from pool of free registers
        add i to active, sorted by increasing end point

ExpireOldIntervals(i)
    for each interval j in active, in order of increasing end point do
        if endpoint[j] ≥ startpoint[i] then
            return 
        remove j from active
        add register[j] to pool of free registers
