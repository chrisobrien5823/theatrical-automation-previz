// Rig mode panel: Model (outliner + piece inspector), Axes (setup + jog), Cues (record + edit).

import { h, add, select, num, field } from './dom.js';
import { AXIS_KINDS, makePiece, refitPiece, setMount, createAxisForPiece, updateAxis, originFromPiece, overlappingPiece } from './rigOps.js';
import { removeAxis, modelPositions } from '../../core/edit.js';
import { renderCueEditor } from './cueEditor.js';
import { nodeAt } from '../../model/modelView.js';
import { unitOf } from '../format.js';

export function createRigPanel(el, app) {
  let tab = 'model';
  let filter = '';
  const expanded = new Set(['']);
  const scrollTops = {};

  function rerender() {
    const prevBody = el.querySelector('.rig-body');
    if (prevBody) scrollTops[tab] = prevBody.scrollTop;
    const body = h('div', { class: 'rig-body' });
    if (tab === 'model') renderModel(body);
    else if (tab === 'axes') renderAxes(body);
    else renderCueEditor(body, app);
    el.replaceChildren(
      h(
        'nav',
        { class: 'tabs', role: 'tablist' },
        ['model', 'axes', 'cues'].map((t) =>
          h('button', { role: 'tab', 'aria-selected': String(t === tab), onclick: () => ((tab = t), rerender()) }, t[0].toUpperCase() + t.slice(1)),
        ),
      ),
      h(
        'label',
        { class: 'check-row' },
        h('input', { type: 'checkbox', checked: app.boxesVisible, onchange: (e) => app.setBoxesVisible(e.target.checked) }),
        'Show collision boxes',
      ),
      body,
    );
    body.scrollTop = scrollTops[tab] ?? 0;
  }

  // ---------- Model tab ----------

  function renderModel(body) {
    if (!app.source) {
      add(body, 
        h('p', { class: 'muted' }, 'No model loaded. Use “Open…” (or drag a .glb / .gltf onto the stage) to import a set model.'),
        app.raw.pieces?.length ? h('p', { class: 'hint' }, 'The demo show uses hand-written boxes; its axes can still be jogged in the Axes tab.') : null,
      );
      if (app.selection.pieceId) add(body, pieceInspector(app.raw.pieces.find((p) => p.id === app.selection.pieceId)));
      return;
    }
    add(body, 
      h('input', {
        type: 'search',
        class: 'search',
        placeholder: 'Find object…',
        value: filter,
        oninput: (e) => {
          filter = e.target.value.trim().toLowerCase();
          const tree = el.querySelector('.tree');
          tree.replaceWith(renderTree());
        },
      }),
      renderTree(),
      inspector(),
    );
  }

  function renderTree() {
    // Open the first two levels (CAD exports usually wrap everything in a root or two) and the
    // path down to whatever is selected, so a click in 3D shows up in the list.
    expanded.add('0');
    const sel = app.selection.path;
    if (sel) {
      const parts = sel.split('/');
      for (let i = 1; i < parts.length; i++) expanded.add(parts.slice(0, i).join('/'));
    }
    const pieceByNode = new Map((app.raw.pieces ?? []).filter((p) => p.node != null).map((p) => [p.node, p]));
    const axisName = new Map((app.raw.axes ?? []).map((a) => [a.id, a.name ?? a.id]));
    const rows = [];
    const matches = (o) => !filter || (o.name || '').toLowerCase().includes(filter);
    const subtreeMatches = (o) => matches(o) || o.children.some(subtreeMatches);

    function walk(o, path, depth) {
      if (filter && !subtreeMatches(o)) return;
      const piece = pieceByNode.get(path);
      const open = filter ? true : expanded.has(path);
      const hasKids = o.children.length > 0;
      rows.push(
        h(
          'div',
          {
            class: `tree-row${app.selection.path === path ? ' selected' : ''}${piece ? ' is-piece' : ''}`,
            style: { paddingLeft: `${6 + depth * 14}px` },
            onclick: () => app.select({ path, pieceId: piece?.id ?? null }),
          },
          h(
            'span',
            {
              class: 'twisty',
              onclick: (e) => {
                e.stopPropagation();
                if (!hasKids) return;
                open ? expanded.delete(path) : expanded.add(path);
                rerender();
              },
            },
            hasKids ? (open ? '▾' : '▸') : '',
          ),
          h('span', { class: 'tree-name' }, o.name || (o.isMesh ? '(mesh)' : '(group)')),
          piece ? h('span', { class: 'tag' }, piece.mount ? `◆ ${axisName.get(piece.mount) ?? piece.mount}` : 'static') : null,
        ),
      );
      if (open) o.children.forEach((c, i) => walk(c, path === '' ? String(i) : `${path}/${i}`, depth + 1));
    }
    walk(app.source, '', 0);
    return h('div', { class: 'tree' }, rows);
  }

  function inspector() {
    const { path, pieceId } = app.selection;
    if (path == null && !pieceId) return h('div', { class: 'inspector muted' }, 'Click an object in the 3D view or the list above.');
    const piece = pieceId ? app.raw.pieces.find((p) => p.id === pieceId) : null;
    if (piece) return pieceInspector(piece);

    const obj = nodeAt(app.source, path);
    const overlap = overlappingPiece(app.raw, path);
    let meshes = 0;
    obj?.traverse((o) => o.isMesh && meshes++);
    return h(
      'div',
      { class: 'inspector' },
      h('h3', {}, obj?.name || '(unnamed)'),
      h('p', { class: 'muted' }, `${meshes} mesh${meshes === 1 ? '' : 'es'} · static scenery`),
      obj?.parent && path !== ''
        ? h('button', { class: 'link', onclick: () => app.select({ path: path.split('/').slice(0, -1).join('/'), pieceId: null }) }, '↑ Select parent group')
        : null,
      overlap
        ? h('p', { class: 'hint' }, `Part of piece “${overlap.name}”. `, h('button', { class: 'link', onclick: () => app.select({ path: overlap.node, pieceId: overlap.id }) }, 'Select it'))
        : meshes === 0
          ? h('p', { class: 'hint' }, 'No geometry here.')
          : h(
              'div',
              { class: 'btn-row' },
              h('button', { class: 'btn-small primary', onclick: () => make('one') }, 'Make piece'),
              meshes > 1 ? h('button', { class: 'btn-small', onclick: () => make('parts') }, 'Make piece (box per part)') : null,
            ),
      h('p', { class: 'hint' }, 'A piece is collision-checked. Leave it static for walls and pipes, or give it an axis to make it move.'),
    );

    function make(mode) {
      try {
        const { raw, id } = makePiece(app.raw, app.source, path, obj.name, mode);
        if (app.apply(raw)) app.select({ path, pieceId: id });
      } catch (err) {
        app.toast(err.message);
      }
    }
  }

  function pieceInspector(piece) {
    if (!piece) return h('div');
    const axes = app.raw.axes ?? [];
    const idx = app.raw.pieces.indexOf(piece);
    const edit = (patch) => {
      const raw = structuredClone(app.raw);
      Object.assign(raw.pieces[idx], patch);
      app.apply(raw);
    };
    const mountOptions = [
      ['', 'Static (does not move)'],
      ...axes.map((a) => [a.id, a.name ?? a.id]),
      ...Object.entries(AXIS_KINDS).map(([k, v]) => [`new:${k}`, `＋ New ${v.label}${piece.mount ? ' (stacked)' : ''}`]),
    ];
    return h(
      'div',
      { class: 'inspector' },
      h('h3', {}, piece.name),
      field('Name', h('input', { type: 'text', value: piece.name, onchange: (e) => edit({ name: e.target.value || piece.id }) })),
      field(
        'Moves with',
        select(mountOptions, piece.mount ?? '', (v) => {
          if (v.startsWith('new:')) {
            const { raw, id } = createAxisForPiece(app.raw, v.slice(4), piece.id);
            if (app.apply(raw)) app.toast(`Created axis “${raw.axes.find((a) => a.id === id).name}”. Jog it in the Axes tab.`);
          } else app.apply(setMount(app.raw, piece.id, v));
        }),
        piece.mount ? null : 'New axes are centered on this piece.',
      ),
      h(
        'label',
        { class: 'check-row' },
        h('input', { type: 'checkbox', checked: piece.check !== false, onchange: (e) => edit({ check: e.target.checked }) }),
        'Collision-checked',
      ),
      piece.node != null
        ? field(
            'Collision fit',
            select(
              [
                ['one', 'One box'],
                ['parts', 'Box per part'],
              ],
              piece.fit ?? 'one',
              (v) => {
                try {
                  app.apply(refitPiece(app.raw, app.source, piece.id, v));
                } catch (err) {
                  app.toast(err.message);
                }
              },
            ),
            `${piece.boxes?.length ?? 1} box${(piece.boxes?.length ?? 1) === 1 ? '' : 'es'}. Use box per part for L-shapes and units with gaps.`,
          )
        : null,
      piece.node != null
        ? h(
            'button',
            {
              class: 'btn-small danger',
              onclick: () => {
                const raw = structuredClone(app.raw);
                raw.pieces.splice(idx, 1);
                if (app.apply(raw)) app.select({ path: piece.node, pieceId: null });
              },
            },
            'Remove piece',
          )
        : null,
    );
  }

  // ---------- Axes tab ----------

  function renderAxes(body) {
    const axes = app.raw.axes ?? [];
    const sim = app.sim;
    const idle = sim.state === 'idle';
    add(body, 
      h(
        'div',
        { class: 'btn-row' },
        h('button', { class: 'btn-small', disabled: !idle, onclick: () => app.setPositions(modelPositions(app.show)) }, 'Model positions'),
        h('button', { class: 'btn-small', disabled: !idle, onclick: () => app.setPositions(Object.fromEntries(app.show.axes.map((a) => [a.id, a.home]))) }, 'Home'),
      ),
      axes.length ? null : h('p', { class: 'muted' }, 'No axes yet. Select a piece in the Model tab and choose “＋ New …” under “Moves with”.'),
      axes.map((a) => axisCard(a, idle)),
    );
  }

  function axisCard(a, idle) {
    const def = app.show.axes.find((x) => x.id === a.id);
    const u = unitOf(def);
    const pos = app.sim.positions()[a.id];
    const patch = (p) => app.apply(updateAxis(app.raw, a.id, p));
    const descendants = (id) => app.raw.axes.filter((x) => x.parent === id).flatMap((x) => [x.id, ...descendants(x.id)]);
    const parentOptions = [['', '(stage)'], ...app.raw.axes.filter((x) => x.id !== a.id && !descendants(a.id).includes(x.id)).map((x) => [x.id, x.name ?? x.id])];
    const lo = Number.isFinite(def.min) ? def.min : def.modelPosition - 10;
    const hi = Number.isFinite(def.max) ? def.max : def.modelPosition + 10;
    const readout = h('span', { class: 'mono jog-val' }, `${pos.toFixed(def.type === 'rotary' ? 1 : 3)} ${u.pos}`);
    const sel = app.selection.pieceId;
    const dirKey = def.type === 'linear' ? dirName(def.direction) : null;

    return h(
      'div',
      { class: 'axis-card' },
      h(
        'div',
        { class: 'axis-card-head' },
        h('input', { type: 'text', class: 'axis-title', value: a.name ?? a.id, onchange: (e) => patch({ name: e.target.value || a.id }) }),
        h('span', { class: 'tag' }, AXIS_KINDS[a.kind]?.label ?? (def.type === 'rotary' ? 'Rotary' : 'Linear')),
      ),
      h(
        'div',
        { class: 'jog' },
        h('input', {
          type: 'range',
          min: lo,
          max: hi,
          step: def.type === 'rotary' ? 0.5 : 0.005,
          value: pos,
          disabled: !idle,
          oninput: (e) => {
            const v = Number(e.target.value);
            readout.textContent = `${v.toFixed(def.type === 'rotary' ? 1 : 3)} ${u.pos}`;
            app.setPositions({ ...app.sim.positions(), [a.id]: v });
          },
        }),
        readout,
      ),
      h(
        'details',
        {},
        h('summary', {}, 'Setup'),
        h(
          'div',
          { class: 'grid2' },
          field('Rides on', select(parentOptions, a.parent ?? '', (v) => patch({ parent: v || undefined }))),
          def.type === 'linear'
            ? field(
                'Travel',
                select(
                  [
                    ['y', 'Vertical'],
                    ['x', 'SL ↔ SR'],
                    ['z', 'US ↔ DS'],
                    ...(dirKey === 'custom' ? [['custom', 'Custom']] : []),
                  ],
                  dirKey,
                  (v) => patch({ direction: { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[v] }),
                ),
              )
            : h('span'),
          field(`Home (${u.pos})`, num(a.home ?? 0, (v) => patch({ home: v }))),
          field(`Drawn at (${u.pos})`, num(def.modelPosition, (v) => patch({ modelPosition: v })), 'Position shown in the model'),
          field(`Min (${u.pos})`, num(a.min, (v) => patch({ min: v }))),
          field(`Max (${u.pos})`, num(a.max, (v) => patch({ max: v }))),
          field(`Speed (${u.vel})`, num(a.vMax, (v) => patch({ vMax: v }), { min: 0 })),
          field(`Accel (${u.pos}/s²)`, num(a.aMax, (v) => patch({ aMax: v }), { min: 0 })),
        ),
        h(
          'div',
          { class: 'origin-row' },
          h('span', { class: 'field-label' }, def.type === 'rotary' ? 'Pivot (x, y, z m)' : 'Origin (x, y, z m)'),
          [0, 1, 2].map((i) =>
            num(a.origin?.[i] ?? 0, (v) => {
              const o = [...(a.origin ?? [0, 0, 0])];
              o[i] = v;
              patch({ origin: o });
            }),
          ),
        ),
        h(
          'div',
          { class: 'btn-row' },
          sel ? h('button', { class: 'btn-small', onclick: () => app.apply(originFromPiece(app.raw, a.id, sel)) }, 'Center on selected piece') : null,
          h(
            'button',
            {
              class: 'btn-small danger',
              onclick: () => {
                if (confirm(`Delete axis “${a.name ?? a.id}”? Its pieces stay where they are, as static scenery, and its cue moves are removed.`)) {
                  app.apply(removeAxis(app.raw, a.id));
                }
              },
            },
            'Delete axis',
          ),
        ),
      ),
    );
  }

  return {
    rerender,
    showTab(t) {
      tab = t;
      rerender();
    },
    /** Light refresh for jog readouts / selection without losing input focus. */
    refreshSelection() {
      if (tab === 'model') rerender();
    },
  };
}

function dirName(d) {
  const [x, y, z] = d;
  if (Math.abs(y) > 0.999) return 'y';
  if (Math.abs(x) > 0.999) return 'x';
  if (Math.abs(z) > 0.999) return 'z';
  return 'custom';
}
