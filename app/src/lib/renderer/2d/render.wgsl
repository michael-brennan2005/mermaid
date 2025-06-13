@group(0) @binding(0) var surface: texture_2d<f32>;

struct VertexOutput {
    @builtin(position) clip_space_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
    var pos = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>( 1.0,  1.0)
    );

    var out: VertexOutput;
    out.clip_space_position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
    out.uv = (pos[VertexIndex] * 0.5) + vec2<f32>(0.5, 0.5);
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let texSize = vec2<i32>(textureDimensions(surface, 0));
    let pixelCoord = vec2<i32>(in.uv * vec2<f32>(texSize));
    let clampedCoord = clamp(pixelCoord, vec2<i32>(0, 0), texSize - vec2<i32>(1, 1));
    return textureLoad(surface, clampedCoord, 0);
}