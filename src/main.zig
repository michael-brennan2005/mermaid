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
const encoding = @import("./encoding.zig");

const alloc = std.heap.wasm_allocator;
const little_endian = std.builtin.Endian.little;

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

export fn compile(addr: usize, len: usize) u32 {
    const str: [:0]u8 = @as([*]u8, @ptrFromInt(addr))[0..len :0];

    var err: ?frontend.CompilationError = null;

    const tokens = frontend.Tokenizer.do(alloc, str, &err) catch {
        if (err) |ce| {
            const buf = encoding.encodeError(alloc, ce);
            return @intFromPtr(buf.ptr);
        }

        @panic("Tokenization failed, no CE reported");
    };

    const ssa = frontend.Parser.do(alloc, tokens, &err) catch {
        if (err) |ce| {
            const buf = encoding.encodeError(alloc, ce);
            return @intFromPtr(buf.ptr);
        }

        @panic("Parser failed, no CE reported");
    };
    defer alloc.free(ssa);

    // for (ssa, 0..) |elem, i| {
    //     print("${d} = {s} ${d} ${d}", .{ i, @tagName(elem.op), elem.lhs, elem.rhs });
    // }

    const bytes = frontend.RegAlloc.do(alloc, ssa) catch {
        // Only way this errors as of now (may 31st) is OOM which I think is unlikely enough to warrant
        // panic
        @panic("RegAlloc failed");
    };

    const buf = encoding.encodeInsts(alloc, bytes);

    print("Buffer ff sent is {any}", .{buf});
    return @intFromPtr(buf.ptr);
}
