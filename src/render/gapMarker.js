// The gap, dimensioned: a drafting-style dimension line between the two closest points of the worst
// clashing pair, with end ticks and the measured distance. The points come from core clearance
// (pieceClosestPoints), so the line is the measurement. It is drawn as a screen overlay on top of the
// 3D view, so it stays crisp at any camera distance and is never hidden behind scenery.

import * as THREE from 'three';

const TICK = 7; // px, half-length of the end ticks
const MIN_LEN = 24; // px, shortest dimension line drawn: a visual floor so a tiny gap is still a visible line (the label keeps the true gap)
const LEADER = 44; // px, how far above the midpoint the label floats
const SVG_NS = 'http://www.w3.org/2000/svg';

export function createGapMarker(view, stageEl) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'gap-dim');
  svg.setAttribute('aria-hidden', 'true'); // the alert and log carry the same numbers for screen readers
  svg.innerHTML = `
    <line class="dim-ext" />
    <line class="dim-line" />
    <line class="dim-tick a" />
    <line class="dim-tick b" />
    <circle class="dim-contact" r="9" />`;
  svg.style.display = 'none';
  stageEl.append(svg);
  const [ext, line, tickA, tickB, contact] = svg.children;

  const label = document.createElement('div');
  label.className = 'gap-label tnum';
  label.hidden = true;
  label.setAttribute('aria-hidden', 'true');
  stageEl.append(label);

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  const pc = new THREE.Vector3();
  let visible = false;
  let touching = false;
  let text = '';

  /** w: { a: [x,y,z], b: [x,y,z], gap } or null to hide. */
  function set(w, labelText) {
    visible = !!w;
    if (!w) {
      svg.style.display = 'none';
      label.hidden = true;
      return;
    }
    a.fromArray(w.a);
    b.fromArray(w.b);
    touching = w.gap <= 1e-6;
    if (labelText !== text) label.textContent = text = labelText;
  }

  const toScreen = (v, out, r) => {
    out.copy(v).project(view.camera);
    return { x: (out.x * 0.5 + 0.5) * r.clientWidth, y: (-out.y * 0.5 + 0.5) * r.clientHeight, behind: out.z > 1 };
  };
  const put = (el, x1, y1, x2, y2) => {
    el.setAttribute('x1', x1.toFixed(1));
    el.setAttribute('y1', y1.toFixed(1));
    el.setAttribute('x2', x2.toFixed(1));
    el.setAttribute('y2', y2.toFixed(1));
  };

  /** Re-project after the camera moves (call once per frame, after rendering). */
  function update() {
    if (!visible) return;
    const r = view.renderer.domElement;
    const sa = toScreen(a, pa, r);
    const sb = toScreen(b, pb, r);
    if (sa.behind || sb.behind) {
      svg.style.display = 'none';
      label.hidden = true;
      return;
    }
    svg.style.display = '';
    label.hidden = false;
    const dx = sb.x - sa.x;
    const dy = sb.y - sa.y;
    const len = Math.hypot(dx, dy);
    const mx = (sa.x + sb.x) / 2;
    const my = (sa.y + sb.y) / 2;
    // The ring means real contact; a gap that projects to a pixel or two still gets its ticks.
    const isContact = touching;
    contact.style.display = isContact ? '' : 'none';
    for (const el of [line, tickA, tickB]) el.style.display = isContact ? 'none' : '';
    // Label sits off to one side of the line, joined by a short leader.
    const lx = mx;
    const ly = my - LEADER;
    put(ext, mx, my, lx, ly);
    if (isContact) {
      contact.setAttribute('cx', mx.toFixed(1));
      contact.setAttribute('cy', my.toFixed(1));
    } else {
      let [ux, uy] = len > 0.5 ? [dx / len, dy / len] : [0, 1];
      let [x1, y1, x2, y2] = [sa.x, sa.y, sb.x, sb.y];
      if (len < MIN_LEN) {
        // Floor on the drawn length only. A gap that projects to a few pixels is stretched to MIN_LEN
        // about its midpoint, along the screen direction of the real gap axis (the label still shows the
        // measured gap, and contact still collapses to the circle).
        const g = a.distanceTo(b);
        if (g > 1e-6) {
          pc.copy(a).addScaledVector(pb.copy(b).sub(a).normalize(), 0.1);
          const sc = toScreen(pc, pc, r);
          const cl = Math.hypot(sc.x - sa.x, sc.y - sa.y);
          if (!sc.behind && cl > 0.5) [ux, uy] = [(sc.x - sa.x) / cl, (sc.y - sa.y) / cl];
          if (dx * ux + dy * uy < 0) [ux, uy] = [-ux, -uy];
        }
        const h = MIN_LEN / 2;
        [x1, y1, x2, y2] = [mx - ux * h, my - uy * h, mx + ux * h, my + uy * h];
      }
      const nx = -uy * TICK;
      const ny = ux * TICK;
      put(line, x1, y1, x2, y2);
      put(tickA, x1 - nx, y1 - ny, x1 + nx, y1 + ny);
      put(tickB, x2 - nx, y2 - ny, x2 + nx, y2 + ny);
    }
    label.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px) translate(-50%, -100%)`;
  }

  return { set, update };
}
