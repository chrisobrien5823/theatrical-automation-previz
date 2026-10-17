import { describe, it, expect } from 'vitest';
import { prismGap, rectDistance, corners, ConflictTracker } from '../src/core/clearance.js';

const box = (cx, cz, w, d, yawDeg = 0, y0 = 0, y1 = 1) => ({
  cx,
  cz,
  hx: w / 2,
  hz: d / 2,
  yaw: (yawDeg * Math.PI) / 180,
  y0,
  y1,
});

describe('prismGap', () => {
  it('separated along X', () => {
    expect(prismGap(box(0, 0, 1, 1), box(3, 0, 1, 1))).toBeCloseTo(2, 9);
  });

  it('touching faces is zero', () => {
    expect(prismGap(box(0, 0, 1, 1), box(1, 0, 1, 1))).toBeCloseTo(0, 9);
  });

  it('overlapping is zero', () => {
    expect(prismGap(box(0, 0, 2, 2), box(0.5, 0.5, 2, 2))).toBe(0);
  });

  it('vertical gap only', () => {
    expect(prismGap(box(0, 0, 1, 1, 0, 0, 1), box(0, 0, 1, 1, 0, 1.25, 2))).toBeCloseTo(0.25, 9);
  });

  it('combines plan and vertical gaps as a hypotenuse', () => {
    expect(prismGap(box(0, 0, 1, 1, 0, 0, 1), box(4, 0, 1, 1, 0, 5, 6))).toBeCloseTo(5, 9); // 3-4-5
  });

  it('rotated 45 deg: corner-to-face distance', () => {
    // Unit square rotated 45 deg has its corner at x = sqrt(2)/2 from its center.
    const a = box(0, 0, 1, 1, 45);
    const b = box(2, 0, 1, 1); // face at x = 1.5
    expect(prismGap(a, b)).toBeCloseTo(1.5 - Math.SQRT2 / 2, 9);
  });

  it('rotation convention matches Three.js (rotation.y)', () => {
    // A long box along X rotated +90 deg about Y should lie along Z.
    const c = corners(box(0, 0, 4, 0.2, 90));
    const zs = c.map(([, z]) => z);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(4, 9);
  });

  it('rectDistance is symmetric', () => {
    const a = corners(box(0, 0, 1, 2, 30));
    const b = corners(box(3, 1, 2, 1, -20));
    expect(rectDistance(a, b)).toBeCloseTo(rectDistance(b, a), 12);
  });
});

describe('ConflictTracker', () => {
  it('opens one window per pair, tracks min gap, closes when the hit goes away', () => {
    const A = { id: 'a', name: 'A' };
    const B = { id: 'b', name: 'B' };
    const hit = (gap) => [{ a: A, b: B, key: 'a|b', gap, severity: 'warning' }];
    const t = new ConflictTracker();
    expect(t.update(hit(0.1), '3', 1).opened).toHaveLength(1);
    t.update(hit(0.05), '3', 1.5);
    t.update(hit(0.08), '3', 2);
    const { closed } = t.update([], '3', 2.5);
    expect(closed).toHaveLength(1);
    expect(closed[0]).toMatchObject({ tStart: 1, tEnd: 2, minGap: 0.05, tMin: 1.5 });
  });
});
