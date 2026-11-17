import { describe, it, expect } from 'vitest';
import demo from '../src/shows/demo.json';
import { loadShow } from '../src/core/show.js';
import { Simulator } from '../src/core/simulator.js';
import { preflightShow } from '../src/core/preflight.js';
import { buildPairs, checkClearance } from '../src/core/clearance.js';
import { createAttract, attractCueIndex, parseBoothParam, BOOTH_IDLE_DEFAULT } from '../src/core/attract.js';

const STEP = 0.01;

describe('parseBoothParam', () => {
  it('is off unless asked for', () => {
    expect(parseBoothParam(null)).toBe(null);
    expect(parseBoothParam('off')).toBe(null);
    expect(parseBoothParam('0')).toBe(null);
  });
  it('defaults to 30 s and clamps a given delay', () => {
    expect(parseBoothParam('')).toBe(BOOTH_IDLE_DEFAULT);
    expect(parseBoothParam('on')).toBe(BOOTH_IDLE_DEFAULT);
    expect(parseBoothParam('20')).toBe(20);
    expect(parseBoothParam('1')).toBe(5);
    expect(parseBoothParam('9999')).toBe(600);
    expect(parseBoothParam('soon')).toBe(BOOTH_IDLE_DEFAULT);
  });
});

describe('attractCueIndex', () => {
  it('picks Q3, the demo show’s near-miss', () => {
    const { show } = loadShow(demo);
    const home = Object.fromEntries(show.axes.map((a) => [a.id, a.home]));
    const i = attractCueIndex(preflightShow(show, home, 0));
    expect(show.cues[i].id).toBe('3');
  });
  it('is -1 when nothing is flagged', () => {
    expect(attractCueIndex([{ conflicts: [] }, { conflicts: [] }])).toBe(-1);
    expect(attractCueIndex([])).toBe(-1);
  });
});

describe('createAttract', () => {
  const idle = { simIdle: true, eligible: true };

  it('waits out the idle delay, then asks for a replay once', () => {
    const a = createAttract({ idleDelay: 1, hold: 0.5 });
    const actions = [];
    for (let k = 0; k < 99; k++) actions.push(a.tick(0.01, idle));
    expect(actions.every((x) => x === null)).toBe(true);
    expect(a.tick(0.02, idle)).toBe('replay');
    expect(a.state).toBe('running');
  });

  it('a cue the user is running does not count as idle', () => {
    const a = createAttract({ idleDelay: 1 });
    a.tick(0.9, idle);
    a.tick(5, { simIdle: false, eligible: true });
    expect(a.tick(0.5, idle)).toBe(null);
    expect(a.tick(0.6, idle)).toBe('replay');
  });

  it('runs, holds on the result, then replays again', () => {
    const a = createAttract({ idleDelay: 1, hold: 2 });
    expect(a.tick(1, idle)).toBe('replay');
    expect(a.tick(3, { simIdle: false, eligible: true })).toBe(null); // the cue moves
    expect(a.tick(0.01, idle)).toBe(null); // done: hold
    expect(a.state).toBe('holding');
    expect(a.tick(1.5, idle)).toBe(null);
    expect(a.tick(0.6, idle)).toBe('replay');
  });

  it('any input hands the stage back and restarts the idle count', () => {
    const a = createAttract({ idleDelay: 1 });
    expect(a.poke()).toBe(false); // input while waiting: not active, just restarts the count
    a.tick(1, idle);
    expect(a.poke()).toBe(true);
    expect(a.state).toBe('waiting');
    expect(a.tick(0.5, idle)).toBe(null);
  });

  it('stops (once) when the app leaves a state it may drive', () => {
    const a = createAttract({ idleDelay: 1 });
    a.tick(1, idle);
    expect(a.tick(0.01, { simIdle: false, eligible: false })).toBe('end');
    expect(a.tick(0.01, { simIdle: true, eligible: false })).toBe(null);
    expect(a.state).toBe('waiting');
  });

  it('drives the demo show through two Q3 near-misses (what main.js does on each replay)', () => {
    const { show } = loadShow(demo);
    const pairs = buildPairs(show);
    const home = Object.fromEntries(show.axes.map((a) => [a.id, a.home]));
    const chain = preflightShow(show, home, 0, { pairs });
    const target = attractCueIndex(chain);
    const before = target === 0 ? home : chain[target - 1].endPositions;
    const sim = new Simulator(show);
    const a = createAttract({ idleDelay: 0.5, hold: 1 });

    let replays = 0;
    let flaggedSteps = 0;
    for (let t = 0; t < 120 && replays < 3; t += STEP) {
      const action = a.tick(STEP, { simIdle: sim.state === 'idle', eligible: true });
      if (action === 'replay') {
        replays++;
        sim.load(before, target);
        expect(sim.go()).toBe(true);
        expect(sim.activeCue.id).toBe('3');
      }
      if (sim.state !== 'idle') {
        sim.step(STEP);
        if (checkClearance(show, sim.positions(), pairs).length) flaggedSteps++;
      }
    }
    expect(replays).toBe(3);
    expect(flaggedSteps).toBeGreaterThan(0);
  });
});
