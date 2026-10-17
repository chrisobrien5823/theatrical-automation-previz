// Clearance checking between pieces.
//
// Each piece is a yaw-rotated box: a rectangle in plan view (XZ) extruded over a Y interval.
// For two such prisms the exact minimum distance separates into orthogonal parts:
//     gap = sqrt(dPlan^2 + dY^2)
// where dY is the gap between the Y intervals and dPlan is the 2D distance between the rotated
// rectangles (0 when they overlap). So we get a real distance, not just hit / no-hit.

import { piecePoses, mountChain, compose } from './rig.js';

const DEG = Math.PI / 180;

/** World-space prism for a box of the given size centered at a pose. */
export function prism(size, pose) {
  const [w, h, d] = size;
  return {
    cx: pose.x,
    cz: pose.z,
    hx: w / 2,
    hz: d / 2,
    yaw: pose.yaw,
    y0: pose.y - h / 2,
    y1: pose.y + h / 2,
  };
}

/**
 * World-space prisms for every collision box of a piece. A piece has one or more boxes
 * (`boxes: [{ offset, size, yaw }]` in the piece's own frame); an L-shaped wall is two boxes.
 */
export function piecePrisms(piece, pose) {
  return piece.boxes.map((b) =>
    prism(b.size, compose(pose, { x: b.offset[0], y: b.offset[1], z: b.offset[2], yaw: (b.yaw ?? 0) * DEG })),
  );
}

/** Minimum gap between two compound pieces (min over their box pairs). */
export function piecesGap(prismsA, prismsB) {
  let best = Infinity;
  for (const a of prismsA) {
    for (const b of prismsB) {
      const g = prismGap(a, b);
      if (g < best) best = g;
      if (best === 0) return 0;
    }
  }
  return best;
}

/** Plan-view corners of a prism, counter-clockwise. Uses the same yaw convention as rig.js. */
export function corners(p) {
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  const local = [
    [-p.hx, -p.hz],
    [p.hx, -p.hz],
    [p.hx, p.hz],
    [-p.hx, p.hz],
  ];
  return local.map(([x, z]) => [p.cx + c * x + s * z, p.cz - s * x + c * z]);
}

function axesOf(poly) {
  // Edge normals of a rectangle: only two unique directions.
  const out = [];
  for (let i = 0; i < 2; i++) {
    const [ax, az] = poly[i];
    const [bx, bz] = poly[i + 1];
    out.push([-(bz - az), bx - ax]);
  }
  return out;
}

function project(poly, [nx, nz]) {
  let min = Infinity;
  let max = -Infinity;
  for (const [x, z] of poly) {
    const v = x * nx + z * nz;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/** Separating Axis Test for two convex quads in plan. True if they overlap (touching counts). */
export function rectsOverlap(a, b) {
  for (const n of [...axesOf(a), ...axesOf(b)]) {
    const [a0, a1] = project(a, n);
    const [b0, b1] = project(b, n);
    if (a1 < b0 || b1 < a0) return false;
  }
  return true;
}

function pointSegDist([px, pz], [ax, az], [bx, bz]) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx - px;
  const qz = az + t * dz - pz;
  return Math.sqrt(qx * qx + qz * qz);
}

/** Minimum 2D distance between two convex quads (0 if overlapping). */
export function rectDistance(a, b) {
  if (rectsOverlap(a, b)) return 0;
  // For disjoint convex polygons the minimum is always between a vertex of one and an edge of the other.
  let best = Infinity;
  for (const [P, Q] of [
    [a, b],
    [b, a],
  ]) {
    for (const pt of P) {
      for (let i = 0; i < Q.length; i++) {
        const d = pointSegDist(pt, Q[i], Q[(i + 1) % Q.length]);
        if (d < best) best = d;
      }
    }
  }
  return best;
}

/** Exact minimum distance between two yaw-rotated prisms. */
export function prismGap(a, b) {
  const dY = Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
  const dPlan = rectDistance(corners(a), corners(b));
  return Math.hypot(dPlan, dY);
}

/**
 * Which piece pairs to check. Skips: pieces with check:false, pairs on the exact same mount
 * (they never move relative to each other), static-vs-static, and the show's ignorePairs.
 */
export function buildPairs(show) {
  const ignore = new Set(show.ignorePairs.map(([a, b]) => pairKey(a, b)));
  const checked = show.pieces.filter((p) => p.check);
  const chains = new Map(checked.map((p) => [p.id, mountChain(show, p).join('>')]));
  const pairs = [];
  for (let i = 0; i < checked.length; i++) {
    for (let j = i + 1; j < checked.length; j++) {
      const a = checked[i];
      const b = checked[j];
      if (chains.get(a.id) === chains.get(b.id)) continue; // rigidly attached (or both static)
      if (ignore.has(pairKey(a.id, b.id))) continue;
      pairs.push([a, b]);
    }
  }
  return pairs;
}

export function pairKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Check every pair at the given axis positions.
 * Returns [{ a, b, key, gap, severity: 'contact' | 'warning' }] for pairs inside the clearance.
 */
export function checkClearance(show, positions, pairs = buildPairs(show)) {
  const poses = piecePoses(show, positions);
  const prisms = new Map();
  const prismsOf = (p) => {
    if (!prisms.has(p.id)) prisms.set(p.id, piecePrisms(p, poses.get(p.id)));
    return prisms.get(p.id);
  };
  const hits = [];
  for (const [a, b] of pairs) {
    const gap = piecesGap(prismsOf(a), prismsOf(b));
    if (gap < show.clearance) {
      hits.push({ a, b, key: pairKey(a.id, b.id), gap, severity: gap <= 1e-6 ? 'contact' : 'warning' });
    }
  }
  return hits;
}

/**
 * Turns per-step hit lists into conflict windows: one record per pair per continuous violation,
 * with when it started, when it ended, and the minimum gap (and when that happened).
 */
export class ConflictTracker {
  constructor() {
    this.open = new Map();
    this.closed = [];
  }

  /** Feed one sample. Returns { opened: [...], closed: [...] } for this step. */
  update(hits, cueId, cueTime) {
    const opened = [];
    const closedNow = [];
    const seen = new Set();
    for (const h of hits) {
      seen.add(h.key);
      let w = this.open.get(h.key);
      if (!w) {
        w = {
          key: h.key,
          a: h.a.id,
          b: h.b.id,
          aName: h.a.name,
          bName: h.b.name,
          cueId,
          tStart: cueTime,
          tEnd: cueTime,
          minGap: h.gap,
          tMin: cueTime,
          severity: h.severity,
        };
        this.open.set(h.key, w);
        opened.push(w);
      }
      w.tEnd = cueTime;
      if (h.gap < w.minGap) {
        w.minGap = h.gap;
        w.tMin = cueTime;
      }
      if (h.severity === 'contact') w.severity = 'contact';
    }
    for (const [key, w] of this.open) {
      if (!seen.has(key)) {
        this.open.delete(key);
        this.closed.push(w);
        closedNow.push(w);
      }
    }
    return { opened, closed: closedNow };
  }

  /** Close every open window (end of a sweep). */
  flush() {
    const out = [...this.open.values()];
    for (const w of out) this.closed.push(w);
    this.open.clear();
    return out;
  }
}
