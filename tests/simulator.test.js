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
});
