// Renderer, camera, lights, orbit controls, camera presets.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const CAMERA_PRESETS = {
  FOH: { pos: [0, 6.5, 17], target: [0, 2.2, 0] },
  SL: { pos: [15, 6, 1.5], target: [0, 2.2, 0] },
  SR: { pos: [-15, 6, 1.5], target: [0, 2.2, 0] },
  Top: { pos: [0, 22, 0.01], target: [0, 0, 0] },
};

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d0e12');
  scene.fog = new THREE.Fog('#0d0e12', 30, 60);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 3;
  controls.maxDistance = 45;

  // Lighting: soft fill plus a warm key from FOH and a cool backlight, like a work-light look.
  scene.add(new THREE.HemisphereLight('#c9d4ff', '#202024', 0.9));
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
    new THREE.MeshStandardMaterial({ color: '#121317', roughness: 1 }),
  );
  pitFloor.rotation.x = -Math.PI / 2;
  pitFloor.position.y = -2.2;
  pitFloor.receiveShadow = true;
  scene.add(pitFloor);
  const grid = new THREE.GridHelper(40, 40, '#2c2f38', '#1d1f26');
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

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Pull back a bit on narrow (portrait phone) screens so the whole stage fits.
    camera.fov = camera.aspect < 1 ? 60 : 45;
    camera.updateProjectionMatrix();
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

  return { renderer, scene, camera, controls, render, setPreset, frameBounds };
}
