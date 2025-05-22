// Text -> Register allocated instructions
const std = @import("std");

// Text -> Tokens
pub const Tokenizer = struct {
    buffer: [:0]const u8,
    index: usize,

    pub const Token = union(enum) {
        val: f32,
        op: Op,

        arg: Arg,
        func1: Func1,
        func2: Func2,

        left_paren,
        right_paren,
        comma,

        pub const Arg = enum { X, Y, Z };
        pub const Op = enum { Add, Sub, Mul, Div };
        pub const Func1 = enum { Sqrt, Sin, Cos, Asin, Acos, Atan, Exp, Log, Abs };
        pub const Func2 = enum { Min, Max };
    };

    pub fn init(buffer: [:0]const u8) Tokenizer {
        return .{ .buffer = buffer, .index = 0 };
    }

    // TODO: support numbers in form of ".32"
    // TODO: better name for identifier
    const State = enum { start, int, float, identifier };

    pub fn next(self: *Tokenizer) !?Token {
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
                    return Token{
                        .op = switch (self.buffer[self.index - 1]) {
                            '+' => .Add,
                            '-' => .Sub,
                            '*' => .Mul,
                            '/' => .Div,
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

                        return Token{
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

                        return Token{
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

    pub fn collect(self: *Tokenizer, gpa: std.mem.Allocator) ![]Token {
        var arr = std.ArrayList(Token).init(gpa);

        while (try self.next()) |tok| {
            try arr.append(tok);
        }

        return arr.toOwnedSlice();
    }

    fn getIdentifierToken(buf: []const u8) ?Token {
        const map = [_]struct { []const u8, Token }{
            .{ "x", Token{ .arg = Token.Arg.X } },
            .{ "y", Token{ .arg = Token.Arg.Y } },
            .{ "z", Token{ .arg = Token.Arg.Z } },
            .{ "sqrt", Token{ .func1 = Token.Func1.Sqrt } },
            .{ "sin", Token{ .func1 = Token.Func1.Sin } },
            .{ "cos", Token{ .func1 = Token.Func1.Cos } },
            .{ "asin", Token{ .func1 = Token.Func1.Asin } },
            .{ "acos", Token{ .func1 = Token.Func1.Acos } },
            .{ "atan", Token{ .func1 = Token.Func1.Atan } },
            .{ "exp", Token{ .func1 = Token.Func1.Exp } },
            .{ "log", Token{ .func1 = Token.Func1.Log } },
            .{ "abs", Token{ .func1 = Token.Func1.Abs } },
            .{ "min", Token{ .func2 = Token.Func2.Min } },
            .{ "max", Token{ .func2 = Token.Func2.Max } },
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
    toks: []Tokenizer.Token,
    insts: std.ArrayList(Inst),

    pub const Inst = struct {
        op: Op,
        lhs: Input,
        rhs: Input,

        pub const Op = enum { Add };

        pub const Input = union(enum) {
            idx: usize,
            arg: Tokenizer.Token.Arg,
            imm: f32,
        };
    };

    pub fn init(gpa: std.mem.Allocator, toks: []Tokenizer.Token) Parser {
        return Parser{
            .index = 0,
            .insts = std.ArrayList(Inst).init(gpa),
            .toks = toks,
        };
    }

    pub fn parse(self: *Parser) !void {
        _ = try self.parseExpr();
    }

    pub fn parseExpr(self: *Parser) !Inst.Input {
        const lhs = try self.parseFactor();

        if (self.advanceIfOp(Tokenizer.Token.Op.Add)) {
            const rhs = try self.parseExpr();

            try self.insts.append(Inst{
                .op = .Add,
                .lhs = lhs,
                .rhs = rhs,
            });

            return Inst.Input{
                .idx = self.insts.items.len - 1,
            };
        } else {
            return lhs;
        }
    }

    pub fn parseFactor(self: *Parser) !Inst.Input {
        if (self.advanceIfNumber()) |val| {
            return Inst.Input{ .imm = val };
        }

        if (self.advanceIfArg()) |arg| {
            return Inst.Input{ .arg = arg };
        }

        @panic("TODO error: we get to this point");
    }

    pub fn advanceIfOp(self: *Parser, op: Tokenizer.Token.Op) bool {
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

    pub fn advanceIfNumber(self: *Parser) ?f32 {
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

    pub fn advanceIfArg(self: *Parser) ?Tokenizer.Token.Arg {
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

    pub fn advance(self: *Parser) Tokenizer.Token {
        self.index += 1;
        return self.toks[self.index - 1];
    }
};

// SSA -> Register allocated
pub const RegAlloc = struct {
    insts: []Parser.Inst,
    output: std.ArrayList(Inst),

    // SSA -> Register
    active: std.AutoHashMap(usize, usize),
    free: std.ArrayList(usize),
    r: usize,

    pub const Inst = struct {
        op: Op,
        lhs: Input,
        rhs: Input,
        out: usize,

        pub const Op = enum { Add };

        pub const Input = union(enum) {
            idx: usize,
            arg: Tokenizer.Token.Arg,
            imm: f32,
        };
    };

    pub fn init(gpa: std.mem.Allocator, insts: []Parser.Inst) !RegAlloc {
        return RegAlloc{
            .insts = insts,
            .output = std.ArrayList(Inst).init(gpa),
            .active = std.AutoHashMap(usize, usize).init(gpa),
            .free = std.ArrayList(usize).init(gpa),
            .r = 0,
        };
    }

    pub fn do(self: *RegAlloc) !void {
        var i: usize = self.insts.len;
        while (i > 0) {
            i -= 1;

            const ssa = self.insts[i];

            var inst = Inst{
                .op = .Add,
                .lhs = Inst.Input{ .imm = -1.0 },
                .rhs = Inst.Input{ .imm = -1.0 },
                .out = 0,
            };

            inst.out = try self.bind(i);

            switch (ssa.lhs) {
                .idx => |idx| {
                    inst.lhs = Inst.Input{
                        .idx = try self.bind(idx),
                    };
                },
                else => {},
            }

            switch (ssa.rhs) {
                .idx => |idx| {
                    inst.rhs = Inst.Input{
                        .idx = try self.bind(idx),
                    };
                },
                else => {},
            }

            try self.unbind(i);

            try self.output.append(inst);
        }
    }

    // Returns register
    fn bind(self: *RegAlloc, inst: usize) !usize {
        if (self.free.items.len == 0) {
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
