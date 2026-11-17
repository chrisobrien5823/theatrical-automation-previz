// Cue playback state machine. Deterministic and headless: the render loop (or a test, or the
// preflight sweep) drives it by calling step(dt).
//
// States:  idle -> running -> idle            (cue completes, pointer advances)
//          running -> stopping -> idle        (STOP ramps every moving axis down; pointer stays)
//          running -> stopping -> faulted     (an injected e-stop; see armFaults)
//          running -> faulted                 (the cue ends with a stalled axis)
//          faulted -> idle                    (clearFault(); pointer stays on the faulted cue)
// GO is ignored unless idle. GO after a STOP (or a cleared fault) re-runs the cue from wherever the axes are.

import { planMove, planStop } from './profile.js';
import { STALL_DECEL_FACTOR, ESTOP_DECEL_FACTOR, DEFAULT_OVERSHOOT_FRACTION } from './faults.js';

const DONE_EPS = 1e-9;

/** Motion limits for one move: the cue may lower vMax; aMax and jMax (S-curve if set) come from the axis. */
function moveLimits(move, axisDef) {
  return { vMax: move.vMax ?? axisDef.vMax, aMax: axisDef.aMax, jMax: axisDef.jMax };
}

export class Simulator {
  /**
   * @param show normalized show from loadShow()
   * @param opts.positions optional starting axis positions (defaults to each axis's home)
   * @param opts.cueIndex  optional starting cue pointer
   */
  constructor(show, opts = {}) {
    this.show = show;
    this.axisDefs = new Map(show.axes.map((a) => [a.id, a]));
    this.listeners = [];
    this.axes = new Map();
    for (const a of show.axes) {
      this.axes.set(a.id, { pos: opts.positions?.[a.id] ?? a.home, vel: 0, acc: 0, active: null, fault: null });
    }
    this.state = 'idle';
    this.cueIndex = opts.cueIndex ?? 0;
    this.activeCue = null;
    this.cueTime = 0;
    this.cueDuration = 0;
    this.pending = [];
    // Operator training (see faults.js): the scenario as armed, what has not fired yet, the fault
    // that is holding the show, and this cue's overshoots waiting for their axis to start.
    this.faultPlan = [];
    this.armed = [];
    this.fault = null;
    this.overshoots = new Map();
  }

  /** Arm a normalized fault list (normalizeFaults). Each fault fires once; RESET re-arms them all. */
  armFaults(faults = []) {
    this.faultPlan = faults.slice();
    this.armed = faults.slice();
  }

