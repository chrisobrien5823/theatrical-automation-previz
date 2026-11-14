// Per-axis position / velocity readouts with a velocity trace and a limit bar.

import { unitOf, esc } from './format.js';
import { createTrace, tracePath } from './velTrace.js';

// Trace box in SVG user units. The SVG stretches to the row width (preserveAspectRatio="none") and
// the stroke is non-scaling, so the line stays 1.5 px whatever the panel width.
const TW = 300;
const TH = 24;

export function createReadouts(el) {
  let rows = new Map();

  function setShow(show) {
    el.replaceChildren();
    rows = new Map(
      show.axes.map((a) => {
        const div = document.createElement('div');
        div.className = 'axis';
        const u = unitOf(a);
        const vMax = fmtLimit(a.vMax);
        div.innerHTML = `
          <div class="axis-head">
            <span class="axis-name"><span class="lamp"></span><span class="tape" aria-hidden="true"></span>${esc(a.name)}<span class="mv">IN POS</span></span>
            <span class="axis-pos"></span>
          </div>
          <div class="axis-sub"><span class="vel"></span><span>${fmtLimit(a.min)} … ${fmtLimit(a.max)} ${u.pos}</span></div>
          <svg class="axis-trace" viewBox="0 0 ${TW} ${TH}" preserveAspectRatio="none" role="img" aria-label="${esc(a.name)} velocity, last 6 seconds of cue time">
            <line class="zero" x1="0" y1="${TH / 2}" x2="${TW}" y2="${TH / 2}" vector-effect="non-scaling-stroke"/>
            <path vector-effect="non-scaling-stroke"/>
          </svg>
          <div class="axis-trace-legend"><span>velocity · last 6 s</span><span>±${vMax} ${u.vel}</span></div>
          <div class="axis-bar"><i></i></div>`;
        div.querySelector('.tape').style.setProperty('--tape', a.color);
        el.appendChild(div);
        return [
          a.id,
          {
            u,
            row: div,
            lamp: div.querySelector('.lamp'),
            pos: div.querySelector('.axis-pos'),
            vel: div.querySelector('.vel'),
            mv: div.querySelector('.mv'),
            tick: div.querySelector('.axis-bar i'),
            path: div.querySelector('.axis-trace path'),
            trace: createTrace(),
            moving: null,
          },
        ];
      }),
    );
  }

  /**
   * states: sim.axisStatesAt(); t: the show clock in seconds (advances only while a cue runs), used
   * to scroll the velocity traces.
   */
  function update(states, t = 0) {
    for (const s of states) {
      const r = rows.get(s.id);
      if (!r) continue;
      const digits = s.def.type === 'rotary' ? 1 : 3;
      r.pos.textContent = `${s.pos.toFixed(digits)} ${r.u.pos}`;
      r.vel.textContent = `v ${s.vel >= 0 ? ' ' : ''}${s.vel.toFixed(digits === 1 ? 1 : 2)} ${r.u.vel}`;
      // Lamp and word, like the axis bus: cyan MOVING while the axis moves, unlit IN POS at rest.
      const moving = !!s.moving;
      if (moving !== r.moving) {
        r.moving = moving;
        r.row.dataset.state = r.lamp.dataset.state = moving ? 'moving' : 'idle';
        r.mv.textContent = moving ? 'MOVING' : 'IN POS';
      }
      if (r.trace.push(t, s.vel)) r.path.setAttribute('d', tracePath(r.trace.samples, t, r.trace.window, s.def.vMax, TW, TH));
      const { min, max } = s.def;
      const k = Number.isFinite(min) && Number.isFinite(max) && max > min ? (s.pos - min) / (max - min) : 0.5;
      r.tick.style.left = `${Math.max(0, Math.min(1, k)) * 100}%`;
    }
  }

  /** Forget the traces (RESET: the show clock starts again from the top). */
  function clearTraces() {
    for (const r of rows.values()) {
      r.trace.clear();
      r.path.removeAttribute('d');
    }
  }

  return { setShow, update, clearTraces };
}

function fmtLimit(v) {
  return Number.isFinite(v) ? v : '∞';
}
