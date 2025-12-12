/*
 * Copyright 2024 Junho Yeo
 * Licensed under the Apache License, Version 2.0
 * SPDX-License-Identifier: Apache-2.0
 *
 * Blackhole Hero Background - Vertex Shader
 * Simple pass-through for fullscreen quad rendering
 */

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
