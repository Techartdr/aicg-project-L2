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

function resizeCanvasToDisplaySize(canvas) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

async function main() {
  const canvas = document.getElementById("canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) alert("Could not initialize WebGL Context.");

  // Redimensionner le canvas pour l'adapter à l'écran
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
  let mouse = { x: 0, y: 0, clicked: false };

  // Gestion des événements de toucher (touch) pour les appareils mobiles
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    mouse.x = touch.clientX / canvas.width;
    mouse.y = 1.0 - touch.clientY / canvas.height;
  });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    mouse.clicked = true;
    const touch = e.touches[0];
    mouse.x = touch.clientX / canvas.width;
    mouse.y = 1.0 - touch.clientY / canvas.height;
  });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    mouse.clicked = false;
  });

  // Gestion de la souris pour les appareils de bureau
  canvas.addEventListener('mousemove', (e) => {
    if (mouse.clicked) {
      mouse.x = e.clientX / canvas.width;
      mouse.y = 1.0 - e.clientY / canvas.height;
    }
  });

  canvas.addEventListener('mousedown', () => { mouse.clicked = true; });
  canvas.addEventListener('mouseup', () => { mouse.clicked = false; });

  const micInput = await getMicrophoneInput();
  if (!micInput) return;

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

    gl.uniform4f(u_mouse, mouse.x * canvas.width, mouse.y * canvas.height, 0.0, 0.0);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();
