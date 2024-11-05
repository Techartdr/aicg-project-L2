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
  let mouse = { x: 0, y: 0, clicked: false };
  let pinchStartDist = 0;
  let zoom = 1.5;

  let isTouching = false;

  function calculatePinchDistance(e) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Gestion des événements tactiles
  canvas.addEventListener('touchstart', (e) => {
    isTouching = true;
    if (e.touches.length === 1) {
      mouse.clicked = true;
      mouse.x = e.touches[0].clientX / canvas.width;
      mouse.y = 1.0 - e.touches[0].clientY / canvas.height;
    } else if (e.touches.length === 2) {
      pinchStartDist = calculatePinchDistance(e);
    }
  });

  canvas.addEventListener('touchmove', (e) => {
    if (!isTouching) return;

    if (e.touches.length === 1) {
      const deltaX = (e.touches[0].clientX / canvas.width) - mouse.x;
      const deltaY = (1.0 - e.touches[0].clientY / canvas.height) - mouse.y;
      mouse.x += deltaX;
      mouse.y += deltaY;
    } else if (e.touches.length === 2) {
      const pinchDist = calculatePinchDistance(e);
      const pinchDelta = pinchDist - pinchStartDist;
      zoom += pinchDelta * 0.005;
      zoom = Math.min(Math.max(zoom, 1.0), 5.0);
      pinchStartDist = pinchDist;
    }
  });

  canvas.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
      mouse.clicked = false;
      isTouching = false;
    }
  });

  // Gestion des événements de souris pour PC uniquement
  canvas.addEventListener('mousemove', (e) => {
    if (!isTouching && mouse.clicked) {
      mouse.x = e.clientX / canvas.width;
      mouse.y = 1.0 - e.clientY / canvas.height;
    }
  });

  canvas.addEventListener('mousedown', (e) => {
    if (!isTouching) {
      mouse.clicked = true;
      mouse.x = e.clientX / canvas.width;
      mouse.y = 1.0 - e.clientY / canvas.height;
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    if (!isTouching) {
      mouse.clicked = false;
    }
  });

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

    gl.uniform4f(u_mouse, mouse.x * canvas.width, mouse.y * canvas.height, 0.0, zoom);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();
