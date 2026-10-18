// Cue list panel: standby / running / done / skipped states, plus preflight badges.
//
// Rows are buttons. A mouse click or Enter puts a cue in standby; on touch screens the cue has to be
// held for a moment, so a stray thumb at the booth can't skip half the show.

import { formatGap, esc } from './format.js';
import { icon } from './icons.js';

const HOLD_MS = 450;
const MOVE_SLOP = 10; // px a held finger may drift before it counts as a scroll

// "CLASH", never "CLR": on a stage crew's tongue CLR means clear, the opposite.
const STATE_LABEL = { standby: 'STBY', running: 'RUN', conflict: 'CLASH', done: 'DONE', skipped: 'SKIP', pending: 'PEND' };

export function createCueList(el, { onSelect, onHint }) {
  let rows = [];
  let touchUntil = 0; // clicks that follow a touch are handled by the hold gesture instead

  function setShow(show) {
    el.replaceChildren();
    rows = show.cues.map((cue, i) => {
      const li = document.createElement('li');
      li.className = 'cue';
      li.innerHTML = `
        <button type="button" class="cue-btn">
          <span class="state"><span class="lamp"></span><span class="state-text"></span></span>
          <span class="num">Q${esc(cue.id)}</span>
          <span class="name">${esc(cue.name)}</span>
          <span class="meta"><span class="ok" hidden>${icon('check')}<span class="sr-only">clear</span></span><span class="dur"></span></span>
          ${cue.note ? `<span class="note">${esc(cue.note)}</span>` : ''}
          <span class="flag" hidden><span class="badge warn"></span><span class="flag-text"></span></span>
          <span class="hold" aria-hidden="true"></span>
        </button>`;
      const btn = li.querySelector('.cue-btn');
      wireHold(btn, li, i);
      el.appendChild(li);
      return {
        li,
        btn,
        stateText: li.querySelector('.state-text'),
        ok: li.querySelector('.ok'),
        badge: li.querySelector('.badge'),
        dur: li.querySelector('.dur'),
        flag: li.querySelector('.flag'),
        flagText: li.querySelector('.flag-text'),
        state: null,
      };
    });
  }

  function wireHold(btn, li, i) {
    let press = null;
    const cancel = () => {
      if (!press) return;
      clearTimeout(press.timer);
      li.classList.remove('pressing');
      const tapped = !press.fired;
      press = null;
      return tapped;
    };
    btn.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      touchUntil = Infinity;
      press = {
        x: e.clientX,
        y: e.clientY,
        fired: false,
        timer: setTimeout(() => {
          press.fired = true;
          li.classList.remove('pressing');
          navigator.vibrate?.(12);
          onSelect(i);
        }, HOLD_MS),
      };
      li.classList.add('pressing');
    });
    btn.addEventListener('pointermove', (e) => {
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_SLOP) cancel();
    });
    btn.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'touch') return;
      touchUntil = performance.now() + 800;
      if (cancel()) onHint?.(i);
    });
    btn.addEventListener('pointercancel', () => {
      touchUntil = performance.now() + 800;
      cancel();
    });
    btn.addEventListener('contextmenu', (e) => e.pointerType === 'touch' && e.preventDefault());
    btn.addEventListener('click', () => {
      if (performance.now() < touchUntil) return;
      onSelect(i);
    });
  }

  /** preflight: array aligned with cues, null for cues already run. */
  function setPreflight(preflight) {
    rows.forEach((r, i) => {
      const p = preflight[i];
      if (!p) return; // keep the last known result for cues already run
      const timed = p.duration >= 0.05;
      r.dur.textContent = timed ? `${p.duration.toFixed(1)} s` : 'instant';
      r.dur.classList.toggle('mono', timed); // mono is for numbers only
      if (p.conflicts.length) {
        const worst = p.conflicts.reduce((a, b) => (b.minGap < a.minGap ? b : a));
        r.badge.innerHTML = `${icon('warn')}<span class="mono">${worst.severity === 'contact' ? 'CONTACT' : esc(formatGap(worst.minGap))}</span>`;
        r.flagText.textContent =
          `${worst.aName} ↔ ${worst.bName} at t=${worst.tMin.toFixed(2)} s` + (p.conflicts.length > 1 ? ` (+${p.conflicts.length - 1} more)` : '');
        r.flag.hidden = false;
        r.ok.hidden = true;
      } else {
        r.flag.hidden = true;
        r.ok.hidden = false;
      }
    });
  }

  /**
   * standbyIndex: cue the next GO takes. runningIndex: cue in motion (or null).
   * ran: Set of cue indices that actually ran since the last reset; earlier cues that didn't are "skipped".
   * conflict: the running cue is inside clearance right now.
   */
  function setState({ standbyIndex, runningIndex, ran, conflict }) {
    const pointer = runningIndex ?? standbyIndex;
    rows.forEach((r, i) => {
      let state = null;
      if (i === runningIndex) state = conflict ? 'conflict' : 'running';
      else if (runningIndex == null && i === standbyIndex) state = 'standby';
      else if (i < pointer) state = ran.has(i) ? 'done' : 'skipped';
      else state = 'pending';
      if (state === r.state) return;
      r.li.classList.remove('standby', 'running', 'conflict', 'done', 'skipped', 'pending');
      if (state) r.li.classList.add(state);
      r.stateText.textContent = STATE_LABEL[state] ?? '';
      if (state === 'standby' || state === 'running' || state === 'conflict') r.btn.setAttribute('aria-current', 'step');
      else r.btn.removeAttribute('aria-current');
      r.state = state;
    });
    const focus = rows[pointer];
    focus?.li.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  return { setShow, setPreflight, setState };
}
