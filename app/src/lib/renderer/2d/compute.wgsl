// IMPORT intervals.wgsl!!!

// MARK: constants & struct definitions
override output_subinterval: bool = true;
override fill_r: f32 = 1.0;
override fill_g: f32 = 1.0;
override fill_b: f32 = 1.0;

const PI = radians(180);

struct Region {
    x: Interval,
    y: Interval
}

struct RegionArrayInput {
    x: u32,
    padding: array<u32, 2>,
    regions: array<Region>
}

struct RegionArrayOutput {
    x: atomic<u32>,
    padding: array<u32, 2>,
    regions: array<Region>
}

// MARK: compute kernel
@group(0) @binding(0) var<storage, read> tape: Tape;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;

@group(1) @binding(0) var<storage, read> input_regions: RegionArrayInput;
@group(2) @binding(0) var<storage, read_write> output_regions: RegionArrayOutput;

@compute @workgroup_size(16,16)
fn main(
    @builtin(workgroup_id) input_idx: vec3u, 
    @builtin(local_invocation_id) subinterval: vec3u) {
    var region = input_regions.regions[input_idx.x];
    
    var x_size = (region.x.max - region.x.min) / 16.0;
    var y_size = (region.y.max - region.y.min) / 16.0;

    var x_min = region.x.min + (x_size * f32(subinterval.x));
    var x_max = region.x.min + (x_size * (f32(subinterval.x) + 1));

    var y_min = region.y.min + (y_size * f32(subinterval.y));
    var y_max = region.y.min + (y_size * (f32(subinterval.y) + 1));

    var x = Interval(x_min, x_max);
    var y = Interval(y_min, y_max);

    var output = evaluate_tape(x, y, Interval(0.0, 0.0));

    if (output.max < 0) {
        fillTile(vec4(x.min, x.max, y.min, y.max), vec4(fill_r, fill_g, fill_b, 1.0));
    } else if (output.min < 0 && output_subinterval) {
        let idx = atomicAdd(&output_regions.x, 1);
        output_regions.regions[idx] = Region(x, y);
    } else {
        fillTile(vec4(x.min, x.max, y.min, y.max), vec4(0.0,0.0,0.0,1.0));
    }
}

// Current bounds is +/-16 on X and Y
// Texture is 1024 x 1024

// int(X) -> texel(X)
// -16 -> 0
// 16 -> 1024
// texel(X) = 32 int(x) + 512

fn fillTile(bounds: vec4<f32>, color: vec4<f32>) {
    let texelMinX = u32(32.0 * bounds[0] + 512.0);
    let texelMaxX = u32(32.0 * bounds[1] + 512.0);
    let texelMinY = u32(32.0 * bounds[2] + 512.0);
    let texelMaxY = u32(32.0 * bounds[3] + 512.0);

    for (var x: u32 = texelMinX; x < texelMaxX; x += 1) {
        for (var y: u32 = texelMinY; y < texelMaxY; y += 1) {
            textureStore(output, vec2i(i32(x), i32(y)), color);
        }
    }
}