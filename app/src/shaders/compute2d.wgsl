// compute2d.wgsl - Write a "default" rainbow effect to a storage texture using cosine-based coloring
// Storage texture is bound at group(0), binding(0) as rgba8unorm, write-only

// Bind the output storage texture at group(0), binding(0)
@group(0) @binding(0)
var outputTex: texture_storage_2d<rgba8unorm, write>;

// Each invocation of the compute shader will process one pixel
@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    // Get the dimensions of the output texture
    let dims = textureDimensions(outputTex);

    // Only process pixels within the texture bounds
    if (global_id.x >= dims.x || global_id.y >= dims.y) {
        return;
    }

    // Normalized pixel coordinates (from 0 to 1)
    let uv = vec2<f32>(f32(global_id.x) / f32(dims.x), f32(global_id.y) / f32(dims.y));

    // Cosine-based rainbow color, similar to shadertoy's "default" rainbow
    let col = 0.5 + 0.5 * cos(vec3<f32>(uv.x, uv.y, uv.x) + vec3<f32>(0.0, 2.0, 4.0));

    // Write the color to the output texture with full alpha
    textureStore(outputTex, vec2<i32>(global_id.xy), vec4<f32>(col, 1.0));
}


