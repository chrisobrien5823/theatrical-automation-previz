import { describe, it, expect } from 'vitest';
import { TC_RATES, getRate, parseTimecode, formatTimecode, framesPerDay, framesToSeconds, secondsToFrames } from '../src/core/timecode.js';

const r25 = getRate('25');
const nd = getRate('29.97');
const df = getRate('29.97df');

describe('getRate', () => {
  it('knows the five rates and rejects anything else', () => {
    expect(Object.keys(TC_RATES).sort()).toEqual(['24', '25', '29.97', '29.97df', '30']);
    expect(getRate(25)).toBe(r25);
    expect(() => getRate('60')).toThrow(/unknown timecode rate/);
    expect(() => getRate('constructor')).toThrow(/unknown timecode rate/);
  });
});

describe('non-drop timecode', () => {
  it('parses labels to frame counts', () => {
    expect(parseTimecode('00:00:00:00', r25)).toBe(0);
    expect(parseTimecode('00:00:01:00', r25)).toBe(25);
    expect(parseTimecode('01:00:00:00', r25)).toBe(90000);
    expect(parseTimecode(' 00:01:12:05 ', r25)).toBe((72 * 25) + 5);
    expect(parseTimecode('1:00:00:00', r25)).toBe(90000);
  });

  it('rejects labels that cannot exist', () => {
    for (const bad of ['00:00:00:25', '24:00:00:00', '00:60:00:00', '00:00:60:00', '00:00:00', '1:2:3:4', 'abc', '']) {
      expect(parseTimecode(bad, r25), bad).toBeNull();
    }
  });

  it('formats and wraps at 24 hours', () => {
    expect(formatTimecode(0, r25)).toBe('00:00:00:00');
    expect(formatTimecode(90000 + 72 * 25 + 5, r25)).toBe('01:01:12:05');
    expect(formatTimecode(framesPerDay(r25), r25)).toBe('00:00:00:00');
    expect(formatTimecode(-1, r25)).toBe('23:59:59:24');
  });

  it('29.97 non-drop labels run 3.6 s slow per hour of clock time', () => {
    const hour = parseTimecode('01:00:00:00', nd);
    expect(hour).toBe(108000);
    expect(framesToSeconds(hour, nd)).toBeCloseTo(3603.6, 6);
  });
});

describe('29.97 drop-frame timecode', () => {
  it('skips :00 and :01 at each minute except every tenth', () => {
    expect(parseTimecode('00:00:59;29', df)).toBe(1799);
    expect(parseTimecode('00:01:00;02', df)).toBe(1800);
    expect(parseTimecode('00:01:00;00', df)).toBeNull();
    expect(parseTimecode('00:01:00;01', df)).toBeNull();
    expect(parseTimecode('00:10:00;00', df)).toBe(17982);
    expect(formatTimecode(1799, df)).toBe('00:00:59;29');
    expect(formatTimecode(1800, df)).toBe('00:01:00;02');
    expect(formatTimecode(17982, df)).toBe('00:10:00;00');
  });

  it('keeps the label within a few milliseconds of clock time over an hour', () => {
    const hour = parseTimecode('01:00:00;00', df);
    expect(hour).toBe(107892);
    expect(Math.abs(framesToSeconds(hour, df) - 3600)).toBeLessThan(0.005);
  });

  it('round-trips every frame of the first 21 minutes with no repeated label', () => {
    const seen = new Set();
    for (let n = 0; n < 21 * 1800; n++) {
      const label = formatTimecode(n, df);
      expect(seen.has(label)).toBe(false);
      seen.add(label);
      if (parseTimecode(label, df) !== n) throw new Error(`frame ${n} -> ${label} -> ${parseTimecode(label, df)}`);
    }
  });

  it('wraps at 24 hours', () => {
    expect(framesPerDay(df)).toBe(2589408);
    expect(formatTimecode(framesPerDay(df) - 1, df)).toBe('23:59:59;29');
    expect(formatTimecode(framesPerDay(df), df)).toBe('00:00:00;00');
  });
});

describe('seconds <-> frames', () => {
  it('a frame starts at its own timestamp', () => {
    expect(secondsToFrames(1, r25)).toBe(25);
    expect(secondsToFrames(0.999, r25)).toBe(24);
    expect(secondsToFrames(0, df)).toBe(0);
  });

  it('round-trips at 29.97 despite floating point', () => {
    for (let n = 0; n < 200000; n += 7) {
      if (secondsToFrames(framesToSeconds(n, df), df) !== n) throw new Error(`frame ${n}`);
    }
  });
});
