import { describe, it, expect } from 'vitest';
import demo from '../src/shows/demo.json';
import { loadShow } from '../src/core/show.js';
import { Simulator } from '../src/core/simulator.js';
import { preflightShow } from '../src/core/preflight.js';
import { normalizeFaults } from '../src/core/faults.js';
import { pickDrill, drillCandidates, seededRandom, DRILL_KINDS, DRILL_WINDOW, MIN_DRILL_MOVE } from '../src/core/drills.js';

const { show } = loadShow(demo);
const home = Object.fromEntries(show.axes.map((a) => [a.id, a.home]));
const chain = preflightShow(show, home, 0);
const before = chain.map((r, i) => (i === 0 ? home : chain[i - 1].endPositions));

// Run the show from home with one fault armed; clear any hold so the rest of the show still runs.
function runWith(fault) {
  const sim = new Simulator(show);
  sim.armFaults([fault]);
  const events = [];
  sim.on((ev) => events.push(ev));
  for (let guard = 0; guard < 50 && sim.nextCue; guard++) {
    sim.go(); // after a cleared fault the pointer is still on the held cue, so this re-runs it
    for (let i = 0; i < 20000 && (sim.state === 'running' || sim.state === 'stopping'); i++) sim.step(0.01);
    if (sim.state === 'faulted') sim.clearFault();
  }
  return { sim, events };
}

describe('seededRandom', () => {
  it('is repeatable and stays in [0, 1)', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    for (let i = 0; i < 500; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    expect(seededRandom(8)()).not.toBe(seededRandom(7)());
  });
});

describe('drillCandidates', () => {
  it('lists the demo moves long enough to interrupt, with durations from the real start positions', () => {
    const c = drillCandidates(show, before);
    expect(c.length).toBeGreaterThan(0);
    for (const m of c) expect(m.duration).toBeGreaterThanOrEqual(MIN_DRILL_MOVE);
    // Q3: revolve 0 -> 90 deg and the fly 9.5 -> 6.0 m after a 1 s delay.
    const q3 = c.filter((m) => m.cue === '3');
    expect(q3.map((m) => m.axis).sort()).toEqual(['fly', 'turntable']);
    expect(q3.find((m) => m.axis === 'fly').start).toBe(1);
    expect(q3.find((m) => m.axis === 'fly').distance).toBeCloseTo(3.5, 9);
  });

  it('skips moves that go nowhere (an axis already at its target)', () => {
    // Q1 sends the revolve to 0 and the lift to -1.5 from home: both already there.
    const q1 = drillCandidates(show, before).filter((m) => m.cue === '1');
    expect(q1.map((m) => m.axis)).toEqual([]);
  });

  it('reports headroom to the soft limit past each target', () => {
    const lift = drillCandidates(show, before).find((m) => m.cue === '2' && m.axis === 'lift');
    expect(lift.headroom).toBeCloseTo(0, 9); // Q2 takes the lift to 0.0, its max
  });
});

describe('pickDrill', () => {
  it('rejects an unknown kind', () => {
    expect(() => pickDrill(show, { kind: 'fire' })).toThrow(/kind/);
  });

  it('returns null when nothing in the show moves far enough', () => {
    const { show: still } = loadShow({
      axes: [{ id: 'x', type: 'linear', home: 0, vMax: 1, aMax: 1 }],
      pieces: [],
      cues: [{ id: 'Q1', moves: [{ axis: 'x', target: 0 }] }],
    });
    for (const kind of DRILL_KINDS) expect(pickDrill(still, { kind })).toBeNull();
  });

  it('deals each kind as a valid fault, inside the chosen move', () => {
    for (const kind of ['stall', 'estop', 'overshoot']) {
      const random = seededRandom(11);
      for (let i = 0; i < 40; i++) {
        const f = pickDrill(show, { kind, startPositions: before, random });
        expect(f.type).toBe(kind);
        expect(normalizeFaults([f], show).errors).toEqual([]);
        if (kind === 'overshoot') {
          expect(f.amount).toBeGreaterThan(0);
          continue;
        }
        // The time lands while some move of that cue is in its drill window.
        const moves = drillCandidates(show, before).filter((m) => m.cue === f.cue && (kind === 'estop' || m.axis === f.axis));
        const [lo, hi] = DRILL_WINDOW;
        const inside = moves.some((m) => f.at >= m.start + m.duration * lo - 0.006 && f.at <= m.start + m.duration * hi + 0.006);
        expect(inside).toBe(true);
      }
    }
  });

  it('never sends an overshoot past a soft limit', () => {
    const random = seededRandom(3);
    const defs = new Map(show.axes.map((a) => [a.id, a]));
    for (let i = 0; i < 100; i++) {
      const f = pickDrill(show, { kind: 'overshoot', startPositions: before, random });
      const m = drillCandidates(show, before).find((c) => c.cue === f.cue && c.axis === f.axis);
      expect(f.amount).toBeLessThanOrEqual(m.headroom + 1e-9);
      expect(f.cue === '2' && f.axis === 'lift').toBe(false); // that move ends at the lift's max
      expect(defs.has(f.axis)).toBe(true);
    }
  });

  it('is repeatable with a seeded random and varies across seeds', () => {
    const a = pickDrill(show, { startPositions: before, random: seededRandom(42) });
    const b = pickDrill(show, { startPositions: before, random: seededRandom(42) });
    expect(a).toEqual(b);
    const seen = new Set();
    for (let s = 0; s < 60; s++) seen.add(pickDrill(show, { startPositions: before, random: seededRandom(s) }).type);
    expect([...seen].sort()).toEqual(['estop', 'overshoot', 'stall']);
  });

  it('a dealt stall or e-stop actually holds the show in the simulator', () => {
    for (const kind of ['stall', 'estop']) {
      const random = seededRandom(5);
      for (let i = 0; i < 10; i++) {
        const f = pickDrill(show, { kind, startPositions: before, random });
        const { events } = runWith(f);
        expect(events.some((e) => e.type === 'fault')).toBe(true);
        expect(events.some((e) => e.type === 'faulted')).toBe(true);
      }
    }
  });

  it('a dealt overshoot fires and the cue still completes', () => {
    const random = seededRandom(9);
    for (let i = 0; i < 10; i++) {
      const f = pickDrill(show, { kind: 'overshoot', startPositions: before, random });
      const { events, sim } = runWith(f);
      expect(events.some((e) => e.type === 'fault' && e.fault.type === 'overshoot')).toBe(true);
      expect(events.some((e) => e.type === 'faulted')).toBe(false);
      expect(sim.nextCue).toBeNull(); // ran to the end of the list
    }
  });
});
