// Fonction pour détecter si on est sur un appareil mobile
function isMobileDevice() {
  return /Mobi|Android/i.test(navigator.userAgent);
}

// Fonction pour afficher les instructions adaptées
function displayInstructions() {
  const instructionsText = document.getElementById('instructions-text');

  if (isMobileDevice()) {
    instructionsText.innerHTML = `
      <strong>Bienvenue !</strong><br><br>
      <ul>
        <li>Glissez pour faire pivoter la vue.</li>
        <li>Pincez pour zoomer et dézoomer.</li>
        <li>Utilisez le microphone pour animer la scène en fonction des sons.</li>
      </ul>
    `;
  } else {
    instructionsText.innerHTML = `
      <strong>Bienvenue !</strong><br><br>
      <ul>
        <li>Utilisez les touches <- Q et D -> pour vous déplacer dans la scène.</li>
        <li>Le microphone influence l'animation de la scène en fonction des sons.</li>
      </ul>
    `;
  }

  document.getElementById('instructions').style.display = 'flex';
}

// Fonction pour fermer la boîte d'instructions
function closeInstructions() {
  console.log("TESTZ7GDeiufhioqzj");
  document.getElementById('instructions').style.display = 'none';
}

// Appeler displayInstructions lors du chargement de la page
window.addEventListener('load', displayInstructions);


async function readShader(id) {
  const req = await fetch(document.getElementById(id).src);
  return await req.text();
}

function createShader(gl, type, src) {
  let shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);

  let success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) return shader;

  console.error("Could not compile WebGL Shader", gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

function createProgram(gl, vertShader, fragShader) {
  let program = gl.createProgram();
  gl.attachShader(program, vertShader);
  gl.attachShader(program, fragShader);
  gl.linkProgram(program);

  let success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) return program;

  console.error("Could not Link WebGL Program", gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

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

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const amplitude = sum / dataArray.length / 128.0;

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

function resizeCanvasToDisplaySize(canvas) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

async function main() {
  document.getElementById('close-help').addEventListener('click', () => closeInstructions());

  const canvas = document.getElementById("canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) alert("Could not initialize WebGL Context.");

  resizeCanvasToDisplaySize(canvas);
  window.addEventListener('resize', () => resizeCanvasToDisplaySize(canvas));

  const vertShader = createShader(gl, gl.VERTEX_SHADER, await readShader("vert"));
  const fragShader = createShader(gl, gl.FRAGMENT_SHADER, await readShader("frag"));
  const program = createProgram(gl, vertShader, fragShader);

  const a_position = gl.getAttribLocation(program, "a_position");
  const a_uv = gl.getAttribLocation(program, "a_uv");

  const u_resolution = gl.getUniformLocation(program, "iResolution");
  const u_time = gl.getUniformLocation(program, "iTime");
  const u_mouse = gl.getUniformLocation(program, "iMouse");
  const u_amplitude = gl.getUniformLocation(program, "iAmplitude");
  const u_frequency = gl.getUniformLocation(program, "iFrequency");

  const data = new Float32Array([
    -1.0, -1.0, 0.0, 0.0,
    1.0, -1.0, 1.0, 0.0,
    1.0, 1.0, 1.0, 1.0,
    -1.0, 1.0, 0.0, 1.0,
  ]);

  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

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

  // Variables de contrôle de la caméra
  let camera = {
    position: { x: 0, y: 3, z: -8 },
    rotation: { x: 0, y: 0 },
    zoom: 1.5
  };
  
  let isDragging = false;
  let lastMouseX, lastMouseY;

  // Écoute des événements de la souris pour la rotation de la caméra
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

  // Écoute de la molette pour le zoom
  canvas.addEventListener('wheel', (e) => {
    camera.zoom += e.deltaY * 0.001;
    camera.zoom = Math.min(Math.max(camera.zoom, 1.0), 5.0); // Limite du zoom
  });

  // Déplacement avec ZQSD
  let keys = {};
  window.addEventListener('keydown', (e) => { keys[e.key] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });

  const micInput = await getMicrophoneInput();
  if (!micInput) return;

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

    /*if (keys['w'] || keys['z']) {
      camera.position.z += forward.x;
      camera.position.z += forward.z;
    }*/
    /*if (keys['s']) {
      camera.position.x -= forward.x;
      camera.position.z -= forward.z;
    }*/
    if (keys['a'] || keys['q']) {
      camera.position.x -= right.x;
      camera.position.z -= right.z;
    }
    if (keys['d']) {
      camera.position.x += right.x;
      camera.position.z += right.z;
    }
  }

  function render() {
    let currentTime = Date.now() / 1000;
    let elapsedTime = currentTime - startTime;

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

    // Calcul de la direction et position de la caméra
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

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();
