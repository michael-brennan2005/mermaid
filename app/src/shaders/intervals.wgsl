struct Interval {
    min: f32,
    max: f32
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

fn evaluate_tape(x: Interval, y: Interval, z: Interval) -> Interval {
    var regs = array<Interval, 16>();

    for (var clause: u32 = 0; clause < 2 * tape.length; clause += 2) {
        // We just assume tape is defined correctly in whatever shader imports this. 
        // Very much a code smell but WGSL does not allow passing in Tape as an arg since it has
        // a runtime-sized array
        
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
                regs[out] = z;
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

    return regs[0];
}