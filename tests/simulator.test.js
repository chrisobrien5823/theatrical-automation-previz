import { describe, it, expect } from 'vitest';
import { Simulator } from '../src/core/simulator.js';
import { loadShow } from '../src/core/show.js';

const { show } = loadShow({
  axes: [{ id: 'x', type: 'linear', home: 0, min: -10, max: 10, vMax: 1, aMax: 1 }],
  pieces: [],
  cues: [
    { id: '1', moves: [{ axis: 'x', target: 5 }] },
    { id: '2', moves: [{ axis: 'x', target: 0, delay: 1 }] },
  ],
});

function runToIdle(sim, dt = 0.01, max = 10000) {
  for (let i = 0; i < max && sim.state !== 'idle'; i++) sim.step(dt);
}

describe('Simulator', () => {
  it('GO runs a cue to its target and advances the pointer', () => {
    const sim = new Simulator(show);
    const events = [];
    sim.on((e) => events.push(e.type));
    expect(sim.go()).toBe(true);
    expect(sim.state).toBe('running');
    expect(sim.cueDuration).toBeCloseTo(6, 9); // 1 s accel, 4 s cruise, 1 s decel
    runToIdle(sim);
    expect(sim.positions().x).toBe(5);
    expect(sim.cueIndex).toBe(1);
    expect(events).toEqual(['cueStart', 'cueComplete']);
  });

  it('GO is ignored while a cue is running', () => {
    const sim = new Simulator(show);
    sim.go();
    expect(sim.go()).toBe(false);
  });

  it('delay holds the axis before moving', () => {
    const sim = new Simulator(show, { positions: { x: 5 }, cueIndex: 1 });
    sim.go();
    sim.step(0.5);
    expect(sim.positions().x).toBe(5);
    runToIdle(sim);
    expect(sim.positions().x).toBe(0);
  });

  it('STOP ramps down instead of snapping, and keeps the pointer', () => {
    const sim = new Simulator(show);
    sim.go();
    for (let i = 0; i < 300; i++) sim.step(0.01); // 3 s in: cruising at 1 m/s
    const posAtStop = sim.positions().x;
    sim.stop();
    expect(sim.state).toBe('stopping');
    sim.step(0.01);
    expect(sim.positions().x).toBeGreaterThan(posAtStop); // still coasting
    runToIdle(sim);
    expect(sim.positions().x).toBeCloseTo(posAtStop + 0.5, 6); // v^2 / 2a
    expect(sim.cueIndex).toBe(0);
    // GO again completes the stopped cue.
    sim.go();
    runToIdle(sim);
    expect(sim.positions().x).toBe(5);
    expect(sim.cueIndex).toBe(1);
  });

  it('RESET homes axes and returns to the first cue', () => {
    const sim = new Simulator(show);
    sim.go();
    sim.step(2);
    sim.reset();
    expect(sim.state).toBe('idle');
    expect(sim.positions().x).toBe(0);
    expect(sim.cueIndex).toBe(0);
  });
});

describe('loadShow', () => {
  it('clamps targets outside axis limits and warns', () => {
    const { show: s, warnings } = loadShow({
      axes: [{ id: 'x', type: 'linear', min: 0, max: 1, vMax: 1, aMax: 1 }],
      cues: [{ id: '1', moves: [{ axis: 'x', target: 5 }] }],
    });
    expect(s.cues[0].moves[0].target).toBe(1);
    expect(warnings[0]).toMatch(/clamped/);
  });

  it('rejects unknown axis references', () => {
    expect(() => loadShow({ axes: [], cues: [{ id: '1', moves: [{ axis: 'nope', target: 1 }] }] })).toThrow(/unknown axis/);
  });

  it('jMax is optional; set, the simulator runs an S-curve', () => {
    const axis = { id: 'x', type: 'linear', min: 0, max: 10, vMax: 1, aMax: 1 };
    const cues = [{ id: '1', moves: [{ axis: 'x', target: 4 }] }];
    expect(() => loadShow({ axes: [{ ...axis, jMax: 0 }], cues })).toThrow(/jMax/);
    const trapShow = loadShow({ axes: [axis], cues }).show;
    const smoothShow = loadShow({ axes: [{ ...axis, jMax: 2 }], cues }).show;
    expect(trapShow.axes[0].jMax).toBeUndefined();
    const cue = trapShow.cues[0];
    // S-curve adds aMax/jMax = 0.5 s to a move that reaches aMax and vMax.
    expect(new Simulator(smoothShow).estimateDuration(cue)).toBeCloseTo(new Simulator(trapShow).estimateDuration(cue) + 0.5, 9);
  });
});

describe('Simulator lookahead (render between sim steps)', () => {
  it('positionsAt(ahead) matches stepping that far, without changing state', () => {
    const a = new Simulator(show);
    const b = new Simulator(show);
    a.go();
    b.go();
    for (let i = 0; i < 37; i++) a.step(0.01), b.step(0.01);
    const ahead = 0.0063;
    const peek = a.positionsAt(ahead);
    b.step(ahead);
    expect(peek.x).toBeCloseTo(b.positions().x, 12);
    expect(a.cueTime).toBeCloseTo(0.37, 12); // unchanged
    expect(a.axisStatesAt(ahead)[0].vel).toBeCloseTo(b.axisStates()[0].vel, 12);
  });

  it('is monotonic within a step and lands on the next step exactly', () => {
    const sim = new Simulator(show);
    sim.go();
    for (let i = 0; i < 150; i++) sim.step(0.01);
    const p0 = sim.positions().x;
    const mid = sim.positionsAt(0.005).x;
    const end = sim.positionsAt(0.01).x;
    expect(mid).toBeGreaterThan(p0);
    expect(end).toBeGreaterThan(mid);
    sim.step(0.01);
    expect(sim.positions().x).toBeCloseTo(end, 12);
  });

  it('clamps to the target past the end of a move', () => {
    const sim = new Simulator(show);
    sim.go();
    for (let i = 0; i < 599; i++) sim.step(0.01); // 5.99 s of a 6 s move
    const s = sim.axisStatesAt(0.05)[0];
    expect(s.pos).toBe(5);
    expect(s.vel).toBe(0);
  });

  it('picks up a delayed move that starts inside the lookahead', () => {
    const sim = new Simulator(show, { positions: { x: 5 }, cueIndex: 1 });
    sim.go();
    sim.step(0.995); // move starts at 1 s
    expect(sim.positions().x).toBe(5);
    const peek = sim.positionsAt(0.009).x;
    expect(peek).toBeLessThan(5);
    sim.step(0.009);
    expect(sim.positions().x).toBeCloseTo(peek, 12);
  });

  it('returns current positions when idle or with no lookahead', () => {
    const sim = new Simulator(show);
    expect(sim.positionsAt(0.005)).toEqual(sim.positions());
    sim.go();
    sim.step(0.5);
    expect(sim.positionsAt(0)).toEqual(sim.positions());
  });
});
