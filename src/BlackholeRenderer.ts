/*
 * Copyright 2024 Junho Yeo
 * Licensed under the Apache License, Version 2.0
 * SPDX-License-Identifier: Apache-2.0
 *
 * Blackhole Hero Background - Three.js Renderer
 *
 * Real-time Schwarzschild blackhole visualization with gravitational lensing,
 * accretion disk, and relativistic effects.
 */

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import vertexShader from "./shaders/blackhole.vert.glsl?raw";
import fragmentShader from "./shaders/blackhole.frag.glsl?raw";

// === TYPES ===

export interface BlackholeConfig {
  /** Canvas element to render to */
  canvas: HTMLCanvasElement;

  /** Render quality preset */
  quality?: "low" | "medium" | "high" | "ultra";

  /** Initial camera distance from blackhole (in Schwarzschild radii) */
  cameraDistance?: number;

  /** Camera field of view in degrees */
  fieldOfView?: number;

  /** Enable orbital camera motion */
  enableOrbit?: boolean;

  /** Orbital angular velocity (radians per second) */
  orbitSpeed?: number;

  /** Enable manual camera controls (mouse/touch) */
  enableControls?: boolean;

  /** Mouse sensitivity for camera rotation */
  mouseSensitivity?: number;

  /** Touch sensitivity for camera rotation */
  touchSensitivity?: number;

  /** Enable camera distance control via scroll/pinch */
  enableZoom?: boolean;

  /** Minimum camera distance (in Schwarzschild radii) */
  minDistance?: number;

  /** Maximum camera distance (in Schwarzschild radii) */
  maxDistance?: number;

  /** Show accretion disk */
  showAccretionDisk?: boolean;

  /** Use texture for disk (false = procedural blackbody) */
  useDiskTexture?: boolean;

  /** Enable relativistic light aberration */
  enableLorentzTransform?: boolean;

  /** Enable Doppler color shift */
  enableDopplerShift?: boolean;

  /** Enable relativistic beaming (intensity boost) */
  enableBeaming?: boolean;

  /** Bloom effect strength (0 to disable) */
  bloomStrength?: number;

  /** Bloom effect radius */
  bloomRadius?: number;

  /** Bloom effect threshold */
  bloomThreshold?: number;

  /** Background texture URL */
  backgroundTextureUrl?: string;

  /** Star data texture URL */
  starTextureUrl?: string;

  /** Accretion disk texture URL */
  diskTextureUrl?: string;

  /** Resolution scale (0.5 = half resolution for performance) */
  resolutionScale?: number;

  /** Callback when all textures are loaded */
  onTexturesLoaded?: () => void;
}

interface QualityPreset {
  integrationSteps: number;
  stepSize: number;
}

const QUALITY_PRESETS: Record<string, QualityPreset> = {
  low: { integrationSteps: 300, stepSize: 0.1 },
  medium: { integrationSteps: 600, stepSize: 0.05 },
  high: { integrationSteps: 1000, stepSize: 0.02 },
  ultra: { integrationSteps: 1500, stepSize: 0.015 },
};

// === CAMERA CONTROLS CLASS ===

class CameraControls {
  private canvas: HTMLCanvasElement;
  private observer: BlackholeObserver;
  private enabled: boolean = false;
  private mouseSensitivity: number = 0.002;
  private touchSensitivity: number = 0.003;
  private enableZoom: boolean = true;
  private minDistance: number = 2.1;
  private maxDistance: number = 50;

  private isDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private lastTouchDistance: number = 0;

  // 绑定的事件处理器引用，用于正确移除事件监听器
  private boundMouseDown: (event: MouseEvent) => void;
  private boundMouseMove: (event: MouseEvent) => void;
  private boundMouseUp: () => void;
  private boundWheel: (event: WheelEvent) => void;
  private boundTouchStart: (event: TouchEvent) => void;
  private boundTouchMove: (event: TouchEvent) => void;
  private boundTouchEnd: (event: TouchEvent) => void;
  private boundContextMenu: (event: Event) => void;

