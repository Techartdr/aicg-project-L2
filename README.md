# AICG Project : Ray Marching Project - Dynamic World - Arthur Deroo

Welcome to **Ray Marching - Dynamic World**! This WebGL project provides an interactive rendering experience using ray marching, with real-time reactions to audio input from the microphone and user interactions.

## Table of Contents
- [Overview](#overview)
- [Technologies Used](#technologies-used)
- [Project Structure](#project-structure)
- [File Details](#file-details)
- [Features](#features)
- [Shader Explanations](#shader-explanations)
- [Controls and Interactions](#controls-and-interactions)
- [Potential Improvements](#potential-improvements)

---

## Overview

This project uses ray marching to create an immersive 3D scene in the browser. The scene responds to audio input, animating geometric objects and generating an interactive display based on the frequencies and amplitudes captured by the microphone.

## Technologies Used

- **WebGL2** for browser-based 3D rendering
- **JavaScript (ES6)** for program logic
- **GLSL Shaders** for graphical computation and ray marching effects
- **HTML/CSS** for basic page structure and styling

## Project Structure

The project consists of the following files:
- `index.html` : Main HTML file.
- `style.css` : Optional stylesheet for enhanced page styling.
- `script.js` : JavaScript script for WebGL setup and microphone handling.
- `shader.vert` : Vertex shader for setting up basic geometry.
- `shader.frag` : Fragment shader containing the ray marching code.

## File Details

### `index.html`
This HTML file defines the basic structure of the page:
- A `canvas` for 3D rendering.
- An instruction `div` displayed at load time.
- An FPS counter showing the frames per second.

### `style.css`
Stylesheet for the page, including styles for the canvas and instruction elements.

### `script.js`
The central JavaScript file of the project, handling:
- Display of instructions based on the device type (mobile or desktop).
- Audio capture and frequency analysis.
- WebGL setup, shader compilation, and scene rendering.
- Camera logic and interaction via mouse and keyboard.

### `shader.vert`
Vertex shader that manages basic vertex data, passing position and texture coordinates to the fragment shader.

### `shader.frag`
Fragment shader implementing ray marching, defining the objects in the scene, and incorporating audio and lighting effects for a reactive visual experience.

## Features

1. **Ray Marching Effects**: This project defines several geometric objects via Signed Distance Field (SDF) functions:
   - Sphere
   - Box
   - Ground
2. **Audio-Reactive Animation**: Using the user's microphone, the scene responds to audio frequencies and amplitudes to modify the sphere's position and scale.
3. **Camera Controls**: The camera can be controlled with the mouse or keyboard, allowing free exploration of the scene.

## Shader Explanations

### shader.vert
The vertex shader handles basic vertex data, passing position and texture coordinates to the fragment shader.

### shader.frag
The fragment shader is the core of the ray marching algorithm:
- **`map` Function**: Defines the objects in the scene, such as a reactive sphere, a repeating box to create a grid effect, and a ground plane.
- **`rayMarch` Function**: Executes ray marching, calculating the distance between the camera and the objects.
- **Fresnel Effect**: Applied to enhance the edges of objects, creating a realistic, glowing effect.

### Important Uniform Variables
- `iAmplitude` and `iFrequency`: Used to animate the scene based on captured audio.
- `iMouse`: Stores the mouse position, allowing for camera orientation manipulation.
- `iResolution` and `iTime`: Screen dimensions and current time for generating animated effects.

## Controls and Interactions

### Keyboard
- **Q/A** and **D**: Move the camera left and right.

### Mouse
- **Click and Drag**: Rotate the camera around the scene.
- **Scroll**: Zoom in and out.

### Mobile
- **Swipe**: Rotate the view.
- **Pinch**: Zoom in and out.

## Potential Improvements

- **Add New Objects**: Enhance the scene by adding more shapes and volumes.
- **Post-Processing Effects**: Add blur, color filters, or distortion effects.
- **Performance Optimization**: Reduce shader complexity to improve framerate.

---

This project serves as an introduction to ray marching and real-time audio-visual interaction, offering a solid base to further explore the potential of 3D rendering with WebGL.
