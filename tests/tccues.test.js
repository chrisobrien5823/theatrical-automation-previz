import { describe, it, expect } from 'vitest';
import demo from '../src/shows/demo.json';
import { loadShow } from '../src/core/show.js';
import { Simulator } from '../src/core/simulator.js';
import { tcSchedule, createTcFollower, tcTimingIssues, cueDurations, TC_JUMP_SECONDS } from '../src/core/tcCues.js';

// One axis, vMax 1 and aMax 1: a 5 m move is 1 s accel (0.5 m), 4 s cruise, 1 s decel (0.5 m) = 6 s.
const axes = [{ id: 'x', type: 'linear', home: 0, min: -10, max: 10, vMax: 1, aMax: 1 }];

function tcShow(cues, timecode = { rate: '25' }) {
  return loadShow({ axes, pieces: [], timecode, cues });
}

const home = { x: 0 };

describe('loadShow timecode fields', () => {
  it('parses cue tc into frames and keeps the rate', () => {
    const { show, warnings } = tcShow([
      { id: 'A', tc: '00:00:02:00', moves: [{ axis: 'x', target: 5 }] },
      { id: 'B', moves: [{ axis: 'x', target: 0 }] },
    ]);
    expect(warnings).toEqual([]);
    expect(show.timecode).toEqual({ rate: '25' });
    expect(show.cues.map((c) => c.tc)).toEqual([50, null]);
  });

  it('a show without timecode is unchanged', () => {
    const { show } = loadShow(demo);
    expect(show.timecode).toBeNull();
    expect(show.cues.every((c) => c.tc === null)).toBe(true);
    expect(tcSchedule(show)).toEqual([]);
  });

  it('rejects a tc with no rate, a bad label and an unknown rate', () => {
    expect(() => tcShow([{ id: 'A', tc: '00:00:01:00', moves: [] }], null)).toThrow(/no timecode rate/);
    expect(() => tcShow([{ id: 'A', tc: '00:00:01:25', moves: [] }])).toThrow(/not a valid 25 fps timecode/);
    expect(() => tcShow([{ id: 'A', tc: '00:01:00;00', moves: [] }], { rate: '29.97df' })).toThrow(/not a valid/);
    expect(() => tcShow([], { rate: '60' })).toThrow(/timecode.rate must be one of/);
  });

  it('warns about timecode out of cue order and auto-follow into a timecode cue', () => {
    const { warnings } = tcShow([
      { id: 'A', tc: '00:00:10:00', follow: true, moves: [] },
      { id: 'B', tc: '00:00:05:00', moves: [] },
    ]);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toMatch(/cue B: tc 00:00:05:00 is not after cue A/);
    expect(warnings[1]).toMatch(/cue A auto-follows into it/);
  });
});

describe('tcSchedule', () => {
  it('lists timecode cues in time order with seconds', () => {
    const { show } = tcShow([
      { id: 'A', tc: '00:00:01:00', moves: [] },
      { id: 'B', moves: [] },
      { id: 'C', tc: '00:00:03:12', moves: [] },
    ]);
    expect(tcSchedule(show)).toEqual([
      { cueIndex: 0, cueId: 'A', frame: 25, seconds: 1 },
      { cueIndex: 2, cueId: 'C', frame: 87, seconds: 3.48 },
    ]);
  });
});

describe('createTcFollower', () => {
  const schedule = [
    { cueIndex: 0, seconds: 1 },
    { cueIndex: 1, seconds: 2 },
    { cueIndex: 3, seconds: 2.1 },
  ];

  it('locates on the first update, then fires cues as timecode runs past them', () => {
    const f = createTcFollower(schedule);
    expect(f.locked).toBe(false);
    expect(f.update(0.5)).toEqual({ type: 'locate', cueIndex: -1, elapsed: 0 });
    expect(f.locked).toBe(true);
    expect(f.update(0.9)).toBeNull();
    expect(f.update(1.0)).toEqual({ type: 'fire', cues: [0] });
    expect(f.update(1.0)).toBeNull(); // paused clock
    expect(f.update(1.4)).toBeNull();
    expect(f.update(1.8)).toBeNull();
    expect(f.update(2.2)).toEqual({ type: 'fire', cues: [1, 3] }); // two cues in one step, in order
  });

  it('locates mid-cue after a jump forward or any step back', () => {
    const f = createTcFollower(schedule);
    f.update(0);
    const ahead = f.update(1 + TC_JUMP_SECONDS + 0.25);
    expect(ahead.type).toBe('locate');
    expect(ahead.cueIndex).toBe(0);
    expect(ahead.elapsed).toBeCloseTo(0.75, 9);
    expect(f.update(1.5)).toEqual({ type: 'locate', cueIndex: 0, elapsed: 0.5 });
    expect(f.update(0.2)).toEqual({ type: 'locate', cueIndex: -1, elapsed: 0 });
  });

  it('locking exactly on a cue time locates into it at 0 s (the caller runs it)', () => {
    expect(createTcFollower(schedule).update(2)).toEqual({ type: 'locate', cueIndex: 1, elapsed: 0 });
  });

  it('reset makes the next update locate again', () => {
    const f = createTcFollower(schedule);
    f.update(0);
    f.reset();
    expect(f.locked).toBe(false);
    expect(f.update(0.04).type).toBe('locate');
  });
});