  constructor(canvas: HTMLCanvasElement, observer: BlackholeObserver) {
    this.canvas = canvas;
    this.observer = observer;
    
    // 绑定事件处理器
    this.boundMouseDown = this.onMouseDown.bind(this);
    this.boundMouseMove = this.onMouseMove.bind(this);
    this.boundMouseUp = this.onMouseUp.bind(this);
    this.boundWheel = this.onWheel.bind(this);
    this.boundTouchStart = this.onTouchStart.bind(this);
    this.boundTouchMove = this.onTouchMove.bind(this);
    this.boundTouchEnd = this.onTouchEnd.bind(this);
    this.boundContextMenu = (e) => e.preventDefault();
    
    this.setupEventListeners();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.observer.manualControl = enabled;
    
    // 更新鼠标样式
    if (enabled) {
      this.canvas.style.cursor = 'grab';
    } else {
      this.canvas.style.cursor = 'default';
      this.isDragging = false;
    }
  }

  setMouseSensitivity(sensitivity: number): void {
    this.mouseSensitivity = sensitivity;
  }

  setTouchSensitivity(sensitivity: number): void {
    this.touchSensitivity = sensitivity;
  }

  setZoomEnabled(enabled: boolean): void {
    this.enableZoom = enabled;
  }

  setDistanceRange(min: number, max: number): void {
    this.minDistance = Math.max(min, 2.01); // 确保不会进入事件视界
    this.maxDistance = max;
  }

  private setupEventListeners(): void {
    // 鼠标事件
    this.canvas.addEventListener('mousedown', this.boundMouseDown);
    this.canvas.addEventListener('mousemove', this.boundMouseMove);
    this.canvas.addEventListener('mouseup', this.boundMouseUp);
    this.canvas.addEventListener('wheel', this.boundWheel);

    // 触摸事件
    this.canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.boundTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.boundTouchEnd);

    // 防止右键菜单
    this.canvas.addEventListener('contextmenu', this.boundContextMenu);
  }

  private onMouseDown(event: MouseEvent): void {
    if (!this.enabled) return;
    
    this.isDragging = true;
    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
    this.canvas.style.cursor = 'grabbing';
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.enabled || !this.isDragging) return;

    const deltaX = event.clientX - this.lastMouseX;
    const deltaY = event.clientY - this.lastMouseY;

    // 转换为角度增量
    const deltaYaw = -deltaX * this.mouseSensitivity;
    const deltaPitch = -deltaY * this.mouseSensitivity;

    this.observer.addManualAngles(deltaPitch, deltaYaw);

    this.lastMouseX = event.clientX;
    this.lastMouseY = event.clientY;
  }

  private onMouseUp(): void {
    if (!this.enabled) return;
    
    this.isDragging = false;
    this.canvas.style.cursor = 'grab';
  }

  private onWheel(event: WheelEvent): void {
    if (!this.enabled || !this.enableZoom) return;

    event.preventDefault();
    
    const zoomSpeed = 0.1;
    const delta = event.deltaY > 0 ? 1 : -1;
    const newDistance = this.observer.distance + delta * zoomSpeed;
    
    this.observer.distance = Math.max(this.minDistance, Math.min(this.maxDistance, newDistance));
  }

  private onTouchStart(event: TouchEvent): void {
    if (!this.enabled) return;

    event.preventDefault();
    
    if (event.touches.length === 1) {
      // 单指拖拽
      this.isDragging = true;
      this.lastMouseX = event.touches[0].clientX;
      this.lastMouseY = event.touches[0].clientY;
    } else if (event.touches.length === 2 && this.enableZoom) {
      // 双指缩放
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      this.lastTouchDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
    }
  }

  private onTouchMove(event: TouchEvent): void {
    if (!this.enabled) return;

    event.preventDefault();

    if (event.touches.length === 1 && this.isDragging) {
      // 单指拖拽旋转
      const touch = event.touches[0];
      const deltaX = touch.clientX - this.lastMouseX;
      const deltaY = touch.clientY - this.lastMouseY;

      const deltaYaw = -deltaX * this.touchSensitivity;
      const deltaPitch = -deltaY * this.touchSensitivity;

      this.observer.addManualAngles(deltaPitch, deltaYaw);

      this.lastMouseX = touch.clientX;
      this.lastMouseY = touch.clientY;
    } else if (event.touches.length === 2 && this.enableZoom) {
      // 双指缩放
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const currentDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      if (this.lastTouchDistance > 0) {
        const zoomFactor = currentDistance / this.lastTouchDistance;
        const newDistance = this.observer.distance / zoomFactor;
        this.observer.distance = Math.max(this.minDistance, Math.min(this.maxDistance, newDistance));
      }

      this.lastTouchDistance = currentDistance;
    }
  }

  private onTouchEnd(event: TouchEvent): void {
    if (!this.enabled) return;

    if (event.touches.length === 0) {
      this.isDragging = false;
      this.lastTouchDistance = 0;
    } else if (event.touches.length === 1) {
      // 从双指变为单指，重新设置单指位置
      this.lastMouseX = event.touches[0].clientX;
      this.lastMouseY = event.touches[0].clientY;
      this.lastTouchDistance = 0;
    }
  }

  dispose(): void {
    // 移除事件监听器
    this.canvas.removeEventListener('mousedown', this.boundMouseDown);
    this.canvas.removeEventListener('mousemove', this.boundMouseMove);
    this.canvas.removeEventListener('mouseup', this.boundMouseUp);
    this.canvas.removeEventListener('wheel', this.boundWheel);
    this.canvas.removeEventListener('touchstart', this.boundTouchStart);
    this.canvas.removeEventListener('touchmove', this.boundTouchMove);
    this.canvas.removeEventListener('touchend', this.boundTouchEnd);
    this.canvas.removeEventListener('contextmenu', this.boundContextMenu);
  }
}

