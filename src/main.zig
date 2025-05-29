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
const frontend = @import("./frontend.zig");

const alloc = std.heap.wasm_allocator;
const native_endian = @import("builtin").cpu.arch.endian();

export fn allocate(len: u32) u32 {
    const buf = alloc.alloc(u8, len) catch return 0;
    return @intFromPtr(buf.ptr);
}

export fn free(addr: u32, len: u32) void {
    alloc.free(@as([*]u8, @ptrFromInt(addr))[0..len]);
}

extern fn consoleLog(addr: usize, len: usize) void;

pub const panic = std.debug.FullPanic(panicHandler);
const panicString = "INCOMING PANIC:";
fn panicHandler(msg: []const u8, first_trace_addr: ?usize) noreturn {
    _ = first_trace_addr;
    consoleLog(@intFromPtr(panicString), panicString.len);
    consoleLog(@intFromPtr(msg.ptr), msg.len);
    @trap();
}

var printBuffer: [1024]u8 = [_]u8{0} ** 1024;
pub fn print(comptime fmt: []const u8, args: anytype) void {
    var stream = std.io.fixedBufferStream(&printBuffer);
    const writer = stream.writer();

    std.fmt.format(writer, fmt, args) catch return;
    consoleLog(@intFromPtr(&printBuffer), stream.pos);
}

export fn wasmTest(size: u32) void {
    var arr = std.ArrayList(u32).init(alloc);
    defer arr.deinit();

    for (0..size) |i| {
        arr.append(i) catch @panic("OOM");
        print("Element: {d}", .{i});
    }
}

export fn wasmTest2(size: u32) void {
    _ = size;
    @panic("OOM");
}

export fn compile(addr: usize, len: usize) u32 {
    const str: [:0]u8 = @as([*]u8, @ptrFromInt(addr))[0..len :0];

    print("Running tokenization on string: {s}", .{str});
    const tokens = frontend.Tokenizer.do(alloc, str) catch {
        @panic("Tokens failed");
    };
    defer alloc.free(tokens);

    print("Now doing ssa... (tokens length: {d})", .{tokens.len});
    const ssa = frontend.Parser.do(alloc, tokens) catch {
        @panic("Parser failed");
    };
    defer alloc.free(ssa);

    for (ssa, 0..) |elem, i| {
        print("${d} = {s} ${d} ${d}", .{ i, @tagName(elem.op), elem.lhs, elem.rhs });
    }

    print("Now creating final insts... (ssa len: {d})", .{ssa.len});
    const bytes = frontend.RegAlloc.do(alloc, ssa) catch {
        @panic("RegAlloc failed");
    };

    print("ZIG SIDE: bytes is {any}", .{bytes});
    return @intFromPtr(bytes.ptr);
}
