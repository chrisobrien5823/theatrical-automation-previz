// Adaptive render quality: watch how long frames really take and step the GPU cost down
// (pixel ratio, then shadows) when a phone can't keep up, and back up when it can.
// Pure logic, no Three.js: the renderer applies whatever level this picks.

// Cheapest last. Each step cuts one cost: fewer pixels first (fill rate is what phones run
// out of), then the shadow pass, then pixels again.
export const QUALITY_LEVELS = [
  { name: 'high', maxPixelRatio: 2, shadows: true },
  { name: 'medium', maxPixelRatio: 1.5, shadows: true },
  { name: 'low', maxPixelRatio: 1.5, shadows: false },
  { name: 'lowest', maxPixelRatio: 1, shadows: false },
];

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Feed it the time between frames (ms); it answers with a new level index when quality should
 * change, otherwise null. Decisions use the median of a window of frames, so one hitch (a
 * preflight slice, garbage collection) never changes quality, only frames that run long
 * frame after frame.
 */
export function createQualityGovernor({
  level = 0,
  windowSize = 60, // frames per decision (about 1 s at 60 Hz)
  slowMs = 1000 / 50, // median above this: drop a level (below ~50 fps)
  fastMs = 1000 / 58, // median below this: a good window (steady ~60 fps or better)
  upgradeAfter = 5, // good windows in a row before trying a level up
  maxUpgradeAfter = 40, // back-off cap after failed tries
  settleFrames = 20, // frames ignored after a change (buffer resize and shader compile hitch)
  maxSampleMs = 250, // longer gaps are a hidden tab or a stall, not rendering cost
} = {}) {
  const maxLevel = QUALITY_LEVELS.length - 1;
  let samples = [];
  let settle = 0;
  let goodWindows = 0;
  let wait = upgradeAfter;
  let probing = false; // just stepped up: a slow first window means it didn't fit
  let dropCheck = null; // just stepped down: { from, median } to see if it helped
  let locked = false; // stepping down didn't help (display or CPU limit): stop stepping down

  function change(to) {
    level = to;
    settle = settleFrames;
    samples = [];
    goodWindows = 0;
    return level;
  }

  function judge(m) {
    if (dropCheck) {
      const { from, median: before } = dropCheck;
      dropCheck = null;
      // Less GPU work didn't make frames faster: the limit is elsewhere (a 30 Hz low-power
      // mode, a busy CPU). Go back to the better picture and stop lowering it.
      if (m > before * 0.9) {
        locked = true;
        return change(from);
      }
    }
    if (m > slowMs) {
      if (probing) wait = Math.min(maxUpgradeAfter, wait * 2);
      probing = false;
      if (level < maxLevel && !locked) {
        dropCheck = { from: level, median: m };
        return change(level + 1);
      }
      goodWindows = 0;
      return null;
    }
    probing = false;
    if (m < fastMs) {
      goodWindows++;
      if (level > 0 && goodWindows >= wait) {
        probing = true;
        return change(level - 1);
      }
    } else {
      goodWindows = 0;
    }
    return null;
  }

  return {
    get level() {
      return level;
    },
    get locked() {
      return locked;
    },
    sample(ms) {
      if (!(ms > 0) || ms > maxSampleMs) return null;
      if (settle > 0) {
        settle--;
        return null;
      }
      samples.push(ms);
      if (samples.length < windowSize) return null;
      const m = median(samples);
      samples = [];
      return judge(m);
    },
  };
}

/** `?quality=high|medium|low|lowest` (or 0-3) pins a level; anything else means adaptive. */
export function parseQualityParam(value) {
  if (value == null || value === '' || value === 'auto') return null;
  const byName = QUALITY_LEVELS.findIndex((q) => q.name === value);
  if (byName >= 0) return byName;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n < QUALITY_LEVELS.length ? n : null;
}
