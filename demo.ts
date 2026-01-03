import { BlackholeRenderer } from "./src/BlackholeRenderer";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const params = new URLSearchParams(window.location.search);
const quality = (params.get("quality") as "low" | "medium" | "high") || "medium";

const renderer = new BlackholeRenderer({
  canvas,
  quality,
  cameraDistance: 10,
  fieldOfView: 90,
  enableOrbit: true,
  enableControls: false, // 默认关闭手动控制
  mouseSensitivity: 0.002,
  touchSensitivity: 0.003,
  enableZoom: true,
  minDistance: 2.1,
  maxDistance: 50,
  showAccretionDisk: true,
  useDiskTexture: true,
  enableLorentzTransform: true,
  enableDopplerShift: true,
  enableBeaming: true,
  bloomStrength: 0.5,
  bloomRadius: 0.3,
  bloomThreshold: 0.8,
  backgroundTextureUrl: "/assets/milkyway.jpg",
  starTextureUrl: "/assets/star_noise.png",
  diskTextureUrl: "/assets/accretion_disk.png",
});

renderer.start();

let frames = 0;
let lastTime = performance.now();
const fpsEl = document.getElementById("fps");

function updateFPS() {
  frames++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    if (fpsEl) fpsEl.textContent = `${frames} FPS`;
    frames = 0;
    lastTime = now;
  }
  requestAnimationFrame(updateFPS);
}
updateFPS();

const orbitToggle = document.getElementById("orbitToggle") as HTMLInputElement;
const controlsToggle = document.getElementById("controlsToggle") as HTMLInputElement;
const diskCheckbox = document.getElementById("disk") as HTMLInputElement;
const dopplerCheckbox = document.getElementById("doppler") as HTMLInputElement;
const beamingCheckbox = document.getElementById("beaming") as HTMLInputElement;
const lorentzCheckbox = document.getElementById("lorentz") as HTMLInputElement;
const distanceSlider = document.getElementById("distance") as HTMLInputElement;
const mouseSensitivitySlider = document.getElementById("mouseSensitivity") as HTMLInputElement;

orbitToggle.addEventListener("change", () => {
  renderer.setConfig({ enableOrbit: orbitToggle.checked });
});

controlsToggle.addEventListener("change", () => {
  renderer.setConfig({ enableControls: controlsToggle.checked });
  // 当启用手动控制时，自动禁用轨道运动
  if (controlsToggle.checked && orbitToggle.checked) {
    orbitToggle.checked = false;
    renderer.setConfig({ enableOrbit: false });
  }
});

diskCheckbox.addEventListener("change", () => {
  renderer.setConfig({ showAccretionDisk: diskCheckbox.checked });
});

dopplerCheckbox.addEventListener("change", () => {
  renderer.setConfig({ enableDopplerShift: dopplerCheckbox.checked });
});

beamingCheckbox.addEventListener("change", () => {
  renderer.setConfig({ enableBeaming: beamingCheckbox.checked });
});

lorentzCheckbox.addEventListener("change", () => {
  renderer.setConfig({ enableLorentzTransform: lorentzCheckbox.checked });
});

distanceSlider.addEventListener("input", () => {
  renderer.setConfig({ cameraDistance: parseFloat(distanceSlider.value) });
});

mouseSensitivitySlider.addEventListener("input", () => {
  renderer.setConfig({ mouseSensitivity: parseFloat(mouseSensitivitySlider.value) });
});
