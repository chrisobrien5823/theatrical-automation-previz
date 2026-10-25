// Renderer, camera, lights, orbit controls, camera presets.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SCENE } from './palette.js';

export const CAMERA_PRESETS = {
  FOH: { pos: [0, 6.5, 17], target: [0, 2.2, 0] },
  SL: { pos: [15, 6, 1.5], target: [0, 2.2, 0] },
  SR: { pos: [-15, 6, 1.5], target: [0, 2.2, 0] },
  TOP: { pos: [0, 22, 0.01], target: [0, 0, 0] },
};

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE.ground);
  scene.fog = new THREE.Fog(SCENE.ground, 30, 60);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 3;
  controls.maxDistance = 45;

  // Lighting: soft fill plus a warm key from FOH and a cool backlight, like a work-light look.
  scene.add(new THREE.HemisphereLight(SCENE.skyFill, SCENE.groundFill, 0.9));
  const key = new THREE.DirectionalLight('#fff1dd', 1.6);
  key.position.set(6, 14, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 12, bottom: -6, near: 1, far: 40 });
  scene.add(key);
  const back = new THREE.DirectionalLight('#8fb0ff', 0.6);
  back.position.set(-4, 10, -12);
  scene.add(back);

  // Floor of the trap room / pit below the deck, with a grid for scale (1 m squares).
  const pitFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: SCENE.pit, roughness: 1 }),
  );
  pitFloor.rotation.x = -Math.PI / 2;
  pitFloor.position.y = -2.2;
  pitFloor.receiveShadow = true;
  scene.add(pitFloor);
  const grid = new THREE.GridHelper(40, 40, SCENE.gridMajor, SCENE.gridMinor);
  grid.position.y = -2.19;
  scene.add(grid);

  let camTween = null;
  function setPreset(name, animate = true) {
    const p = CAMERA_PRESETS[name];
    if (!p) return;
    const to = { pos: new THREE.Vector3(...p.pos), target: new THREE.Vector3(...p.target) };
    if (!animate) {
      camera.position.copy(to.pos);
      controls.target.copy(to.target);
      controls.update();
      return;
    }
    camTween = { from: { pos: camera.position.clone(), target: controls.target.clone() }, to, t: 0 };
  }

  /** Point the camera at a bounding box from a FOH-ish angle so the whole thing is in view. */
  function frameBounds(box) {
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    const dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.9;
    const dir = new THREE.Vector3(0, 0.35, 1).normalize();
    camTween = {
      from: { pos: camera.position.clone(), target: controls.target.clone() },
      to: { pos: center.clone().addScaledVector(dir, dist), target: center },
      t: 0,
    };
    controls.maxDistance = Math.max(45, dist * 2);
    camera.far = Math.max(200, dist * 6);
    camera.updateProjectionMatrix();
  }

  // Note when the user steers the camera, so automatic framing never fights their hands.
  let userSteeredAt = -Infinity;
  controls.addEventListener('start', () => {
    userSteeredAt = performance.now();
    camTween = null;
  });

  /**
   * Swing the camera to look across a gap ({x, y, z} midpoint and direction): side-on to the gap direction, from the side the camera is
   * already on, a little above. Skipped if the user moved the camera in the last few seconds.
   */
  function focusGap(at, gapDir, { distance = 8, elevation = 0.95, respectUserMs = 8000 } = {}) {
    if (performance.now() - userSteeredAt < respectUserMs) return false;
    const point = new THREE.Vector3(at.x, at.y, at.z);
    const flat = new THREE.Vector3(gapDir.x, 0, gapDir.z);
    if (flat.lengthSq() < 1e-8) flat.set(1, 0, 0); // vertical gap: any side view shows it
    flat.normalize();
    const side = new THREE.Vector3(-flat.z, 0, flat.x);
    const toCam = new THREE.Vector3().subVectors(camera.position, point);
    // Look from downstage (the audience side) when that's a real choice, otherwise stay on the camera's side.
    if (Math.abs(side.z) > 0.3 ? side.z < 0 : side.dot(toCam) < 0) side.negate();
    // High enough to look down into the gap: most clearance problems are in plan (a sweep past a unit).
    const dir = side.multiplyScalar(Math.cos(elevation)).add(new THREE.Vector3(0, Math.sin(elevation), 0));
    camTween = {
      from: { pos: camera.position.clone(), target: controls.target.clone() },
      to: { pos: point.clone().addScaledVector(dir.normalize(), distance), target: point.clone() },
      t: 0,
    };
    return true;
  }

  // Overlays (HUD and axis bus on top, camera control and messages at the bottom) cover part of the
  // canvas. Shift the projection so the camera's aim lands in the middle of the clear band.
  let insets = { top: 0, bottom: 0 };
  function applyInsets() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    const shift = (insets.top - insets.bottom) / 2;
    if (Math.abs(shift) < 1 || !w || !h) camera.clearViewOffset();
    else camera.setViewOffset(w, h, 0, -shift, w, h);
    camera.updateProjectionMatrix();
  }
  function setInsets(top, bottom) {
    insets = { top, bottom };
    applyInsets();
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Pull back a bit on narrow (portrait phone) screens so the whole stage fits.
    camera.fov = camera.aspect < 1 ? 60 : 45;
    applyInsets();
  }
  new ResizeObserver(resize).observe(container);
  resize();
  setPreset('FOH', false);

  function render(dt) {
    if (camTween) {
      camTween.t = Math.min(1, camTween.t + dt / 0.8);
      const k = camTween.t * camTween.t * (3 - 2 * camTween.t); // smoothstep
      camera.position.lerpVectors(camTween.from.pos, camTween.to.pos, k);
      controls.target.lerpVectors(camTween.from.target, camTween.to.target, k);
      if (camTween.t >= 1) camTween = null;
    }
    controls.update();
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, controls, render, setPreset, frameBounds, focusGap, setInsets };
}
