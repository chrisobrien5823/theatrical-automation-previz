// Per-axis position / velocity readouts with a limit bar.

import { unitOf, esc } from './format.js';
import { writeText, writeHidden, writeStyle } from './domWrite.js';

export function createReadouts(el) {
  let rows = new Map();

  function setShow(show) {
    el.replaceChildren();
    rows = new Map(
      show.axes.map((a) => {
        const div = document.createElement('div');
        div.className = 'axis';
        const u = unitOf(a);
        div.innerHTML = `
          <div class="axis-head">
            <span class="axis-name"><span class="tape" aria-hidden="true"></span>${esc(a.name)}<span class="mv" hidden>MOVING</span></span>
            <span class="axis-pos"></span>
          </div>
          <div class="axis-sub"><span class="vel"></span><span>${fmtLimit(a.min)} … ${fmtLimit(a.max)} ${u.pos}</span></div>
          <div class="axis-bar"><i></i></div>`;
        div.querySelector('.tape').style.setProperty('--tape', a.color);
        el.appendChild(div);
        return [
          a.id,
          { u, pos: div.querySelector('.axis-pos'), vel: div.querySelector('.vel'), mv: div.querySelector('.mv'), tick: div.querySelector('.axis-bar i') },
        ];
      }),
    );
  }

  // Runs every frame. Each field is written only when its text changes, so a stage at rest costs no
  // DOM writes and a moving axis only touches the digits that rolled over.
  function update(states) {
    for (const s of states) {
      const r = rows.get(s.id);
      if (!r) continue;
      const f = readoutFields(s, r.u);
      writeText(r.pos, f.pos);
      writeText(r.vel, f.vel);
      writeHidden(r.mv, !f.moving);
      writeStyle(r.tick, 'left', f.left);
    }
  }

  return { setShow, update };
}

function fmtLimit(v) {
  return Number.isFinite(v) ? v : '∞';
}

/**
 * The strings one readout row shows for an axis state ({ pos, vel, moving, def }). Pure, so the
 * formatting (and how often it changes) is unit-tested without a DOM. The limit-bar tick is rounded
 * to 0.1 % of travel: finer than a pixel on any panel, and it stops sub-pixel float noise from
 * counting as a change.
 */
export function readoutFields(s, u) {
  const digits = s.def.type === 'rotary' ? 1 : 3;
  const { min, max } = s.def;
  const k = Number.isFinite(min) && Number.isFinite(max) && max > min ? (s.pos - min) / (max - min) : 0.5;
  const pct = Math.round(Math.max(0, Math.min(1, k)) * 1000) / 10;
  return {
    pos: `${s.pos.toFixed(digits)} ${u.pos}`,
    vel: `v ${s.vel >= 0 ? ' ' : ''}${s.vel.toFixed(digits === 1 ? 1 : 2)} ${u.vel}`,
    moving: !!s.moving,
    left: `${pct}%`,
  };
}
