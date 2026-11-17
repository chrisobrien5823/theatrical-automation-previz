// Operator training: scripted faults the Simulator can inject into a cue.
//
// A fault list is plain data, so a training scenario can live in JSON next to the show:
//   { type: 'stall',     cue: 'Q3', axis: 'revolve', at: 2.5 }   drive trips: the axis brakes hard and stays put
//   { type: 'overshoot', cue: 'Q2', axis: 'lift', amount: 0.15 } the axis runs past its target, then creeps back
//   { type: 'estop',     cue: 'Q4', at: 1.0 }                    the e-stop chain opens: every axis brakes hard
// `cue` is a cue id; `at` is seconds into that cue; `amount` is in the axis's units (m or deg) past the target.
// Each fault fires once per arming (RESET re-arms the scenario). Pure data + checks: no Three.js, no DOM.

export const FAULT_TYPES = ['stall', 'overshoot', 'estop'];

/** A drive trip or an e-stop brakes harder than a controlled STOP: this many times the axis's aMax. */
export const STALL_DECEL_FACTOR = 4;
export const ESTOP_DECEL_FACTOR = 3;

/** Overshoot with no `amount`: this fraction of the move's distance past the target. */
export const DEFAULT_OVERSHOOT_FRACTION = 0.05;

/**
 * Check and normalize a fault list against a loaded show.
 * @returns {{ faults: object[], errors: string[] }} faults with defaults filled in; errors for anything unusable
 */
export function normalizeFaults(list, show) {
  const errors = [];
  const faults = [];
  if (list == null) return { faults, errors };
  if (!Array.isArray(list)) return { faults, errors: ['faults must be an array'] };
  const cueIds = new Set(show.cues.map((c) => c.id));
  const axisIds = new Set(show.axes.map((a) => a.id));
  list.forEach((f, i) => {
    const where = `faults[${i}]`;
    if (!f || typeof f !== 'object') return errors.push(`${where} must be an object`);
    if (!FAULT_TYPES.includes(f.type)) return errors.push(`${where}: type must be one of ${FAULT_TYPES.join(', ')}`);
    if (!cueIds.has(f.cue)) return errors.push(`${where}: no cue "${f.cue}"`);
    const needsAxis = f.type !== 'estop';
    if (needsAxis && !axisIds.has(f.axis)) return errors.push(`${where}: no axis "${f.axis}"`);
    const needsTime = f.type !== 'overshoot';
    const at = f.at ?? 0;
    if (needsTime && !(Number.isFinite(at) && at >= 0)) return errors.push(`${where}: "at" must be seconds >= 0`);
    if (f.type === 'overshoot' && f.amount !== undefined && !(Number.isFinite(f.amount) && f.amount > 0)) {
      return errors.push(`${where}: "amount" must be > 0`);
    }
    if (f.type === 'overshoot' && show.cues.find((c) => c.id === f.cue).moves.every((m) => m.axis !== f.axis)) {
      return errors.push(`${where}: cue "${f.cue}" does not move axis "${f.axis}"`);
    }
    faults.push({
      type: f.type,
      cue: f.cue,
      axis: needsAxis ? f.axis : null,
      at: needsTime ? at : null,
      amount: f.type === 'overshoot' ? f.amount ?? null : null,
    });
  });
  return { faults, errors };
}

/** Human-readable one-liner for the conflict log / HUD, e.g. "Axis stall: revolve at 2.50 s". */
export function describeFault(f) {
  if (f.type === 'estop') return `E-stop at ${f.at.toFixed(2)} s`;
  if (f.type === 'stall') return `Axis stall: ${f.axis} at ${f.at.toFixed(2)} s`;
  return `Overshoot: ${f.axis}`;
}
