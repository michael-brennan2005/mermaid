struct Interval {
    min: f32,
    max: f32
}

@group(0) @binding(0) var<storage, read> tape: array<u32>;
@group(0) @binding(1) var output: texture_storage_2d<rgba8unorm, write>;

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

        switch (op) {
            case 0x0: {
                let imm = f32(tape[clause + 1]);
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
        fillTile(vec4(x.min, x.max, y.min, y.max), vec4(0.0,1.0,0.0,1.0));
    }
}

// Bounds is interval-space [x1,x2,y1,y2]
fn fillTile(bounds: vec4<f32>, color: vec4<f32>) {
    for (var x: u32 = u32(bounds[0] + 32) * 16; x < u32(bounds[1] + 32) * 16; x += 1) {
        for (var y: u32 = u32(bounds[2] + 32) * 16; y < u32(bounds[3] + 32) * 16; y += 1) {
            textureStore(output, vec2i(i32(x), i32(y)), color);
        }
    }
}