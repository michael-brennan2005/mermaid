pub const packages = struct {
    pub const @"12209083b0c43d0f68a26a48a7b26ad9f93b22c9cff710c78ddfebb47b89cfb9c7a4" = struct {
        pub const build_root = "/home/mbrennan/.cache/zig/p/mime-2.0.1-AAAAAIQgAACQg7DEPQ9oompIp7Jq2fk7IsnP9xDHjd_r";
        pub const build_zig = @import("12209083b0c43d0f68a26a48a7b26ad9f93b22c9cff710c78ddfebb47b89cfb9c7a4");
        pub const deps: []const struct { []const u8, []const u8 } = &.{
        };
    };
    pub const @"demo_webserver-0.0.0-s8bjD7sqAACqVmz3kvf2iJbe0Jk9Hv6SBKz-kVlZ7q0J" = struct {
        pub const build_root = "/home/mbrennan/.cache/zig/p/demo_webserver-0.0.0-s8bjD7sqAACqVmz3kvf2iJbe0Jk9Hv6SBKz-kVlZ7q0J";
        pub const build_zig = @import("demo_webserver-0.0.0-s8bjD7sqAACqVmz3kvf2iJbe0Jk9Hv6SBKz-kVlZ7q0J");
        pub const deps: []const struct { []const u8, []const u8 } = &.{
            .{ "mime", "12209083b0c43d0f68a26a48a7b26ad9f93b22c9cff710c78ddfebb47b89cfb9c7a4" },
        };
    };
    pub const @"javascript_bridge-0.0.0-E-FZAQ-0AABFbIqnfQ0rEO2oaxnbd6qI2Cr-hvaU7CEX" = struct {
        pub const build_root = "/home/mbrennan/.cache/zig/p/javascript_bridge-0.0.0-E-FZAQ-0AABFbIqnfQ0rEO2oaxnbd6qI2Cr-hvaU7CEX";
        pub const build_zig = @import("javascript_bridge-0.0.0-E-FZAQ-0AABFbIqnfQ0rEO2oaxnbd6qI2Cr-hvaU7CEX");
        pub const deps: []const struct { []const u8, []const u8 } = &.{
        };
    };
};

pub const root_deps: []const struct { []const u8, []const u8 } = &.{
    .{ "javascript_bridge", "javascript_bridge-0.0.0-E-FZAQ-0AABFbIqnfQ0rEO2oaxnbd6qI2Cr-hvaU7CEX" },
    .{ "demo_webserver", "demo_webserver-0.0.0-s8bjD7sqAACqVmz3kvf2iJbe0Jk9Hv6SBKz-kVlZ7q0J" },
};
