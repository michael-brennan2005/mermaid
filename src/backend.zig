const std = @import("std");
const Types = @import("frontend.zig").Types;

pub const InstEncoding = struct {
    pub const Opcode = enum(u8) {
        constant = 0, // reg <- imm
        x = 1, // reg <- x
        y = 2, // reg <- y
        add = 3, // reg <- reg + reg
    };

    pub fn encodeInst(writer: std.io.AnyWriter, opcode: Opcode, out: u8, lhs: u8, rhs: u8, imm: f32) !void {
        try writer.writeByte(rhs);
        try writer.writeByte(lhs);
        try writer.writeByte(out);
        try writer.writeByte(@intFromEnum(opcode));

        try writer.writeInt(u32, @bitCast(imm), std.builtin.Endian.little);
    }

    pub fn encode(writer: std.io.AnyWriter, insts: []Types.Inst) !void {
        for (insts) |inst| {
            switch (inst.ssa) {
                .constant => |constant| {
                    try encodeInst(writer, Opcode.constant, @intCast(inst.out), 0, 0, constant);
                },
                .arg => |arg| {
                    const op = switch (arg) {
                        .x => Opcode.x,
                        .y => Opcode.y,
                    };

                    try encodeInst(writer, op, @intCast(inst.out), 0, 0, 0.0);
                },
                .op => |op| {
                    const opcode = switch (op.op) {
                        .add => Opcode.add,
                        else => {
                            @panic("TODO error: unsupported");
                        },
                    };

                    try encodeInst(writer, opcode, @intCast(inst.out), @intCast(op.lhs), @intCast(op.rhs), 0.0);
                },
            }
        }
    }
};
