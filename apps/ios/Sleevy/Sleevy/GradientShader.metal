#include <metal_stdlib>
using namespace metal;

struct VertexOut {
    float4 position [[position]];
    float2 uv;
};

vertex VertexOut gradient_vertex(uint vid [[vertex_id]]) {
    float2 positions[] = {
        float2(-1, -1), float2(3, -1), float2(-1, 3)
    };
    VertexOut out;
    out.position = float4(positions[vid], 0, 1);
    out.uv = positions[vid] * 0.5 + 0.5;
    out.uv.y = 1.0 - out.uv.y;
    return out;
}

fragment float4 gradient_fragment(VertexOut in [[stage_in]],
                                  constant float &time [[buffer(0)]]) {
    float2 uv = in.uv;

    float drift = time * 0.06;

    float2 center1 = float2(0.3 + 0.2 * sin(drift * 0.7), 0.2 + 0.15 * cos(drift * 0.5));
    float2 center2 = float2(0.7 + 0.15 * cos(drift * 0.6), 0.5 + 0.2 * sin(drift * 0.8));
    float2 center3 = float2(0.5 + 0.2 * sin(drift * 0.9), 0.8 + 0.1 * cos(drift * 0.4));

    float d1 = length(uv - center1);
    float d2 = length(uv - center2);
    float d3 = length(uv - center3);

    // #F3C087 -> (0.953, 0.753, 0.529)
    float3 color1 = float3(0.953, 0.753, 0.529);
    // #F59683 -> (0.961, 0.588, 0.514)
    float3 color2 = float3(0.961, 0.588, 0.514);
    // #F755AB -> (0.969, 0.333, 0.671)
    float3 color3 = float3(0.969, 0.333, 0.671);

    float w1 = 1.0 / (d1 * d1 + 0.15);
    float w2 = 1.0 / (d2 * d2 + 0.15);
    float w3 = 1.0 / (d3 * d3 + 0.15);
    float wTotal = w1 + w2 + w3;

    float3 color = (color1 * w1 + color2 * w2 + color3 * w3) / wTotal;

    // Subtle noise-like variation for organic feel
    float grain = fract(sin(dot(uv * 200.0 + drift, float2(12.9898, 78.233))) * 43758.5453);
    color += (grain - 0.5) * 0.015;

    return float4(color, 1.0);
}