describe('tcTimingIssues', () => {
  it('flags a timecode that arrives while the previous cue is still moving', () => {
    const { show } = tcShow([
      { id: 'A', tc: '00:00:00:00', moves: [{ axis: 'x', target: 5 }] }, // 6 s
      { id: 'B', tc: '00:00:04:00', moves: [{ axis: 'x', target: 0 }] },
    ]);
    expect(cueDurations(show, home)).toEqual([6, 5 + 1]);
    const issues = tcTimingIssues(show, home);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ cueId: 'B', prevCueId: 'A', at: 4 });
    expect(issues[0].early).toBeCloseTo(2, 9);
  });

  it('chains start positions: a cue that ends where it began takes no time', () => {
    const { show } = tcShow([
      { id: 'A', moves: [{ axis: 'x', target: 5 }] },
      { id: 'B', moves: [{ axis: 'x', target: 5 }] },
    ]);
    expect(cueDurations(show)).toEqual([6, 0]);
  });

  it('times auto-follow chains and skips cues after a manual GO', () => {
    const { show } = tcShow([
      { id: 'A', tc: '00:00:00:00', follow: true, moves: [{ axis: 'x', target: 5 }] }, // 0 to 6 s
      { id: 'B', moves: [{ axis: 'x', target: 0 }] }, // follows: 6 to 12 s
      { id: 'C', tc: '00:00:11:00', moves: [{ axis: 'x', target: 1 }] }, // too early by ~1 s
      { id: 'D', moves: [{ axis: 'x', target: 3 }] }, // manual GO: start unknown
      { id: 'E', tc: '00:00:12:00', moves: [] }, // not judged
    ]);
    const issues = tcTimingIssues(show); // defaults to every axis at home
    expect(issues.map((i) => i.cueId)).toEqual(['C']);
    expect(issues[0].early).toBeCloseTo(1, 9);
  });

  it('is empty for a well-spaced show and for a show without timecode', () => {
    const { show } = tcShow([
      { id: 'A', tc: '00:00:00:00', moves: [{ axis: 'x', target: 5 }] },
      { id: 'B', tc: '00:00:06:10', moves: [{ axis: 'x', target: 0 }] },
    ]);
    expect(tcTimingIssues(show, home)).toEqual([]);
    expect(tcTimingIssues(loadShow(demo).show)).toEqual([]);
  });
});

describe('following a 25 fps clock with the real Simulator', () => {
  it('GOes each timecode cue on its frame and the show completes', () => {
    const { show } = tcShow([
      { id: 'A', tc: '00:00:01:00', moves: [{ axis: 'x', target: 5 }] },
      { id: 'B', tc: '00:00:08:00', moves: [{ axis: 'x', target: -2 }] },
    ]);
    const sim = new Simulator(show, { positions: home });
    const started = [];
    sim.on((ev) => ev.type === 'cueStart' && started.push(ev.cue.id));
    const follower = createTcFollower(tcSchedule(show));
    const fps = 25;
    const goAt = {};
    for (let frame = 0; frame <= 20 * fps; frame++) {
      const t = frame / fps;
      const action = follower.update(t);
      if (action?.type === 'fire') {
        for (const i of action.cues) if (sim.state === 'idle' && sim.cueIndex === i && sim.go()) goAt[show.cues[i].id] = t;
      }
      sim.step(1 / fps);
    }
    expect(started).toEqual(['A', 'B']);
    expect(goAt).toEqual({ A: 1, B: 8 });
    expect(sim.state).toBe('idle');
    expect(sim.positions().x).toBeCloseTo(-2, 6);
  });
});
