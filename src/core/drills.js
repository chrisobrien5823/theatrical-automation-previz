// Operator training drills: deal one surprise fault for a run-through of the show.
//
// The operator picks a kind (any / stall / overshoot / estop); pickDrill() chooses a cue and an axis
// at random and a moment while that axis is actually moving, so the fault always lands mid-move.
// The result is one normalized fault (see faults.js) for Simulator.armFaults(). Pure: no Three.js,
// no DOM; pass `random` (e.g. seededRandom(42)) to make a pick repeatable in tests.

import { planMove } from './profile.js';
import { FAULT_TYPES, normalizeFaults, DEFAULT_OVERSHOOT_FRACTION } from './faults.js';

export const DRILL_KINDS = ['any', ...FAULT_TYPES];

/** Moves shorter than this (s) are too quick to interrupt in a way an operator would notice. */
export const MIN_DRILL_MOVE = 0.3;

/** A stall or e-stop lands this far through the chosen move (fractions of its duration). */
export const DRILL_WINDOW = [0.15, 0.7];

/** Small, fast, repeatable PRNG (mulberry32): returns a function giving floats in [0, 1). */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Every move in the show that could carry a drill: long enough to interrupt.
 * @param startPositions optional array: axis positions before each cue (e.g. a preflight chain);
 *                       missing entries fall back to the axes' home positions
 * @returns {{ cue, axis, start, duration, distance, headroom }[]} start = the move's delay in its cue (s);
 *          headroom = room past the target before the axis's soft limit (axis units)
 */
export function drillCandidates(show, startPositions = []) {
  const defs = new Map(show.axes.map((a) => [a.id, a]));
  const home = Object.fromEntries(show.axes.map((a) => [a.id, a.home]));
  const out = [];
  show.cues.forEach((cue, i) => {
    const pos = { ...home, ...startPositions[i] };
    for (const m of [...cue.moves].sort((a, b) => a.delay - b.delay)) {
      const def = defs.get(m.axis);
      const from = pos[m.axis];
      pos[m.axis] = m.target;
      const p = planMove(from, m.target, { vMax: m.vMax ?? def.vMax, aMax: def.aMax, jMax: def.jMax });
      if (p.duration < MIN_DRILL_MOVE) continue;
      const up = m.target >= from;
      const headroom = up ? (def.max ?? Infinity) - m.target : m.target - (def.min ?? -Infinity);
      out.push({ cue: cue.id, axis: m.axis, start: m.delay, duration: p.duration, distance: Math.abs(m.target - from), headroom });
    }
  });
  return out;
}

/**
 * Deal one fault of the given kind, or null if the show has no move a drill can land on.
 * An overshoot never runs an axis past its soft limit: moves that end at a limit are skipped for it.
 */
export function pickDrill(show, { kind = 'any', startPositions = [], random = Math.random } = {}) {
  if (!DRILL_KINDS.includes(kind)) throw new Error(`pickDrill: kind must be one of ${DRILL_KINDS.join(', ')}`);
  const all = drillCandidates(show, startPositions);
  const pickOne = (list) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];
  // Overshoot needs a move with room past its target; if there is none, an "any" drill picks again.
  const roomy = all.filter((m) => m.headroom > 1e-6);
  const types = kind === 'any' ? FAULT_TYPES.filter((t) => (t === 'overshoot' ? roomy.length : all.length)) : [kind];
  if (!types.length) return null;
  const type = pickOne(types);
  const pool = type === 'overshoot' ? roomy : all;
  if (!pool.length) return null;
  const m = pickOne(pool);

  let raw;
  if (type === 'overshoot') {
    const amount = Math.min(m.distance * DEFAULT_OVERSHOOT_FRACTION, m.headroom);
    raw = { type, cue: m.cue, axis: m.axis, amount };
  } else {
    const [lo, hi] = DRILL_WINDOW;
    const at = Math.round((m.start + m.duration * (lo + random() * (hi - lo))) * 100) / 100;
    raw = type === 'estop' ? { type, cue: m.cue, at } : { type, cue: m.cue, axis: m.axis, at };
  }
  return normalizeFaults([raw], show).faults[0] ?? null;
}
