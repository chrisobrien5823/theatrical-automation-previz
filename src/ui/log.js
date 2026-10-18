// Conflict / event log. Conflict entries update in place as their window closes (final min gap).

import { formatGap, clockTime, esc } from './format.js';

export function createLog(el, countEl, { onJump }) {
  let conflictCount = 0;
  const entries = new Map(); // window object -> li

  function empty() {
    el.innerHTML = '<li class="empty">No conflicts yet. The warning badges in the cue list show what preflight expects.</li>';
  }
  empty();

  function prepend(li) {
    el.querySelector('.empty')?.remove();
    el.prepend(li);
  }

  function info(text) {
    const li = document.createElement('li');
    li.className = 'info';
    li.innerHTML = `<span class="ts">${clockTime()}</span>${esc(text)}`;
    prepend(li);
  }

  /** A conflict window opened during a live cue. */
  function conflictOpened(w, cueIndex) {
    const li = document.createElement('li');
    li.className = w.severity;
    li.dataset.ts = clockTime();
    // The whole entry is a button: it loads the stage as it stood just before this cue.
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'log-jump';
    btn.addEventListener('click', () => onJump(cueIndex));
    li.append(btn);
    entries.set(w, li);
    render(w, li, true);
    prepend(li);
    conflictCount++;
    countEl.textContent = conflictCount;
    countEl.setAttribute('aria-label', `${conflictCount} conflict${conflictCount === 1 ? '' : 's'}`);
    countEl.hidden = false;
  }

  function conflictUpdated(w, final = false) {
    const li = entries.get(w);
    if (!li) return;
    li.className = w.severity;
    render(w, li, !final);
    if (final) entries.delete(w);
  }

  function render(w, li, live) {
    const span = live ? `from t=${w.tStart.toFixed(2)}s` : `t=${w.tStart.toFixed(2)}–${w.tEnd.toFixed(2)}s`;
    li.firstChild.innerHTML =
      `<span class="ts">${li.dataset.ts}</span><b>Q${esc(w.cueId)}</b> · ${esc(w.aName)} ↔ ${esc(w.bName)}<br>` +
      `${w.severity === 'contact' ? 'CONTACT' : 'Inside clearance'} ${span} · min <span class="gap">${formatGap(w.minGap)}</span> at t=${w.tMin.toFixed(2)}s` +
      (live ? ' …' : '<span class="log-hint">Load the stage before this cue</span>');
  }

  function clear() {
    conflictCount = 0;
    countEl.hidden = true;
    entries.clear();
    empty();
  }

  return { info, conflictOpened, conflictUpdated, clear };
}
