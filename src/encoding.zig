const std = @import("std");
const frontend = @import("./frontend.zig");

const little_endian = std.builtin.Endian.little;

pub const MessageTypes = struct {
    pub const insts: u8 = 0x0;
    pub const compilation_error: u8 = 0x1;
};

pub fn encodeError(alloc: std.mem.Allocator, ce: frontend.CompilationError) []const u8 {
    var arr = std.ArrayList(u8).init(alloc);
    const writer = arr.writer();

    // TODO: potential memory leakage/lifetime issue
    const str = ce.toString(alloc);

    writer.writeByte(MessageTypes.compilation_error) catch {
        @panic("Writing failed (encodeError)");
    };
    writer.writeInt(u32, str.len, little_endian) catch {
        @panic("Writing failed (encodeError)");
    };
    writer.writeInt(u32, @intFromPtr(str.ptr), little_endian) catch {
        @panic("Writing failed (encodeError)");
    };

    return arr.toOwnedSlice() catch {
        @panic("TODO: handle this");
    };
}

pub fn encodeInsts(alloc: std.mem.Allocator, insts: []u8) []const u8 {
    var arr = std.ArrayList(u8).init(alloc);
    const writer = arr.writer();

    writer.writeByte(MessageTypes.insts) catch {
        @panic("Writing failed (encodeError)");
    };
    writer.writeInt(u32, insts.len, little_endian) catch {
        @panic("Writing failed (encodeError)");
    };
    writer.writeInt(u32, @intFromPtr(insts.ptr), little_endian) catch {
        @panic("Writing failed (encodeError)");
    };

    return arr.toOwnedSlice() catch {
        @panic("TODO: handle this");
    };
}