// === OBSERVER CLASS ===

class BlackholeObserver {
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public direction: THREE.Vector3;
  public up: THREE.Vector3;
  public fov: number = 60;

  private _r: number;
  private _theta: number = 0;
  private _phi: number = 0; // 俯仰角
  private _angularVelocity: number = 0;
  private _maxAngularVelocity: number = 0;
  private _incline: number = -5 * Math.PI / 180;
  private _moving: boolean = false;
  private _time: number = 0;
  private _manualControl: boolean = false;
  private _manualPitch: number = 0; // 手动俯仰角
  private _manualYaw: number = 0;   // 手动偏航角

  constructor(distance: number = 8) {
    this._r = distance;
    this._maxAngularVelocity = 1 / Math.sqrt(2.0 * (this._r - 1.0)) / this._r;

    this.position = new THREE.Vector3(0, 0, this._r);
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3(0, 0, -1);
    this.up = new THREE.Vector3(0, 1, 0);
  }

  get distance(): number {
    return this._r;
  }

  set distance(value: number) {
    this._r = Math.max(value, 2.0);
    this._maxAngularVelocity = 1 / Math.sqrt(2.0 * (this._r - 1.0)) / this._r;
    this.updatePosition();
  }

  get orbitSpeed(): number {
    return this._angularVelocity;
  }

  set orbitSpeed(value: number) {
    this._angularVelocity = Math.min(Math.abs(value), this._maxAngularVelocity);
  }

  set moving(value: boolean) {
    this._moving = value;
  }

  get manualControl(): boolean {
    return this._manualControl;
  }

  set manualControl(value: boolean) {
    this._manualControl = value;
    if (value) {
      // 切换到手动控制时，从当前轨道位置计算初始角度
      const currentPos = this.position.clone().normalize();
      this._manualYaw = Math.atan2(currentPos.x, currentPos.z);
      this._manualPitch = Math.asin(currentPos.y);
    }
  }

  /**
   * 设置手动控制的视角
   * @param pitch 俯仰角 (弧度)
   * @param yaw 偏航角 (弧度)
   */
  setManualAngles(pitch: number, yaw: number): void {
    this._manualPitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
    this._manualYaw = yaw;
    if (this._manualControl) {
      this.updatePosition();
    }
  }

  /**
   * 增加手动控制的视角
   * @param deltaPitch 俯仰角增量 (弧度)
   * @param deltaYaw 偏航角增量 (弧度)
   */
  addManualAngles(deltaPitch: number, deltaYaw: number): void {
    this.setManualAngles(this._manualPitch + deltaPitch, this._manualYaw + deltaYaw);
  }

