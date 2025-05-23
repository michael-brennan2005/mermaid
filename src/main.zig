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
const wgpu = @import("wgpu");

pub const Tokenizer = @import("./frontend.zig").Tokenizer;
pub const Parser = @import("./frontend.zig").Parser;
pub const RegAlloc = @import("./frontend.zig").RegAlloc;
pub const Types = @import("./frontend.zig").Types;

pub const Renderer = @import("./backend.zig").Renderer;

pub fn main() !void {
    var gpa = std.heap.DebugAllocator(.{}){};
    const alloc = gpa.allocator();

    const stdin = std.io.getStdIn().reader();
    const stdout = std.io.getStdOut().writer();

    const renderer = try Renderer.init(.{});
    _ = renderer;

    while (true) {
        try stdout.print("eq > ", .{});

        const buf = try stdin.readUntilDelimiterAlloc(alloc, '\n', 1024);
        const buf_terminated = try alloc.dupeZ(u8, buf);
        defer alloc.free(buf);
        defer alloc.free(buf_terminated);

        _ = try compile(alloc, buf_terminated);
    }
    // const instance = wgpu.Instance.create(null).?;
    // defer instance.release();

    // const adapter_request = instance.requestAdapterSync(&wgpu.RequestAdapterOptions{});
    // const adapter = switch (adapter_request.status) {
    //     .success => adapter_request.adapter.?,
    //     else => return error.NoAdapter,
    // };
    // defer adapter.release();

    // const device_request = adapter.requestDeviceSync(&wgpu.DeviceDescriptor{
    //     .required_limits = null,
    // });
    // const device = switch (device_request.status) {
    //     .success => device_request.device.?,
    //     else => return error.NoDevice,
    // };
    // defer device.release();

    // const queue = device.getQueue().?;
    // defer queue.release();

}

// Text -> register allocated instructions
pub fn compile(gpa: std.mem.Allocator, text: [:0]const u8) ![]Types.Inst {
    const tokens = try Tokenizer.do(gpa, text);
    const ssa = try Parser.do(gpa, tokens);
    const insts = try RegAlloc.do(gpa, ssa);

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

    return insts;
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
