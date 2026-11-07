// Motion profiles for a single axis. Pure math, no rendering.
//
// planMove() returns a profile object:
//   { duration, distance, vPeak, shape, sample(t) -> { pos, vel, acc } }
// t is seconds since the move started; it is clamped to [0, duration].

const EPS = 1e-9;

/**
 * Point-to-point move starting and ending at rest.
 *
 * Without jMax (or with jMax = Infinity): trapezoidal, or triangular if the move is too short
 * to reach vMax. Acceleration switches instantly between +aMax, 0 and -aMax.
 *
 * With a finite jMax > 0: jerk-limited S-curve. Acceleration ramps at jMax instead of jumping,
 * so the motion eases in and out. Same vMax / aMax limits; the move takes a little longer.
 */
export function planMove(start, target, { vMax, aMax, jMax }) {
  if (!(vMax > 0) || !(aMax > 0)) throw new Error('planMove: vMax and aMax must be > 0');
  if (jMax !== undefined && jMax !== null && !(jMax > 0)) throw new Error('planMove: jMax must be > 0');

  const dist = Math.abs(target - start);
  const dir = target >= start ? 1 : -1;

  if (dist < EPS) {
    return holdProfile(target);
  }

  if (jMax > 0 && Number.isFinite(jMax)) return planSCurve(start, target, dist, dir, vMax, aMax, jMax);

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
 * Time and distance to go from rest to speed v (or v back to rest; it is symmetric) with
 * acceleration capped at aMax and jerk capped at jMax.
 *   tj: each jerk ramp (acceleration rising or falling)
 *   ta: time held at aMax (0 if v is too low to ever reach aMax)
 */
function rampTo(v, aMax, jMax) {
  let tj, ta;
  if (v * jMax >= aMax * aMax) {
    tj = aMax / jMax;
    ta = v / aMax - tj;
  } else {
    tj = Math.sqrt(v / jMax);
    ta = 0;
  }
  const time = 2 * tj + ta;
  return { tj, ta, time, dist: (v * time) / 2 }; // velocity curve is point-symmetric, so mean speed = v/2
}

/**
 * Jerk-limited (S-curve) move: up to 7 phases, each with constant jerk.
 *   jerk +J, 0, -J  (accelerate to vPeak) | 0 (cruise) | -J, 0, +J (decelerate to rest)
 * Short moves drop the cruise and/or the constant-acceleration phases.
 */
function planSCurve(start, target, dist, dir, vMax, aMax, jMax) {
  let vPeak = vMax;
  let ramp = rampTo(vMax, aMax, jMax);
  let tCruise;
  if (2 * ramp.dist <= dist) {
    tCruise = (dist - 2 * ramp.dist) / vMax;
  } else {
    // Too short to reach vMax: find the peak speed whose up + down ramps cover exactly dist.
    // Ramp distance rises monotonically with v, so bisection is simple and always converges.
    let lo = 0;
    let hi = vMax;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (2 * rampTo(mid, aMax, jMax).dist > dist) hi = mid;
      else lo = mid;
    }
    vPeak = lo;
    ramp = rampTo(vPeak, aMax, jMax);
    tCruise = 0;
  }

  const { tj, ta } = ramp;
  const phases = [
    [tj, jMax],
    [ta, 0],
    [tj, -jMax],
    [tCruise, 0],
    [tj, -jMax],
    [ta, 0],
    [tj, jMax],
  ].filter(([dt]) => dt > 0);

  // State (t0, s, v, a) at the start of each phase, integrated once up front.
  const segs = [];
  let t0 = 0, s = 0, v = 0, a = 0;
  for (const [dt, j] of phases) {
    segs.push({ t0, dt, j, s, v, a });
    s += v * dt + (a * dt * dt) / 2 + (j * dt * dt * dt) / 6;
    v += a * dt + (j * dt * dt) / 2;
    a += j * dt;
    t0 += dt;
  }
  const duration = t0;

  function sample(t) {
    if (t <= 0) return { pos: start, vel: 0, acc: 0 };
    if (t >= duration) return { pos: target, vel: 0, acc: 0 };
    let k = segs.length - 1;
    while (k > 0 && t < segs[k].t0) k--;
    const g = segs[k];
    const u = t - g.t0;
    const ss = g.s + g.v * u + (g.a * u * u) / 2 + (g.j * u * u * u) / 6;
    const vv = g.v + g.a * u + (g.j * u * u) / 2;
    const aa = g.a + g.j * u;
    // Clamp tiny float overshoot so position never strays outside [start, target].
    return { pos: start + dir * Math.min(dist, Math.max(0, ss)), vel: dir * vv, acc: dir * aa };
  }

  return { duration, distance: dist, vPeak, shape: 'scurve', start, target, sample };
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
