const std = @import("std");
const Types = @import("frontend.zig").Types;

pub const InstEncoding = struct {
    pub const Opcode = enum(u8) {
        constant = 0, // reg <- imm
        x = 1, // reg <- x
        y = 2, // reg <- y
        add = 2, // reg <- reg + reg
    };

    pub const Arg = enum(u8) { x = 0, y = 1 };

    pub fn encode(gpa: std.mem.Allocator, insts: []Types.Inst) ![]u8 {
        const arr = std.ArrayList(u8).init(gpa);
        const writer = arr.writer();

        for (insts) |inst| {
            switch (inst.ssa) {
                .constant => |constant| {
                    try writer.writeByte(Opcode.constant);
                    try writer.writeByte(inst.out);
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                    try writer.write(constant);
                },
                .arg => |arg| {
                    switch (arg) {
                        .x => {
                            try writer.writeByte(Opcode.x);
                        },
                        .y => {
                            try writer.writeByte(Opcode.y);
                        },
                    }

                    try writer.writeByte(inst.out);
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                },
                .op => |op| {
                    switch (op) {
                        .add => {
                            try writer.writeByte(Opcode.add);
                        },
                    }
                    try writer.writeByte(inst.out);
                    try writer.writeByte(op.lhs);
                    try writer.writeByte(op.rhs);
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                    try writer.writeByte(0x0);
                },
            }
        }
    }
};
