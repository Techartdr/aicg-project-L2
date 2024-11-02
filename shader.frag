#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_audio;

in vec2 v_uv;
out vec4 outColor;

// Signed distance function for a sphere
float sdf_sphere(vec3 p, float r) {
    return length(p) - r;
}

// Scene function that uses the audio level to adjust the radius or position
float sdf_scene(vec3 p) {
    float sphere_radius = 0.5 + u_audio * 0.5; // sphere grows with audio level
    return sdf_sphere(p, sphere_radius);
}

void main() {
    vec2 uv = (v_uv - 0.5) * u_resolution / u_resolution.y;
    vec3 ro = vec3(0.0, 0.0, -3.0);
    vec3 rd = normalize(vec3(uv, 1.0));

    float dist = sdf_scene(ro + rd * 2.0); // apply ray-marching
    vec3 color = vec3(0.3 + 0.7 * sin(u_time + dist * 5.0 + u_audio * 10.0));
    
    outColor = vec4(color, 1.0);
}