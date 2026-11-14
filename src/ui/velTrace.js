// Velocity trace: the last few seconds of one axis's velocity, for the sparkline on the Axes tab.
// Pure data and geometry (no DOM), so the sampling and the path are unit-tested.
//
// Time is the show clock the caller passes in, which only advances while a cue runs. A stage at
// rest therefore adds no samples and the trace holds the shape of the last move instead of
// scrolling a flat line; the panel costs no DOM writes until the next GO.

export const TRACE_WINDOW = 6; // s of show time across the full width
export const TRACE_STEP = 0.05; // s between kept samples (20 per second is plenty for a 300 px line)

/**
 * A rolling buffer of { t, v } samples. Kept samples are at least `step` apart; the newest sample
 * is always the latest value pushed (it is overwritten until `step` has passed), so the line ends
 * exactly at the live velocity, including the final zero when a cue stops between two steps.
 */
export function createTrace({ window = TRACE_WINDOW, step = TRACE_STEP } = {}) {
  let samples = [];

  /** Add a sample. Returns true if the trace changed (so the caller knows to redraw). */
  function push(t, v) {
    const n = samples.length;
    const lastT = n ? samples[n - 1].t : -Infinity;
    if (t < lastT) samples = []; // the clock went backwards (reset): start over
    else if (t === lastT) {
      // Same moment (the clock is paused): only the value can change.
      if (samples[n - 1].v === v) return false;
      samples[n - 1] = { t, v };
      return true;
    }

    const m = samples.length;
    // The newest sample is provisional: it is replaced until it sits a full step after the one
    // before it, then kept, and the next push starts a new provisional tail. (1e-9: float clock.)
    if (m >= 2 && samples[m - 1].t - samples[m - 2].t < step - 1e-9) samples[m - 1] = { t, v };
    else samples.push({ t, v });

    // Drop samples that have scrolled off the left edge, keeping one so the line still starts at x = 0.
    const cut = t - window;
    let drop = 0;
    while (drop + 1 < samples.length && samples[drop + 1].t <= cut) drop++;
    if (drop) samples.splice(0, drop);
    return true;
  }

  return {
    push,
    clear: () => (samples = []),
    get samples() {
      return samples;
    },
    window,
  };
}

/**
 * SVG path for a trace in a w × h box. Zero velocity is the centre line; ±vMax reaches `pad` from the
 * top / bottom edge (positive up). The right edge is `now`, the left edge `now - window`.
 * Coordinates are rounded to 0.1 so an unchanged trace gives an identical string.
 */
export function tracePath(samples, now, window, vMax, w, h, pad = 2) {
  if (!samples.length || !(vMax > 0)) return '';
  const half = h / 2;
  const reach = half - pad;
  const t0 = now - window;
  const r = (x) => Math.round(x * 10) / 10;
  let d = '';
  for (let i = 0; i < samples.length; i++) {
    const { t, v } = samples[i];
    const x = Math.max(0, ((t - t0) / window) * w);
    const k = Math.max(-1, Math.min(1, v / vMax)); // a stop ramp can't exceed vMax, but stay in the box
    d += `${i ? 'L' : 'M'}${r(x)} ${r(half - k * reach)}`;
  }
  return d;
}
