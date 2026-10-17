// Read 3D model files from a file drop or picker into a Three.js scene.
// Accepts .glb, .gltf (with its .bin and textures), .fbx and .obj.
// Vectorworks and many CAD tools export FBX or OBJ directly, so no Blender round trip is needed.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export const UNIT_SCALES = { m: 1, cm: 0.01, mm: 0.001, in: 0.0254, ft: 0.3048 };

const MODEL_EXT = /\.(glb|gltf|fbx|obj)$/i;
// 1x1 transparent PNG: stands in for textures the export references but that weren't dropped
// (FBX files often point at absolute paths on the designer's machine).
const BLANK_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

export function isModelFile(file) {
  return MODEL_EXT.test(file.name);
}

/**
 * @param files File[] from a drop or <input type=file multiple>
 * @returns { scene, name, stats: { meshes, triangles, nodes }, notes: string[] }
 */
export async function readModelFiles(files) {
  const list = [...files];
  const main =
    list.find((f) => /\.glb$/i.test(f.name)) ??
    list.find((f) => /\.gltf$/i.test(f.name)) ??
    list.find((f) => /\.fbx$/i.test(f.name)) ??
    list.find((f) => /\.obj$/i.test(f.name));
  if (!main) throw new Error('Choose a .glb, .gltf, .fbx or .obj file');
  const ext = main.name.split('.').pop().toLowerCase();

  // Resolve relative references (buffers, textures) to the other dropped files.
  const urls = new Map(list.map((f) => [f.name, URL.createObjectURL(f)]));
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (/^(blob|data):/.test(url)) return url;
    const name = decodeURIComponent(url.split(/[\\/]/).pop());
    if (urls.has(name)) return urls.get(name);
    if (ext === 'gltf' && !/\.(png|jpe?g|webp|ktx2)$/i.test(name)) {
      throw new Error(`Missing file "${name}": drop it together with the .gltf`);
    }
    return BLANK_PNG; // a missing texture shouldn't stop the geometry from loading
  });

  let scene;
  try {
    if (ext === 'glb') {
      scene = (await new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder).parseAsync(await main.arrayBuffer(), '')).scene;
    } else if (ext === 'gltf') {
      scene = (await new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder).loadAsync(urls.get(main.name))).scene;
    } else if (ext === 'fbx') {
      scene = new FBXLoader(manager).parse(await main.arrayBuffer(), '');
    } else {
      scene = new OBJLoader(manager).parse(await main.text());
    }
  } finally {
    setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 5000); // textures may still be loading
  }

  const notes = cleanImported(scene, ext);
  scene.name = main.name.replace(MODEL_EXT, '');
  return { scene, name: scene.name, stats: modelStats(scene), notes };
}

/**
 * Make an imported scene suitable for previz:
 * - drop lights and cameras that came with the export (they would relight the stage)
 * - convert FBX/OBJ materials (Phong/Lambert) to standard materials, so lighting, highlighting
 *   and saving to .previz behave the same as for glTF
 * - render both sides of every face: CAD exports often have flipped or single faces, and soft
 *   goods are usually zero-thickness planes
 */
export function cleanImported(root, ext = 'glb') {
  const notes = [];
  const drop = [];
  root.traverse((o) => {
    if (o.isLight || o.isCamera) drop.push(o);
  });
  for (const o of drop) o.removeFromParent();
  if (drop.length) notes.push(`Removed ${drop.length} light${drop.length === 1 ? '' : 's'}/camera${drop.length === 1 ? '' : 's'} from the export.`);

  const converted = new Map();
  const toStandard = (m) => {
    if (!m) return m;
    if (converted.has(m)) return converted.get(m);
    let out = m;
    if (ext !== 'glb' && ext !== 'gltf' && !m.isMeshStandardMaterial) {
      out = new THREE.MeshStandardMaterial({
        name: m.name,
        color: m.color?.clone() ?? new THREE.Color('#9a9aa2'),
        map: m.map ?? null,
        transparent: m.transparent,
        opacity: m.opacity ?? 1,
        roughness: 0.8,
        metalness: 0.05,
        vertexColors: m.vertexColors,
      });
    }
    out.side = THREE.DoubleSide;
    converted.set(m, out);
    return out;
  };
  root.traverse((o) => {
    if (o.isMesh) o.material = Array.isArray(o.material) ? o.material.map(toStandard) : toStandard(o.material);
  });
  return notes;
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
