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
@group(0) @binding(2) var<uniform> transform: mat3x3<f32>;

@group(1) @binding(0) var<storage, read> input_regions: RegionArrayInput;
@group(2) @binding(0) var<storage, read_write> output_regions: RegionArrayOutput;

@compute @workgroup_size(16,16)
fn main(
    @builtin(workgroup_id) input_idx: vec3u, 
    @builtin(local_invocation_id) subinterval: vec3u) {
    var region = input_regions.regions[input_idx.x];
    
    var minR = vec3f(region.x.min, region.y.min, 1.0);
    var maxR = vec3f(region.x.max, region.y.max, 1.0);
    
    var min = transform * minR;
    var max = transform * maxR;

    var x = Interval(min.y, max.x);
    var y = Interval(min.y, max.y);

    var output = evaluate_tape(x, y, Interval(0.0, 0.0));

    if (output.max < 0) {
        fillTile(minR, maxR, vec4(fill_r, fill_g, fill_b, 1.0));
    } else if (output.min < 0 && output_subinterval) {
        let idx = atomicAdd(&output_regions.x, 1);
        output_regions.regions[idx] = Region(x, y);
    } else {
        fillTile(minR, maxR, vec4(0.0,0.0,0.0,1.0));
    }
}

fn fillTile(min: vec3<f32>, max: vec3<f32>, color: vec4<f32>) {
    for (var x: u32 = u32(min.x); x < u32(max.x); x += 1) {
        for (var y: u32 = u32(min.y); y < u32(max.y); y += 1) {
            textureStore(output, vec2i(i32(x), i32(y)), color);
        }
    }
}