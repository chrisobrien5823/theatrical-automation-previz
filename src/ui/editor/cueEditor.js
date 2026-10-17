// Cues tab in Rig mode: record a cue from the jogged positions, then edit moves.

import { h, add, select, num } from './dom.js';
import { recordCue, endOfShowPositions } from '../../core/edit.js';
import { formatGap } from '../format.js';

export function renderCueEditor(body, app) {
  const raw = app.raw;
  const cues = raw.cues ?? [];
  const axes = raw.axes ?? [];
  const idle = app.sim.state === 'idle';
  const nameInput = h('input', { type: 'text', placeholder: `Cue ${cues.length + 1} name (optional)` });

  const edit = (fn) => {
    const next = structuredClone(app.raw);
    fn(next.cues);
    app.apply(next);
  };

  add(body, 
    h(
      'div',
      { class: 'record' },
      h('p', { class: 'hint' }, 'Jog axes in the Axes tab to the next look, then record. Only axes that moved since the end of the last cue are included.'),
      nameInput,
      h(
        'button',
        {
          class: 'btn-small primary',
          disabled: !idle || !axes.length,
          onclick: () => {
            const { raw: next, cue } = recordCue(app.raw, endOfShowPositions(app.raw), app.sim.positions(), {
              name: nameInput.value.trim() || undefined,
            });
            if (!cue) return app.toast('Nothing moved since the end of the last cue.');
            if (app.apply(next, { standby: next.cues.length })) app.toast(`Recorded Q${cue.id}: ${cue.moves.length} move${cue.moves.length === 1 ? '' : 's'}.`);
          },
        },
        '● Record cue',
      ),
    ),
    cues.length ? null : h('p', { class: 'muted' }, 'No cues yet.'),
    cues.map((c, ci) => cueCard(c, ci)),
  );

  function cueCard(c, ci) {
    const pf = app.preflight?.[ci];
    const worst = pf?.conflicts.length ? pf.conflicts.reduce((a, b) => (b.minGap < a.minGap ? b : a)) : null;
    return h(
      'div',
      { class: 'cue-card' },
      h(
        'div',
        { class: 'cue-card-head' },
        h('span', { class: 'num mono' }, `Q${c.id}`),
        h('input', { type: 'text', value: c.name ?? '', onchange: (e) => edit((cs) => (cs[ci].name = e.target.value)) }),
        worst
          ? h('span', { class: 'badge warn' }, `⚠ ${formatGap(worst.minGap)}`)
          : pf
            ? h('span', { class: 'badge ok' }, '✓')
            : null,
      ),
      worst ? h('p', { class: 'flag' }, `${worst.aName} ↔ ${worst.bName} at t=${worst.tMin.toFixed(2)}s`) : null,
      h(
        'table',
        { class: 'moves' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Axis'), h('th', {}, 'Target'), h('th', {}, 'Delay s'), h('th', {}))),
        h(
          'tbody',
          {},
          (c.moves ?? []).map((m, mi) =>
            h(
              'tr',
              {},
              h(
                'td',
                {},
                select(
                  axes.map((a) => [a.id, a.name ?? a.id]),
                  m.axis,
                  (v) => edit((cs) => (cs[ci].moves[mi].axis = v)),
                ),
              ),
              h('td', {}, num(m.target, (v) => edit((cs) => (cs[ci].moves[mi].target = v)))),
              h('td', {}, num(m.delay ?? 0, (v) => edit((cs) => (cs[ci].moves[mi].delay = Math.max(0, v))), { min: 0 })),
              h('td', {}, h('button', { class: 'icon', title: 'Remove move', onclick: () => edit((cs) => cs[ci].moves.splice(mi, 1)) }, '×')),
            ),
          ),
        ),
      ),
      h(
        'div',
        { class: 'btn-row' },
        axes.length
          ? h(
              'button',
              {
                class: 'btn-small',
                onclick: () => {
                  const used = new Set(c.moves.map((m) => m.axis));
                  const a = axes.find((x) => !used.has(x.id)) ?? axes[0];
                  edit((cs) => cs[ci].moves.push({ axis: a.id, target: a.home ?? 0 }));
                },
              },
              '+ Move',
            )
          : null,
        h(
          'label',
          { class: 'check-row inline' },
          h('input', { type: 'checkbox', checked: !!c.follow, onchange: (e) => edit((cs) => (cs[ci].follow = e.target.checked)) }),
          'Auto-follow',
        ),
        h('button', { class: 'icon', title: 'Move up', disabled: ci === 0, onclick: () => edit((cs) => cs.splice(ci - 1, 0, cs.splice(ci, 1)[0])) }, '↑'),
        h('button', { class: 'icon', title: 'Move down', disabled: ci === cues.length - 1, onclick: () => edit((cs) => cs.splice(ci + 1, 0, cs.splice(ci, 1)[0])) }, '↓'),
        h('button', { class: 'icon danger', title: 'Delete cue', onclick: () => confirm(`Delete Q${c.id}?`) && edit((cs) => cs.splice(ci, 1)) }, '🗑'),
      ),
    );
  }
}
