// Preflight: run cues headless before they are taken and report every clearance violation.

import { Simulator } from './simulator.js';
import { buildPairs, checkClearance, ConflictTracker } from './clearance.js';

export const PREFLIGHT_DT = 0.01;
const MAX_CUE_SECONDS = 600;

/**
 * The sweep itself, written as generators that pause after every 10 ms step. The blocking functions
 * and the background job below all drain these, so they cannot disagree about a result.
 */
function* sweepCue(show, positions, cueIndex, { dt = PREFLIGHT_DT, pairs = buildPairs(show) } = {}) {
  const sim = new Simulator(show, { positions, cueIndex });
  const cue = show.cues[cueIndex];
  const tracker = new ConflictTracker();
  if (!sim.go()) return { cueId: cue?.id ?? null, duration: 0, endPositions: positions, conflicts: [] };

  tracker.update(checkClearance(show, sim.positions(), pairs), cue.id, 0);
  let steps = 0;
  while (sim.state !== 'idle' && steps * dt < MAX_CUE_SECONDS) {
    sim.step(dt);
    steps++;
    tracker.update(checkClearance(show, sim.positions(), pairs), cue.id, sim.cueTime);
    yield;
  }
  tracker.flush();
  return { cueId: cue.id, duration: sim.cueTime, endPositions: sim.positions(), conflicts: tracker.closed };
}

function* sweepShow(show, positions, fromIndex, opts) {
  const pairs = opts.pairs ?? buildPairs(show);
  const results = show.cues.map(() => null);
  let pos = { ...positions };
  for (let i = fromIndex; i < show.cues.length; i++) {
    const r = yield* sweepCue(show, pos, i, { ...opts, pairs });
    results[i] = r;
    pos = r.endPositions;
  }
  return results;
}

function drain(sweep) {
  let next = sweep.next();
  while (!next.done) next = sweep.next();
  return next.value;
}

/**
 * Sweep a single cue from the given axis positions.
 * Returns { cueId, duration, endPositions, conflicts: [window...] }.
 * Conflicts that already exist before the cue starts (t = 0) are included, since they
 * are still a problem during the cue.
 */
export function preflightCue(show, positions, cueIndex, opts) {
  return drain(sweepCue(show, positions, cueIndex, opts));
}

/**
 * Sweep every cue from `fromIndex` to the end of the show, in order, chaining each cue's end
 * positions into the next. Returns an array indexed like show.cues (null before fromIndex).
 */
export function preflightShow(show, positions, fromIndex = 0, opts = {}) {
  return drain(sweepShow(show, positions, fromIndex, opts));
}

/**
 * The same sweep as preflightShow, but resumable, so it can share the main thread with rendering.
 * run(hasTime) always advances at least one step, then keeps going while hasTime() is true.
 * It returns true once the sweep is finished; job.results then holds what preflightShow returns.
 */
export function createPreflightJob(show, positions, fromIndex = 0, opts = {}) {
  const sweep = sweepShow(show, positions, fromIndex, opts);
  const job = {
    done: false,
    results: null,
    run(hasTime = () => true) {
      while (!job.done) {
        const next = sweep.next();
        if (next.done) {
          job.done = true;
          job.results = next.value;
        } else if (!hasTime()) {
          break;
        }
      }
      return job.done;
    },
  };
  return job;
}
