// Per-axis position / velocity readouts with a limit bar.

import { unitOf, esc } from './format.js';

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
            <span class="axis-name">${esc(a.name)}<span class="mv" hidden>MOVING</span></span>
            <span class="axis-pos"></span>
          </div>
          <div class="axis-sub"><span class="vel"></span><span>${fmtLimit(a.min)} … ${fmtLimit(a.max)} ${u.pos}</span></div>
          <div class="axis-bar"><i></i></div>`;
        el.appendChild(div);
        return [
          a.id,
          { u, pos: div.querySelector('.axis-pos'), vel: div.querySelector('.vel'), mv: div.querySelector('.mv'), tick: div.querySelector('.axis-bar i') },
        ];
      }),
    );
  }

  function update(states) {
    for (const s of states) {
      const r = rows.get(s.id);
      if (!r) continue;
      const digits = s.def.type === 'rotary' ? 1 : 3;
      r.pos.textContent = `${s.pos.toFixed(digits)} ${r.u.pos}`;
      r.vel.textContent = `v ${s.vel >= 0 ? ' ' : ''}${s.vel.toFixed(digits === 1 ? 1 : 2)} ${r.u.vel}`;
      r.mv.hidden = !s.moving;
      const { min, max } = s.def;
      const k = Number.isFinite(min) && Number.isFinite(max) && max > min ? (s.pos - min) / (max - min) : 0.5;
      r.tick.style.left = `${Math.max(0, Math.min(1, k)) * 100}%`;
    }
  }

  return { setShow, update };
}

function fmtLimit(v) {
  return Number.isFinite(v) ? v : '∞';
}
