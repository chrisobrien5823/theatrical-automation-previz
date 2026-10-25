// Meshes for show pieces: built from the show data, positioned from core poses, highlighted on conflict.
//
// Three kinds of piece:
//   - box pieces (the hand-written demo): a box or cylinder mesh of `size`
//   - compound box pieces with no model node: one mesh per collision box
//   - model pieces: a node lifted out of the imported model and driven by the rig
// Every piece gets a holder group posed from core poses, so drawing and clearance agree.

import * as THREE from 'three';
import { SCENE } from './palette.js';

const WARN = new THREE.Color('#ff2b2b');
const BOX_LINE = SCENE.boxLine;

/**
 * @param modelView  ModelView or null
 * @param modelPoses piece poses at the axes' model positions (where the drawing put each piece)
 */
export function createPieces(scene, show, modelView = null, modelPoses = null) {
  const group = new THREE.Group();
  group.name = 'pieces';
  scene.add(group);
  if (modelView) scene.add(modelView.root);

  const items = new Map();
  const owned = []; // geometries / materials this module created and must dispose

  // Optional stage floor at height 0, for model exports that don't include a deck.
  if (modelView && show.model?.floor) {
    const b = modelView.bounds();
    const w = b.max.x - b.min.x + 4;
    const d = b.max.z - b.min.z + 4;
    const geom = new THREE.PlaneGeometry(w, d);
    const mat = new THREE.MeshStandardMaterial({ color: SCENE.deck, roughness: 0.95 });
    owned.push(geom, mat);
    const floor = new THREE.Mesh(geom, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((b.min.x + b.max.x) / 2, -0.002, (b.min.z + b.max.z) / 2);
    floor.receiveShadow = true;
    floor.name = 'stage-floor';
    group.add(floor);
  }

  for (const p of show.pieces) {
    const holder = new THREE.Group();
    holder.name = `piece:${p.id}`;
    holder.userData.pieceId = p.id;
    const item = { holder, mats: [], boxLines: null };

    if (p.node && modelView) {
      attachModelNode(p, item);
    } else if (p.size) {
      addBoxMesh(p, item, p.size, [0, 0, 0], 0, p.shape);
    } else {
      for (const b of p.boxes) addBoxMesh(p, item, b.size, b.offset, b.yaw, 'box');
    }

    item.boxLines = collisionBoxLines(p);
    item.boxLines.visible = false;
    holder.add(item.boxLines);
    group.add(holder);
    items.set(p.id, item);
  }

  function addBoxMesh(p, item, size, offset, yawDeg, shape) {
    const [w, h, d] = size;
    const geom = shape === 'cylinder' ? new THREE.CylinderGeometry(w / 2, w / 2, h, 64) : new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.75, metalness: 0.05 });
    owned.push(geom, mat);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(...offset);
    mesh.rotation.y = THREE.MathUtils.degToRad(yawDeg);
    mesh.castShadow = p.check || shape === 'cylinder';
    mesh.receiveShadow = true;
    // Thin outlines read as "previz" and make moving pieces easy to track on a small phone screen.
    if (shape !== 'cylinder' && Math.min(w, h, d) > 0.02) {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geom),
        new THREE.LineBasicMaterial({ color: p.check ? SCENE.edgeChecked : SCENE.edgeStatic, transparent: true, opacity: p.check ? 0.55 : 0.6 }),
      );
      owned.push(edges.geometry, edges.material);
      mesh.add(edges);
    }
    item.holder.add(mesh);
    item.mats.push(trackMaterial(mat));
  }

  function attachModelNode(p, item) {
    const obj = modelView.node(p.node);
    if (!obj) return;
    obj.updateWorldMatrix(true, false);
    const nodeWorld = obj.matrixWorld.clone();
    // Keep the node exactly where the drawing put it when the axes sit at their model positions:
    // inner = inverse(piece frame at model position) * node world matrix.
    const p0 = modelPoses.get(p.id);
    const frame = new THREE.Matrix4().compose(
      new THREE.Vector3(p0.x, p0.y, p0.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p0.yaw),
      new THREE.Vector3(1, 1, 1),
    );
    obj.removeFromParent();
    obj.matrixAutoUpdate = false;
    obj.matrix.copy(frame.invert().multiply(nodeWorld));
    item.holder.add(obj);
    // Clone materials so a red highlight on this piece doesn't bleed into static parts that shared them.
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const clone = (m) => {
        const c = m.clone();
        owned.push(c);
        item.mats.push(trackMaterial(c));
        return c;
      };
      o.material = Array.isArray(o.material) ? o.material.map(clone) : clone(o.material);
    });
  }

  function collisionBoxLines(p) {
    const g = new THREE.Group();
    if (!p.check) return g;
    for (const b of p.boxes) {
      const geom = new THREE.EdgesGeometry(new THREE.BoxGeometry(...b.size));
      const mat = new THREE.LineBasicMaterial({ color: BOX_LINE, depthTest: false, transparent: true, opacity: 0.9 });
      owned.push(geom, mat);
      const lines = new THREE.LineSegments(geom, mat);
      lines.position.set(...b.offset);
      lines.rotation.y = THREE.MathUtils.degToRad(b.yaw);
      lines.renderOrder = 10;
      g.add(lines);
    }
    return g;
  }

  function trackMaterial(mat) {
    return { mat, color: mat.color?.clone(), emissive: mat.emissive?.clone() };
  }

  function update(poses) {
    for (const [id, pose] of poses) {
      const it = items.get(id);
      if (!it) continue;
      it.holder.position.set(pose.x, pose.y, pose.z);
      it.holder.rotation.y = pose.yaw;
    }
  }

  /** severityById: Map<pieceId, 'warning' | 'contact'>; time drives the contact flash. */
  function highlight(severityById, time) {
    for (const [id, it] of items) {
      const sev = severityById.get(id);
      const pulse = sev === 'contact' ? 0.5 + 0.5 * Math.sin(time * 18) : 0.75 + 0.25 * Math.sin(time * 6);
      for (const m of it.mats) {
        if (m.color) {
          m.mat.color.copy(m.color);
          if (sev) m.mat.color.lerp(WARN, 0.7);
        }
        if (m.emissive) {
          if (sev) m.mat.emissive.copy(WARN).multiplyScalar(0.55 * pulse);
          else m.mat.emissive.copy(m.emissive);
        }
      }
    }
  }

  function setBoxesVisible(visible) {
    for (const it of items.values()) it.boxLines.visible = visible;
  }

  /** The piece id an intersected object belongs to, or null. */
  function pieceIdOf(obj) {
    for (let o = obj; o; o = o.parent) if (o.userData.pieceId) return o.userData.pieceId;
    return null;
  }

  function holder(id) {
    return items.get(id)?.holder ?? null;
  }

  function dispose() {
    scene.remove(group);
    if (modelView) scene.remove(modelView.root);
    for (const o of owned) o.dispose();
  }

  return { update, highlight, setBoxesVisible, pieceIdOf, holder, group, dispose };
}
