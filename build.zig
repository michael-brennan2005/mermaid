const std = @import("std");
const demo_webserver = @import("demo_webserver");

pub fn build(b: *std.Build) void {
    const optimize = b.standardOptimizeOption(.{});
    const dir = std.Build.InstallDir.prefix;

    // const zjb = b.dependency("javascript_bridge", .{});

    const exe = b.addExecutable(.{
        .name = "teddy",
        .root_module = b.createModule(.{
            .root_source_file = b.path("src/main.zig"),
            .target = b.resolveTargetQuery(.{ .cpu_arch = .wasm32, .os_tag = .emscripten }),
            .optimize = optimize,
        }),
    });
    // exe.root_module.addImport("zjb", zjb.module("zjb"));
    exe.entry = .disabled;
    exe.rdynamic = true;
    exe.import_memory = true;

    // const extract_simple = b.addRunArtifact(zjb.artifact("generate_js"));
    // const extract_simple_out = extract_simple.addOutputFileArg("zjb_extract.js");
    // extract_simple.addArg("Zjb"); // Name of js class.
    // extract_simple.addArtifactArg(exe);

    const install_step = b.getInstallStep();
    install_step.dependOn(&b.addInstallArtifact(exe, .{
        .dest_dir = .{ .override = dir },
    }).step);
    // install_step.dependOn(&b.addInstallFileWithDir(extract_simple_out, dir, "zjb_extract.js").step);
    install_step.dependOn(&b.addInstallDirectory(.{
        .source_dir = b.path("static"),
        .install_dir = dir,
        .install_subdir = "",
    }).step);

    const run_demo_server = demo_webserver.runDemoServer(b, install_step, .{});
    const serve = b.step("serve", "serve website locally");
    serve.dependOn(run_demo_server);
}
