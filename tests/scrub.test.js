import { describe, it, expect } from 'vitest';
import demo from '../src/shows/demo.json';
import { loadShow } from '../src/core/show.js';
import { Simulator } from '../src/core/simulator.js';
import { preflightShow } from '../src/core/preflight.js';
import { checkClearance } from '../src/core/clearance.js';
import { createCueScrubber, timelineMarks } from '../src/core/scrub.js';

const { show } = loadShow(demo);
const home = Object.fromEntries(show.axes.map((a) => [a.id, a.home]));
const results = preflightShow(show, home, 0);
const q3 = show.cues.findIndex((c) => c.id === '3');
const before3 = q3 > 0 ? results[q3 - 1].endPositions : home;

describe('createCueScrubber', () => {
  it('is as long as the preflight sweep of the same cue', () => {
    const s = createCueScrubber(show, before3, q3);
    expect(s.cueId).toBe('3');
    expect(s.duration).toBeCloseTo(results[q3].duration, 9);
  });

  it('draws exactly what a live run draws, on and between 10 ms steps', () => {
    const s = createCueScrubber(show, before3, q3);
    const live = new Simulator(show, { positions: before3, cueIndex: q3 });
    live.go();
    let checked = 0;
    for (let k = 0; live.state !== 'idle'; k++) {
      if (k % 37 === 0) {
        // Same pose at the step boundary and 4 ms past it (the render loop's leftover accumulator).
        expect(s.poseAt(live.cueTime)).toEqual(live.positions());
        expect(s.poseAt(live.cueTime + 0.004)).toEqual(live.positionsAt(0.004));
        checked++;
      }
      live.step(0.01);
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('scrubs backwards and forwards to the same answer', () => {
    const s = createCueScrubber(show, before3, q3);
    const mid = s.duration / 2;
    const a = s.poseAt(mid);
    s.poseAt(s.duration);
    const b = s.poseAt(mid); // backwards: replays from the top
    s.poseAt(0.05);
    expect(s.poseAt(mid)).toEqual(a);
    expect(b).toEqual(a);
  });

  it('clamps to the start and end poses', () => {
    const s = createCueScrubber(show, before3, q3);
    expect(s.poseAt(-5)).toEqual(s.poseAt(0));
    expect(s.poseAt(0)).toEqual(before3);
    expect(s.poseAt(s.duration + 10)).toEqual(results[q3].endPositions);
    expect(s.statesAt(s.duration).every((st) => !st.moving)).toBe(true);
  });

  it('lands on the preflight minimum gap at the window’s tMin (what is drawn is what is checked)', () => {
    const [w] = results[q3].conflicts;
    const s = createCueScrubber(show, before3, q3);
    const hits = checkClearance(show, s.poseAt(w.tMin));
    const hit = hits.find((h) => h.key === w.key);
    expect(hit).toBeDefined();
    expect(hit.gap).toBeCloseTo(w.minGap, 9);
    // And just outside the window the pair is clear again.
    const after = checkClearance(show, s.poseAt(w.tEnd + 0.05));
    expect(after.find((h) => h.key === w.key)).toBeUndefined();
  });

  it('returns null for a cue that does not exist', () => {
    expect(createCueScrubber(show, home, show.cues.length)).toBeNull();
  });

  it('handles a cue whose axes are already in position', () => {
    const tiny = loadShow({
      axes: [{ id: 'x', type: 'linear', home: 0, min: -1, max: 1, vMax: 1, aMax: 1 }],
      pieces: [],
      cues: [{ id: '1', moves: [{ axis: 'x', target: 0 }] }],
    }).show;
    const s = createCueScrubber(tiny, { x: 0 }, 0);
    expect(s.duration).toBeLessThanOrEqual(0.01 + 1e-9);
    expect(s.poseAt(1)).toEqual({ x: 0 });
  });
});

describe('timelineMarks', () => {
  it('turns Q3’s conflict window into a span inside the cue', () => {
    const marks = timelineMarks(results[q3]);
    expect(marks).toHaveLength(1);
    const [m] = marks;
    expect(m.from).toBeGreaterThan(0);
    expect(m.to).toBeLessThan(1);
    expect(m.atMin).toBeGreaterThanOrEqual(m.from);
    expect(m.atMin).toBeLessThanOrEqual(m.to);
    expect(m.severity).toBe('warning');
    expect([m.aName, m.bName].length).toBe(2);
  });

  it('is empty for clean cues and missing results', () => {
    expect(timelineMarks(results[0])).toEqual([]);
    expect(timelineMarks(null)).toEqual([]);
    expect(timelineMarks({ duration: 0, conflicts: [{ tStart: 0, tEnd: 0, tMin: 0 }] })).toEqual([]);
  });
});
