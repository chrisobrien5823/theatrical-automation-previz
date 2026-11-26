import { describe, it, expect } from 'vitest';
import { loadShow } from '../src/core/show.js';
import { preflightShow, preflightCue, createPreflightJob } from '../src/core/preflight.js';
import { createCueScrubber } from '../src/core/scrub.js';

// A wagon tracks along X toward a fixed wall. Gap = 6 - x - 1, so it is inside the default
// 0.15 m clearance once x > 4.85. Q1 (clean, auto-follows) parks it at x = 2; Q2 drives it to x = 5.
// vMax = aMax = 1: Q1 is 1 s accel + 1 s cruise + 1 s decel = 3 s, Q2 is 1 + 2 + 1 = 4 s.
function wagonShow({ q1Target = 2 } = {}) {
  const { show } = loadShow({
    axes: [{ id: 'x', type: 'linear', direction: [1, 0, 0], home: 0, min: -10, max: 10, vMax: 1, aMax: 1 }],
    pieces: [
      { id: 'wagon', name: 'Wagon', mount: 'x', offset: [0, 0.5, 0], size: [1, 1, 1] },
      { id: 'wall', name: 'Wall', offset: [6, 0.5, 0], size: [1, 1, 1] },
    ],
    cues: [
      { id: '1', follow: true, moves: [{ axis: 'x', target: q1Target }] },
      { id: '2', moves: [{ axis: 'x', target: 5 }] },
    ],
  });
  return show;
}

describe('preflight with auto-follow cues', () => {
  it('ends a follow cue at its own completion, not at the end of the cue it follows into', () => {
    const [q1, q2] = preflightShow(wagonShow(), { x: 0 });
    expect(q1.cueId).toBe('1');
    expect(q1.duration).toBeCloseTo(3, 6);
    expect(q1.endPositions.x).toBeCloseTo(2, 9);
    expect(q1.conflicts).toEqual([]); // Q2's clash is not blamed on Q1
  });

  it('gives the follow-on cue its own conflict, with times from its own GO', () => {
    const [, q2] = preflightShow(wagonShow(), { x: 0 });
    expect(q2.cueId).toBe('2');
    expect(q2.duration).toBeCloseTo(4, 6);
    expect(q2.conflicts).toHaveLength(1);
    const w = q2.conflicts[0];
    expect(w.cueId).toBe('2');
    // x passes 4.85 during the decel: 4.5 + s - s²/2 = 4.85 at s ≈ 0.452, so t ≈ 3.45 s.
    expect(w.tStart).toBeGreaterThan(3.4);
    expect(w.tStart).toBeLessThan(3.5);
    expect(w.tStart).toBeLessThanOrEqual(q2.duration);
  });

  it('chaining matches sweeping the next cue on its own from the previous end', () => {
    const show = wagonShow();
    const [q1, q2] = preflightShow(show, { x: 0 });
    expect(preflightCue(show, q1.endPositions, 1)).toEqual(q2);
  });

  it('an instant follow cue (axes already in position) lasts one step and stays clean', () => {
    const [q1, q2] = preflightShow(wagonShow({ q1Target: 0 }), { x: 0 });
    expect(q1.duration).toBeLessThan(0.02);
    expect(q1.endPositions.x).toBe(0);
    expect(q1.conflicts).toEqual([]);
    expect(q2.conflicts).toHaveLength(1);
  });

  it('the background job gives the same results as the blocking sweep', () => {
    const show = wagonShow();
    const job = createPreflightJob(show, { x: 0 });
    let slices = 0;
    while (!job.run(() => false)) slices++;
    expect(slices).toBeGreaterThan(100); // it really did run in slices
    expect(job.results).toEqual(preflightShow(show, { x: 0 }));
  });

  it('agrees with the cue scrubber on each cue length', () => {
    const show = wagonShow();
    const [q1, q2] = preflightShow(show, { x: 0 });
    expect(createCueScrubber(show, { x: 0 }, 0).duration).toBeCloseTo(q1.duration, 9);
    expect(createCueScrubber(show, q1.endPositions, 1).duration).toBeCloseTo(q2.duration, 9);
  });
});
