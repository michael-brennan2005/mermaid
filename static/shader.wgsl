const PI = radians(180);

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

struct Interval {
    min: f32,
    max: f32
}

@group(0) @binding(0) var output: texture_storage_2d<rgba8unorm, write>;
@group(1) @binding(0) var<storage, read> tape: array<u32>;

@compute @workgroup_size(1)
fn main(@builtin(global_invocation_id) id: vec3u) {
    var x = Interval(f32(id.x) - 32.0, f32(id.x) - 31.0);
    var y = Interval(f32(id.y) - 32.0, f32(id.y) - 31.0);

    var regs = array<Interval, 16>();

    for (var clause: u32 = 0; clause < arrayLength(&tape); clause += 2) {
        let op  = (tape[clause] >> 24) & 0xFF;
        let out = (tape[clause] >> 16) & 0xFF;
        let in1 = (tape[clause] >> 8) & 0xFF;
        let in2 = (tape[clause]) & 0xFF;

        let imm = bitcast<f32>(tape[clause + 1]);

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
    } else if (regs[0].min < 0) {
        // ambiguous!
        fillTile(vec4(x.min, x.max, y.min, y.max), vec4(1.0, 1.0, 0.0, 1.0));
    } else {
        fillTile(vec4(x.min, x.max, y.min, y.max), vec4(0.0,0.0,0.0,1.0));
    }
}

// Bounds is interval-space [x1,x2,y1,y2]
fn fillTile(bounds: vec4<f32>, color: vec4<f32>) {
    for (var x: u32 = u32(bounds[0] + 32) * 8; x < u32(bounds[1] + 32) * 8; x += 1) {
        for (var y: u32 = u32(bounds[2] + 32) * 8; y < u32(bounds[3] + 32) * 8; y += 1) {
            textureStore(output, vec2i(i32(x), i32(y)), color);
        }
    }
}