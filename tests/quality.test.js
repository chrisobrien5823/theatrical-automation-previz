import { describe, it, expect } from 'vitest';
import { QUALITY_LEVELS, createQualityGovernor, parseQualityParam } from '../src/core/quality.js';

// Feed `frames` frames of `ms` each; return every level change, in order.
function run(gov, ms, frames) {
  const changes = [];
  for (let i = 0; i < frames; i++) {
    const to = gov.sample(typeof ms === 'function' ? ms(i) : ms);
    if (to != null) changes.push(to);
  }
  return changes;
}

const opts = { windowSize: 10, settleFrames: 2, upgradeAfter: 3 };

describe('createQualityGovernor', () => {
  it('leaves quality alone while frames keep up', () => {
    const gov = createQualityGovernor(opts);
    expect(run(gov, 16.7, 500)).toEqual([]);
    expect(run(gov, 8.3, 500)).toEqual([]); // 120 Hz phone
    expect(gov.level).toBe(0);
  });

  it('steps down one level at a time while frames run long, and helps', () => {
    // Frame time falls as quality drops: 40 ms at high, then 30, then 22, then 15.
    const cost = [40, 30, 22, 15];
    const gov = createQualityGovernor(opts);
    for (let i = 0; i < 200; i++) gov.sample(cost[gov.level]);
    expect(gov.level).toBe(3);
    expect(gov.locked).toBe(false);
  });

  it('ignores single hitches: decisions use the median of a window', () => {
    const gov = createQualityGovernor(opts);
    // One 200 ms stall in every 10 frames (e.g. an end-of-cue job) is not slow rendering.
    expect(run(gov, (i) => (i % 10 === 3 ? 200 : 16.7), 500)).toEqual([]);
  });

  it('ignores gaps from a hidden tab', () => {
    const gov = createQualityGovernor(opts);
    expect(run(gov, 5000, 50)).toEqual([]);
    expect(run(gov, 0, 50)).toEqual([]);
    expect(gov.level).toBe(0);
  });

  it('goes back to the better level when dropping did not make frames faster', () => {
    // A 30 Hz cap (iOS Low Power Mode): every level gives 33 ms frames.
    const gov = createQualityGovernor(opts);
    expect(run(gov, 33.3, 500)).toEqual([1, 0]);
    expect(gov.locked).toBe(true);
    expect(gov.level).toBe(0);
  });

  it('tries a level up after a run of good windows', () => {
    const gov = createQualityGovernor({ ...opts, level: 2 });
    // settle frames are only skipped after a change, so 3 good windows = 30 frames here.
    expect(run(gov, 16.7, 30)).toEqual([1]);
    expect(run(gov, 16.7, 2 + 30)).toEqual([0]);
  });

  it('waits longer before each retry of a level that did not fit', () => {
    // Fits at level 1 (16 ms) but not at level 0 (25 ms).
    const cost = [25, 16, 15, 14];
    const gov = createQualityGovernor({ ...opts, level: 1, maxUpgradeAfter: 40 });
    const ups = [];
    let goodRun = 0;
    for (let i = 0; i < 3000; i++) {
      const before = gov.level;
      gov.sample(cost[gov.level]);
      if (before === 1) goodRun++;
      if (before === 1 && gov.level === 0) {
        ups.push(goodRun);
        goodRun = 0;
      }
    }
    // Waits double each time (3, 6, 12, 24 good windows) until the cap of 40.
    expect(ups.length).toBeGreaterThan(4);
    for (let k = 1; k < 4; k++) expect(ups[k]).toBeGreaterThan(ups[k - 1]);
    for (let k = 4; k < ups.length; k++) expect(ups[k]).toBe(ups[4]);
  });

  it('never goes past the lowest level', () => {
    const cost = [60, 50, 40, 30];
    const gov = createQualityGovernor(opts);
    for (let i = 0; i < 1000; i++) gov.sample(cost[gov.level]);
    expect(gov.level).toBe(QUALITY_LEVELS.length - 1);
  });
});

describe('parseQualityParam', () => {
  it('takes level names and indexes, and treats anything else as adaptive', () => {
    expect(parseQualityParam('high')).toBe(0);
    expect(parseQualityParam('low')).toBe(2);
    expect(parseQualityParam('3')).toBe(3);
    expect(parseQualityParam('auto')).toBe(null);
    expect(parseQualityParam(null)).toBe(null);
    expect(parseQualityParam('9')).toBe(null);
    expect(parseQualityParam('1.5')).toBe(null);
  });
});

describe('QUALITY_LEVELS', () => {
  it('only ever gets cheaper going down the list', () => {
    for (let i = 1; i < QUALITY_LEVELS.length; i++) {
      const a = QUALITY_LEVELS[i - 1];
      const b = QUALITY_LEVELS[i];
      expect(b.maxPixelRatio).toBeLessThanOrEqual(a.maxPixelRatio);
      expect(!b.shadows || a.shadows).toBe(true);
      expect(b.maxPixelRatio < a.maxPixelRatio || (a.shadows && !b.shadows)).toBe(true);
    }
  });
});
