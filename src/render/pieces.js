// Meshes for show pieces: built from the show data, positioned from core poses, highlighted on conflict.

import * as THREE from 'three';

const WARN = new THREE.Color('#ff2b2b');
const BLACK = new THREE.Color('#000000');

export function createPieces(scene, show) {
  const group = new THREE.Group();
  scene.add(group);
  const items = new Map();

  for (const p of show.pieces) {
    const [w, h, d] = p.size;
    const geom =
      p.shape === 'cylinder'
        ? new THREE.CylinderGeometry(w / 2, w / 2, h, 64)
        : new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.75, metalness: 0.05 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = p.check || p.shape === 'cylinder';
    mesh.receiveShadow = true;

    // Thin outlines read as "previz" and make moving pieces easy to track on a small phone screen.
    if (p.shape !== 'cylinder' && Math.min(w, h, d) > 0.02) {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geom),
        new THREE.LineBasicMaterial({ color: p.check ? '#e6e6ea' : '#3a3c44', transparent: true, opacity: p.check ? 0.55 : 0.6 }),
      );
      mesh.add(edges);
      items.set(p.id, { mesh, mat, edges, base: new THREE.Color(p.color) });
    } else {
      items.set(p.id, { mesh, mat, edges: null, base: new THREE.Color(p.color) });
    }
    group.add(mesh);
  }

  function update(poses) {
    for (const [id, pose] of poses) {
      const it = items.get(id);
      if (!it) continue;
      it.mesh.position.set(pose.x, pose.y, pose.z);
      it.mesh.rotation.y = pose.yaw;
    }
  }

  /** severityById: Map<pieceId, 'warning' | 'contact'>; time drives the contact flash. */
  function highlight(severityById, time) {
    for (const [id, it] of items) {
      const sev = severityById.get(id);
      if (!sev) {
        it.mat.color.copy(it.base);
        it.mat.emissive.copy(BLACK);
        continue;
      }
      const pulse = sev === 'contact' ? 0.5 + 0.5 * Math.sin(time * 18) : 0.75 + 0.25 * Math.sin(time * 6);
      it.mat.color.copy(it.base).lerp(WARN, 0.7);
      it.mat.emissive.copy(WARN).multiplyScalar(0.55 * pulse);
    }
  }

  function dispose() {
    scene.remove(group);
    for (const it of items.values()) {
      it.mesh.geometry.dispose();
      it.mat.dispose();
      if (it.edges) {
        it.edges.geometry.dispose();
        it.edges.material.dispose();
      }
    }
  }

  return { update, highlight, dispose };
}
