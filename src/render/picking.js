// Click-to-select in the 3D view (Rig mode), plus the selection outline.

import * as THREE from 'three';

const CLICK_SLOP = 5; // px: a press that moves further than this is an orbit drag, not a click

export function createPicking(view, { enabled, targets, onPick }) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const el = view.renderer.domElement;
  let down = null;

  el.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
  });
  el.addEventListener('pointerup', (e) => {
    if (!down || !enabled()) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved > CLICK_SLOP) return;
    const rect = el.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, view.camera);
    const hit = raycaster.intersectObjects(targets(), true).find((h) => h.object.isMesh && h.object.visible);
    onPick(hit?.object ?? null, e);
  });

  const helper = new THREE.BoxHelper(undefined, '#f2f6fa');
  helper.material.depthTest = false;
  helper.material.transparent = true;
  helper.renderOrder = 20;
  helper.visible = false;
  view.scene.add(helper);
  let selected = null;

  return {
    /** Outline obj (or nothing). */
    outline(obj) {
      selected = obj;
      helper.visible = !!obj;
      if (obj) helper.setFromObject(obj);
    },
    /** Keep the outline on a moving selection. */
    update() {
      if (selected && helper.visible) helper.setFromObject(selected);
    },
  };
}
