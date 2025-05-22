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

# BIG TODO LIST

TODO (DONE): better name for arg?
    - Arg is fine
TODO (DONE): centralize the op and arg types
TODO (DONE): is there a hash set in zig
    - There is not
TODO (DONE): naming conventions
TODO (DONE): consts and vars should be instructions

TODO: we should try and comapct these to single functions instead of OOP vibe we got going on
TODO: Eliminate tokenization, one text -> SSA pass

# 5-21-2025
// FOR NOW:
// expr: factor "+" expr | factor
// factor: number | var

# 5-22-2025
Intervals are already ordered by start point (their SSA index)



FOR FUTURE: Eliminate tokenization, one text -> SSA pass
FOR FUTURE: subexpression elimination w hashmap

R0: X
R1: X + Y + Y + 0.5
R2: Y + 0.5
