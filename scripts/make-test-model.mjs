// Generates samples/test-set.glb: a stand-in for a real AutoCAD export.
// It deliberately has the quirks CAD-derived glTF files often have:
//   - millimeter units (glTF expects meters)
//   - Z-up (glTF expects Y-up)
//   - all geometry baked into world coordinates, every node at identity
//   - objects grouped under layer-style names (A-DECK, S-WAGON-SL, ...)
// Run: node scripts/make-test-model.mjs

import { writeFileSync, mkdirSync } from 'node:fs';

const DEG = Math.PI / 180;

// ---- Scene, authored in Y-up meters (the app's convention), converted on write ----
// Stage: deck top at y = 0, +X stage left, +Z downstage.
const layers = [
  {
    name: 'A-DECK',
    color: [0.17, 0.17, 0.19],
    objects: [
      box('Deck US', [0, -0.15, -1.775], [16, 0.3, 8.45]),
      box('Deck DS', [0, -0.15, 4.575], [16, 0.3, 0.85]),
      box('Deck SL', [4.525, -0.15, 3.3], [6.95, 0.3, 1.7]),
      box('Deck SR', [-4.525, -0.15, 3.3], [6.95, 0.3, 1.7]),
    ],
  },
  {
    name: 'A-PROS',
    color: [0.1, 0.1, 0.12],
    objects: [box('Pros leg SL', [7.6, 5, 5.2], [0.8, 10, 0.4]), box('Pros leg SR', [-7.6, 5, 5.2], [0.8, 10, 0.4])],
  },
  {
    name: 'A-WALLS',
    color: [0.24, 0.22, 0.2],
    objects: [
      box('Back wall', [0, 4, -6.2], [16, 8, 0.3]),
      // Angled masking flat SR, drawn at 20 degrees: tests tight box fitting.
      box('SR masking flat', [-6.2, 3, 1.2], [2.4, 6, 0.1], 20),
    ],
  },
  {
    name: 'S-REVOLVE',
    color: [0.23, 0.21, 0.19],
    objects: [
      cylinder('Revolve deck', [0, 0.1, -1.5], 2.95, 0.2, 48),
      box('Revolve wall', [0, 2.2, -0.2], [4, 4, 0.3], 0, [0.49, 0.44, 0.64]),
    ],
  },
  {
    name: 'S-WAGON-SL',
    color: [0.33, 0.33, 0.36],
    objects: [
      box('Wagon deck', [5.5, 0.15, 0.6], [3, 0.3, 2.2]),
      // L-shaped scenic wall on the wagon: a run plus a return. One box would swallow the inside corner.
      box('Wagon wall run', [5.5, 1.8, -0.35], [2.8, 3, 0.15], 0, [0.62, 0.45, 0.3]),
      box('Wagon wall return', [4.175, 1.8, 0.35], [0.15, 3, 1.25], 0, [0.62, 0.45, 0.3]),
    ],
  },
  {
    name: 'S-LIFT',
    color: [0.33, 0.33, 0.36],
    objects: [
      box('Lift platform', [0, -1.6, 3.3], [2, 0.2, 1.6]),
      box('Lift riser', [0, -1.0, 3.1], [1.5, 1.0, 1.2], 0, [0.69, 0.53, 0.31]),
    ],
  },
  {
    name: 'S-FLY-LS4',
    color: [0.25, 0.5, 0.48],
    objects: [box('Header', [0, 8.9, -1.5], [6, 1.2, 0.3]), box('LS4 pipe', [0, 9.5, -1.5], [9, 0.05, 0.05], 0, [0.47, 0.47, 0.47])],
  },
];

// ---- Geometry helpers (Y-up meters) ----
function box(name, center, size, yawDeg = 0, color = null) {
  const [cx, cy, cz] = center;
  const [w, h, d] = size.map((v) => v / 2);
  const c = Math.cos(yawDeg * DEG);
  const s = Math.sin(yawDeg * DEG);
  // Same yaw convention as the app: x' = c*x + s*z, z' = -s*x + c*z
  const pt = (x, y, z) => [cx + c * x + s * z, cy + y, cz - s * x + c * z];
  const faces = [
    // each face: 4 corners counter-clockwise seen from outside
    [pt(-w, -h, d), pt(w, -h, d), pt(w, h, d), pt(-w, h, d)],
    [pt(w, -h, -d), pt(-w, -h, -d), pt(-w, h, -d), pt(w, h, -d)],
    [pt(w, -h, d), pt(w, -h, -d), pt(w, h, -d), pt(w, h, d)],
    [pt(-w, -h, -d), pt(-w, -h, d), pt(-w, h, d), pt(-w, h, -d)],
    [pt(-w, h, d), pt(w, h, d), pt(w, h, -d), pt(-w, h, -d)],
    [pt(-w, -h, -d), pt(w, -h, -d), pt(w, -h, d), pt(-w, -h, d)],
  ];
  const tris = [];
  for (const [a, b, c2, d2] of faces) tris.push([a, b, c2], [a, c2, d2]);
  return { name, tris, color };
}

