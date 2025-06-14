// blit.wgsl - Simple blit shader for rendering a texture to the screen
// Assumes the render target and srcTex have the same dimensions

// Vertex output: only position is needed, as UV can be derived in the fragment shader
struct VSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

// Full-screen triangle vertex shader
@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VSOut {
    // Positions for a full-screen triangle
    var pos = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(3.0, -1.0),
        vec2<f32>(-1.0, 3.0)
    );
    // Corresponding UVs for the triangle
    var uv = array<vec2<f32>, 3>(
        vec2<f32>(0.0, 0.0),
        vec2<f32>(2.0, 0.0),
        vec2<f32>(0.0, 2.0)
    );

    var out: VSOut;
    out.position = vec4<f32>(pos[vertex_index], 0.0, 1.0);
    out.uv = uv[vertex_index];
    return out;
}

// Bind the storage texture at group(0), binding(0)
@group(0) @binding(0)
var srcTex: texture_storage_2d<rgba8unorm, read>;

// Fragment shader: directly samples the storage texture using interpolated UV
@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
    // Since the render target and srcTex are the same size, we can use UV * size directly
    let texSize = textureDimensions(srcTex);
    let texel = vec2<i32>(in.uv * vec2<f32>(texSize));
    return textureLoad(srcTex, texel);
}