  private updatePosition(): void {
    if (this._manualControl) {
      // 手动控制模式：使用球坐标系
      // 球坐标转换：x = r*cos(pitch)*sin(yaw), y = r*sin(pitch), z = r*cos(pitch)*cos(yaw)
      const x = this._r * Math.cos(this._manualPitch) * Math.sin(this._manualYaw);
      const y = this._r * Math.sin(this._manualPitch);
      const z = this._r * Math.cos(this._manualPitch) * Math.cos(this._manualYaw);
      
      this.position.set(x, y, z);
      this.velocity.set(0, 0, 0); // 手动控制时速度为0
      
      // 计算朝向黑洞的方向
      this.direction.copy(this.position).negate().normalize();
      
      // 计算上方向
      const worldUp = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(this.direction, worldUp).normalize();
      this.up.crossVectors(right, this.direction).normalize();
    } else {
      // 轨道模式：保持原有逻辑
      const cos = Math.cos(this._theta);
      const sin = Math.sin(this._theta);

      this.position.set(this._r * sin, 0, this._r * cos);
      this.velocity.set(cos * this._angularVelocity, 0, -sin * this._angularVelocity);

      const inclineMatrix = new THREE.Matrix4().makeRotationX(this._incline);
      this.position.applyMatrix4(inclineMatrix);
      this.velocity.applyMatrix4(inclineMatrix);

      this.direction.copy(this.position).negate().normalize();
      
      const worldUp = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(this.direction, worldUp).normalize();
      this.up.crossVectors(right, this.direction).normalize();
    }
  }

  setDirection(pitch: number, yaw: number): void {
    const originalDirection = new THREE.Vector3(0, 0, -1);
    const rotation = new THREE.Euler(pitch, yaw, 0, "YXZ");
    this.direction.copy(originalDirection).applyEuler(rotation).normalize();
  }

  setLookAngles(pitch: number, yaw: number): void {
    this.setDirection(pitch, yaw);
  }

  update(delta: number): void {
    if (!this._manualControl) {
      // 轨道模式更新
      this._theta = (this._theta + this._angularVelocity * delta) % (Math.PI * 2);
      
      if (this._moving) {
        if (this._angularVelocity < this._maxAngularVelocity) {
          this._angularVelocity += delta / this._r;
        } else {
          this._angularVelocity = this._maxAngularVelocity;
        }
      } else {
        if (this._angularVelocity > 0.0) {
          this._angularVelocity -= delta / this._r;
        } else {
          this._angularVelocity = 0;
          this.velocity.set(0, 0, 0);
        }
      }
    }
    
    this.updatePosition();
    this._time += delta;
  }
}

// === MAIN RENDERER CLASS ===

