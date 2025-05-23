const std = @import("std");
const wgpu = @import("wgpu");

pub const Renderer = struct {
    config: Config,

    pub const Config = struct {
        image_width: usize = 1024,
        image_height: usize = 1024,
        image_subdivisions: usize = 64,
    };

    pub fn init(config: Config) !Renderer {
        // Init device
        std.debug.print("Creating instance...\n", .{});

        const instance = wgpu.Instance.create(null).?;
        defer instance.release();

        std.debug.print("Creating adapter...\n", .{});
        const adapter_request = instance.requestAdapterSync(&wgpu.RequestAdapterOptions{});
        const adapter = switch (adapter_request.status) {
            .success => adapter_request.adapter.?,
            else => {
                std.debug.print("Adapter message: {s}\n", .{adapter_request.message.?});
                @panic("Failed to make adapter");
            },
        };
        defer adapter.release();

        // Init bind group layout

        // Init buffers

        // Init bind group

        return Renderer{
            .config = config,
        };
    }
};
