import { describe, it, expect } from 'vitest';
import { Simulator } from '../src/core/simulator.js';
import { loadShow } from '../src/core/show.js';
import { normalizeFaults, describeFault, STALL_DECEL_FACTOR, ESTOP_DECEL_FACTOR } from '../src/core/faults.js';

// Two axes, vMax 1 and aMax 1: a 5 m move is 1 s accel, 4 s cruise, 1 s decel. At t = 3 s, x is
// cruising at 1 m/s at 2.5 m. Q2 starts y after a 4 s delay.
const { show } = loadShow({
  axes: [
    { id: 'x', type: 'linear', home: 0, min: -10, max: 10, vMax: 1, aMax: 1 },
    { id: 'y', type: 'linear', home: 0, min: -10, max: 10, vMax: 1, aMax: 1 },
  ],
  pieces: [],
  cues: [
    { id: 'Q1', moves: [{ axis: 'x', target: 5 }] },
    { id: 'Q2', moves: [{ axis: 'x', target: 0 }, { axis: 'y', target: 2, delay: 4 }] },
  ],
});

function arm(list) {
  const { faults, errors } = normalizeFaults(list, show);
  expect(errors).toEqual([]);
  return faults;
}

function simWith(list, opts) {
  const sim = new Simulator(show, opts);
  sim.armFaults(arm(list));
  return sim;
}

function runToRest(sim, dt = 0.01, max = 20000) {
  for (let i = 0; i < max && (sim.state === 'running' || sim.state === 'stopping'); i++) sim.step(dt);
}

describe('normalizeFaults', () => {
  it('fills defaults and keeps only the fields a type uses', () => {
    const { faults } = normalizeFaults(
      [
        { type: 'stall', cue: 'Q1', axis: 'x' },
        { type: 'estop', cue: 'Q2', axis: 'x', at: 1.5 },
        { type: 'overshoot', cue: 'Q1', axis: 'x', at: 9 },
      ],
      show,
    );
    expect(faults).toEqual([
      { type: 'stall', cue: 'Q1', axis: 'x', at: 0, amount: null },
      { type: 'estop', cue: 'Q2', axis: null, at: 1.5, amount: null },
      { type: 'overshoot', cue: 'Q1', axis: 'x', at: null, amount: null },
    ]);
  });

  it('reports unusable faults instead of arming them', () => {
    const { faults, errors } = normalizeFaults(
      [
        { type: 'fire', cue: 'Q1' },
        { type: 'stall', cue: 'Q9', axis: 'x', at: 1 },
        { type: 'stall', cue: 'Q1', axis: 'z', at: 1 },
        { type: 'estop', cue: 'Q1', at: -1 },
        { type: 'overshoot', cue: 'Q1', axis: 'y' },
        { type: 'overshoot', cue: 'Q1', axis: 'x', amount: 0 },
      ],
      show,
    );
    expect(faults).toEqual([]);
    expect(errors).toHaveLength(6);
    expect(errors[4]).toMatch(/does not move axis "y"/);
    expect(normalizeFaults(undefined, show)).toEqual({ faults: [], errors: [] });
    expect(normalizeFaults({}, show).errors).toEqual(['faults must be an array']);
  });

  it('describes a fault in one line', () => {
    expect(describeFault({ type: 'stall', axis: 'x', at: 2.5 })).toBe('Axis stall: x at 2.50 s');
    expect(describeFault({ type: 'estop', at: 1 })).toBe('E-stop at 1.00 s');
    expect(describeFault({ type: 'overshoot', axis: 'x' })).toBe('Overshoot: x');
  });
});

