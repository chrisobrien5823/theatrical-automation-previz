// Cue list panel: standby / running / done states, plus preflight badges.

import { formatGap, esc } from './format.js';

export function createCueList(el, { onSelect }) {
  let rows = [];

  function setShow(show) {
    el.replaceChildren();
    rows = show.cues.map((cue, i) => {
      const li = document.createElement('li');
      li.className = 'cue';
      li.innerHTML = `
        <span class="num">Q${esc(cue.id)}</span>
        <span class="name">${esc(cue.name)}</span>
        <span class="meta"><span class="badge"></span> <span class="dur"></span></span>
        <span class="note">${esc(cue.note)}</span>
        <span class="flag" hidden></span>`;
      li.addEventListener('click', () => onSelect(i));
      el.appendChild(li);
      return {
        li,
        badge: li.querySelector('.badge'),
        dur: li.querySelector('.dur'),
        flag: li.querySelector('.flag'),
      };
    });
  }

  /** preflight: array aligned with cues, null for cues already run. */
  function setPreflight(preflight) {
    rows.forEach((r, i) => {
      const p = preflight[i];
      if (!p) return; // keep the last known result for cues already run
      r.dur.textContent = `${p.duration.toFixed(1)}s`;
      if (p.conflicts.length) {
        const worst = p.conflicts.reduce((a, b) => (b.minGap < a.minGap ? b : a));
        r.badge.className = 'badge warn';
        r.badge.textContent = worst.severity === 'contact' ? '⚠ CONTACT' : `⚠ ${formatGap(worst.minGap)}`;
        r.flag.hidden = false;
        r.flag.textContent = `${worst.aName} ↔ ${worst.bName} at t=${worst.tMin.toFixed(2)}s` +
          (p.conflicts.length > 1 ? ` (+${p.conflicts.length - 1} more)` : '');
      } else {
        r.badge.className = 'badge ok';
        r.badge.textContent = '✓';
        r.flag.hidden = true;
      }
    });
  }

  function setState({ standbyIndex, runningIndex }) {
    rows.forEach((r, i) => {
      r.li.classList.toggle('running', i === runningIndex);
      r.li.classList.toggle('standby', runningIndex == null && i === standbyIndex);
      r.li.classList.toggle('done', i < (runningIndex ?? standbyIndex));
    });
    const focus = rows[runningIndex ?? standbyIndex];
    focus?.li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  return { setShow, setPreflight, setState };
}