export class BlackholeRenderer {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private composer: EffectComposer;
  private uniforms: Record<string, THREE.IUniform>;
  private observer: BlackholeObserver;
  private controls: CameraControls;
  private config: Required<Omit<BlackholeConfig, 'onTexturesLoaded'>> & Pick<BlackholeConfig, 'onTexturesLoaded'>;
  private lastTime: number = 0;
  private animationId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(userConfig: BlackholeConfig) {
    // Merge with defaults
    this.config = {
      canvas: userConfig.canvas,
      quality: userConfig.quality ?? "medium",
      cameraDistance: userConfig.cameraDistance ?? 10,
      fieldOfView: userConfig.fieldOfView ?? 90,
      enableOrbit: userConfig.enableOrbit ?? true,
      orbitSpeed: userConfig.orbitSpeed ?? 0.15,
      enableControls: userConfig.enableControls ?? false,
      mouseSensitivity: userConfig.mouseSensitivity ?? 0.002,
      touchSensitivity: userConfig.touchSensitivity ?? 0.003,
      enableZoom: userConfig.enableZoom ?? true,
      minDistance: userConfig.minDistance ?? 2.1,
      maxDistance: userConfig.maxDistance ?? 50,
      showAccretionDisk: userConfig.showAccretionDisk ?? true,
      useDiskTexture: userConfig.useDiskTexture ?? true,
      enableLorentzTransform: userConfig.enableLorentzTransform ?? true,
      enableDopplerShift: userConfig.enableDopplerShift ?? true,
      enableBeaming: userConfig.enableBeaming ?? true,
      bloomStrength: userConfig.bloomStrength ?? 0.5,
      bloomRadius: userConfig.bloomRadius ?? 0.3,
      bloomThreshold: userConfig.bloomThreshold ?? 0.8,
      backgroundTextureUrl: userConfig.backgroundTextureUrl ?? "",
      starTextureUrl: userConfig.starTextureUrl ?? "",
      diskTextureUrl: userConfig.diskTextureUrl ?? "",
      resolutionScale: userConfig.resolutionScale ?? 1.0,
      onTexturesLoaded: userConfig.onTexturesLoaded,
    };

    this.canvas = this.config.canvas;
    this.observer = new BlackholeObserver(this.config.cameraDistance);
    this.observer.orbitSpeed = this.config.orbitSpeed;

    // 初始化相机控制器
    this.controls = new CameraControls(this.canvas, this.observer);
    this.controls.setEnabled(this.config.enableControls);
    this.controls.setMouseSensitivity(this.config.mouseSensitivity);
    this.controls.setTouchSensitivity(this.config.touchSensitivity);
    this.controls.setZoomEnabled(this.config.enableZoom);
    this.controls.setDistanceRange(this.config.minDistance, this.config.maxDistance);

    this.renderer = this.createRenderer();
    this.scene = new THREE.Scene();
    this.camera = new THREE.Camera();
    this.camera.position.z = 1;
    this.uniforms = this.createUniforms();
    this.composer = this.createComposer();

    // Create fullscreen quad with shader
    this.createShaderMesh();

    // Setup resize handling
    this.setupResizeObserver();

    // Load textures
    this.loadTextures();
  }

