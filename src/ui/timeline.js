// The cue timeline in the transport deck: one track for the current cue, its preflight conflict
// windows marked in red, the live progress while it runs, and, while idle, a scrubber that previews
// the stage at any moment of the standby cue (drag, click, or arrow keys).
//
// This module only draws and reports input. What a moment looks like comes from the core scrubber
// (src/core/scrub.js) in main.js, so the preview pose is the one the clearance check sees.

import { formatGap, esc } from './format.js';

const secs = (t) => `${t.toFixed(2)} s`;

/**
 * @param el container (the .timeline element in the deck)
 * @param opts.onScrub(t) the user picked cue time t (drag, click or key); only fired while scrubbable
 * @param opts.onExit()   the user asked to leave the preview
 */
export function createTimeline(el, { onScrub, onExit }) {
  el.innerHTML = `
    <div class="tl-track" role="slider" tabindex="0" aria-label="Cue timeline" aria-valuemin="0">
      <div class="tl-marks"></div>
      <div class="tl-fill" id="progressBar"></div>
      <div class="tl-head" hidden></div>
    </div>
    <div class="tl-meta">
      <span class="tl-t tnum"></span>
      <span class="tl-say"></span>
      <button type="button" class="tl-exit" hidden>End preview</button>
      <span class="tl-dur tnum"></span>
    </div>`;
  const track = el.querySelector('.tl-track');
  const marksEl = el.querySelector('.tl-marks');
  const head = el.querySelector('.tl-head');
  const tEl = el.querySelector('.tl-t');
  const say = el.querySelector('.tl-say');
  const exitBtn = el.querySelector('.tl-exit');
  const durEl = el.querySelector('.tl-dur');

  let state = { duration: 0, scrubbable: false };
  let marksKey = '';
  let shown = {};

  // Called every frame while previewing, so only touch the DOM when something changed.
  const set = (node, key, text) => {
    if (shown[key] !== text) node.textContent = shown[key] = text;
  };
  const attr = (name, value) => {
    if (shown[name] !== value) track.setAttribute(name, (shown[name] = value));
  };

  function timeAt(clientX) {
    const r = track.getBoundingClientRect();
    const f = r.width > 0 ? (clientX - r.left) / r.width : 0;
    return Math.min(1, Math.max(0, f)) * state.duration;
  }

  let dragging = false;
  track.addEventListener('pointerdown', (e) => {
    if (!state.scrubbable || e.button !== 0) return;
    dragging = true;
    track.setPointerCapture(e.pointerId);
    track.focus({ preventScroll: true });
    onScrub(timeAt(e.clientX));
    e.preventDefault();
  });
  track.addEventListener('pointermove', (e) => {
    if (dragging && state.scrubbable) onScrub(timeAt(e.clientX));
  });
  const endDrag = () => (dragging = false);
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  track.addEventListener('keydown', (e) => {
    if (!state.scrubbable) return;
    const now = state.t ?? 0;
    const step = e.shiftKey ? 1 : 0.1;
    let t = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') t = now + step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') t = now - step;
    else if (e.key === 'Home') t = 0;
    else if (e.key === 'End') t = state.duration;
    else if (e.key === 'PageUp') t = now + 1;
    else if (e.key === 'PageDown') t = now - 1;
    if (t === null) return;
    e.preventDefault();
    onScrub(Math.min(state.duration, Math.max(0, t)));
  });

  exitBtn.addEventListener('click', () => onExit());

  return {
    /**
     * @param s.cue         the cue on the track (or null for an empty list)
     * @param s.duration    its length in seconds
     * @param s.marks       timelineMarks() of its preflight result
     * @param s.mode        'idle' (standby cue, scrubbable), 'preview' (scrubbing), 'live' (running), 'empty'
     * @param s.t           playhead time in preview
     * @param s.hit         the worst clearance hit at the preview pose, if any
     */
    update(s) {
      state = { ...s, scrubbable: s.mode === 'idle' || s.mode === 'preview' };
      const { cue, duration, marks = [], mode, t } = state;
      if (el.dataset.mode !== mode) el.dataset.mode = mode;

      const key = `${duration}|` + marks.map((m) => `${m.from}-${m.to}-${m.severity}`).join(',');
      if (key !== marksKey) {
        marksKey = key;
        // A conflict that lasted a single sample is still drawn 3 px wide, but its time and gap are true.
        marksEl.innerHTML = marks
          .map(
            (m) =>
              `<span class="tl-mark${m.severity === 'contact' ? ' contact' : ''}" style="left:${(m.from * 100).toFixed(3)}%;width:max(3px, ${((m.to - m.from) * 100).toFixed(3)}%)" title="${esc(m.aName)} ↔ ${esc(m.bName)}, min ${esc(formatGap(m.minGap))} at t=${m.tMin.toFixed(2)} s"></span>`,
          )
          .join('');
      }

      const inPreview = mode === 'preview';
      if (head.hidden === inPreview) head.hidden = !inPreview;
      const left = inPreview && duration > 0 ? `${((100 * t) / duration).toFixed(3)}%` : '0%';
      if (shown.left !== left) head.style.left = shown.left = left;
      if (exitBtn.hidden === inPreview) exitBtn.hidden = !inPreview;

      attr('aria-disabled', String(!state.scrubbable));
      attr('tabindex', state.scrubbable ? '0' : '-1');
      attr('aria-valuemax', duration.toFixed(2));
      attr('aria-valuenow', (inPreview ? t : 0).toFixed(2));

      set(durEl, 'dur', cue ? secs(duration) : '');
      set(tEl, 't', inPreview ? `t=${secs(t)}` : '');
      let words;
      if (!cue) words = '';
      else if (mode === 'live') words = marks.length ? 'Red marks the preflight conflict' : '';
      else if (inPreview) words = s.hit ? `${s.hit.a.name} ↔ ${s.hit.b.name} ${formatGap(s.hit.gap)} here` : `Q${cue.id} preview`;
      else words = `Drag to preview Q${cue.id}`;
      set(say, 'say', words);
      const valueText = inPreview ? `Q${cue.id} at ${secs(t)} of ${secs(duration)}${s.hit ? `, ${s.hit.a.name} and ${s.hit.b.name} ${formatGap(s.hit.gap)} apart` : ''}` : cue ? `Q${cue.id}, ${secs(duration)}` : 'No cue';
      attr('aria-valuetext', valueText);
    },
  };
}
