// Fonction pour détecter si l'utilisateur est sur un appareil mobile
function isMobileDevice() {
  return /Mobi|Android/i.test(navigator.userAgent);
}

// Affiche les instructions au chargement de la page
function displayInstructions() {
  const instructionsText = document.getElementById('instructions-text');

  // Instructions spécifiques en fonction du type de périphérique (mobile ou bureau)
  if (isMobileDevice()) {
    instructionsText.innerHTML = `
      <strong>Welcome to Dynamic World</strong><br><br>
      <p>Swipe to rotate view</p>
      <p>Pinch to zoom in and out</p>
      <p>The microphone influences the animation and colors of the scene based on the sounds</p><br>
      <p>Switch the phone to landscape to get a better view!</p>
    `;
  } else {
    instructionsText.innerHTML = `
      <strong>Welcome to Dynamic World</strong><br><br>
      <p>Use the Q (Left) and D (Right) keys to rotate the scene view</p>
      <p>The microphone influences the animation and colors of the scene based on the sounds</p>
    `;
  }

  document.getElementById('instructions').style.display = 'flex';
}

// Cache la superposition d'instructions après avoir cliqué sur le bouton
function closeInstructions() {
  document.getElementById('instructions').style.display = 'none';
}

window.addEventListener('load', displayInstructions);

// Charge un shader (vertex ou fragment) depuis son URL
async function readShader(id) {
  const req = await fetch(document.getElementById(id).src);
  return await req.text();
}

// Crée un shader WebGL à partir d'une source
function createShader(gl, type, src) {
  let shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);

  // Vérifie si la compilation a réussi
  let success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) return shader;

  // Affiche une erreur si la compilation échoue
  console.error("Could not compile WebGL Shader", gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

// Crée et lie un programme WebGL à partir de shaders vertex et fragment
function createProgram(gl, vertShader, fragShader) {
  let program = gl.createProgram();
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);

  // Vérifie si le lien a réussi
  let success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) return program;

  // Affiche une erreur si le lien échoue
  console.error("Could not Link WebGL Program", gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

// Fonction pour obtenir les données du microphone
async function getMicrophoneInput() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;

    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function getAmplitudeAndFrequency() {
      analyser.getByteFrequencyData(dataArray);

      // Calcul de l'amplitude moyenne
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const amplitude = sum / dataArray.length / 128.0;

      // Calcul de la fréquence dominante
      let maxVal = 0;
      let dominantFrequency = 0;
      for (let i = 0; i < dataArray.length; i++) {
        if (dataArray[i] > maxVal) {
          maxVal = dataArray[i];
          dominantFrequency = i;
        }
      }
      const frequency = dominantFrequency / dataArray.length;

      return { amplitude, frequency };
    }

    return { getAmplitudeAndFrequency };
  } catch (error) {
    console.error("Microphone access denied or not available.", error);
    return null;
  }
}

// Adapte la taille du canvas à la taille de la fenêtre
function resizeCanvasToDisplaySize(canvas) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

