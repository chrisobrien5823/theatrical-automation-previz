// Fit collision boxes to imported geometry. Pure math: the render layer extracts vertices
// from meshes and passes them in, so this stays testable without Three.js.

import { relative } from './rig.js';

const MIN_SIZE = 0.005; // flats drawn with zero thickness still get a sliver of a box (m)
const DEG = Math.PI / 180;

/**
 * Tightest yaw-rotated box around a point cloud: minimum-area rectangle in plan (convex hull +
 * rotating calipers) extruded over the Y range.
 * @param pts flat array [x0, y0, z0, x1, y1, z1, ...] in world meters (Y up)
 * @returns { center: [x, y, z], size: [w, h, d], yaw } with yaw in degrees, in (-45, 45]
 */
export function fitPrism(pts) {
  const n = Math.floor(pts.length / 3);
  if (n === 0) throw new Error('fitPrism: no points');
  let y0 = Infinity;
  let y1 = -Infinity;
  const plan = new Array(n);
  for (let i = 0; i < n; i++) {
    const y = pts[i * 3 + 1];
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    plan[i] = [pts[i * 3], pts[i * 3 + 2]];
  }
  const hull = convexHull(plan);

  let best = null;
  const edges = hull.length >= 2 ? hull.length : 1;
  for (let i = 0; i < edges; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length] ?? a;
    let theta = Math.atan2(b[1] - a[1], b[0] - a[0]);
    if (!Number.isFinite(theta) || (a[0] === b[0] && a[1] === b[1])) theta = 0;
    const r = boundsAt(hull, theta);
    const area = Math.max(r.u1 - r.u0, MIN_SIZE) * Math.max(r.n1 - r.n0, MIN_SIZE);
    if (!best || area < best.area - 1e-12) best = { area, theta, ...r };
  }

  const { theta, u0, u1, n0, n1 } = best;
  let w = u1 - u0;
  let d = n1 - n0;
  const uc = (u0 + u1) / 2;
  const nc = (n0 + n1) / 2;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const cx = c * uc - s * nc;
  const cz = s * uc + c * nc;

  // Our yaw convention maps local +X to world (cos yaw, -sin yaw), so yaw = -theta.
  // Then normalize to (-45, 45] by swapping width and depth, so boxes stay close to their drawn axes.
  // A box at yaw Y with size (w, d) is the same box as yaw Y ± 90 with size (d, w).
  let yaw = -theta / DEG;
  while (yaw > 45) {
    yaw -= 90;
    [w, d] = [d, w];
  }
  while (yaw <= -45) {
    yaw += 90;
    [w, d] = [d, w];
  }

  return {
    center: [cx, (y0 + y1) / 2, cz],
    size: [Math.max(w, MIN_SIZE), Math.max(y1 - y0, MIN_SIZE), Math.max(d, MIN_SIZE)],
    yaw,
  };
}

/** Extent of points along direction theta (u) and its normal (n). */
function boundsAt(pts, theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  let u0 = Infinity;
  let u1 = -Infinity;
  let n0 = Infinity;
  let n1 = -Infinity;
  for (const [x, z] of pts) {
    const u = c * x + s * z;
    const v = -s * x + c * z;
    if (u < u0) u0 = u;
    if (u > u1) u1 = u;
    if (v < n0) n0 = v;
    if (v > n1) n1 = v;
  }
  return { u0, u1, n0, n1 };
}

/** Andrew's monotone chain. Returns hull points counter-clockwise (collinear points dropped). */
export function convexHull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length <= 2) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Convert a fitted box to a pose ({x, y, z, yaw} in radians). */
export function boxPose(box) {
  return { x: box.center[0], y: box.center[1], z: box.center[2], yaw: box.yaw * DEG };
}

/**
 * Express world-space fitted boxes in a piece's frame, ready for the show's `boxes` field.
 * @param framePose the piece's world pose (usually the pose of its overall fitted box)
 */
export function boxesInFrame(framePose, worldBoxes) {
  return worldBoxes.map((b) => {
    const local = relative(framePose, boxPose(b));
    return { offset: [local.x, local.y, local.z], size: [...b.size], yaw: local.yaw / DEG };
  });
}
