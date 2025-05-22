// Text -> Register allocated instructions
const std = @import("std");

// Allow SSA and RegAlloc to share types (and eventually tokenizer)
pub const Types = struct {
    // Input's are indices to other SSA instructions
    pub const SSA = union(enum) {
        constant: f32,
        arg: Arg,
        op: struct {
            op: Op,
            lhs: Input,
            rhs: Input,
        },

        // Needed for instruction caching in parser
        pub const Context = struct {
            pub fn hash(self: @This(), key: Types.SSA) u64 {
                _ = self;

                return std.hash.Wyhash.hash(0, std.mem.asBytes(&key));
            }

            pub const eql = std.hash_map.getAutoEqlFn(Types.SSA, @This());
        };
    };

    // Input's are indices to registers; that goes for the lhs and rhs of ssa too
    pub const Inst = struct {
        out: Input,
        ssa: SSA,
    };

    pub const Op = enum { add, sub, mul, div };
    pub const Func1 = enum { sqrt, sin, cos, asin, acos, atan, exp, log, abs };
    pub const Func2 = enum { min, max };
    pub const Arg = enum { x, y };
    pub const Input = usize;

    pub const Token = union(enum) {
        val: f32,
        op: Op,

        arg: Arg,
        func1: Func1,
        func2: Func2,

        left_paren,
        right_paren,
        comma,
    };
};

// Text -> Tokens
pub const Tokenizer = struct {
    buffer: [:0]const u8,
    index: usize,

    pub fn do(gpa: std.mem.Allocator, buffer: [:0]const u8) ![]Types.Token {
        var tokenizer = Tokenizer{ .buffer = buffer, .index = 0 };

        var arr = std.ArrayList(Types.Token).init(gpa);

        while (try tokenizer.next()) |tok| {
            try arr.append(tok);
        }

        return arr.toOwnedSlice();
    }

    // TODO: support numbers in form of ".32"
    const State = enum { start, int, float, identifier };

    pub fn next(self: *Tokenizer) !?Types.Token {
        var start: usize = 0;
        state: switch (State.start) {
            .start => switch (self.buffer[self.index]) {
                0 => {
                    if (self.index == self.buffer.len) {
                        return null;
                    } else {
                        @panic("TODO error: null not at end of string");
                    }
                },
                ' ', '\n', '\t', '\r' => {
                    self.index += 1;
                    continue :state .start;
                },
                '+', '-', '*', '/' => {
                    self.index += 1;
                    return Types.Token{
                        .op = switch (self.buffer[self.index - 1]) {
                            '+' => .add,
                            '-' => .sub,
                            '*' => .mul,
                            '/' => .div,
                            else => unreachable,
                        },
                    };
                },
                '(' => {
                    self.index += 1;
                    return .left_paren;
                },
                ')' => {
                    self.index += 1;
                    return .right_paren;
                },
                ',' => {
                    self.index += 1;
                    return .comma;
                },
                'a'...'z', 'A'...'Z' => {
                    start = self.index;
                    continue :state .identifier;
                },
                '0'...'9' => {
                    start = self.index;
                    continue :state .int;
                },
                else => {
                    @panic("TODO error: unexpected character");
                },
            },
            .int => {
                switch (self.buffer[self.index]) {
                    '0'...'9' => {
                        self.index += 1;
                        continue :state .int;
                    },
                    '.' => {
                        continue :state .float;
                    },
                    else => {
                        const val = std.fmt.parseInt(usize, self.buffer[start..self.index], 10) catch {
                            @panic("TODO error: int is misformed (can this even be reached?)");
                        };

                        return Types.Token{
                            .val = @floatFromInt(val),
                        };
                    },
                }
            },
            .float => {
                self.index += 1;
                switch (self.buffer[self.index]) {
                    '0'...'9' => {
                        continue :state .float;
                    },
                    else => {
                        const val = std.fmt.parseFloat(f32, self.buffer[start..self.index]) catch {
                            @panic("TODO error: float is misformed (can this even be reached?)");
                        };

                        return Types.Token{
                            .val = val,
                        };
                    },
                }
            },
            .identifier => {
                self.index += 1;
                switch (self.buffer[self.index]) {
                    'a'...'z', 'A'...'Z' => {
                        continue :state .identifier;
                    },
                    else => {
                        if (getIdentifierToken(self.buffer[start..self.index])) |tok| {
                            return tok;
                        } else {
                            @panic("TODO error: identifier is misformed");
                        }
                    },
                }
            },
        }
    }

    fn getIdentifierToken(buf: []const u8) ?Types.Token {
        const map = [_]struct { []const u8, Types.Token }{
            .{ "x", Types.Token{ .arg = Types.Arg.x } },
            .{ "y", Types.Token{ .arg = Types.Arg.y } },
            // .{ "z", Types.Token{ .arg = Types.Arg.z } },
            .{ "sqrt", Types.Token{ .func1 = Types.Func1.sqrt } },
            .{ "sin", Types.Token{ .func1 = Types.Func1.sin } },
            .{ "cos", Types.Token{ .func1 = Types.Func1.cos } },
            .{ "asin", Types.Token{ .func1 = Types.Func1.asin } },
            .{ "acos", Types.Token{ .func1 = Types.Func1.acos } },
            .{ "atan", Types.Token{ .func1 = Types.Func1.atan } },
            .{ "exp", Types.Token{ .func1 = Types.Func1.exp } },
            .{ "log", Types.Token{ .func1 = Types.Func1.log } },
            .{ "abs", Types.Token{ .func1 = Types.Func1.abs } },
            .{ "min", Types.Token{ .func2 = Types.Func2.min } },
            .{ "max", Types.Token{ .func2 = Types.Func2.max } },
        };

        for (map) |elem| {
            if (std.ascii.eqlIgnoreCase(buf, elem.@"0")) {
                return elem.@"1";
            }
        }

        return null;
    }
};

