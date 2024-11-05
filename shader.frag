#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform float iAmplitude; // Amplitude sonore pour contrôler la luminosité
uniform float iFrequency; // Fréquence dominante pour contrôler la teinte

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
    float scale = 1.0 + 0.6 * iAmplitude; // Pulsation de la sphère avec amplitude
    vec3 spherePos = vec3(sin(iTime) * 3.0, cos(iTime * 0.5) * 3.0 * iFrequency, 0.0); // Position influencée par la fréquence
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

// Fonction de Fresnel pour accentuer les bords
float fresnelEffect(vec3 viewDir, vec3 normal) {
    return pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
}

void main() {
    vec2 uv = (v_uv * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
    
    // Position et angle de la caméra
    vec3 ro = vec3(0.0, 3.0 + sin(iTime * 0.3) * iAmplitude * 2.0, -4.0);
    vec3 ta = vec3(0.0, 0.0, 0.0);

    float mouseX = iMouse.x / iResolution.x;
    float mouseY = iMouse.y / iResolution.y;
    float angleX = (mouseX - 0.5) * 2.0 * 3.1415;
    float angleY = (mouseY - 0.5) * 3.1415;

    mat3 camMat = camera(ro, ta, 0.0);
    vec3 rd = normalize(camMat * vec3(uv, 1.5));

    // Appliquer les rotations pour un mouvement de caméra fluide
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

    // Ray Marching
    float t = rayMarch(ro, rd);

    vec3 color = vec3(0.0);
    if (t > 0.0) {
        vec3 p = ro + rd * t;
        vec3 n = getNormal(p);
        vec3 viewDir = normalize(ro - p);

        // Direction et intensité de la lumière
        vec3 lightPos = vec3(sin(iTime * 0.5) * 3.0, 4.0, cos(iTime * 0.5) * 3.0);
        vec3 lightDir = normalize(lightPos - p);
        
        float diff = max(dot(n, lightDir), 0.0);

        // Specular pour l'effet chromé
        float specularStrength = 1.2;
        vec3 reflectDir = reflect(-lightDir, n);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), 64.0) * specularStrength;

        // Couleur avec teintes métalliques et accentuation des reflets
        float hueShift = mod(iFrequency * 0.3 + iAmplitude * 0.5 + sin(iTime * 0.3), 1.0);
        vec3 baseColor = vec3(0.7 * hueShift, 0.8 * iAmplitude, 0.6 - 0.3 * iFrequency);
        vec3 chromeColor = mix(baseColor, vec3(1.0), spec);

        // Ajout de l'effet de Fresnel pour accentuer les bords
        float fresnel = fresnelEffect(viewDir, n);
        color = mix(chromeColor, vec3(1.0), fresnel) * (diff + spec);
    }

    fragColor = vec4(color, 1.0);
}
