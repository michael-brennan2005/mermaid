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

pub const Tokenizer = @import("./frontend.zig").Tokenizer;
pub const Parser = @import("./frontend.zig").Parser;
pub const RegAlloc = @import("./frontend.zig").RegAlloc;
pub const Types = @import("./frontend.zig").Types;

pub fn main() !void {
    var gpa = std.heap.DebugAllocator(.{}){};
    const alloc = gpa.allocator();

    const tokens = try Tokenizer.do(alloc, "x+y+y+0.5");
    const ssa = try Parser.do(alloc, tokens);
    const insts = try RegAlloc.do(alloc, ssa);

    std.debug.print("Tokens:\n", .{});
    for (tokens) |tok| {
        Debug.prettyPrintToken(tok);
        std.debug.print("\n", .{});
    }

    std.debug.print("\nSSA:\n", .{});
    for (ssa, 0..) |inst, i| {
        std.debug.print("${d} = ", .{i});
        Debug.prettyPrintSSA(inst, '$');
        std.debug.print("\n", .{});
    }

    std.debug.print("\nReg alloc:\n", .{});
    for (insts) |inst| {
        std.debug.print("r{d} = ", .{inst.out});
        Debug.prettyPrintSSA(inst.ssa, 'r');
        std.debug.print("\n", .{});
    }
}

const Debug = struct {
    pub fn prettyPrintToken(tok: Types.Token) void {
        switch (tok) {
            .val => |val| {
                std.debug.print("Val({d})", .{val});
            },
            .op => |op| {
                std.debug.print("Op({s})", .{@tagName(op)});
            },
            .arg => |arg| {
                std.debug.print("Arg({s})", .{@tagName(arg)});
            },
            .func1 => |func1| {
                std.debug.print("Func1({s})", .{@tagName(func1)});
            },
            .func2 => |func2| {
                std.debug.print("Func2({s})", .{@tagName(func2)});
            },
            .left_paren => {
                std.debug.print("(", .{});
            },
            .right_paren => {
                std.debug.print(")", .{});
            },
            .comma => {
                std.debug.print(",", .{});
            },
        }
    }

    pub fn prettyPrintSSA(inst: Types.SSA, prefix: u8) void {
        switch (inst) {
            .op => |op| {
                std.debug.print("{s} {c}{d} {c}{d}", .{ @tagName(op.op), prefix, op.lhs, prefix, op.rhs });
            },
            .constant => |constant| {
                std.debug.print("const {d}", .{constant});
            },
            .arg => |arg| {
                std.debug.print("arg {s}", .{@tagName(arg)});
            },
        }
    }
};