// Fonction principale pour initialiser le rendu et la logique de l'animation
async function main() {
  const fps = document.getElementById("fps");

  // Géstion du temps et le calcul des FPS
  const time = {
    current_t: Date.now(),
    dts: [1 / 60],
    t: 0,

    dt: () => time.dts[0],
    update: () => {
      const new_t = Date.now();
      time.dts = [(new_t - time.current_t) / 1_000, ...time.dts].slice(0, 10);
      time.t += time.dt();
      time.current_t = new_t;

      const dt = time.dts.reduce((a, dt) => a + dt, 0) / time.dts.length;
      fps.innerHTML = `${Math.round(1 / dt, 2)}`;
    },
  };

  document.getElementById('close-help').addEventListener('click', () => closeInstructions());

  // Initialisation du WebGL et configuration du canvas
  const canvas = document.getElementById("canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) alert("Could not initialize WebGL Context.");

  resizeCanvasToDisplaySize(canvas);
  window.addEventListener('resize', () => resizeCanvasToDisplaySize(canvas));

  // Chargement et compilation des shaders
  const vertShader = createShader(gl, gl.VERTEX_SHADER, await readShader("vert"));
  const fragShader = createShader(gl, gl.FRAGMENT_SHADER, await readShader("frag"));
  const program = createProgram(gl, vertShader, fragShader);

  // Attributs et uniformes du programme WebGL
  const a_position = gl.getAttribLocation(program, "a_position");
  const a_uv = gl.getAttribLocation(program, "a_uv");

  const u_resolution = gl.getUniformLocation(program, "iResolution");
  const u_time = gl.getUniformLocation(program, "iTime");
  const u_mouse = gl.getUniformLocation(program, "iMouse");
  const u_amplitude = gl.getUniformLocation(program, "iAmplitude");
  const u_frequency = gl.getUniformLocation(program, "iFrequency");

  // Données de géométrie du quadrilatère couvrant l'écran
  const data = new Float32Array([
    -1.0, -1.0, 0.0, 0.0,
    1.0, -1.0, 1.0, 0.0,
    1.0, 1.0, 1.0, 1.0,
    -1.0, 1.0, 0.0, 1.0,
  ]);

  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

  // Configuration des buffers de données pour le rendu WebGL
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(a_position);
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 4 * 4, 0);
  gl.enableVertexAttribArray(a_uv);
  gl.vertexAttribPointer(a_uv, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

  const ebo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  let startTime = Date.now() / 1000;

  // Caméra avec position et zoom
  let camera = {
    position: { x: 0, y: 3, z: -8 },
    rotation: { x: 0, y: 0 },
    zoom: 1.5
  };
  
  let isDragging = false;
  let lastMouseX, lastMouseY;

  // Événements pour faire pivoter la caméra
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const deltaX = e.clientX - lastMouseX;
      const deltaY = e.clientY - lastMouseY;
      camera.rotation.x += deltaX * 0.005;
      camera.rotation.y += deltaY * 0.005;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    }
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
  });

  canvas.addEventListener('mouseleave', () => {
    isDragging = false;
  });

  canvas.addEventListener('wheel', (e) => {
    camera.zoom += e.deltaY * 0.001;
    camera.zoom = Math.min(Math.max(camera.zoom, 1.0), 5.0);
  });

  // Gestion des touches du clavier
  let keys = {};
  window.addEventListener('keydown', (e) => { keys[e.key] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  // Obtenir les données du microphone pour l'animation audio-réactive
  const micInput = await getMicrophoneInput();
  if (!micInput) return;

  // Met à jour la position de la caméra en fonction des touches
  function updateCameraPosition() {
    const speed = 5;
    const forward = {
      x: Math.sin(camera.rotation.x) * speed,
      z: Math.cos(camera.rotation.x) * speed
    };
    const right = {
      x: Math.cos(camera.rotation.x) * speed,
      z: -Math.sin(camera.rotation.x) * speed
    };

    if (keys['a'] || keys['q']) {
      camera.position.x -= right.x;
      camera.position.z -= right.z;
    }
    if (keys['d']) {
      camera.position.x += right.x;
      camera.position.z += right.z;
    }
  }

  // Fonction de rendu, appelée à chaque frame
  function render() {
    let currentTime = Date.now() / 1000;
    let elapsedTime = currentTime - startTime;

    // Redimensionne le canvas si la fenêtre change
    resizeCanvasToDisplaySize(canvas);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindVertexArray(vao);
    gl.useProgram(program);
    gl.uniform3f(u_resolution, gl.canvas.width, gl.canvas.height, 1.0);
    gl.uniform1f(u_time, elapsedTime);

    const { amplitude, frequency } = micInput.getAmplitudeAndFrequency();
    gl.uniform1f(u_amplitude, amplitude);
    gl.uniform1f(u_frequency, frequency);

    updateCameraPosition();
    gl.uniform4f(
      u_mouse,
      camera.position.x,
      camera.position.y,
      camera.position.z,
      camera.zoom
    );

    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);

    time.update();
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();
