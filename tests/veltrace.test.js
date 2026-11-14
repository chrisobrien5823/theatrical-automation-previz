import { describe, it, expect } from 'vitest';
import { createTrace, tracePath } from '../src/ui/velTrace.js';

describe('createTrace (velocity samples on the show clock)', () => {
  it('keeps samples at least one step apart, newest always the latest value', () => {
    const tr = createTrace({ window: 6, step: 0.05 });
    for (let i = 0; i <= 10; i++) tr.push(i * 0.01, i); // 100 Hz for 0.1 s
    const ts = tr.samples.map((s) => s.t);
    for (let i = 1; i < ts.length - 1; i++) expect(ts[i] - ts[i - 1]).toBeGreaterThanOrEqual(0.05 - 1e-9);
    expect(tr.samples.at(-1)).toEqual({ t: 0.1, v: 10 });
    expect(tr.samples.length).toBeLessThanOrEqual(4);
  });

  it('records the final zero when a cue ends between two steps', () => {
    const tr = createTrace({ step: 0.05 });
    tr.push(0, 0);
    tr.push(0.05, 0.4);
    tr.push(0.07, 0); // cue complete 20 ms later
    expect(tr.samples.at(-1)).toEqual({ t: 0.07, v: 0 });
  });

  it('reports no change while the clock is paused and the value is unchanged', () => {
    const tr = createTrace();
    expect(tr.push(1, 0)).toBe(true);
    expect(tr.push(1, 0)).toBe(false); // stage at rest: no redraw
    expect(tr.push(1, 0.2)).toBe(true);
    expect(tr.samples).toEqual([{ t: 1, v: 0.2 }]);
  });

  it('drops samples older than the window but keeps one to start the line at the left edge', () => {
    const tr = createTrace({ window: 1, step: 0.1 });
    for (let i = 0; i <= 30; i++) tr.push(i * 0.1, 1);
    const first = tr.samples[0].t;
    expect(first).toBeLessThanOrEqual(3 - 1 + 1e-9);
    expect(tr.samples[1].t).toBeGreaterThan(3 - 1);
    expect(tr.samples.length).toBeLessThanOrEqual(12);
  });

  it('starts over when the clock goes backwards, and on clear()', () => {
    const tr = createTrace();
    tr.push(5, 1);
    tr.push(6, 1);
    tr.push(2, 0);
    expect(tr.samples).toEqual([{ t: 2, v: 0 }]);
    tr.clear();
    expect(tr.samples).toEqual([]);
  });
});

describe('tracePath (samples to an SVG path)', () => {
  it('puts zero on the centre line and +/- vMax at the padded edges, newest at the right', () => {
    const d = tracePath(
      [
        { t: 4, v: 0 },
        { t: 5, v: 0.5 },
        { t: 6, v: -0.5 },
      ],
      6, 2, 0.5, 100, 24, 2,
    );
    expect(d).toBe('M0 12L50 2L100 22');
  });

  it('clamps a value beyond vMax into the box and a sample past the left edge to x = 0', () => {
    expect(tracePath([{ t: 0, v: 2 }, { t: 10, v: 0 }], 10, 6, 1, 60, 24, 2)).toBe('M0 2L60 12');
  });

  it('is empty with no samples or no vMax', () => {
    expect(tracePath([], 1, 6, 1, 100, 24)).toBe('');
    expect(tracePath([{ t: 0, v: 0 }], 1, 6, 0, 100, 24)).toBe('');
  });

  it('gives an identical string for an unchanged trace (no needless DOM write)', () => {
    const s = [{ t: 0.1234567, v: 0.3333333 }];
    expect(tracePath(s, 1, 6, 1, 300, 24)).toBe(tracePath(s.map((x) => ({ ...x })), 1, 6, 1, 300, 24));
  });
});
