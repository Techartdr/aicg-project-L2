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

async function main() {
  const fps = document.getElementById("fps");

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
          fps.innerHTML = Math.round(1 / dt, 2);
      },
  };

  const canvas = document.getElementById("canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) alert("Could not initialize WebGL Context.");

  const vertShader = createShader(gl, gl.VERTEX_SHADER, await readShader("vert"));
  const fragShader = createShader(gl, gl.FRAGMENT_SHADER, await readShader("frag"));
  const program = createProgram(gl, vertShader, fragShader);

  const a_position = gl.getAttribLocation(program, "a_position");
  const a_uv = gl.getAttribLocation(program, "a_uv");

  const u_resolution = gl.getUniformLocation(program, "u_resolution");
  const u_time = gl.getUniformLocation(program, "u_time");
  const u_dt = gl.getUniformLocation(program, "u_dt");
  const u_audio = gl.getUniformLocation(program, "u_audio");  // New uniform for audio data

  // Set up audio context and analyzer
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;  // Can be adjusted for finer or coarser frequency data
  const audioData = new Uint8Array(analyser.frequencyBinCount);

  // Start audio capture
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
  }).catch(error => {
      console.error("Error accessing microphone:", error);
  });

  // Geometry data
  const data = new Float32Array([
      -1.0, -1.0, 0.0, 0.0,
       1.0, -1.0, 1.0, 0.0,
       1.0,  1.0, 1.0, 1.0,
      -1.0,  1.0, 0.0, 1.0,
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

  function loop() {
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      // Update audio level
      analyser.getByteFrequencyData(audioData);
      const audioLevel = audioData.reduce((a, b) => a + b) / audioData.length / 255;

      // Set uniform variables
      gl.bindVertexArray(vao);
      gl.useProgram(program);
      gl.uniform2f(u_resolution, gl.canvas.width, gl.canvas.height);
      gl.uniform1f(u_time, time.t);
      gl.uniform1f(u_dt, time.dt());
      gl.uniform1f(u_audio, audioLevel);  // Pass the audio level to the shader
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
      gl.bindVertexArray(null);

      time.update();
      requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

main();