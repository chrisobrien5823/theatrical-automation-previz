import { describe, it, expect } from 'vitest';
import { planMove, planStop } from '../src/core/profile.js';

function sweep(profile, dt = 0.001) {
  const out = [];
  for (let t = 0; t <= profile.duration + dt; t += dt) out.push(profile.sample(t));
  return out;
}

describe('planMove', () => {
  it('trapezoid: closed-form duration and exact endpoints', () => {
    // 90 deg at 12 deg/s, 6 deg/s^2: 2 s accel + 5.5 s cruise + 2 s decel.
    const p = planMove(0, 90, { vMax: 12, aMax: 6 });
    expect(p.shape).toBe('trapezoid');
    expect(p.duration).toBeCloseTo(9.5, 9);
    expect(p.sample(0).pos).toBe(0);
    expect(p.sample(p.duration).pos).toBe(90);
    expect(p.sample(p.duration / 2).pos).toBeCloseTo(45, 9);
  });

  it('triangle when the move is too short to reach vMax', () => {
    const p = planMove(0, 1, { vMax: 10, aMax: 1 });
    expect(p.shape).toBe('triangle');
    expect(p.vPeak).toBeCloseTo(1, 9); // sqrt(1 * 1)
    expect(p.duration).toBeCloseTo(2, 9);
  });

  it('never exceeds vMax or aMax, and position is monotonic', () => {
    for (const [s, e] of [
      [0, 3.5],
      [9.5, 6],
      [-1.5, 0],
      [0, 0.05],
    ]) {
      const p = planMove(s, e, { vMax: 1, aMax: 0.5 });
      const samples = sweep(p);
      const dir = Math.sign(e - s);
      let prev = s;
      for (const x of samples) {
        expect(Math.abs(x.vel)).toBeLessThanOrEqual(1 + 1e-9);
        expect(Math.abs(x.acc)).toBeLessThanOrEqual(0.5 + 1e-9);
        expect((x.pos - prev) * dir).toBeGreaterThanOrEqual(-1e-12);
        prev = x.pos;
      }
      expect(samples.at(-1).pos).toBe(e);
    }
  });

  it('velocity is continuous (no jumps bigger than aMax*dt)', () => {
    const p = planMove(0, 10, { vMax: 2, aMax: 1 });
    const dt = 0.001;
    const s = sweep(p, dt);
    for (let i = 1; i < s.length; i++) expect(Math.abs(s[i].vel - s[i - 1].vel)).toBeLessThanOrEqual(1 * dt + 1e-9);
  });

  it('zero-length move is a hold', () => {
    const p = planMove(5, 5, { vMax: 1, aMax: 1 });
    expect(p.duration).toBe(0);
    expect(p.sample(1).pos).toBe(5);
  });
});

describe('planStop', () => {
  it('decelerates to rest at aMax', () => {
    const p = planStop(2, -1, { aMax: 0.5 });
    expect(p.duration).toBeCloseTo(2, 9);
    expect(p.target).toBeCloseTo(1, 9); // 2 - 1^2 / (2 * 0.5)
    expect(p.sample(p.duration).vel).toBe(0);
  });
});
