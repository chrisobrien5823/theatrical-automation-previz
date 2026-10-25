// Axis bus: one lamp per axis across the top of the stage, like the status row on an automation
// desk. Lit cyan while the axis moves, red while a piece it carries is inside clearance. Every lamp
// has a word next to it, so the state never depends on colour alone.

import { esc, unitOf, axisCodes } from './format.js';

// On a phone the cell is too narrow for the axis name, so it shows a short code (.n-short) over the
// position; the full name stays in the DOM (.n-full, visually hidden there) for screen readers.

// "CLASH", never "CLR": on a stage crew's tongue CLR means clear, the opposite.
// "IN POS" is an axis at rest where it was last sent; it says nothing about whether that is the next cue's target.
const WORD = { moving: 'MOVE', clash: 'CLASH', idle: 'IN POS' };

export function createAxisBus(el) {
  let rows = new Map();

  function setShow(show) {
    el.replaceChildren();
    const codes = axisCodes(show.axes);
    rows = new Map(
      show.axes.map((a, i) => {
        const item = document.createElement('div');
        item.className = 'bus-axis';
        item.setAttribute('role', 'listitem');
        item.innerHTML = `<span class="lamp"></span><span class="tape" aria-hidden="true"></span><span class="bus-name"><span class="n-full">${esc(a.name)}</span><span class="n-short" aria-hidden="true">${esc(codes[i])}</span></span><span class="bus-word"></span><span class="bus-pos tnum"></span>`;
        item.querySelector('.tape').style.setProperty('--tape', a.color);
        el.appendChild(item);
        return [a.id, { item, word: item.querySelector('.bus-word'), pos: item.querySelector('.bus-pos'), u: unitOf(a), state: null, text: '' }];
      }),
    );
    el.hidden = rows.size === 0;
  }

  /** states: sim.axisStates(); clashing: Set of axis ids carrying a piece that is inside clearance. */
  function update(states, clashing) {
    for (const s of states) {
      const r = rows.get(s.id);
      if (!r) continue;
      const state = clashing.has(s.id) ? 'clash' : s.moving ? 'moving' : 'idle';
      if (state !== r.state) {
        r.item.dataset.state = r.state = state;
        r.word.textContent = WORD[state];
      }
      const text = `${s.pos.toFixed(s.def.type === 'rotary' ? 1 : 2)} ${r.u.pos}`;
      if (text !== r.text) r.pos.textContent = r.text = text;
    }
  }

  return { setShow, update };
}
