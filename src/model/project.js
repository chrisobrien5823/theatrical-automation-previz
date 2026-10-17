// .previz project files: the show JSON plus the imported model, in one file.
// The model is re-exported as GLB (so a multi-file .gltf becomes one blob) and embedded as base64.

import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const FORMAT = 'previz-project';
const VERSION = 1;

// Pieces reference model nodes by child-index path from the root, so a save/load round trip must
// reproduce the same hierarchy. Exporting the root object itself would make GLTFExporter wrap it
// in an extra "AuxScene" level; exporting its children makes the reloaded root match the original.
export async function exportGlb(root) {
  return new GLTFExporter().parseAsync(root.children, { binary: true });
}

export async function parseGlb(buffer, name = 'Model') {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, '');
  gltf.scene.name = name;
  return gltf.scene;
}

/** Serialize { raw, source } to a .previz JSON string. */
export async function saveProject(raw, source) {
  const doc = { format: FORMAT, version: VERSION, show: raw, model: null };
  if (source) doc.model = { glb: toBase64(await exportGlb(source)) };
  return JSON.stringify(doc);
}

/** Parse a .previz (or plain show .json) into { raw, source }. */
export async function loadProject(text) {
  const doc = JSON.parse(text);
  if (doc.format !== FORMAT) return { raw: doc, source: null }; // a plain show file
  if (doc.version > VERSION) throw new Error(`Project was saved by a newer version (v${doc.version})`);
  const source = doc.model?.glb ? await parseGlb(fromBase64(doc.model.glb), doc.show?.model?.name) : null;
  return { raw: doc.show, source };
}

export function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}

// ---------- Autosave (IndexedDB, per browser; a convenience, never the only copy) ----------

const DB = 'previz';
const STORE = 'autosave';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

/** Store the current project. `glb` is an ArrayBuffer (cached by the caller; export is slow). */
export async function autosave(raw, glb) {
  try {
    await tx('readwrite', (s) => s.put({ raw, glb, savedAt: Date.now() }, 'current'));
  } catch {
    // Private windows or blocked storage: autosave is best-effort.
  }
}

export async function loadAutosave() {
  try {
    const rec = await tx('readonly', (s) => s.get('current'));
    if (!rec) return null;
    return { raw: rec.raw, source: rec.glb ? await parseGlb(rec.glb, rec.raw?.model?.name) : null, savedAt: rec.savedAt };
  } catch {
    return null;
  }
}

export async function clearAutosave() {
  try {
    await tx('readwrite', (s) => s.delete('current'));
  } catch {
    // ignore
  }
}
