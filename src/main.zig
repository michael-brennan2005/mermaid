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

extern fn logPanic(addr: usize, len: usize) void;
extern fn logDebug(addr: usize, len: usize) void;

pub const panic = std.debug.FullPanic(panicHandler);
fn panicHandler(msg: []const u8, first_trace_addr: ?usize) noreturn {
    _ = first_trace_addr;
    logPanic(@intFromPtr(msg.ptr), msg.len);
    @trap();
}

fn print(msg: []const u8) void {
    logDebug(@intFromPtr(msg.ptr), msg.len);
}

export fn wasmTest(size: u32) void {
    var arr = std.ArrayList(u32).init(alloc);
    defer arr.deinit();

    for (0..size) |i| {
        arr.append(i) catch @panic("OOM");
        print("XXXXXX");
    }
}

export fn wasmTest2(size: u32) void {
    _ = size;
    @panic("OOM");
}

export fn compile() void {
    const tokens = frontend.Tokenizer.do(alloc, "x + y") catch {
        @panic("Tokens failed");
    };

    print("We did well!");
    _ = tokens;
}
