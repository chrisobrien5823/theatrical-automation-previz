// Motion profiles for a single axis. Pure math, no rendering.
//
// planMove() returns a profile object:
//   { duration, distance, vPeak, shape, sample(t) -> { pos, vel, acc } }
// t is seconds since the move started; it is clamped to [0, duration].

const EPS = 1e-9;

/**
 * Trapezoidal (or triangular, if the move is too short to reach vMax) point-to-point move
 * starting and ending at rest.
 */
export function planMove(start, target, { vMax, aMax }) {
  if (!(vMax > 0) || !(aMax > 0)) throw new Error('planMove: vMax and aMax must be > 0');

  const dist = Math.abs(target - start);
  const dir = target >= start ? 1 : -1;

  if (dist < EPS) {
    return holdProfile(target);
  }

  let tAcc = vMax / aMax;
  let dAcc = 0.5 * aMax * tAcc * tAcc;
  let vPeak = vMax;
  let tCruise;
  let shape;

  if (2 * dAcc >= dist) {
    // Triangular: never reaches vMax.
    vPeak = Math.sqrt(dist * aMax);
    tAcc = vPeak / aMax;
    dAcc = dist / 2;
    tCruise = 0;
    shape = 'triangle';
  } else {
    tCruise = (dist - 2 * dAcc) / vMax;
    shape = 'trapezoid';
  }

  const duration = 2 * tAcc + tCruise;
  const tDec = tAcc + tCruise; // time deceleration begins

  function sample(t) {
    if (t <= 0) return { pos: start, vel: 0, acc: 0 };
    if (t >= duration) return { pos: target, vel: 0, acc: 0 };
    let s, v, a;
    if (t < tAcc) {
      s = 0.5 * aMax * t * t;
      v = aMax * t;
      a = aMax;
    } else if (t < tDec) {
      const u = t - tAcc;
      s = dAcc + vPeak * u;
      v = vPeak;
      a = 0;
    } else {
      const u = t - tDec;
      s = dAcc + vPeak * tCruise + vPeak * u - 0.5 * aMax * u * u;
      v = vPeak - aMax * u;
      a = -aMax;
    }
    return { pos: start + dir * s, vel: dir * v, acc: dir * a };
  }

  return { duration, distance: dist, vPeak, shape, start, target, sample };
}

/**
 * Controlled stop: decelerate from the current velocity to rest at aMax.
 * Used for STOP (an e-stop style ramp rather than an instant halt).
 */
export function planStop(pos, vel, { aMax }) {
  if (Math.abs(vel) < EPS) return holdProfile(pos);
  const dir = vel > 0 ? 1 : -1;
  const speed = Math.abs(vel);
  const duration = speed / aMax;
  const target = pos + dir * (speed * speed) / (2 * aMax);

  function sample(t) {
    if (t <= 0) return { pos, vel, acc: 0 };
    if (t >= duration) return { pos: target, vel: 0, acc: 0 };
    return {
      pos: pos + vel * t - 0.5 * dir * aMax * t * t,
      vel: vel - dir * aMax * t,
      acc: -dir * aMax,
    };
  }

  return { duration, distance: Math.abs(target - pos), vPeak: speed, shape: 'stop', start: pos, target, sample };
}

function holdProfile(pos) {
  return {
    duration: 0,
    distance: 0,
    vPeak: 0,
    shape: 'hold',
    start: pos,
    target: pos,
    sample: () => ({ pos, vel: 0, acc: 0 }),
  };
}