  on(fn) {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((l) => l !== fn));
  }

  emit(type, data = {}) {
    const ev = { type, cue: this.activeCue, cueTime: this.cueTime, ...data };
    for (const l of this.listeners) l(ev);
  }

  get nextCue() {
    return this.show.cues[this.cueIndex] ?? null;
  }

  go() {
    if (this.state !== 'idle') {
      this.emit('ignored', { reason: `GO ignored: ${this.state}` });
      return false;
    }
    const cue = this.nextCue;
    if (!cue) {
      this.emit('endOfShow');
      return false;
    }
    this.activeCue = cue;
    this.cueTime = 0;
    this.pending = cue.moves.map((m) => ({ ...m })).sort((a, b) => a.delay - b.delay);
    this.cueDuration = this.estimateDuration(cue);
    this.overshoots = new Map();
    this.armed = this.armed.filter((f) => {
      if (f.type !== 'overshoot' || f.cue !== cue.id) return true;
      this.overshoots.set(f.axis, f);
      return false;
    });
    this.state = 'running';
    this.emit('cueStart');
    this.activatePending();
    return true;
  }

  stop() {
    if (this.state !== 'running') return false;
    this.pending = [];
    for (const [id, ax] of this.axes) {
      if (!ax.active || ax.fault === 'stall') continue; // a tripped drive is already braking harder
      const def = this.axisDefs.get(id);
      ax.active = { profile: planStop(ax.pos, ax.vel, def), startTime: this.cueTime };
    }
    this.state = 'stopping';
    this.emit('stopping');
    this.finishIfDone();
    return true;
  }

  /** Instantly return every axis to home and the pointer to the first cue. */
  reset() {
    for (const [id, ax] of this.axes) {
      ax.pos = this.axisDefs.get(id).home;
      ax.vel = 0;
      ax.acc = 0;
      ax.active = null;
      ax.fault = null;
    }
    this.pending = [];
    this.fault = null;
    this.overshoots = new Map();
    this.armed = this.faultPlan.slice();
    this.state = 'idle';
    this.activeCue = null;
    this.cueIndex = 0;
    this.cueTime = 0;
    this.cueDuration = 0;
    this.emit('reset');
  }

  /** Acknowledge a fault: back to idle with the pointer still on the faulted cue. Only while faulted. */
  clearFault() {
    if (this.state !== 'faulted') return false;
    for (const ax of this.axes.values()) ax.fault = null;
    this.fault = null;
    this.state = 'idle';
    this.emit('faultCleared');
    return true;
  }

  /** Snap every axis to the given positions and standby a cue (e.g. "load the state before Q3"). Only while idle. */
  load(positions, cueIndex) {
    if (this.state !== 'idle') return false;
    for (const [id, ax] of this.axes) {
      ax.pos = positions[id] ?? ax.pos;
      ax.vel = 0;
      ax.acc = 0;
      ax.active = null;
    }
    this.cueIndex = cueIndex;
    this.emit('load');
    return true;
  }

  /** Move the pointer (standby a different cue). Only while idle. */
  standby(index) {
    if (this.state !== 'idle') return false;
    if (index < 0 || index > this.show.cues.length) return false;
    this.cueIndex = index;
    this.emit('standby');
    return true;
  }

  step(dt) {
    if (this.state === 'idle' || dt <= 0) return;
    this.cueTime += dt;
    this.activatePending();
    this.fireTimedFaults();
    for (const [id, ax] of this.axes) {
      if (!ax.active) continue;
      let { profile, startTime } = ax.active;
      if (ax.active.then !== undefined && this.cueTime - startTime >= profile.duration - DONE_EPS) {
        // Overshoot: the axis has coasted past its target; creep back at a quarter speed.
        const { fault } = ax.active;
        const back = planMove(profile.target, ax.active.then, { ...ax.active.limits, vMax: ax.active.limits.vMax / 4 });
        startTime += profile.duration;
        profile = back;
        ax.active = { profile, startTime };
        ax.fault = 'overshoot';
        this.emit('fault', { fault, axis: id, time: startTime });
      }
      const s = profile.sample(this.cueTime - startTime);
      ax.pos = s.pos;
      ax.vel = s.vel;
      ax.acc = s.acc;
      if (this.cueTime - startTime >= profile.duration - DONE_EPS) {
        ax.pos = profile.target;
        ax.vel = 0;
        ax.acc = 0;
        ax.active = null;
        if (ax.fault === 'overshoot') ax.fault = null; // back in position: a warning, not a hold
      }
    }
    this.finishIfDone();
  }

  /** An axis's position and velocity at cue time t (t within the current step), from its profile. */
  stateAt(ax, t) {
    if (!ax.active) return { pos: ax.pos, vel: 0 };
    const { profile, startTime } = ax.active;
    if (t < startTime) return { pos: profile.start, vel: 0 }; // its move began later in this step
    const s = profile.sample(t - startTime);
    return { pos: s.pos, vel: s.vel };
  }

  /** Brake one axis from its state at time `at` with `factor` x its aMax. */
  brake(id, ax, at, factor) {
    const def = this.axisDefs.get(id);
    const s = this.stateAt(ax, at);
    const profile = planStop(s.pos, s.vel, { aMax: def.aMax * factor });
    ax.pos = s.pos;
    ax.vel = s.vel;
    ax.acc = 0;
    ax.active = profile.duration > 0 ? { profile, startTime: at } : null;
    if (!ax.active) ax.vel = 0;
  }

  /**
   * Fire armed stall / e-stop faults whose time has come. They take effect at their exact `at`
   * (sampled from the profiles), so the result doesn't depend on the step size. The renderer's
   * lookahead can't see a fault coming, so the drawn pose may lead the sim by under one step at
   * the instant a fault fires; clearance always uses the stepped state.
   */
  fireTimedFaults() {
    if (this.state !== 'running' || !this.armed.length) return;
    const due = this.armed
      .filter((f) => f.at !== null && f.cue === this.activeCue.id && f.at <= this.cueTime + DONE_EPS)
      .sort((a, b) => a.at - b.at);
    for (const f of due) {
      if (this.state !== 'running') break; // an e-stop already took everything down
      this.armed = this.armed.filter((x) => x !== f);
      this.fault = this.fault ?? f;
      if (f.type === 'stall') {
        const ax = this.axes.get(f.axis);
        this.brake(f.axis, ax, f.at, STALL_DECEL_FACTOR);
        ax.fault = 'stall';
        this.pending = this.pending.filter((m) => m.axis !== f.axis);
        this.overshoots.delete(f.axis);
        this.emit('fault', { fault: f, axis: f.axis, time: f.at });
      } else if (f.type === 'estop') {
        this.fault = f;
        this.pending = [];
        for (const [id, ax] of this.axes) if (ax.active && ax.fault !== 'stall') this.brake(id, ax, f.at, ESTOP_DECEL_FACTOR);
        this.state = 'stopping';
        this.emit('fault', { fault: f, axis: null, time: f.at });
      }
    }
  }

  activatePending() {
    while (this.pending.length && this.pending[0].delay <= this.cueTime + DONE_EPS) {
      const m = this.pending.shift();
      const ax = this.axes.get(m.axis);
      const def = this.axisDefs.get(m.axis);
      const limits = moveLimits(m, def);
      const over = this.overshoots.get(m.axis);
      let profile;
      if (over && Math.abs(m.target - ax.pos) > DONE_EPS) {
        this.overshoots.delete(m.axis);
        const dir = m.target >= ax.pos ? 1 : -1;
        const amount = over.amount ?? Math.abs(m.target - ax.pos) * DEFAULT_OVERSHOOT_FRACTION;
        profile = planMove(ax.pos, m.target + dir * amount, limits);
        ax.active = { profile, startTime: m.delay, then: m.target, limits, fault: over };
      } else {
        profile = planMove(ax.pos, m.target, limits);
        ax.active = { profile, startTime: m.delay };
      }
      // Sample immediately so a step that crosses the delay boundary stays in sync.
      const s = profile.sample(this.cueTime - m.delay);
      ax.pos = s.pos;
      ax.vel = s.vel;
      ax.acc = s.acc;
      if (profile.duration === 0) ax.active = null;
    }
  }

  finishIfDone() {
    if (this.pending.length) return;
    for (const ax of this.axes.values()) if (ax.active) return;
    const cue = this.activeCue;
    if (this.fault && (this.state === 'running' || this.state === 'stopping')) {
      // The cue can't be called complete: hold the show until the operator clears the fault.
      this.state = 'faulted';
      this.emit('faulted', { fault: this.fault });
      this.activeCue = null;
    } else if (this.state === 'running') {
      this.state = 'idle';
      this.cueIndex += 1;
      this.emit('cueComplete');
      this.activeCue = null;
      if (cue?.follow) this.go();
    } else if (this.state === 'stopping') {
      this.state = 'idle';
      this.emit('stopped');
      this.activeCue = null;
    }
  }

  /** Predicted cue length from the current axis positions (moves on the same axis run in delay order). */
  estimateDuration(cue) {
    const pos = Object.fromEntries([...this.axes].map(([id, ax]) => [id, ax.pos]));
    let end = 0;
    for (const m of [...cue.moves].sort((a, b) => a.delay - b.delay)) {
      const def = this.axisDefs.get(m.axis);
      const p = planMove(pos[m.axis], m.target, moveLimits(m, def));
      pos[m.axis] = m.target;
      end = Math.max(end, m.delay + p.duration);
    }
    return end;
  }

  positions() {
    return Object.fromEntries([...this.axes].map(([id, ax]) => [id, ax.pos]));
  }

  /**
   * Read-only lookahead: each axis's state `ahead` seconds past the current step, sampled straight
   * from the motion profiles. Lets the renderer draw at the exact frame time while the sim (and
   * clearance tracking) keeps advancing in fixed steps. Does not change any state or fire events.
   * Meant for small lookaheads (less than one sim step).
   */
  sampleAhead(ahead) {
    const out = new Map();
    const t = this.cueTime + Math.max(0, ahead);
    for (const [id, ax] of this.axes) {
      let s = { pos: ax.pos, vel: ax.vel, acc: ax.acc, moving: !!ax.active };
      let active = ax.active;
      if (!active && this.state === 'running' && ahead > 0) {
        // A delayed move that starts inside the lookahead window.
        const m = this.pending.find((p) => p.axis === id && p.delay <= t + DONE_EPS);
        if (m) {
          const def = this.axisDefs.get(id);
          const profile = planMove(ax.pos, m.target, moveLimits(m, def));
          active = { profile, startTime: m.delay };
        }
      }
      if (active && ahead > 0) {
        const { profile, startTime } = active;
        const local = t - startTime;
        if (local >= profile.duration - DONE_EPS) s = { pos: profile.target, vel: 0, acc: 0, moving: true };
        else if (local > 0) s = { ...profile.sample(local), moving: true };
      }
      out.set(id, s);
    }
    return out;
  }

  /** Axis positions `ahead` seconds past the current step (see sampleAhead). */
  positionsAt(ahead = 0) {
    if (this.state === 'idle' || !(ahead > 0)) return this.positions();
    return Object.fromEntries([...this.sampleAhead(ahead)].map(([id, s]) => [id, s.pos]));
  }

  /** Like axisStates(), but `ahead` seconds past the current step (see sampleAhead). */
  axisStatesAt(ahead = 0) {
    if (this.state === 'idle' || !(ahead > 0)) return this.axisStates();
    return [...this.sampleAhead(ahead)].map(([id, s]) => ({
      id,
      def: this.axisDefs.get(id),
      pos: s.pos,
      vel: s.vel,
      acc: s.acc,
      moving: s.moving,
      fault: this.axes.get(id).fault,
    }));
  }

  axisStates() {
    return [...this.axes].map(([id, ax]) => ({
      id,
      def: this.axisDefs.get(id),
      pos: ax.pos,
      vel: ax.vel,
      acc: ax.acc,
      moving: !!ax.active,
      fault: ax.fault,
    }));
  }
}