// Tokens -> SSA
pub const Parser = struct {
    index: usize,
    toks: []Types.Token,
    insts: std.ArrayList(Types.SSA),
    // Keeping a cache allows for subexpression elimination
    cache: std.HashMap(Types.SSA, usize, Types.SSA.Context, 80),

    pub fn do(gpa: std.mem.Allocator, toks: []Types.Token) ![]Types.SSA {
        var parser = Parser{
            .index = 0,
            .cache = std.HashMap(Types.SSA, usize, Types.SSA.Context, 80).init(gpa),
            .insts = std.ArrayList(Types.SSA).init(gpa),
            .toks = toks,
        };
        defer parser.cache.deinit();

        try parser.parse();
        return parser.insts.toOwnedSlice();
    }

    fn parse(self: *Parser) !void {
        _ = try self.parseExpr();
    }

    fn parseExpr(self: *Parser) !Types.Input {
        const lhs = try self.parseFactor();

        if (self.advanceIfOp(Types.Op.add)) {
            const rhs = try self.parseExpr();

            return try self.addInst(Types.SSA{ .op = .{
                .op = .add,
                .lhs = lhs,
                .rhs = rhs,
            } });
        } else {
            return lhs;
        }
    }

    fn parseFactor(self: *Parser) !Types.Input {
        if (self.advanceIfNumber()) |val| {
            return try self.addInst(Types.SSA{ .constant = val });
        }

        if (self.advanceIfArg()) |arg| {
            return try self.addInst(Types.SSA{ .arg = arg });
        }

        @panic("TODO error: we get to this point");
    }

    fn advanceIfOp(self: *Parser, op: Types.Op) bool {
        if (self.index >= self.toks.len) {
            return false;
        }

        return switch (self.toks[self.index]) {
            .op => |op2| {
                if (op == op2) {
                    _ = self.advance();
                    return true;
                } else {
                    return false;
                }
            },
            else => false,
        };
    }

    fn advanceIfNumber(self: *Parser) ?f32 {
        if (self.index >= self.toks.len) {
            return null;
        }

        return switch (self.toks[self.index]) {
            .val => |val| {
                _ = self.advance();
                return val;
            },
            else => null,
        };
    }

    fn advanceIfArg(self: *Parser) ?Types.Arg {
        if (self.index >= self.toks.len) {
            return null;
        }

        return switch (self.toks[self.index]) {
            .arg => |arg| {
                _ = self.advance();
                return arg;
            },
            else => null,
        };
    }

    fn advance(self: *Parser) Types.Token {
        self.index += 1;
        return self.toks[self.index - 1];
    }

    fn addInst(self: *Parser, inst: Types.SSA) !Types.Input {
        if (self.cache.get(inst)) |idx| {
            return idx;
        } else {
            try self.insts.append(inst);
            const i = self.insts.items.len - 1;
            try self.cache.put(inst, i);
            return i;
        }
    }
};

// SSA -> Register allocated
pub const RegAlloc = struct {
    ssa: []Types.SSA,
    output: []Types.Inst,

    // SSA -> Register
    active: std.AutoHashMap(usize, usize),
    free: std.ArrayList(usize),
    r: usize,

    pub fn do(gpa: std.mem.Allocator, ssa: []Types.SSA) ![]Types.Inst {
        var regAlloc = RegAlloc{
            .ssa = ssa,
            .output = try gpa.alloc(Types.Inst, ssa.len),
            .active = std.AutoHashMap(usize, usize).init(gpa),
            .free = std.ArrayList(usize).init(gpa),
            .r = 0,
        };
        defer regAlloc.active.deinit();
        defer regAlloc.free.deinit();

        var i: usize = regAlloc.ssa.len;
        while (i > 0) {
            i -= 1;

            const elem = regAlloc.ssa[i];

            var inst = Types.Inst{
                .ssa = elem,
                .out = 0,
            };

            inst.out = try regAlloc.bind(i);
            try regAlloc.unbind(i);
            switch (inst.ssa) {
                .op => |op| {
                    inst.ssa.op.lhs = try regAlloc.bind(op.lhs);
                    inst.ssa.op.rhs = try regAlloc.bind(op.rhs);
                },
                else => {},
            }

            regAlloc.output[i] = inst;
        }

        return regAlloc.output;
    }

    // Returns register
    fn bind(self: *RegAlloc, inst: usize) !usize {
        if (self.active.get(inst)) |r| {
            return r;
        } else if (self.free.items.len == 0) {
            self.r += 1;

            try self.active.put(inst, self.r - 1);
            return self.r - 1;
        } else {
            const r = self.free.swapRemove(0);
            try self.active.put(inst, r);
            return r;
        }
    }

    fn unbind(self: *RegAlloc, inst: usize) !void {
        if (self.active.get(inst)) |r| {
            _ = self.active.remove(inst);

            try self.free.append(r);
        }
    }
};
