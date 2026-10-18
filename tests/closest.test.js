import { describe, it, expect } from 'vitest';
import { prismGap, prismClosestPoints, pieceClosestPoints, checkClearance, buildPairs } from '../src/core/clearance.js';
import { loadShow } from '../src/core/show.js';
import demo from '../src/shows/demo.json';

const box = (cx, cz, w, d, yawDeg = 0, y0 = 0, y1 = 1) => ({ cx, cz, hx: w / 2, hz: d / 2, yaw: (yawDeg * Math.PI) / 180, y0, y1 });

// Is a world point inside (or on) a prism, within tol? Same yaw convention as corners().
function inside(p, [x, y, z], tol = 1e-7) {
  const dx = x - p.cx;
  const dz = z - p.cz;
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  const lx = c * dx - s * dz;
  const lz = s * dx + c * dz;
  return Math.abs(lx) <= p.hx + tol && Math.abs(lz) <= p.hz + tol && y >= p.y0 - tol && y <= p.y1 + tol;
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Deterministic pseudo-random numbers so failures reproduce.
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

describe('prismClosestPoints', () => {
  it('separated along X: points on the facing faces', () => {
    const r = prismClosestPoints(box(0, 0, 1, 1), box(3, 0, 1, 1));
    expect(r.gap).toBeCloseTo(2, 9);
    expect(r.a[0]).toBeCloseTo(0.5, 9);
    expect(r.b[0]).toBeCloseTo(2.5, 9);
  });

  it('vertical gap: points on the facing top and bottom', () => {
    const r = prismClosestPoints(box(0, 0, 1, 1, 0, 0, 1), box(0, 0, 1, 1, 0, 1.25, 2));
    expect(r.a[1]).toBeCloseTo(1, 9);
    expect(r.b[1]).toBeCloseTo(1.25, 9);
    expect(dist(r.a, r.b)).toBeCloseTo(0.25, 9);
  });

  it('overlapping: one shared point inside both', () => {
    const A = box(0, 0, 2, 2);
    const B = box(0.5, 0.5, 2, 2, 30);
    const r = prismClosestPoints(A, B);
    expect(r.gap).toBe(0);
    expect(dist(r.a, r.b)).toBe(0);
    expect(inside(A, r.a)).toBe(true);
    expect(inside(B, r.b)).toBe(true);
  });

  it('agrees with prismGap and lies on each prism for random boxes', () => {
    const r = rng(42);
    for (let i = 0; i < 2000; i++) {
      const A = box(r() * 6 - 3, r() * 6 - 3, 0.2 + r() * 3, 0.2 + r() * 3, r() * 360, r() * 2, 2 + r() * 2);
      const y0 = r() * 5;
      const B = box(r() * 6 - 3, r() * 6 - 3, 0.2 + r() * 3, 0.2 + r() * 3, r() * 360, y0, y0 + 0.2 + r() * 2);
      const res = prismClosestPoints(A, B);
      expect(res.gap).toBeCloseTo(prismGap(A, B), 9);
      expect(dist(res.a, res.b)).toBeCloseTo(res.gap, 7);
      expect(inside(A, res.a)).toBe(true);
      expect(inside(B, res.b)).toBe(true);
    }
  });
});

describe('pieceClosestPoints on the demo show', () => {
  it("measures the same gap the clearance check reports at Q3's worst moment", () => {
    const { show } = loadShow(demo);
    const wall = show.pieces.find((p) => p.id === 'wall');
    const riser = show.pieces.find((p) => p.id === 'riser');
    // Riser up (Q2), revolve part way through Q3's sweep.
    for (const deg of [20, 35, 45, 60]) {
      const positions = { lift: 0, turntable: deg, fly: 9.5 };
      const hit = checkClearance(show, positions, buildPairs(show)).find((h) => h.key === 'riser|wall');
      const w = pieceClosestPoints(show, positions, wall, riser);
      if (hit) expect(w.gap).toBeCloseTo(hit.gap, 9);
      expect(dist(w.a, w.b)).toBeCloseTo(w.gap, 7);
    }
  });
});
