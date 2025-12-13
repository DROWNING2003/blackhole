/*
 * Copyright 2024 Junho Yeo
 * SPDX-License-Identifier: Apache-2.0
 */

#define PI 3.141592653589793238462643383279
#define DEG_TO_RAD (PI/180.0)
#define ROT_Z(a) mat3(cos(a), -sin(a), 0, sin(a), cos(a), 0, 0, 0, 1)

#ifndef STEP
#define STEP 0.05
#endif

#ifndef NSTEPS
#define NSTEPS 600
#endif

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uCameraPosition;
uniform vec3 uCameraDirection;
uniform vec3 uCameraUp;
uniform float uFieldOfView;
uniform vec3 uCameraVelocity;

uniform bool uShowAccretionDisk;
uniform bool uUseDiskTexture;
uniform bool uEnableDopplerShift;
uniform bool uEnableLorentzTransform;
uniform bool uEnableRelBeaming;

uniform sampler2D uBackgroundTexture;
uniform sampler2D uStarDataTexture;
uniform sampler2D uDiskTexture;

const float DISK_IN = 2.0;
const float DISK_WIDTH = 4.0;
const float MIN_TEMPERATURE = 1000.0;
const float TEMPERATURE_RANGE = 39000.0;

vec2 squareFrame(vec2 screenSize) {
  return 2.0 * (gl_FragCoord.xy / screenSize.xy) - 1.0;
}

vec2 toSpherical(vec3 c) {
  vec2 uv = vec2(atan(c.z, c.x), asin(c.y));
  uv *= vec2(1.0 / (2.0 * PI), 1.0 / PI);
  uv += 0.5;
  return uv;
}

vec3 lorentzTransformVelocity(vec3 u, vec3 v) {
  float speed = length(v);
  if (speed > 0.0) {
    float gamma = 1.0 / sqrt(1.0 - dot(v, v));
    float denominator = 1.0 - dot(v, u);
    vec3 newU = (u / gamma - v + (gamma / (gamma + 1.0)) * dot(u, v) * v) / denominator;
    return newU;
  }
  return u;
}

vec3 tempToColor(float tempKelvin) {
  vec3 color;
  tempKelvin = clamp(tempKelvin, 1000.0, 40000.0) / 100.0;
  
  if (tempKelvin <= 66.0) {
    color.r = 255.0;
    color.g = tempKelvin;
    color.g = 99.4708025861 * log(color.g) - 161.1195681661;
    if (color.g < 0.0) color.g = 0.0;
    if (color.g > 255.0) color.g = 255.0;
  } else {
    color.r = tempKelvin - 60.0;
    if (color.r < 0.0) color.r = 0.0;
    color.r = 329.698727446 * pow(color.r, -0.1332047592);
    if (color.r < 0.0) color.r = 0.0;
    if (color.r > 255.0) color.r = 255.0;
    color.g = tempKelvin - 60.0;
    if (color.g < 0.0) color.g = 0.0;
    color.g = 288.1221695283 * pow(color.g, -0.0755148492);
    if (color.g > 255.0) color.g = 255.0;
  }
  
  if (tempKelvin >= 66.0) {
    color.b = 255.0;
  } else if (tempKelvin <= 19.0) {
    color.b = 0.0;
  } else {
    color.b = tempKelvin - 10.0;
    color.b = 138.5177312231 * log(color.b) - 305.0447927307;
    if (color.b < 0.0) color.b = 0.0;
    if (color.b > 255.0) color.b = 255.0;
  }
  
  color /= 255.0;
  return color;
}

