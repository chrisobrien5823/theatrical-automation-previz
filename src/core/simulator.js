// Cue playback state machine. Deterministic and headless: the render loop (or a test, or the
// preflight sweep) drives it by calling step(dt).
//
// States:  idle -> running -> idle            (cue completes, pointer advances)
//          running -> stopping -> idle        (STOP ramps every moving axis down; pointer stays)
// GO is ignored unless idle. GO after a STOP re-runs the stopped cue from wherever the axes are.

import { planMove, planStop } from './profile.js';

const DONE_EPS = 1e-9;

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
      this.axes.set(a.id, { pos: opts.positions?.[a.id] ?? a.home, vel: 0, acc: 0, active: null });
    }
    this.state = 'idle';
    this.cueIndex = opts.cueIndex ?? 0;
    this.activeCue = null;
    this.cueTime = 0;
    this.cueDuration = 0;
    this.pending = [];
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
    this.state = 'running';
    this.emit('cueStart');
    this.activatePending();
    return true;
  }

  stop() {
    if (this.state !== 'running') return false;
    this.pending = [];
    for (const [id, ax] of this.axes) {
      if (!ax.active) continue;
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
    }
    this.pending = [];
    this.state = 'idle';
    this.activeCue = null;
    this.cueIndex = 0;
    this.cueTime = 0;
    this.cueDuration = 0;
    this.emit('reset');
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
    for (const ax of this.axes.values()) {
      if (!ax.active) continue;
      const { profile, startTime } = ax.active;
      const s = profile.sample(this.cueTime - startTime);
      ax.pos = s.pos;
      ax.vel = s.vel;
      ax.acc = s.acc;
      if (this.cueTime - startTime >= profile.duration - DONE_EPS) {
        ax.pos = profile.target;
        ax.vel = 0;
        ax.acc = 0;
        ax.active = null;
      }
    }
    this.finishIfDone();
  }

  activatePending() {
    while (this.pending.length && this.pending[0].delay <= this.cueTime + DONE_EPS) {
      const m = this.pending.shift();
      const ax = this.axes.get(m.axis);
      const def = this.axisDefs.get(m.axis);
      const profile = planMove(ax.pos, m.target, { vMax: m.vMax ?? def.vMax, aMax: def.aMax });
      ax.active = { profile, startTime: m.delay };
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
    if (this.state === 'running') {
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
      const p = planMove(pos[m.axis], m.target, { vMax: m.vMax ?? def.vMax, aMax: def.aMax });
      pos[m.axis] = m.target;
      end = Math.max(end, m.delay + p.duration);
    }
    return end;
  }

  positions() {
    return Object.fromEntries([...this.axes].map(([id, ax]) => [id, ax.pos]));
  }

  axisStates() {
    return [...this.axes].map(([id, ax]) => ({
      id,
      def: this.axisDefs.get(id),
      pos: ax.pos,
      vel: ax.vel,
      acc: ax.acc,
      moving: !!ax.active,
    }));
  }
}
