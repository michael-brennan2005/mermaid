fn u32ToF32(val: u32) -> f32 {
    if (val < 0x80000000) {
        return bitcast<f32>(~val);
    } else {
        return bitcast<f32>(val ^ 0x80000000);
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