// SMPTE timecode: labels ("01:00:12:05") <-> frame counts <-> seconds, including 29.97 drop-frame.
//
// A frame count is the number of frames since 00:00:00:00. Labels always count at the nominal
// rate (30 for 29.97); drop-frame skips labels :00 and :01 at the start of every minute except
// each tenth, so the label stays close to clock time. Seconds are real time (frames / fps).

export const TC_RATES = {
  '24': { id: '24', fps: 24, nominal: 24, drop: false },
  '25': { id: '25', fps: 25, nominal: 25, drop: false },
  '29.97': { id: '29.97', fps: 30000 / 1001, nominal: 30, drop: false },
  '29.97df': { id: '29.97df', fps: 30000 / 1001, nominal: 30, drop: true },
  '30': { id: '30', fps: 30, nominal: 30, drop: false },
};

// Drop-frame constants at a nominal 30: a ten-minute block holds 17982 frames (18 labels dropped),
// a dropped minute holds 1798.
const DF_PER_10MIN = 17982;
const DF_PER_MIN = 1798;

export function getRate(id) {
  const rate = Object.hasOwn(TC_RATES, String(id)) ? TC_RATES[String(id)] : null;
  if (!rate) throw new Error(`unknown timecode rate "${id}" (use ${Object.keys(TC_RATES).join(', ')})`);
  return rate;
}

/** Frames in 24 hours: timecode wraps here, like a real generator. */
export function framesPerDay(rate) {
  return rate.drop ? 24 * 6 * DF_PER_10MIN : 24 * 3600 * rate.nominal;
}

const LABEL = /^(\d{1,2}):(\d{2}):(\d{2})[:;.](\d{2})$/;

/** "HH:MM:SS:FF" (or ";" before the frames) -> frame count, or null if the label can't exist at this rate. */
export function parseTimecode(text, rate) {
  const m = LABEL.exec(String(text).trim());
  if (!m) return null;
  const [h, min, s, f] = m.slice(1).map(Number);
  if (h > 23 || min > 59 || s > 59 || f >= rate.nominal) return null;
  if (rate.drop && s === 0 && f < 2 && min % 10 !== 0) return null; // a dropped label
  const totalMinutes = h * 60 + min;
  const nominal = (totalMinutes * 60 + s) * rate.nominal + f;
  return rate.drop ? nominal - 2 * (totalMinutes - Math.floor(totalMinutes / 10)) : nominal;
}

/** Frame count -> "HH:MM:SS:FF" (";" before the frames for drop-frame). Wraps at 24 h. */
export function formatTimecode(frames, rate) {
  const day = framesPerDay(rate);
  let n = ((Math.floor(frames) % day) + day) % day;
  if (rate.drop) {
    // Add back the labels skipped so far, then read the label as plain 30 fps.
    const tens = Math.floor(n / DF_PER_10MIN);
    const rem = n % DF_PER_10MIN;
    n += 18 * tens + (rem < 2 ? 0 : 2 * Math.floor((rem - 2) / DF_PER_MIN));
  }
  const fps = rate.nominal;
  const f = n % fps;
  const s = Math.floor(n / fps) % 60;
  const min = Math.floor(n / (fps * 60)) % 60;
  const h = Math.floor(n / (fps * 3600));
  const two = (v) => String(v).padStart(2, '0');
  return `${two(h)}:${two(min)}:${two(s)}${rate.drop ? ';' : ':'}${two(f)}`;
}

export function framesToSeconds(frames, rate) {
  return frames / rate.fps;
}

/** The frame showing at this many seconds (a frame starts at its own timestamp). */
export function secondsToFrames(seconds, rate) {
  return Math.floor(seconds * rate.fps + 1e-6);
}