describe('Simulator with injected faults', () => {
  it('a stall brakes the axis hard, holds the show, and GO after clearFault finishes the cue', () => {
    const sim = simWith([{ type: 'stall', cue: 'Q1', axis: 'x', at: 3 }]);
    const events = [];
    sim.on((e) => events.push(e.type));
    sim.go();
    runToRest(sim);
    // 2.5 m at 1 m/s, braking at 4 x aMax: v^2 / 2a = 1 / 8 m further.
    expect(sim.positions().x).toBeCloseTo(2.5 + 1 / (2 * STALL_DECEL_FACTOR), 9);
    expect(sim.state).toBe('faulted');
    expect(sim.cueIndex).toBe(0);
    expect(sim.axisStates()[0].fault).toBe('stall');
    expect(events).toEqual(['cueStart', 'fault', 'faulted']);

    expect(sim.go()).toBe(false); // GO is locked out until the fault is acknowledged
    expect(sim.clearFault()).toBe(true);
    expect(sim.axisStates()[0].fault).toBe(null);
    sim.go();
    runToRest(sim);
    expect(sim.state).toBe('idle');
    expect(sim.positions().x).toBe(5); // fires once per arming: the re-run is clean
    expect(sim.cueIndex).toBe(1);
  });

  it('takes effect at its exact time, whatever the step size', () => {
    const ends = [0.01, 0.037, 0.25].map((dt) => {
      const sim = simWith([{ type: 'stall', cue: 'Q1', axis: 'x', at: 3 }]);
      sim.go();
      runToRest(sim, dt);
      return sim.positions().x;
    });
    for (const x of ends) expect(x).toBeCloseTo(2.625, 9);
  });

  it('a stalled axis drops its later moves while the other axes carry on', () => {
    const sim = simWith([{ type: 'stall', cue: 'Q2', axis: 'y', at: 1 }], { positions: { x: 5, y: 0 }, cueIndex: 1 });
    sim.go();
    runToRest(sim);
    expect(sim.positions()).toEqual({ x: 0, y: 0 }); // x finishes its move; y never starts
    expect(sim.state).toBe('faulted');
  });

  it('STOP during a stall keeps the stalled axis on its harder brake and ends faulted', () => {
    const sim = simWith([{ type: 'stall', cue: 'Q2', axis: 'x', at: 3 }], { positions: { x: 5, y: 0 }, cueIndex: 1 });
    sim.go();
    for (let i = 0; i < 301; i++) sim.step(0.01);
    sim.stop();
    runToRest(sim);
    expect(sim.positions().x).toBeCloseTo(2.5 - 1 / (2 * STALL_DECEL_FACTOR), 9);
    expect(sim.state).toBe('faulted');
  });

  it('an e-stop brakes every moving axis, cancels delayed moves, then holds', () => {
    const sim = simWith([{ type: 'estop', cue: 'Q2', at: 3 }], { positions: { x: 5, y: 0 }, cueIndex: 1 });
    const events = [];
    sim.on((e) => events.push(e.type));
    sim.go();
    for (let i = 0; i < 301; i++) sim.step(0.01);
    expect(sim.state).toBe('stopping');
    runToRest(sim);
    expect(sim.positions().x).toBeCloseTo(2.5 - 1 / (2 * ESTOP_DECEL_FACTOR), 9);
    expect(sim.positions().y).toBe(0); // its 4 s delay never came
    expect(sim.state).toBe('faulted');
    expect(sim.cueIndex).toBe(1);
    expect(events).toEqual(['cueStart', 'fault', 'faulted']);
  });

  it('an overshoot runs past the target, creeps back, and the cue still completes', () => {
    const sim = simWith([{ type: 'overshoot', cue: 'Q1', axis: 'x', amount: 0.2 }]);
    const faults = [];
    sim.on((e) => e.type === 'fault' && faults.push(e));
    sim.go();
    let peak = 0;
    let sawFault = false;
    while (sim.state === 'running') {
      sim.step(0.01);
      peak = Math.max(peak, sim.positions().x);
      sawFault ||= sim.axisStates()[0].fault === 'overshoot';
    }
    expect(peak).toBeCloseTo(5.2, 3);
    expect(sawFault).toBe(true);
    expect(faults).toHaveLength(1);
    expect(faults[0].fault.type).toBe('overshoot');
    expect(sim.positions().x).toBe(5);
    expect(sim.axisStates()[0].fault).toBe(null);
    expect(sim.state).toBe('idle');
    expect(sim.cueIndex).toBe(1);
  });

  it('an overshoot with no amount runs 5% of the move past the target', () => {
    const sim = simWith([{ type: 'overshoot', cue: 'Q1', axis: 'x' }]);
    sim.go();
    let peak = 0;
    while (sim.state === 'running') {
      sim.step(0.01);
      peak = Math.max(peak, sim.positions().x);
    }
    expect(peak).toBeCloseTo(5.25, 3);
  });

  it('RESET re-arms the scenario', () => {
    const sim = simWith([{ type: 'stall', cue: 'Q1', axis: 'x', at: 3 }]);
    sim.go();
    runToRest(sim);
    sim.reset();
    expect(sim.state).toBe('idle');
    sim.go();
    runToRest(sim);
    expect(sim.state).toBe('faulted');
    expect(sim.positions().x).toBeCloseTo(2.625, 9);
  });

  it('a fault armed for another cue leaves this one alone', () => {
    const sim = simWith([{ type: 'estop', cue: 'Q2', at: 0.5 }]);
    sim.go();
    runToRest(sim);
    expect(sim.state).toBe('idle');
    expect(sim.positions().x).toBe(5);
  });
});