  private createRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
    });

    renderer.setClearColor(0x000000, 1.0);
    renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    renderer.autoClear = false;

    return renderer;
  }

  private createUniforms(): Record<string, THREE.IUniform> {
    return {
      uTime: { value: 0 },
      uResolution: {
        value: new THREE.Vector2(
          this.canvas.clientWidth,
          this.canvas.clientHeight
        ),
      },
      uCameraPosition: { value: this.observer.position },
      uCameraVelocity: { value: this.observer.velocity },
      uCameraDirection: { value: this.observer.direction },
      uCameraUp: { value: this.observer.up },
      uFieldOfView: { value: this.config.fieldOfView },
      uShowAccretionDisk: { value: this.config.showAccretionDisk },
      uEnableLorentzTransform: { value: this.config.enableLorentzTransform },
      uEnableDopplerShift: { value: this.config.enableDopplerShift },
      uEnableRelBeaming: { value: this.config.enableBeaming },
      uUseDiskTexture: { value: this.config.diskTextureUrl ? false : this.config.useDiskTexture },
      uBackgroundTexture: { value: this.createDefaultTexture() },
      uStarDataTexture: { value: this.createStarNoiseTexture() },
      uDiskTexture: { value: this.createDefaultDiskTexture() },
    };
  }

  private createDefaultTexture(): THREE.Texture {
    // Create a simple dark gradient as default background
    const size = 256;
    const data = new Uint8Array(size * size * 4);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        // Dark blue-ish space color
        const brightness = Math.random() * 0.1;
        data[i] = brightness * 20;
        data[i + 1] = brightness * 25;
        data[i + 2] = brightness * 40;
        data[i + 3] = 255;
      }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  private createStarNoiseTexture(): THREE.Texture {
    // Procedural star field: stores (temperature, intensity, visibility)
    const size = 512;
    const data = new Uint8Array(size * size * 4);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;

        // Random star distribution
        const isStar = Math.random() > 0.997;
        if (isStar) {
          data[i] = Math.floor(Math.random() * 255); // Temperature
          data[i + 1] = Math.floor(128 + Math.random() * 127); // Intensity
          data[i + 2] = 255; // Visibility
        } else {
          data[i] = 128;
          data[i + 1] = 0;
          data[i + 2] = 0;
        }
        data[i + 3] = 255;
      }
    }

    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
  }

  private createDefaultDiskTexture(): THREE.Texture {
    // Procedural accretion disk texture
    const width = 512;
    const height = 128;
    const data = new Uint8Array(width * height * 4);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;

        // Radial position (0 = inner edge, 1 = outer edge)
        const radialPos = y / height;

        // Temperature decreases with radius
        const temp = 1.0 - radialPos * 0.7;

        // Turbulent patterns
        const noise1 = Math.sin(x * 0.1 + radialPos * 20) * 0.1;
        const noise2 = Math.sin(x * 0.05 + radialPos * 10) * 0.15;

        // Hot inner edge (orange/white), cooler outer (red)
        const r = Math.min(255, (temp + noise1) * 255 + 100);
        const g = Math.min(255, (temp * 0.6 + noise2) * 200);
        const b = Math.min(255, temp * 0.3 * 150);
        const a = (1.0 - radialPos * 0.5) * 255;

        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      }
    }

    const texture = new THREE.DataTexture(
      data,
      width,
      height,
      THREE.RGBAFormat
    );
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  private createComposer(): EffectComposer {
    const composer = new EffectComposer(this.renderer);

    const renderPass = new RenderPass(this.scene, this.camera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(128, 128),
      this.config.bloomStrength,
      this.config.bloomRadius,
      this.config.bloomThreshold
    );
    composer.addPass(bloomPass);

    const shaderPass = new ShaderPass(CopyShader);
    shaderPass.renderToScreen = true;
    composer.addPass(shaderPass);

    return composer;
  }

  private createShaderMesh(): void {
    const quality = QUALITY_PRESETS[this.config.quality];

    const processedFragShader = `#define STEP ${quality.stepSize.toFixed(4)}
#define NSTEPS ${quality.integrationSteps}
${fragmentShader}`;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: processedFragShader,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    this.scene.add(mesh);
  }

  private loadTextures(): void {
    const loader = new THREE.TextureLoader();
    const texturesToLoad: string[] = [];
    let loadedCount = 0;

    if (this.config.backgroundTextureUrl) texturesToLoad.push('background');
    if (this.config.starTextureUrl) texturesToLoad.push('star');
    if (this.config.diskTextureUrl) texturesToLoad.push('disk');

    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount >= texturesToLoad.length) {
        this.config.onTexturesLoaded?.();
      }
    };

    if (texturesToLoad.length === 0) {
      this.config.onTexturesLoaded?.();
      return;
    }

    if (this.config.backgroundTextureUrl) {
      loader.load(this.config.backgroundTextureUrl, (texture: THREE.Texture) => {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        this.uniforms.uBackgroundTexture.value = texture;
        checkAllLoaded();
      });
    }

    if (this.config.starTextureUrl) {
      loader.load(this.config.starTextureUrl, (texture: THREE.Texture) => {
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        this.uniforms.uStarDataTexture.value = texture;
        checkAllLoaded();
      });
    }

    if (this.config.diskTextureUrl) {
      loader.load(this.config.diskTextureUrl, (texture: THREE.Texture) => {
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        this.uniforms.uDiskTexture.value = texture;
        this.uniforms.uUseDiskTexture.value = true;
        checkAllLoaded();
      });
    }
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.handleResize(width, height);
      }
    });
    this.resizeObserver.observe(this.canvas);
  }

  private handleResize(width: number, height: number): void {
    const scale = this.config.resolutionScale;
    this.renderer.setPixelRatio(window.devicePixelRatio * scale);
    this.renderer.setSize(width, height);
    this.composer.setSize(width * scale, height * scale);
  }

  private animate = (currentTime: number): void => {
    this.animationId = requestAnimationFrame(this.animate);

    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    const scale = this.config.resolutionScale;
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;

    this.renderer.setPixelRatio(window.devicePixelRatio * scale);
    this.renderer.setSize(width, height);
    this.composer.setSize(width * scale, height * scale);

    // 只有在非手动控制模式下才启用轨道运动
    this.observer.moving = this.config.enableOrbit && !this.observer.manualControl;
    this.observer.update(deltaTime);

    this.uniforms.uTime.value = (this.uniforms.uTime.value + deltaTime) % 1000.0;
    this.uniforms.uResolution.value.set(width * scale, height * scale);
    this.uniforms.uCameraPosition.value.copy(this.observer.position);
    this.uniforms.uCameraVelocity.value.copy(this.observer.velocity);
    this.uniforms.uCameraDirection.value.copy(this.observer.direction);
    this.uniforms.uFieldOfView.value = this.observer.fov;

    this.composer.render();
  };

  // === PUBLIC API ===

  /**
   * Start the render loop
   */
  start(): void {
    if (this.animationId !== null) return;
    this.lastTime = performance.now();
    this.animate(this.lastTime);
  }

  /**
   * Stop the render loop
   */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Render a single frame
   */
  renderFrame(): void {
    this.composer.render();
  }

  /**
   * Update configuration at runtime
   */
  setConfig(updates: Partial<BlackholeConfig>): void {
    if (updates.cameraDistance !== undefined) {
      this.observer.distance = updates.cameraDistance;
      this.config.cameraDistance = updates.cameraDistance;
    }

    if (updates.orbitSpeed !== undefined) {
      this.observer.orbitSpeed = updates.orbitSpeed;
      this.config.orbitSpeed = updates.orbitSpeed;
    }

    if (updates.enableOrbit !== undefined) {
      this.config.enableOrbit = updates.enableOrbit;
      this.observer.moving = updates.enableOrbit && !this.observer.manualControl;
    }

    if (updates.enableControls !== undefined) {
      this.config.enableControls = updates.enableControls;
      this.controls.setEnabled(updates.enableControls);
    }

    if (updates.mouseSensitivity !== undefined) {
      this.config.mouseSensitivity = updates.mouseSensitivity;
      this.controls.setMouseSensitivity(updates.mouseSensitivity);
    }

    if (updates.touchSensitivity !== undefined) {
      this.config.touchSensitivity = updates.touchSensitivity;
      this.controls.setTouchSensitivity(updates.touchSensitivity);
    }

    if (updates.enableZoom !== undefined) {
      this.config.enableZoom = updates.enableZoom;
      this.controls.setZoomEnabled(updates.enableZoom);
    }

    if (updates.minDistance !== undefined || updates.maxDistance !== undefined) {
      const minDist = updates.minDistance ?? this.config.minDistance;
      const maxDist = updates.maxDistance ?? this.config.maxDistance;
      this.config.minDistance = minDist;
      this.config.maxDistance = maxDist;
      this.controls.setDistanceRange(minDist, maxDist);
    }

    if (updates.fieldOfView !== undefined) {
      this.config.fieldOfView = updates.fieldOfView;
      this.uniforms.uFieldOfView.value = updates.fieldOfView;
    }

    if (updates.showAccretionDisk !== undefined) {
      this.config.showAccretionDisk = updates.showAccretionDisk;
      this.uniforms.uShowAccretionDisk.value = updates.showAccretionDisk;
    }

    if (updates.enableLorentzTransform !== undefined) {
      this.config.enableLorentzTransform = updates.enableLorentzTransform;
      this.uniforms.uEnableLorentzTransform.value =
        updates.enableLorentzTransform;
    }

    if (updates.enableDopplerShift !== undefined) {
      this.config.enableDopplerShift = updates.enableDopplerShift;
      this.uniforms.uEnableDopplerShift.value = updates.enableDopplerShift;
    }

    if (updates.enableBeaming !== undefined) {
      this.config.enableBeaming = updates.enableBeaming;
      this.uniforms.uEnableRelBeaming.value = updates.enableBeaming;
    }
  }

  /**
   * Set camera look direction (for manual control)
   */
  setLookAngles(pitch: number, yaw: number): void {
    this.observer.setManualAngles(pitch, yaw);
  }

  /**
   * Enable or disable manual camera controls
   */
  setControlsEnabled(enabled: boolean): void {
    this.setConfig({ enableControls: enabled });
  }

  /**
   * Get current camera control state
   */
  getControlsEnabled(): boolean {
    return this.config.enableControls;
  }

  /**
   * Get the Three.js renderer for advanced usage
   */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // 清理控制器
    this.controls.dispose();

    this.renderer.dispose();
    this.composer.dispose();

    // Dispose textures
    const textures = [
      this.uniforms.uBackgroundTexture.value,
      this.uniforms.uStarDataTexture.value,
      this.uniforms.uDiskTexture.value,
    ];
    textures.forEach((tex) => tex?.dispose?.());
  }
}
