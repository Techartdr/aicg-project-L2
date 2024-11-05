#version 300 es

// Attributs d'entrée
in vec2 a_position;  // Position du sommet
in vec2 a_uv;        // Coordonnées de texture du sommet

// Variable de sortie vers le fragment shader
out vec2 v_uv;

void main() {
    // Définit la position du sommet dans l'espace normalisé
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_uv = a_uv;  // Passe les coordonnées de texture au fragment shader
}
