// IMPORT intervals.wgsl!!!
// IMPORT utils.wgsl!!!

// MARK: constants & struct definitions
override output_subinterval: bool = true;

const PI = radians(180);

struct Region {
    x: Interval,
    y: Interval,
    z: Interval
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

struct Camera {
    view: mat4x4<f32>,
    perspective: mat4x4<f32>
}

// MARK: compute kernel
@group(0) @binding(0) var<uniform> camera: Camera;

@group(1) @binding(0) var<storage, read> tape: Tape;
@group(1) @binding(1) var output: texture_storage_2d<r32uint, write>;
@group(1) @binding(2) var<storage, read_write> outputLocks: array<array<atomic<u32>, 1024>, 1024>;

@group(2) @binding(0) var<storage, read> input_regions: RegionArrayInput;
@group(3) @binding(0) var<storage, read_write> output_regions: RegionArrayOutput;

@compute @workgroup_size(6,6,6)
fn main(
    @builtin(workgroup_id) input_idx: vec3u, 
    @builtin(local_invocation_id) subinterval: vec3u) {
    var region = input_regions.regions[input_idx.x];
    
    var size = vec3f(
        (region.x.max - region.x.min) / 16.0,
        (region.y.max - region.y.min) / 16.0,
        (region.z.max - region.z.min) / 16.0
    );

    var I_min = vec4f(
        region.x.min + (size.x * f32(subinterval.x)),
        region.y.min + (size.y * f32(subinterval.y)),
        region.z.min + (size.z * f32(subinterval.z)),
        1.0
    );

    var I_max = vec4f(
        region.x.min + size.x * (f32(subinterval.x) + 1),
        region.y.min + size.y * (f32(subinterval.y) + 1),
        region.z.min + size.z * (f32(subinterval.z) + 1),
        1.0
    );

    var I_min_transformed = camera.perspective * camera.view * I_min;
    I_min_transformed /= I_min_transformed.w;

    var I_max_transformed = camera.perspective * camera.view * I_max;
    I_max_transformed /= I_max_transformed.w;

    var x = Interval(I_min_transformed.x, I_max_transformed.x);
    var y = Interval(I_min_transformed.y, I_max_transformed.y);
    var z = Interval(I_min_transformed.z, I_max_transformed.z);

    var out = evaluate_tape(x,y,z);

    fillTile(vec4(x.min, x.max, y.min, y.max), out.max);

    if (out.max > 0 && out.min < 0 && output_subinterval) {
        let idx = atomicAdd(&output_regions.x, 1);
        output_regions.regions[idx] = Region(x, y, z);
    }
}

fn fillTile(bounds: vec4<f32>, zVal: f32) {
    let texSize: vec2<u32> = textureDimensions(output);

    let x0: u32 = u32(clamp(((bounds.x + 1.0) * 0.5) * f32(texSize.x), 0.0, f32(texSize.x)));
    let x1: u32 = u32(clamp(((bounds.y + 1.0) * 0.5) * f32(texSize.x), 0.0, f32(texSize.x)));
    let y0: u32 = u32(clamp(((bounds.z + 1.0) * 0.5) * f32(texSize.y), 0.0, f32(texSize.y)));
    let y1: u32 = u32(clamp(((bounds.w + 1.0) * 0.5) * f32(texSize.y), 0.0, f32(texSize.y)));

    let val = f32ToU32(zVal);

    for (var x: u32 = x0; x < x1; x += 1) {
        for (var y: u32 = y0; y < y1; y += 1) {
            atomicMax(&outputLocks[y][x], val);        
        }
    }
}