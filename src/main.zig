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
const lib = @import("teddy_lib");

pub fn main() !void {
    var gpa = std.heap.DebugAllocator(.{}){};
    const alloc = gpa.allocator();

    var tokenizer = lib.Tokenizer.init("x+x+0.5+y");
    const toks = try tokenizer.collect(alloc);

    std.debug.print("Tokens:\n", .{});
    for (toks) |tok| {
        Debug.prettyPrintToken(tok);
        std.debug.print("\n", .{});
    }

    var parser = lib.Parser.init(alloc, toks);
    try parser.parse();

    std.debug.print("\nSSA:\n", .{});
    for (parser.insts.items, 0..) |inst, i| {
        std.debug.print("${d} = ", .{i});
        Debug.prettyPrintSSA(inst);
        std.debug.print("\n", .{});
    }

    var regAlloc = try lib.RegAlloc.init(alloc, try parser.insts.toOwnedSlice());
    try regAlloc.do();

    std.debug.print("\nReg alloc:\n", .{});
    for (regAlloc.output.items) |inst| {
        std.debug.print("${d} = ", .{inst.out});
        Debug.prettyPrintRegAlloc(inst);
        std.debug.print("\n", .{});
    }
}

const Debug = struct {
    pub fn prettyPrintToken(tok: lib.Tokenizer.Token) void {
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

    pub fn prettyPrintSSA(inst: lib.Parser.Inst) void {
        std.debug.print("{s} ", .{@tagName(inst.op)});
        prettyPrintInput(inst.lhs);
        std.debug.print(" ", .{});
        prettyPrintInput(inst.rhs);
    }

    fn prettyPrintInput(input: lib.Parser.Inst.Input) void {
        switch (input) {
            .idx => |idx| std.debug.print("${d}", .{idx}),
            .arg => |arg| std.debug.print("{s}", .{@tagName(arg)}),
            .imm => |imm| std.debug.print("{d}", .{imm}),
        }
    }

    pub fn prettyPrintRegAlloc(inst: lib.RegAlloc.Inst) void {
        std.debug.print("{s} ", .{@tagName(inst.op)});
        prettyPrintInput2(inst.lhs);
        std.debug.print(" ", .{});
        prettyPrintInput2(inst.rhs);
    }

    fn prettyPrintInput2(input: lib.RegAlloc.Inst.Input) void {
        switch (input) {
            .idx => |idx| std.debug.print("${d}", .{idx}),
            .arg => |arg| std.debug.print("{s}", .{@tagName(arg)}),
            .imm => |imm| std.debug.print("{d}", .{imm}),
        }
    }
};
