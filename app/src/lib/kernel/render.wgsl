struct Uniforms {
    view: mat4x4<f32>,
    perspective: mat4x4<f32>
}

@group(0) @binding(0) var surface: texture_2d<f32>;
@group(1) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
    @builtin(position) clip_space_position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
    var pos = array<vec4<f32>, 6>(
        vec4<f32>(-1.0, -1.0, 0.0, 1.0),
        vec4<f32>( 1.0, -1.0, 0.0, 1.0),
        vec4<f32>(-1.0,  1.0, 0.0, 1.0),
        vec4<f32>(-1.0,  1.0, 0.0, 1.0),
        vec4<f32>( 1.0, -1.0, 0.0, 1.0),
        vec4<f32>( 1.0,  1.0, 0.0, 1.0)
    );
    
    var out: VertexOutput;
    out.clip_space_position = uniforms.perspective * uniforms.view * pos[VertexIndex];
    out.uv = (pos[VertexIndex].xy * 0.5) + 0.5;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let texSize = vec2<i32>(textureDimensions(surface, 0));
    let pixelCoord = vec2<i32>(in.uv * vec2<f32>(texSize));
    let clampedCoord = clamp(pixelCoord, vec2<i32>(0, 0), texSize - vec2<i32>(1, 1));
    return textureLoad(surface, clampedCoord, 0);
}