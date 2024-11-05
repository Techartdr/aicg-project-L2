#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform float iAmplitude; // Amplitude sonore
uniform float iFrequency; // Fréquence dominante

in vec2 v_uv;
out vec4 fragColor;

float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdSphere(vec3 p, float s) {
    return length(p) - s;
}

float map(vec3 p) {
    float scale = 1.0 + 0.3 * iAmplitude; // Pulsation de la sphère
    vec3 spherePos = vec3(sin(iTime) * 3.0, 0.0, 0.0);
    float sphere = sdSphere(p - spherePos, scale);

    vec3 q = p;
    q.y -= iTime * 0.4;
    float excludeZone = 3.0;
    float mask = step(excludeZone, max(abs(p.x), abs(p.z)));

    q = mix(p, fract(q) - 0.5, mask);
    float box = sdBox(q, vec3(0.1));
    float ground = p.y + 0.75;

    float scene = smin(ground, smin(sphere, box, 2.0), 1.0);
    return scene;
}

float rayMarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    const int MAX_STEPS = 100;
    const float MAX_DIST = 100.0;
    const float SURF_DIST = 0.001;

    for (int i = 0; i < MAX_STEPS; i++) {
        vec3 p = ro + rd * t;
        float d = map(p);
        if (d < SURF_DIST) break;
        t += d;
        if (t > MAX_DIST) break;
    }

    return t > MAX_DIST ? -1.0 : t;
}

vec3 getNormal(vec3 p) {
    float h = 0.001;
    vec2 k = vec2(1, -1);
    return normalize(
        k.xyy * map(p + k.xyy * h) +
        k.yyx * map(p + k.yyx * h) +
        k.yxy * map(p + k.yxy * h) +
        k.xxx * map(p + k.xxx * h)
    );
}

mat3 camera(vec3 ro, vec3 ta, float cr) {
    vec3 cw = normalize(ta - ro);
    vec3 cp = vec3(sin(cr), cos(cr), 0.0);
    vec3 cu = normalize(cross(cw, cp));
    return mat3(cu, normalize(cross(cw, cu)), cw);
}

void main() {
    vec2 uv = (v_uv * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
    
    vec3 ro = vec3(0.0, 3.0 + 0.5 * sin(iFrequency * 6.28), -4.0);
    vec3 ta = vec3(0.0, 0.0, 0.0);  

    float mouseX = iMouse.x / iResolution.x;
    float mouseY = iMouse.y / iResolution.y;
    float angleX = (mouseX - 0.5) * 2.0 * 3.1415;
    float angleY = (mouseY - 0.5) * 3.1415;

    mat3 camMat = camera(ro, ta, 0.0);
    vec3 rd = normalize(camMat * vec3(uv, 1.5));
    rd = vec3(
        cos(angleX) * rd.x + sin(angleX) * rd.z,
        rd.y,
        -sin(angleX) * rd.x + cos(angleX) * rd.z
    );
    rd = vec3(
        rd.x,
        cos(angleY) * rd.y - sin(angleY) * rd.z,
        sin(angleY) * rd.y + cos(angleY) * rd.z
    );

    float t = rayMarch(ro, rd);

    vec3 color = vec3(0.0);
    if (t > 0.0) {
        vec3 p = ro + rd * t;
        vec3 n = getNormal(p);
        vec3 lightDir = normalize(vec3(0.5, 1.0, -0.5));
        float diff = max(dot(n, lightDir), 0.0);

        vec3 surfaceColor = vec3(0.2 + 0.5 * n.x, 0.3 + 0.4 * n.y, 0.4 + 0.5 * n.z);
        color = surfaceColor * diff * (0.5 + 0.5 * iAmplitude);
        color = mix(color, vec3(1.0, 0.5, 0.0), iFrequency); // Variation de couleur
    }

    fragColor = vec4(color, 1.0);
}