void main() {
  float uvfov = tan(uFieldOfView / 2.0 * DEG_TO_RAD);
  vec2 uv = squareFrame(uResolution);
  uv *= vec2(uResolution.x / uResolution.y, 1.0);
  
  vec3 forward = normalize(uCameraDirection);
  vec3 up = normalize(uCameraUp);
  vec3 nright = normalize(cross(forward, up));
  up = cross(nright, forward);
  
  vec3 pixelPos = uCameraPosition + forward + nright * uv.x * uvfov + up * uv.y * uvfov;
  vec3 rayDir = normalize(pixelPos - uCameraPosition);
  
  if (uEnableLorentzTransform)
    rayDir = lorentzTransformVelocity(rayDir, uCameraVelocity);
  
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  
  vec3 point = uCameraPosition;
  vec3 velocity = rayDir;
  vec3 c = cross(point, velocity);
  float h2 = dot(c, c);
  
  float rayGamma = 1.0 / sqrt(1.0 - dot(uCameraVelocity, uCameraVelocity));
  float rayDopplerFactor = rayGamma * (1.0 + dot(rayDir, -uCameraVelocity));
  
  float rayIntensity = 1.0;
  if (uEnableRelBeaming)
    rayIntensity /= pow(rayDopplerFactor, 3.0);
  
  vec3 oldpoint;
  float distance = length(point);
  
  for (int i = 0; i < NSTEPS; i++) {
    oldpoint = point;
    point += velocity * STEP;
    vec3 accel = -1.5 * h2 * point / pow(dot(point, point), 2.5);
    velocity += accel * STEP;
    
    distance = length(point);
    if (distance < 0.0) break;
    
    bool horizonMask = distance < 1.0 && length(oldpoint) > 1.0;
    if (horizonMask) {
      color += vec4(0.0, 0.0, 0.0, 1.0);
      break;
    }
    
    if (uShowAccretionDisk) {
      if (oldpoint.y * point.y < 0.0) {
        float lambda = -oldpoint.y / velocity.y;
        vec3 intersection = oldpoint + lambda * velocity;
        float r = length(intersection);
        
        if (DISK_IN <= r && r <= DISK_IN + DISK_WIDTH) {
          float phi = atan(intersection.x, intersection.z);
          
          vec3 diskVelocity = vec3(-intersection.x, 0.0, intersection.z) / sqrt(2.0 * (r - 1.0)) / (r * r);
          phi -= mod(uTime, PI * 2.0);
          phi = mod(phi + PI * 2.0, PI * 2.0);
          float diskGamma = 1.0 / sqrt(1.0 - dot(diskVelocity, diskVelocity));
          float diskDopplerFactor = diskGamma * (1.0 + dot(rayDir / distance, diskVelocity));
          
          if (uUseDiskTexture) {
            vec2 texCoord = vec2(mod(phi, 2.0 * PI) / (2.0 * PI), 1.0 - (r - DISK_IN) / DISK_WIDTH);
            vec4 diskColor = texture2D(uDiskTexture, texCoord) / (rayDopplerFactor * diskDopplerFactor);
            float brightness = (diskColor.r + diskColor.g + diskColor.b) / 3.0;
            float diskAlpha = clamp(brightness * 1.5, 0.2, 1.0);
            
            if (uEnableRelBeaming)
              diskAlpha /= pow(diskDopplerFactor, 3.0);
            
            color += diskColor * diskAlpha;
          } else {
            float diskTemperature = 10000.0 * pow(r / DISK_IN, -3.0 / 4.0);
            
            if (uEnableDopplerShift)
              diskTemperature /= rayDopplerFactor * diskDopplerFactor;
            
            vec3 diskColor = tempToColor(diskTemperature);
            float diskAlpha = clamp(dot(diskColor, diskColor) / 3.0, 0.0, 1.0);
            
            if (uEnableRelBeaming)
              diskAlpha /= pow(diskDopplerFactor, 3.0);
            
            color += vec4(diskColor, 1.0) * diskAlpha;
          }
        }
      }
    }
  }
  
  if (distance > 1.0) {
    rayDir = normalize(point - oldpoint);
    vec2 texCoord = toSpherical(rayDir * ROT_Z(45.0 * DEG_TO_RAD));
    
    vec4 starColor = texture2D(uStarDataTexture, texCoord);
    if (starColor.g > 0.0) {
      float starTemperature = MIN_TEMPERATURE + TEMPERATURE_RANGE * starColor.r;
      float starVelocity = starColor.b - 0.5;
      float starDopplerFactor = sqrt((1.0 + starVelocity) / (1.0 - starVelocity));
      
      if (uEnableDopplerShift)
        starTemperature /= rayDopplerFactor * starDopplerFactor;
      
      color += vec4(tempToColor(starTemperature), 1.0) * starColor.g;
    }
    
    color += texture2D(uBackgroundTexture, texCoord) * 0.25;
  }
  
  gl_FragColor = color * rayIntensity;
}
