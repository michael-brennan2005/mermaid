// Technology is a glittering lure. But there is the rare occasion when the public can be engaged on
// a level beyond flash, if they have a sentimental bond with the product.
//
// My first job, I was in house at a fur company with this old pro copywriter, Greek, named Teddy.
// And Teddy told me the most important idea in advertising was ‘new.’ Creates an itch. You simply
// put your product in there as a kind of calamine lotion.
//
// But he also talked about a deeper bond with the product: nostalgia. It’s delicate, but potent.
//
// Teddy told me that in Greek nostalgia literally means ‘the pain from an old wound.’  It’s a
// twinge in your heart, far more powerful than memory alone. This device isn’t a space ship. It’s a
// time machine. It goes backwards, forwards. Takes us to a place where we ache to go again.
//
// It’s not called ‘The Wheel.’ It’s called ‘The Carousel.’

const std = @import("std");

const alloc = std.heap.wasm_allocator;

pub const Tokenizer = @import("./frontend.zig").Tokenizer;
pub const Parser = @import("./frontend.zig").Parser;
pub const RegAlloc = @import("./frontend.zig").RegAlloc;
pub const Types = @import("./frontend.zig").Types;

export fn allocate(size: usize) usize {
    const memory = alloc.alloc(u8, size) catch {
        return 0;
    };
    return @intFromPtr(memory.ptr);
}

export fn free(addr: usize, len: usize) void {
    const ptr: [*]u8 = @ptrFromInt(addr);

    alloc.free(ptr[0..len]);
}

pub fn consoleLog(comptime fmt: []const u8, args: anytype) void {
    var arr = std.ArrayList(u8).init(alloc);

    std.fmt.format(arr.writer(), fmt, args) catch return;
}

// Text -> register allocated instructions
export fn compile(addr: usize, len: usize) void {
    const ptr: [*:0]u8 = @ptrFromInt(addr);
    const str: [:0]u8 = ptr[0..len :0];
    _ = str;
    @panic("Help!");
    // const tokens = Tokenizer.do(alloc, str) catch return;
    // const ssa = Parser.do(alloc, tokens) catch return;
    // const insts = RegAlloc.do(alloc, ssa) catch return;

    // consoleLog("Tokens:\n", .{});
    // for (tokens) |tok| {
    //     Debug.prettyPrintToken(tok);
    //     consoleLog("\n", .{});
    // }

    // consoleLog("\nSSA:\n", .{});
    // for (ssa, 0..) |inst, i| {
    //     consoleLog("${d} = ", .{i});
    //     Debug.prettyPrintSSA(inst, '$');
    //     consoleLog("\n", .{});
    // }

    // consoleLog("\nReg alloc:\n", .{});
    // for (insts) |inst| {
    //     consoleLog("r{d} = ", .{inst.out});
    //     Debug.prettyPrintSSA(inst.ssa, 'r');
    //     consoleLog("\n", .{});
    // }

    // return;
}

const Debug = struct {
    pub fn prettyPrintToken(tok: Types.Token) void {
        switch (tok) {
            .val => |val| {
                consoleLog("Val({d})", .{val});
            },
            .op => |op| {
                consoleLog("Op({s})", .{@tagName(op)});
            },
            .arg => |arg| {
                consoleLog("Arg({s})", .{@tagName(arg)});
            },
            .func1 => |func1| {
                consoleLog("Func1({s})", .{@tagName(func1)});
            },
            .func2 => |func2| {
                consoleLog("Func2({s})", .{@tagName(func2)});
            },
            .left_paren => {
                consoleLog("(", .{});
            },
            .right_paren => {
                consoleLog(")", .{});
            },
            .comma => {
                consoleLog(",", .{});
            },
        }
    }

    pub fn prettyPrintSSA(inst: Types.SSA, prefix: u8) void {
        switch (inst) {
            .op => |op| {
                consoleLog("{s} {c}{d} {c}{d}", .{ @tagName(op.op), prefix, op.lhs, prefix, op.rhs });
            },
            .constant => |constant| {
                consoleLog("const {d}", .{constant});
            },
            .arg => |arg| {
                consoleLog("arg {s}", .{@tagName(arg)});
            },
        }
    }
};
