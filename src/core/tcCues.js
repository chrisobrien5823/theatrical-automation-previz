// Timecode-triggered cues: which cue a timecode position calls, a follower that turns a running
// timecode into GO / locate actions, and a check for cues whose timecode arrives while the cue
// before them is still moving (the Simulator ignores a GO while it is running).
//
// Pure functions over a loaded show (see loadShow: `show.timecode.rate`, `cue.tc` in frames), with
// no clock of their own: the caller feeds in timecode seconds, so tests can drive them frame by frame.

import { getRate, framesToSeconds } from './timecode.js';
import { Simulator } from './simulator.js';

/** A step bigger than this (or any step backwards) is a jump: the follower re-locates instead of firing. */
export const TC_JUMP_SECONDS = 0.5;

/**
 * Cues that carry a timecode, in timecode order:
 * [{ cueIndex, cueId, frame, seconds }]. Empty when the show has no timecode rate.
 */
export function tcSchedule(show) {
  if (!show.timecode) return [];
  const rate = getRate(show.timecode.rate);
  return show.cues
    .map((c, cueIndex) => (c.tc == null ? null : { cueIndex, cueId: c.id, frame: c.tc, seconds: framesToSeconds(c.tc, rate) }))
    .filter(Boolean)
    .sort((a, b) => a.frame - b.frame || a.cueIndex - b.cueIndex);
}

/**
 * Follow a timecode clock. Call update(seconds) every frame with the incoming position:
 * - { type: 'fire', cues: [cueIndex...] }  timecode ran forward past these cues' times: GO them.
 * - { type: 'locate', cueIndex, elapsed }  first lock, a jump, or timecode ran backwards: the show
 *   belongs `elapsed` seconds into cue `cueIndex` (the last cue at or before the timecode; -1 means
 *   before the first timecode cue). The caller chases there and keeps running that cue.
 * - null                                    nothing to do (no cue crossed, or the clock is paused).
 */
export function createTcFollower(schedule, { jump = TC_JUMP_SECONDS } = {}) {
  let last = null;

  function locate(t) {
    let found = null;
    for (const e of schedule) {
      if (e.seconds > t) break;
      found = e;
    }
    return found ? { type: 'locate', cueIndex: found.cueIndex, elapsed: t - found.seconds } : { type: 'locate', cueIndex: -1, elapsed: 0 };
  }

  return {
    get locked() {
      return last !== null;
    },
    update(t) {
      if (last === null || t < last || t - last > jump) {
        last = t;
        return locate(t);
      }
      const from = last;
      last = t;
      const cues = schedule.filter((e) => e.seconds > from && e.seconds <= t).map((e) => e.cueIndex);
      return cues.length ? { type: 'fire', cues } : null;
    },
    /** Timecode stopped or dropped out: the next update re-locates. */
    reset() {
      last = null;
    },
  };
}

const EPS = 1e-6;

/**
 * How long each cue runs when the show is played in order from `positions` (default: every axis at
 * home). Each cue starts where the previous one's moves ended. Uses the Simulator's own planner, so
 * the times are exact rather than rounded to the 10 ms step.
 */
export function cueDurations(show, positions) {
  const pos = { ...(positions ?? Object.fromEntries(show.axes.map((a) => [a.id, a.home]))) };
  return show.cues.map((cue) => {
    const duration = new Simulator(show, { positions: pos }).estimateDuration(cue);
    for (const m of cue.moves) pos[m.axis] = m.target;
    return duration;
  });
}

/**
 * Timecode cues that are called while the cue before them is still running, so their GO would be
 * ignored. Times come from cueDurations (a run from the top). A cue's start is known when it has a
 * timecode or auto-follows a cue whose start is known; cues after a manual GO can't be timed, so
 * they're skipped. Returns [{ cueId, prevCueId, at, prevEnd, early }] with times in seconds.
 */
export function tcTimingIssues(show, positions) {
  if (!show.timecode) return [];
  const rate = getRate(show.timecode.rate);
  const durations = cueDurations(show, positions);
  const start = [];
  const issues = [];
  show.cues.forEach((cue, j) => {
    const prev = j > 0 ? show.cues[j - 1] : null;
    const prevEnd = prev && start[j - 1] != null ? start[j - 1] + durations[j - 1] : null;
    if (cue.tc != null) {
      start[j] = framesToSeconds(cue.tc, rate);
      if (prevEnd != null && prevEnd > start[j] + EPS) {
        issues.push({ cueId: cue.id, prevCueId: prev.id, at: start[j], prevEnd, early: prevEnd - start[j] });
      }
    } else {
      start[j] = prev?.follow ? prevEnd : null;
    }
  });
  return issues;
}
