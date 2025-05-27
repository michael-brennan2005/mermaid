const std = @import("std");
const Types = @import("frontend.zig").Types;

pub const InstEncoding = struct {
    pub const Opcode = enum(u8) {
        constant = 0, // reg <- imm
        x = 1, // reg <- x
        y = 2, // reg <- y
        add = 3, // reg <- reg + reg
    };

    pub const Arg = enum(u8) { x = 0, y = 1 };

    pub fn encode(writer: std.io.AnyWriter, insts: []Types.Inst, endian: std.builtin.Endian) !void {
        for (insts) |inst| {
            switch (inst.ssa) {
                .constant => |constant| {
                    try writer.writeByte(@intFromEnum(Opcode.constant));
                    try writer.writeByte(@intCast(inst.out));
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                    try writer.writeInt(u32, @bitCast(constant), endian);
                },
                .arg => |arg| {
                    switch (arg) {
                        .x => {
                            try writer.writeByte(@intFromEnum(Opcode.x));
                        },
                        .y => {
                            try writer.writeByte(@intFromEnum(Opcode.y));
                        },
                    }

                    try writer.writeByte(@intCast(inst.out));
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                },
                .op => |op| {
                    switch (op.op) {
                        .add => {
                            try writer.writeByte(@intFromEnum(Opcode.add));
                        },
                        else => {
                            @panic("TODO error: unsupported");
                        },
                    }
                    try writer.writeByte(@intCast(inst.out));
                    try writer.writeByte(@intCast(op.lhs));
                    try writer.writeByte(@intCast(op.rhs));
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                },
            }
        }
    }
};
