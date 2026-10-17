import { describe, it, expect } from 'vitest';
import demo from '../src/shows/demo.json';
import { loadShow } from '../src/core/show.js';
import { preflightShow } from '../src/core/preflight.js';
import { checkClearance } from '../src/core/clearance.js';

const { show, warnings } = loadShow(demo);
const home = Object.fromEntries(show.axes.map((a) => [a.id, a.home]));
const results = preflightShow(show, home, 0);
const byId = Object.fromEntries(results.map((r) => [r.cueId, r]));

describe('demo show', () => {
  it('loads without warnings', () => {
    expect(warnings).toEqual([]);
  });

  it('is clear at preset', () => {
    expect(checkClearance(show, home)).toEqual([]);
  });

  it('Q3 is flagged: Wall A vs Riser near-miss mid-revolve', () => {
    const c = byId['3'].conflicts;
    expect(c).toHaveLength(1);
    expect([c[0].a, c[0].b].sort()).toEqual(['riser', 'wall']);
    expect(c[0].severity).toBe('warning'); // near-miss, not contact
    expect(c[0].minGap).toBeGreaterThan(0.03);
    expect(c[0].minGap).toBeLessThan(0.1);
    expect(c[0].tStart).toBeGreaterThan(2);
    expect(c[0].tEnd).toBeLessThan(byId['3'].duration); // transient: clears before the cue ends
  });

  it('every other cue runs clean', () => {
    for (const r of results) {
      if (r.cueId === '3') continue;
      expect(r.conflicts, `cue ${r.cueId}`).toEqual([]);
    }
  });
});
