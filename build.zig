const std = @import("std");
const demo_webserver = @import("demo_webserver");

pub fn build(b: *std.Build) void {
    const optimize = b.standardOptimizeOption(.{});
    const dir = std.Build.InstallDir.prefix;

    const exe = b.addExecutable(.{
        .name = "teddy",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = b.resolveTargetQuery(.{ .cpu_arch = .wasm32, .os_tag = .freestanding }),
            .optimize = optimize,
            .dwarf_format = .@"32",
        }),
    });

    exe.entry = .disabled;
    exe.rdynamic = true;
    exe.import_memory = true;
    exe.stack_size = std.wasm.page_size;
    exe.initial_memory = std.wasm.page_size * 17;
    exe.max_memory = std.wasm.page_size * 1024;

    const install_step = b.getInstallStep();
    install_step.dependOn(&b.addInstallArtifact(exe, .{
        .dest_dir = .{ .override = dir },
    }).step);
    install_step.dependOn(&b.addInstallDirectory(.{
        .source_dir = b.path("static"),
        .install_dir = dir,
        .install_subdir = "",
    }).step);

    const run_demo_server = demo_webserver.runDemoServer(b, install_step, .{});
    const serve = b.step("serve", "serve website locally");
    serve.dependOn(run_demo_server);
}
