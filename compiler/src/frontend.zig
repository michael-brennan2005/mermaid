// Text -> Register allocated instructions
const std = @import("std");

const print = @import("./main.zig").print;

const little_endian = std.builtin.Endian.little;

pub const CompilationError = struct {
    tag: Tag,
    msg: [:0]const u8,

    // TODO: add one for OOM-style errors
    pub const Tag = enum { Tokenization, Parsing };

    // bit redundant for now but will be useful later when we want formatted error msgs
    pub fn init(tag: Tag, msg: [:0]const u8) CompilationError {
        return CompilationError{
            .tag = tag,
            .msg = msg,
        };
    }

    pub fn toString(self: *const CompilationError, alloc: std.mem.Allocator) []const u8 {
        var buf = std.ArrayList(u8).init(alloc);
        const writer = buf.writer();

        std.fmt.format(writer, "{s}Error: {s}", .{ @tagName(self.tag), self.msg }) catch {
            @panic("TODO: handle this");
        };

        return buf.toOwnedSlice() catch {
            @panic("TODO: handle this");
        };
    }
};

// Allow SSA and RegAlloc to share types (and eventually tokenizer)
pub const Types = struct {
    pub const Opcode = enum(u8) {
        // reg <- {imm, x, y}
        constant = 0,
        x = 1,
        y = 2,
        // reg <- reg [op] reg
        add = 3,
        sub = 4,
        mul = 5,
        div = 6,
        // reg <- fn(reg)
        sqrt = 7,
        sin = 8,
        cos = 9,
        asin = 10,
        acos = 11,
        atan = 12,
        exp = 13,
        log = 14,
        abs = 15,
        // reg <- fn(reg, reg)
        min = 16,
        max = 17,

        pub fn fromFunc1(val: Token.Func1) Opcode {
            return switch (val) {
                .sqrt => .sqrt,
                .sin => .sin,
                .cos => .cos,
                .asin => .asin,
                .acos => .acos,
                .atan => .atan,
                .exp => .exp,
                .log => .log,
                .abs => .abs,
            };
        }

        pub fn fromFunc2(val: Token.Func2) Opcode {
            return switch (val) {
                .min => .min,
                .max => .max,
            };
        }
    };

    pub const SSA = packed struct {
        op: Opcode,
        lhs: usize = 0,
        rhs: usize = 0,
        // Imm is really a f32, but we use u32 to allow this struct to be easily hashed
        // for subexpression elimination
        imm: u32 = 0.0,

        pub fn constant(imm: f32) SSA {
            const imm_u32: u32 = @bitCast(imm);
            return SSA{ .op = .constant, .imm = imm_u32 };
        }

        pub fn x() SSA {
            return SSA{ .op = .x };
        }

        pub fn y() SSA {
            return SSA{ .op = .y };
        }

        pub fn binOp(op: Opcode, lhs: usize, rhs: usize) SSA {
            return SSA{ .op = op, .lhs = lhs, .rhs = rhs };
        }

        pub fn unaryOp(op: Opcode, lhs: usize) SSA {
            return SSA{ .op = op, .lhs = lhs };
        }
    };

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

        pub const Op = enum { add, sub, mul, div };
        pub const Func1 = enum { sqrt, sin, cos, asin, acos, atan, exp, log, abs };
        pub const Func2 = enum { min, max };
        pub const Arg = enum { x, y };
    };
};

