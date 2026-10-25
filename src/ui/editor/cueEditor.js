// Cues tab in Rig mode: record a cue from the jogged positions, then edit moves.

import { h, add, select, num } from './dom.js';
import { recordCue, endOfShowPositions } from '../../core/edit.js';
import { formatGap, unitOf } from '../format.js';
import { iconEl } from '../icons.js';

export function renderCueEditor(body, app) {
  const raw = app.raw;
  const cues = raw.cues ?? [];
  const axes = raw.axes ?? [];
  const idle = app.sim.state === 'idle';
  const canRecord = idle && axes.length > 0;
  const nameInput = h('input', { type: 'text', placeholder: `Cue ${cues.length + 1} name (optional)`, 'aria-label': 'New cue name', 'data-fk': 'rec:name' });
  const unitFor = new Map(app.show.axes.map((a) => [a.id, unitOf(a).pos]));

  const edit = (fn) => {
    const next = structuredClone(app.raw);
    fn(next.cues);
    app.apply(next);
  };

  add(
    body,
    h(
      'div',
      { class: 'record' },
      h(
        'p',
        { class: 'hint' },
        axes.length
          ? 'Jog axes in the Axes tab to the next look, then record. Only axes that moved since the end of the last cue are included.'
          : 'Recording needs at least one axis. Add one to a piece in the Model tab first.',
      ),
      nameInput,
      h(
        'button',
        {
          type: 'button',
          class: `btn-small${canRecord ? ' primary' : ''}`,
          'data-fk': 'rec:go',
          disabled: !canRecord,
          onclick: () => {
            const { raw: next, cue } = recordCue(app.raw, endOfShowPositions(app.raw), app.sim.positions(), {
              name: nameInput.value.trim() || undefined,
            });
            if (!cue) return app.toast('Nothing moved since the end of the last cue. Jog an axis first.');
            if (app.apply(next, { standby: next.cues.length })) app.toast(`Recorded Q${cue.id}: ${cue.moves.length} move${cue.moves.length === 1 ? '' : 's'}.`);
          },
        },
        iconEl('record'),
        'Record cue',
      ),
    ),
    cues.length ? null : h('p', { class: 'muted' }, 'No cues yet.'),
    cues.map((c, ci) => cueCard(c, ci)),
  );

  function cueCard(c, ci) {
    const pf = app.preflight?.[ci];
    const worst = pf?.conflicts.length ? pf.conflicts.reduce((a, b) => (b.minGap < a.minGap ? b : a)) : null;
    const q = `Q${c.id}`;
    const fk = (k) => `cue:${c.id}:${k}`;
    return h(
      'div',
      { class: 'cue-card' },
      h(
        'div',
        { class: 'cue-card-head' },
        h('span', { class: 'num tnum' }, q),
        h('input', { type: 'text', value: c.name ?? '', 'aria-label': `${q} name`, 'data-fk': fk('name'), onchange: (e) => edit((cs) => (cs[ci].name = e.target.value)) }),
        worst
          ? h('span', { class: 'badge warn' }, iconEl('warn'), worst.severity === 'contact' ? 'CONTACT' : `min ${formatGap(worst.minGap)}`)
          : pf
            ? h('span', { class: 'badge ok' }, iconEl('check'), h('span', { class: 'sr-only' }, 'clear'))
            : null,
      ),
      worst ? h('p', { class: 'flag' }, `${worst.aName} ↔ ${worst.bName} at t=${worst.tMin.toFixed(2)} s`) : null,
      c.moves?.length
        ? h(
            'table',
            { class: 'moves' },
            h('caption', { class: 'sr-only' }, `${q} moves`),
            h('colgroup', {}, h('col', { class: 'c-axis' }), h('col', { class: 'c-target' }), h('col', { class: 'c-delay' }), h('col', { class: 'c-x' })),
            h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Axis'), h('th', { scope: 'col' }, 'Target'), h('th', { scope: 'col' }, 'Delay (s)'), h('th', {}, h('span', { class: 'sr-only' }, 'Remove')))),
            h(
              'tbody',
              {},
              c.moves.map((m, mi) => {
                const axisName = axes.find((a) => a.id === m.axis)?.name ?? m.axis;
                return h(
                  'tr',
                  {},
                  h(
                    'td',
                    {},
                    select(
                      axes.map((a) => [a.id, a.name ?? a.id]),
                      m.axis,
                      (v) => edit((cs) => (cs[ci].moves[mi].axis = v)),
                      { 'aria-label': `${q} move ${mi + 1} axis`, title: axisName, 'data-fk': fk(`m${mi}:axis`) },
                    ),
                  ),
                  h(
                    'td',
                    {},
                    h(
                      'span',
                      { class: 'unit-input' },
                      num(m.target, (v) => edit((cs) => (cs[ci].moves[mi].target = v)), { 'aria-label': `${q} ${axisName} target`, 'data-fk': fk(`m${mi}:target`) }),
                      h('span', { class: 'unit', 'aria-hidden': 'true' }, unitFor.get(m.axis) ?? ''),
                    ),
                  ),
                  h(
                    'td',
                    {},
                    num(m.delay ?? 0, (v) => edit((cs) => (cs[ci].moves[mi].delay = Math.max(0, v))), {
                      min: 0,
                      'aria-label': `${q} ${axisName} delay in seconds`,
                      'data-fk': fk(`m${mi}:delay`),
                    }),
                  ),
                  h(
                    'td',
                    {},
                    h(
                      'button',
                      { type: 'button', class: 'icon', 'aria-label': `Remove ${axisName} from ${q}`, title: 'Remove move', 'data-fk': fk(`m${mi}:x`), onclick: () => edit((cs) => cs[ci].moves.splice(mi, 1)) },
                      iconEl('close'),
                    ),
                  ),
                );
              }),
            ),
          )
        : h('p', { class: 'hint' }, 'No moves: this cue does nothing yet.'),
      h(
        'div',
        { class: 'btn-row' },
        axes.length
          ? h(
              'button',
              {
                type: 'button',
                class: 'btn-small',
                'data-fk': fk('add'),
                onclick: () => {
                  const used = new Set(c.moves.map((m) => m.axis));
                  const a = axes.find((x) => !used.has(x.id)) ?? axes[0];
                  edit((cs) => cs[ci].moves.push({ axis: a.id, target: a.home ?? 0 }));
                },
              },
              iconEl('plus'),
              'Move',
            )
          : null,
        h(
          'label',
          { class: 'check-row inline' },
          h('input', { type: 'checkbox', checked: !!c.follow, 'data-fk': fk('follow'), onchange: (e) => edit((cs) => (cs[ci].follow = e.target.checked)) }),
          'Auto-follow',
        ),
        h('span', { class: 'spacer' }),
        h(
          'button',
          { type: 'button', class: 'icon', 'aria-label': `Move ${q} up`, title: 'Move up', 'data-fk': fk('up'), disabled: ci === 0, onclick: () => edit((cs) => cs.splice(ci - 1, 0, cs.splice(ci, 1)[0])) },
          iconEl('up'),
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'icon',
            'aria-label': `Move ${q} down`,
            title: 'Move down',
            'data-fk': fk('down'),
            disabled: ci === cues.length - 1,
            onclick: () => edit((cs) => cs.splice(ci + 1, 0, cs.splice(ci, 1)[0])),
          },
          iconEl('down'),
        ),
        h(
          'button',
          { type: 'button', class: 'icon danger', 'aria-label': `Delete ${q}`, title: 'Delete cue', 'data-fk': fk('del'), onclick: () => confirm(`Delete ${q}?`) && edit((cs) => cs.splice(ci, 1)) },
          iconEl('trash'),
        ),
      ),
    );
  }
}
