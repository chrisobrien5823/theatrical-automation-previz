// Cue timeline scrubbing: the stage pose at any moment of a cue, without running it live.
//
// A scrubber drives its own private Simulator in the same fixed 10 ms steps as live playback and
// the preflight sweep, then samples the motion profiles for the leftover fraction of a step (the
// same way the render loop draws between steps). So the pose at t is exactly what a live run of
// that cue would draw at t, and the clearance check on it matches the preflight windows.

import { Simulator } from './simulator.js';
import { PREFLIGHT_DT } from './preflight.js';

const EPS = 1e-9;
const MAX_CUE_SECONDS = 600; // same cap as the preflight sweep

/**
 * @param show       normalized show from loadShow()
 * @param positions  axis positions the cue starts from (the stage as it stands before GO)
 * @param cueIndex   index of the cue to scrub
 * @returns {{ duration, poseAt(t), statesAt(t) }} or null if there is no such cue
 */
export function createCueScrubber(show, positions, cueIndex, { dt = PREFLIGHT_DT } = {}) {
  const cue = show.cues[cueIndex];
  if (!cue) return null;
  const start = { ...positions };
  let sim;
  let end = null; // { positions, states } once the cue has completed

  function restart() {
    sim = new Simulator(show, { positions: start, cueIndex });
    end = null;
    // Capture the end pose at the moment the cue completes, before a follow cue could start moving.
    sim.on((ev) => {
      if (ev.type === 'cueComplete' && ev.cue === cue) end = { positions: sim.positions(), states: sim.axisStates() };
    });
    sim.go();
    if (sim.state === 'idle' && !end) end = { positions: sim.positions(), states: sim.axisStates() };
  }

  // Run once to find the length (whole steps, like preflight's duration), then rewind.
  restart();
  while (!end && sim.cueTime < MAX_CUE_SECONDS) sim.step(dt);
  if (!end) end = { positions: sim.positions(), states: sim.axisStates() }; // runaway cue: cap it like preflight
  const duration = sim.cueTime;
  restart();

  /** Step the private sim up to the last whole step at or before t; return the leftover. */
  function seek(t) {
    const target = Math.min(Math.max(0, Number(t) || 0), duration);
    if (target < sim.cueTime - EPS) restart(); // scrubbing backwards: replay from the top
    while (!end && sim.cueTime + dt <= target + EPS) sim.step(dt);
    return end ? 0 : Math.max(0, target - sim.cueTime);
  }

  return {
    cueId: cue.id,
    duration,
    /** Axis positions { axisId: pos } at cue time t (clamped to 0 … duration). */
    poseAt(t) {
      const ahead = seek(t);
      return end ? { ...end.positions } : sim.positionsAt(ahead);
    },
    /** Axis states (pos, vel, acc, moving) at cue time t, shaped like Simulator.axisStates(). */
    statesAt(t) {
      const ahead = seek(t);
      return end ? end.states.map((s) => ({ ...s })) : sim.axisStatesAt(ahead);
    },
  };
}

/**
 * Conflict windows from a preflight result, as spans along a 0 … 1 timeline for drawing.
 * Each span keeps its window's pair, minimum gap, the time of that minimum and severity.
 * A window that was a single sample still gets its true (zero-length) span; the UI decides how
 * wide to draw it.
 */
export function timelineMarks(result, duration = result?.duration) {
  if (!result || !(duration > 0)) return [];
  const frac = (t) => Math.min(1, Math.max(0, t / duration));
  return result.conflicts
    .map((w) => ({
      from: frac(w.tStart),
      to: frac(w.tEnd),
      atMin: frac(w.tMin),
      tStart: w.tStart,
      tEnd: w.tEnd,
      tMin: w.tMin,
      minGap: w.minGap,
      severity: w.severity,
      aName: w.aName,
      bName: w.bName,
    }))
    .sort((p, q) => p.from - q.from);
}