// Text -> Tokens
pub const Tokenizer = struct {
    error_msg: ?[:0]const u8 = null,
    buffer: [:0]const u8,
    index: usize,

    pub fn do(gpa: std.mem.Allocator, buffer: [:0]const u8, err: *?CompilationError) ![]Types.Token {
        var tokenizer = Tokenizer{ .buffer = buffer, .index = 0 };
        var arr = std.ArrayList(Types.Token).init(gpa);
        while (try tokenizer.next(err)) |tok| {
            try arr.append(tok);
        }
        return arr.toOwnedSlice();
    }

    // TODO: support numbers in form of ".32"
    const State = enum { start, int, float, identifier };

    const Error = error{TokenError};
    pub fn next(self: *Tokenizer, err: *?CompilationError) Error!?Types.Token {
        var start: usize = 0;
        state: switch (State.start) {
            .start => switch (self.buffer[self.index]) {
                0 => {
                    if (self.index == self.buffer.len) {
                        return null;
                    } else {
                        err.* = CompilationError.init(.Tokenization, "expected null terminator at end of string");
                        return Error.TokenError;
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
                    err.* = CompilationError.init(.Tokenization, "unexpected character");
                    return Error.TokenError;
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
                            err.* = CompilationError.init(.Tokenization, "unable to parse integer");
                            return Error.TokenError;
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
                            err.* = CompilationError.init(.Tokenization, "unable to parse float");
                            return Error.TokenError;
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
                            err.* = CompilationError.init(.Tokenization, "unexpected identifier");
                            return Error.TokenError;
                        }
                    },
                }
            },
        }
    }

    fn getIdentifierToken(buf: []const u8) ?Types.Token {
        const Arg = Types.Token.Arg;
        const Func1 = Types.Token.Func1;
        const Func2 = Types.Token.Func2;

        const map = [_]struct { []const u8, Types.Token }{
            .{ "x", Types.Token{ .arg = Arg.x } },
            .{ "y", Types.Token{ .arg = Arg.y } },
            // .{ "z", Types.Token{ .arg = Types.Arg.z } },
            .{ "sqrt", Types.Token{ .func1 = Func1.sqrt } },
            .{ "sin", Types.Token{ .func1 = Func1.sin } },
            .{ "cos", Types.Token{ .func1 = Func1.cos } },
            .{ "asin", Types.Token{ .func1 = Func1.asin } },
            .{ "acos", Types.Token{ .func1 = Func1.acos } },
            .{ "atan", Types.Token{ .func1 = Func1.atan } },
            .{ "exp", Types.Token{ .func1 = Func1.exp } },
            .{ "log", Types.Token{ .func1 = Func1.log } },
            .{ "abs", Types.Token{ .func1 = Func1.abs } },
            .{ "min", Types.Token{ .func2 = Func2.min } },
            .{ "max", Types.Token{ .func2 = Func2.max } },
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
    err: *?CompilationError,
    index: usize,
    toks: []Types.Token,
    insts: std.ArrayList(Types.SSA),
    // Keeping a cache allows for subexpression elimination
    cache: std.AutoHashMap(Types.SSA, usize),

    pub fn do(gpa: std.mem.Allocator, toks: []Types.Token, err: *?CompilationError) ![]Types.SSA {
        var parser = Parser{
            .index = 0,
            .cache = std.AutoHashMap(Types.SSA, usize).init(gpa),
            .insts = std.ArrayList(Types.SSA).init(gpa),
            .toks = toks,
            .err = err,
        };
        defer parser.cache.deinit();

        try parser.parse();
        return parser.insts.toOwnedSlice();
    }

    const Error = error{ParseError};

    fn parse(self: *Parser) Error!void {
        _ = try self.parseExpr();
    }

    fn parseExpr(self: *Parser) Error!Types.Input {
        var lhs = try self.parseTerm();

        while (true) {
            if (self.advanceIfOp(Types.Token.Op.add)) {
                const rhs = try self.parseTerm();
                lhs = try self.addInst(Types.SSA.binOp(.add, lhs, rhs));
            } else if (self.advanceIfOp(Types.Token.Op.sub)) {
                const rhs = try self.parseTerm();
                lhs = try self.addInst(Types.SSA.binOp(.sub, lhs, rhs));
            } else {
                break;
            }
        }

        return lhs;
    }

    fn parseTerm(self: *Parser) Error!Types.Input {
        var lhs = try self.parseFactor();

        while (true) {
            if (self.advanceIfOp(Types.Token.Op.mul)) {
                const rhs = try self.parseFactor();
                lhs = try self.addInst(Types.SSA.binOp(.mul, lhs, rhs));
            } else if (self.advanceIfOp(Types.Token.Op.div)) {
                const rhs = try self.parseFactor();
                lhs = try self.addInst(Types.SSA.binOp(.div, lhs, rhs));
            } else {
                break;
            }
        }

        return lhs;
    }

    fn parseFactor(self: *Parser) Error!Types.Input {
        if (self.advanceIf(.left_paren)) |_| {
            const expr = try self.parseExpr();

            if (self.advanceIf(.right_paren) == null) {
                self.err.* = CompilationError.init(.Parsing, "expected right paren");
                return Error.ParseError;
            }

            return expr;
        }

        if (self.advanceIf(.val)) |val| {
            return try self.addInst(Types.SSA.constant(val));
        }

        if (self.advanceIf(.arg)) |arg| {
            return try self.addInst(switch (arg) {
                .x => Types.SSA.x(),
                .y => Types.SSA.y(),
            });
        }

        if (self.advanceIf(.func1)) |func1| {
            if (self.advanceIf(.left_paren) == null) {
                self.err.* = CompilationError.init(.Parsing, "expected left paren after function name");
                return Error.ParseError;
            }

            const expr = try self.parseExpr();

            if (self.advanceIf(.right_paren) == null) {
                self.err.* = CompilationError.init(.Parsing, "expected right paren after function arg");
                return Error.ParseError;
            }

            return try self.addInst(Types.SSA.unaryOp(Types.Opcode.fromFunc1(func1), expr));
        }

        if (self.advanceIf(.func2)) |func2| {
            if (self.advanceIf(.left_paren) == null) {
                self.err.* = CompilationError.init(.Parsing, "expected left paren after function name");
                return Error.ParseError;
            }

            const lhs = try self.parseExpr();

            if (self.advanceIf(.comma) == null) {
                self.err.* = CompilationError.init(.Parsing, "expected comma after first expr");
                return Error.ParseError;
            }

            const rhs = try self.parseExpr();

            if (self.advanceIf(.right_paren) == null) {
                self.err.* = CompilationError.init(.Parsing, "expected right paren after function arg");
                return Error.ParseError;
            }

            return try self.addInst(Types.SSA.binOp(Types.Opcode.fromFunc2(func2), lhs, rhs));
        }

        self.err.* = CompilationError.init(.Parsing, "expected left paren, val, arg, or function");
        return Error.ParseError;
    }

    fn advanceIf(
        self: *Parser,
        comptime tag: std.meta.Tag(Types.Token),
    ) ?@FieldType(Types.Token, @tagName(tag)) {
        if (self.index >= self.toks.len) {
            return null;
        }

        if (self.toks[self.index] == tag) {
            _ = self.advance();
            return @field(self.toks[self.index - 1], @tagName(tag));
        }

        return null;
    }

    fn advanceIfOp(self: *Parser, op: Types.Token.Op) bool {
        if (self.index >= self.toks.len) {
            return false;
        }

        switch (self.toks[self.index]) {
            .op => |_op| {
                if (op == _op) {
                    _ = self.advance();
                    return true;
                }
            },
            else => {},
        }

        return false;
    }

    fn advance(self: *Parser) Types.Token {
        self.index += 1;
        return self.toks[self.index - 1];
    }

    fn addInst(self: *Parser, inst: Types.SSA) Error!Types.Input {
        if (self.cache.get(inst)) |idx| {
            return idx;
        } else {
            self.insts.append(inst) catch {
                self.err.* = CompilationError.init(.Parsing, "OOM error appending to insts");
                return Error.ParseError;
            };
            const i = self.insts.items.len - 1;
            self.cache.put(inst, i) catch {
                // TODO: actually fine if this fails? just means we lose out on some optimization
                self.err.* = CompilationError.init(.Parsing, "OOM error appending to cache");
                return Error.ParseError;
            };
            return i;
        }
    }
};

// SSA -> Register allocated + final encoded
pub const RegAlloc = struct {
    ssa: []Types.SSA,
    // First 4 bytes are # of insts, remaining bytes are clauses (8 byte/clause)
    output: []u8,

    // SSA -> Register
    active: std.AutoHashMap(usize, usize),
    free: std.ArrayList(usize),
    r: usize,

    pub fn do(gpa: std.mem.Allocator, ssa: []Types.SSA) ![]u8 {
        var regAlloc = RegAlloc{
            .ssa = ssa,
            .output = try gpa.alloc(u8, 8 * ssa.len),
            .active = std.AutoHashMap(usize, usize).init(gpa),
            .free = std.ArrayList(usize).init(gpa),
            .r = 0,
        };
        defer regAlloc.active.deinit();
        defer regAlloc.free.deinit();

        var i: usize = regAlloc.ssa.len;
        while (i > 0) {
            i -= 1;

            var inst = regAlloc.ssa[i];
            const out = try regAlloc.bind(i);

            try regAlloc.unbind(i);
            switch (inst.op) {
                .add, .sub, .mul, .div, .min, .max => {
                    inst.lhs = try regAlloc.bind(inst.lhs);
                    inst.rhs = try regAlloc.bind(inst.rhs);
                },
                .sqrt, .sin, .cos, .asin, .acos, .atan, .exp, .log, .abs => {
                    inst.lhs = try regAlloc.bind(inst.lhs);
                },
                else => {},
            }

            regAlloc.encodeInst(
                i,
                inst.op,
                @intCast(out),
                @intCast(inst.lhs),
                @intCast(inst.rhs),
                @intCast(inst.imm),
            );
        }

        return regAlloc.output;
    }

    // TODO: out, lhs, rhs should be usize (or whatever types.ssa uses), throw error if we're somehow
    // using more registers than 255
    fn encodeInst(self: *RegAlloc, idx: usize, opcode: Types.Opcode, out: u8, lhs: u8, rhs: u8, imm: u32) void {
        // WGSL's smallest integer type is u32, so each clause has to be encoded as two seperate u32s, read little endian
        // Logically, we'd like to think of encoded inst as <opcode: byte><output: byte><lhs: byte><rhs: byte><imm: f32>
        // So, we encode the opcode, output, lhs, byte in reverse order, and immediate in the next u32

        const start = (idx * 8);

        self.output[start] = rhs;
        self.output[start + 1] = lhs;
        self.output[start + 2] = out;
        self.output[start + 3] = @intFromEnum(opcode);

        std.mem.writeInt(u32, @ptrCast(self.output.ptr + start + 4), imm, std.builtin.Endian.little);
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
