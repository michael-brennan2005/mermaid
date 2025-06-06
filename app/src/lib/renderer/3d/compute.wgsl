// MARK: constants & struct definitions
override output_subinterval: bool = true;

const PI = radians(180);

struct Interval {
    min: f32,
    max: f32
}

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

struct Tape {
    length: u32,
    insts: array<u32>
}   

struct Camera {
    view: mat4x4<f32>,
    perspective: mat4x4<f32>
}

// MARK: interval functions
fn sin_interval(int: Interval) -> Interval {
    // return extremes if interval is larger than a full period
    if (int.max - int.min > (2 * PI)) {
        return Interval(-1, 1);
    }

    let a = int.min;
    let b = int.max;
    
    var min_val = min(sin(a),sin(b));
    var max_val = max(sin(a),sin(b));

    // Scan over all minima (x = pi/2 + npi)
    let n = ceil((a - PI/2.0) / PI);
    var x = PI/2 + n * PI;
    while (x <= b) {
        min_val = min(min_val, sin(x));
        max_val = max(max_val, sin(x));
        x += PI;
    }

    return Interval(min_val, max_val);
}

fn mul_interval(int1: Interval, int2: Interval) -> Interval {
    let a = int1.min * int2.min;
    let b = int1.min * int2.max;
    let c = int1.max * int2.min;
    let d = int1.max * int2.max;
                
    return Interval(
        min(min(a,b),min(c,d)),
        max(max(a,b),max(c,d)));
}

// [a,b] -> [1/a, 1/b]
fn reciprocal_interval(int: Interval) -> Interval {
    const inf: f32 = 1e30;

    let a = int.min;
    let b = int.max;

    // 0 in interval 
    if (a <= 0 && 0 <= b) {
        return Interval(-inf, inf);
    } else {
        return Interval (1 / int.max, 1 / int.min);
    }
}

// MARK: compute kernel
@group(0) @binding(0) var<uniform> camera: Camera;

@group(1) @binding(0) var output: texture_storage_2d<r32uint, write>;
@group(1) @binding(1) var<storage, read_write> outputLocks: array<array<atomic<u32>, 1024>, 1024>;
@group(1) @binding(2) var<storage, read> tape: Tape;

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

    var regs = array<Interval, 16>();

    for (var clause: u32 = 0; clause < 2 * tape.length; clause += 2) {
        let op  = (tape.insts[clause] >> 24) & 0xFF;
        let out = (tape.insts[clause] >> 16) & 0xFF;
        let in1 = (tape.insts[clause] >> 8) & 0xFF;
        let in2 = (tape.insts[clause]) & 0xFF;

        let imm = bitcast<f32>(tape.insts[clause + 1]);

        switch (op) {
            case 0: {
                regs[out] = Interval(imm, imm);
            }
            case 1: {
                regs[out] = x;
            }
            case 2: {
                regs[out] = y;
            }
            case 3: {
                regs[out] = Interval(0.0,0.0);
            }
            case 4: {
                regs[out] = Interval(
                    regs[in1].min + regs[in2].min, 
                    regs[in1].max + regs[in2].max);
            }
            case 5: {
                regs[out] = Interval(
                    regs[in1].min - regs[in2].max,
                    regs[in1].max - regs[in2].min);
            }
            case 6: {
                regs[out] = mul_interval(regs[in1], regs[in2]);
            }

            case 7: {
                regs[out] = mul_interval(regs[in1], reciprocal_interval(regs[in2]));
            }
            case 8: {
                regs[out] = Interval(sqrt(regs[in1].min), sqrt(regs[in1].max));
            }
            case 9: {
                regs[out] = sin_interval(regs[in1]);
            }
            case 10: {
                regs[out] = sin_interval(Interval(regs[in1].min + PI/2.0, regs[in1].max + PI/2.0));
            }
            case 11: {
                // asin
            }
            case 12: {
                // acos
            }
            case 13: {
                // atan
            }
            case 14: {
                regs[out] = Interval(exp(regs[in1].min), exp(regs[in1].max));
            }
            case 15: {
                regs[out] = Interval(log(regs[in1].min), log(regs[in1].max));
            }
            case 16: {
                regs[out] = Interval(
                    min(abs(regs[in1].min), abs(regs[in1].max)),
                    max(abs(regs[in1].min), abs(regs[in1].max)));
            }
            case 17: {
                regs[out] = Interval(
                    min(regs[in1].min, regs[in2].min),
                    min(regs[in1].max, regs[in2].max));
            }
            case 18: {
                regs[out] = Interval(
                    max(regs[in1].min, regs[in2].min),
                    max(regs[in1].max, regs[in2].max));
            }
            default: {
                continue;
            }
        }
    }

    fillTile(vec4(x.min, x.max, y.min, y.max), z.max);

    if (regs[0].max > 0 && regs[0].min < 0 && output_subinterval) {
        let idx = atomicAdd(&output_regions.x, 1);
        output_regions.regions[idx] = Region(x, y, z);
    }
}

fn f32ToU32(val: f32) -> u32 {
    let bits = bitcast<u32>(val);
     if (bits & 0x80000000) != 0 {
        return ~bits;
    } else {
        return bits ^ 0x80000000;
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