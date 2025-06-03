// MARK: constants & struct definitions
@id(0) override output_subinterval: bool = true;
const PI = radians(180);

struct Interval {
    min: f32,
    max: f32
}

struct Region {
    x: Interval,
    y: Interval
}

struct RegionArray {
    x: atomic<u32>,
    padding: array<u32, 2>,
    region: Region
}

struct Tape {
    length: u32,
    insts: array<u32>
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
@group(0) @binding(0) var output: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<storage, read> tape: Tape;

@group(1) @binding(0) var<storage> input_regions: RegionArray;
@group(2) @binding(0) var<storage> output_regions: RegionArray;

@compute @workgroup_size(16,16)
fn main(
    @builtin(workgroup_id) input_idx: vec3u, 
    @builtin(local_invocation_id) subinterval: vec3u) {
    var region = input_regions[input_idx];
    
    var x_size = (region.x.max - region.x.min) / 16.0;
    var y_size = (region.y.max - region.y.min) / 16.0;

    var x_min = region.x.min + (x_size * subinterval_id.x);
    var x_max = region.x.min + (x_size * (subinterval_id.x + 1));

    var y_min = region.y.min + (y_size * subinterval_id.y);
    var y_max = region.y.min + (y_size * (subinterval_id.y + 1));

    var x = Interval(x_min, x_max);
    var y = Interval(y_min, y_max);

    var regs = array<Interval, 16>();

    for (var clause: u32 = 0; clause < 2 * tape.length; clause += 2) {
        let op  = (tape.insts[clause] >> 24) & 0xFF;
        let out = (tape.insts[clause] >> 16) & 0xFF;
        let in1 = (tape.insts[clause] >> 8) & 0xFF;
        let in2 = (tape.insts[clause]) & 0xFF;

        let imm = bitcast<f32>(tape.insts[clause + 1]);

        switch (op) {
            case 0x0: {
                regs[out] = Interval(imm, imm);
            }
            case 0x1: {
                regs[out] = x;
            }
            case 0x2: {
                regs[out] = y;
            }
            case 0x3: {
                regs[out] = Interval(
                    regs[in1].min + regs[in2].min, 
                    regs[in1].max + regs[in2].max);
            }
            case 0x4: {
                regs[out] = Interval(
                    regs[in1].min - regs[in2].max,
                    regs[in1].max - regs[in2].min);
            }
            case 0x5: {
                regs[out] = mul_interval(regs[in1], regs[in2]);
            }

            case 0x6: {
                regs[out] = mul_interval(regs[in1], reciprocal_interval(regs[in2]));
            }
            case 0x7: {
                regs[out] = Interval(sqrt(regs[in1].min), sqrt(regs[in1].max));
            }
            case 0x8: {
                regs[out] = sin_interval(regs[in1]);
            }
            case 0x9: {
                regs[out] = sin_interval(Interval(regs[in1].min + PI/2.0, regs[in1].max + PI/2.0));
            }
            case 0xA: {
                // asin
            }
            case 0xB: {
                // acos
            }
            case 0xC: {
                // atan
            }
            case 0xD: {
                regs[out] = Interval(exp(regs[in1].min), exp(regs[in1].max));
            }
            case 0xE: {
                regs[out] = Interval(log(regs[in1].min), log(regs[in1].max));
            }
            case 0xF: {
                regs[out] = Interval(
                    min(abs(regs[in1].min), abs(regs[in1].max)),
                    max(abs(regs[in1].min), abs(regs[in1].max)));
            }
            case 0x10: {
                regs[out] = Interval(
                    min(regs[in1].min, regs[in2].min),
                    min(regs[in1].max, regs[in2].max));
            }
            case 0x11: {
                regs[out] = Interval(
                    max(regs[in1].min, regs[in2].min),
                    max(regs[in1].max, regs[in2].max));
            }
            default: {
                continue;
            }
        }
    }

    if (regs[0].max < 0) {
        fillTile(vec4(x.min, x.max, y.min, y.max), vec4(1.0, 1.0, 1.0, 1.0));
    } else if (regs[0].min < 0 && output_subinterval) {
        let idx = atomicAdd(&output_regions.x);
        output_regions[idx] = Region(x, y);
    } else {
        fillTile(vec4(x.min, x.max, y.min, y.max), vec4(0.0,0.0,0.0,1.0));
    }
}

// Bounds is interval-space [x1,x2,y1,y2]
fn fillTile(bounds: vec4<f32>, color: vec4<f32>) {
    for (var x: u32 = u32(bounds[0] + 8) * 64; x < u32(bounds[1] + 8) * 64; x += 1) {
        for (var y: u32 = u32(bounds[2] + 8) * 64; y < u32(bounds[3] + 8) * 64; y += 1) {
            textureStore(output, vec2i(i32(x), i32(y)), color);
        }
    }
}