function cylinder(name, center, r, h, segs, color = null) {
  const [cx, cy, cz] = center;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  const ring = (y) => Array.from({ length: segs }, (_, i) => [cx + r * Math.cos((i / segs) * 2 * Math.PI), y, cz - r * Math.sin((i / segs) * 2 * Math.PI)]);
  const bot = ring(y0);
  const top = ring(y1);
  const tris = [];
  for (let i = 0; i < segs; i++) {
    const j = (i + 1) % segs;
    tris.push([bot[i], bot[j], top[j]], [bot[i], top[j], top[i]]);
    tris.push([[cx, y1, cz], top[i], top[j]]);
    tris.push([[cx, y0, cz], bot[j], bot[i]]);
  }
  return { name, tris, color };
}

// ---- Convert to Z-up millimeters: (x, y, z)_Yup -> (x, -z, y)_Zup, * 1000 ----
const toCad = ([x, y, z]) => [x * 1000, -z * 1000, y * 1000];

// ---- Minimal GLB writer ----
const gltf = {
  asset: { version: '2.0', generator: 'previz test-model script (mimics a CAD export)' },
  scene: 0,
  scenes: [{ name: 'Model', nodes: [0] }],
  nodes: [{ name: 'Model', children: [] }],
  meshes: [],
  materials: [],
  accessors: [],
  bufferViews: [],
  buffers: [{ byteLength: 0 }],
};
const chunks = [];
let byteOffset = 0;

function addView(typed, target) {
  const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
  const pad = (4 - (bytes.byteLength % 4)) % 4;
  gltf.bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.byteLength, target });
  chunks.push(bytes, new Uint8Array(pad));
  byteOffset += bytes.byteLength + pad;
  return gltf.bufferViews.length - 1;
}

function material(name, color) {
  gltf.materials.push({ name, pbrMetallicRoughness: { baseColorFactor: [...color, 1], metallicFactor: 0.05, roughnessFactor: 0.8 } });
  return gltf.materials.length - 1;
}

for (const layer of layers) {
  const layerMat = material(layer.name, layer.color);
  const layerNode = { name: layer.name, children: [] };
  gltf.nodes.push(layerNode);
  gltf.nodes[0].children.push(gltf.nodes.length - 1);

  for (const obj of layer.objects) {
    const pos = [];
    const nrm = [];
    for (const tri of obj.tris) {
      const [a, b, c] = tri.map(toCad);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const len = Math.hypot(...n) || 1;
      for (const p of [a, b, c]) {
        pos.push(...p);
        nrm.push(n[0] / len, n[1] / len, n[2] / len);
      }
    }
    const P = new Float32Array(pos);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < P.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], P[i + k]);
        max[k] = Math.max(max[k], P[i + k]);
      }
    }
    gltf.accessors.push({ bufferView: addView(P, 34962), componentType: 5126, count: P.length / 3, type: 'VEC3', min, max });
    const posAcc = gltf.accessors.length - 1;
    gltf.accessors.push({ bufferView: addView(new Float32Array(nrm), 34962), componentType: 5126, count: P.length / 3, type: 'VEC3' });
    const nrmAcc = gltf.accessors.length - 1;
    const mat = obj.color ? material(obj.name, obj.color) : layerMat;
    gltf.meshes.push({ name: obj.name, primitives: [{ attributes: { POSITION: posAcc, NORMAL: nrmAcc }, material: mat }] });
    gltf.nodes.push({ name: obj.name, mesh: gltf.meshes.length - 1 });
    layerNode.children.push(gltf.nodes.length - 1);
  }
}

gltf.buffers[0].byteLength = byteOffset;
const bin = Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)));
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 0x20)]);
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // 'glTF'
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + json.length + 8 + bin.length, 8);
const jsonHead = Buffer.alloc(8);
jsonHead.writeUInt32LE(json.length, 0);
jsonHead.writeUInt32LE(0x4e4f534a, 4); // 'JSON'
const binHead = Buffer.alloc(8);
binHead.writeUInt32LE(bin.length, 0);
binHead.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

mkdirSync(new URL('../samples/', import.meta.url), { recursive: true });
const out = new URL('../samples/test-set.glb', import.meta.url);
writeFileSync(out, Buffer.concat([header, jsonHead, json, binHead, bin]));
console.log(`wrote ${out.pathname} (${gltf.nodes.length} nodes, ${gltf.meshes.length} meshes)`);
