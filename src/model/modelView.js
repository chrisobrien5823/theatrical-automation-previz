// A displayed copy of an imported model, placed in stage coordinates.
//
// The imported glTF scene is kept untouched as the "source" (that is what gets saved back
// out). Each time the show is rebuilt we clone it for display; clones share geometry and
// materials, so this is cheap. Model pieces are then lifted out of the clone and driven by
// the rig, and whatever is left over is static scenery.

import * as THREE from 'three';
import { UNIT_SCALES } from './import.js';

/** Child-index path from root to obj, e.g. "2/0". The root itself is "". */
export function nodePath(root, obj) {
  const parts = [];
  for (let o = obj; o && o !== root; o = o.parent) {
    if (!o.parent) return null; // not under root
    parts.push(o.parent.children.indexOf(o));
  }
  return parts.reverse().join('/');
}

export function nodeAt(root, path) {
  if (path === '' || path == null) return root;
  let o = root;
  for (const i of String(path).split('/')) {
    o = o?.children[Number(i)];
    if (!o) return null;
  }
  return o;
}

/** Stage transform for the model: offset * up-axis fix * unit scale. */
export function modelMatrix(model) {
  const m = new THREE.Matrix4().makeScale(model.scale, model.scale, model.scale);
  if (model.upAxis === 'z') m.premultiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
  m.premultiply(new THREE.Matrix4().makeTranslation(...model.offset));
  return m;
}

/** Build a show `model` block from import-dialog choices. */
export function modelSettings({ name, unit, upAxis, offset = [0, 0, 0] }) {
  return { name, scale: UNIT_SCALES[unit] ?? 1, upAxis, offset, unit };
}

export class ModelView {
  constructor(source, model) {
    this.source = source;
    this.root = new THREE.Group();
    this.root.name = 'model-root';
    this.root.matrixAutoUpdate = false;
    this.root.matrix.copy(modelMatrix(model));
    this.display = source.clone(true);
    this.root.add(this.display);
    this.root.updateMatrixWorld(true);
    // Index nodes by path now: pieces are later lifted out of the hierarchy, which would shift
    // their siblings' child indices, so paths must not be recomputed from the live tree.
    this.objByPath = new Map();
    this.pathByObj = new Map();
    this.display.traverse((o) => {
      const path = nodePath(this.display, o);
      this.objByPath.set(path, o);
      this.pathByObj.set(o, path);
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  node(path) {
    return this.objByPath.get(String(path)) ?? null;
  }

  /** Path of obj (or of its nearest indexed ancestor). */
  pathOf(obj) {
    for (let o = obj; o; o = o.parent) if (this.pathByObj.has(o)) return this.pathByObj.get(o);
    return null;
  }

  /** World-space vertices of every mesh under obj, as a flat xyz array (subsampled if huge). */
  worldPoints(obj, maxPoints = 200000) {
    obj.updateWorldMatrix(true, true);
    const meshes = [];
    let total = 0;
    obj.traverse((o) => {
      if (o.isMesh && o.geometry?.attributes.position) {
        meshes.push(o);
        total += o.geometry.attributes.position.count;
      }
    });
    const stride = Math.max(1, Math.ceil(total / maxPoints));
    const out = [];
    const v = new THREE.Vector3();
    for (const m of meshes) {
      const pos = m.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += stride) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        out.push(v.x, v.y, v.z);
      }
    }
    return out;
  }

  /** Meshes under obj, each a separate "part" for box-per-part fitting. */
  parts(obj) {
    const out = [];
    obj.traverse((o) => {
      if (o.isMesh) out.push(o);
    });
    return out;
  }

  bounds() {
    return new THREE.Box3().setFromObject(this.root);
  }
}
