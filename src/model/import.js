// Read glTF / GLB files from a file drop or picker into a Three.js scene.
// Accepts a single .glb, or a .gltf together with its .bin and texture files.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export const UNIT_SCALES = { m: 1, cm: 0.01, mm: 0.001, in: 0.0254, ft: 0.3048 };

export function isModelFile(file) {
  return /\.(glb|gltf)$/i.test(file.name);
}

/**
 * @param files File[] from a drop or <input type=file multiple>
 * @returns { scene, name, stats: { meshes, triangles, nodes } }
 */
export async function readModelFiles(files) {
  const list = [...files];
  const main = list.find((f) => /\.glb$/i.test(f.name)) ?? list.find((f) => /\.gltf$/i.test(f.name));
  if (!main) throw new Error('Choose a .glb file, or a .gltf with its .bin and textures');

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  let gltf;
  if (/\.glb$/i.test(main.name)) {
    gltf = await loader.parseAsync(await main.arrayBuffer(), '');
  } else {
    // Resolve the .gltf's relative references (buffers, textures) to the other dropped files.
    const urls = new Map(list.map((f) => [f.name, URL.createObjectURL(f)]));
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      const name = decodeURIComponent(url.split(/[\\/]/).pop());
      if (urls.has(name)) return urls.get(name);
      if (!/^(blob|data):/.test(url)) throw new Error(`Missing file "${name}": drop it together with the .gltf`);
      return url;
    });
    try {
      gltf = await new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder).loadAsync(urls.get(main.name));
    } finally {
      for (const u of urls.values()) URL.revokeObjectURL(u);
    }
  }

  const scene = gltf.scene;
  scene.name ||= 'Model';
  return { scene, name: main.name.replace(/\.(glb|gltf)$/i, ''), stats: modelStats(scene) };
}

export function modelStats(scene) {
  let meshes = 0;
  let triangles = 0;
  let nodes = 0;
  scene.traverse((o) => {
    nodes++;
    if (o.isMesh) {
      meshes++;
      const g = o.geometry;
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });
  return { meshes, triangles: Math.round(triangles), nodes };
}

/**
 * Guess the source units from the model's overall size. A stage set is typically 5-60 m across,
 * so a model that is 20 000 units wide was almost certainly drawn in millimeters.
 */
export function guessUnits(scene) {
  const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(span) || span === 0) return 'm';
  const candidates = Object.entries(UNIT_SCALES).map(([unit, k]) => ({ unit, meters: span * k }));
  // Prefer the unit that puts the model's largest dimension closest to ~20 m (log scale).
  candidates.sort((a, b) => Math.abs(Math.log(a.meters / 20)) - Math.abs(Math.log(b.meters / 20)));
  return candidates[0].unit;
}
