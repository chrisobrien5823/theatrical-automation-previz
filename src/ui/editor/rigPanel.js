// Rig mode panel: Model (outliner + piece inspector), Axes (setup + jog), Cues (record + edit).
//
// The panel is rebuilt from the show document after every edit. Rebuilds are coalesced to the end of
// the current task, so a field committed by Tab lets focus land on the next field first; focus and
// open "Setup" sections are then restored on the new DOM.

import { h, add, select, num, field } from './dom.js';
import { AXIS_KINDS, makePiece, refitPiece, setMount, createAxisForPiece, updateAxis, originFromPiece, overlappingPiece } from './rigOps.js';
import { removeAxis, modelPositions } from '../../core/edit.js';
import { renderCueEditor } from './cueEditor.js';
import { nodeAt } from '../../model/modelView.js';
import { unitOf, friendlyName } from '../format.js';
import { iconEl } from '../icons.js';
import { tabKeydown } from '../tabs.js';

const TABS = ['model', 'axes', 'cues'];
const FOCUSABLE = 'button, input, select, textarea, summary, [tabindex]';
const GUIDE_KEY = 'previz.rigGuideHidden';

export function createRigPanel(el, app) {
  let tab = 'model';
  let filter = '';
  let jogged = false;
  let guideHidden = readGuideHidden();
  const expanded = new Set(['']);
  const openSetups = new Set(); // axis ids whose Setup section is open
  const scrollTops = {};
  let pending = false;

  function rerender() {
    if (pending) return;
    pending = true;
    setTimeout(() => {
      pending = false;
      render();
    }, 0);
  }

  function render() {
    // Remember where focus is (by stable key when the element has one, else by position).
    const active = el.contains(document.activeElement) ? document.activeElement : null;
    const focusables = active ? [...el.querySelectorAll(FOCUSABLE)] : [];
    const focusKey = active?.dataset.fk ?? null;
    const focusIndex = active ? focusables.indexOf(active) : -1;
    const prevTab = tab;

    const prevBody = el.querySelector('.rig-body');
    if (prevBody) scrollTops[prevTab] = prevBody.scrollTop;
    const body = h('div', { class: 'rig-body', role: 'tabpanel', id: 'rig-tabpanel', 'aria-labelledby': `rig-tab-${tab}` });
    if (tab === 'model') renderModel(body);
    else if (tab === 'axes') renderAxes(body);
    else renderCueEditor(body, app);

    el.replaceChildren();
    add(
      el,
      h(
        'div',
        {
          class: 'tabs',
          role: 'tablist',
          'aria-label': 'Rig views',
          onkeydown: (e) => tabKeydown(e, (b) => showTab(b.dataset.tab, true)),
        },
        TABS.map((t) =>
          h(
            'button',
            {
              type: 'button',
              role: 'tab',
              id: `rig-tab-${t}`,
              'data-tab': t,
              'data-fk': `tab:${t}`,
              'aria-controls': 'rig-tabpanel',
              'aria-selected': String(t === tab),
              tabindex: t === tab ? '0' : '-1',
              onclick: () => showTab(t),
            },
            t[0].toUpperCase() + t.slice(1),
          ),
        ),
      ),
      guide(),
      body,
      h(
        'label',
        { class: 'check-row rig-foot' },
        h('input', { type: 'checkbox', checked: app.boxesVisible, 'data-fk': 'boxes', onchange: (e) => app.setBoxesVisible(e.target.checked) }),
        'Show collision boxes',
      ),
    );
    body.scrollTop = scrollTops[tab] ?? 0;

    if (active && !el.contains(document.activeElement)) {
      const next = (focusKey && el.querySelector(`[data-fk="${CSS.escape(focusKey)}"]`)) || [...el.querySelectorAll(FOCUSABLE)][focusIndex];
      next?.focus({ preventScroll: true });
    }
  }

  function showTab(t, keepFocus = false) {
    tab = t;
    if (keepFocus) render();
    else rerender();
  }

  // ---------- Get-started guide ----------

  function steps() {
    const raw = app.raw;
    // The guide is about the user's own model: without one, later steps don't count (the demo has axes and cues).
    const own = !!app.source;
    const pieces = own ? (raw.pieces ?? []).filter((p) => p.node != null) : [];
    const axes = own ? (raw.axes ?? []) : [];
    const cues = own ? (raw.cues ?? []) : [];
    return [
      { done: !!app.source, tab: 'model', text: 'Import your set model', hint: 'Vectorworks: File → Export → FBX.' },
      { done: pieces.length > 0, tab: 'model', text: 'Make a piece', hint: 'Click the scenery that moves, then “Make piece”.' },
      { done: axes.length > 0, tab: 'model', text: 'Give it an axis', hint: 'Lift, fly, wagon or revolve, from the piece panel.' },
      { done: (own && jogged) || cues.length > 0, tab: 'axes', text: 'Jog it to the next look', hint: 'Drag the slider; gaps turn red when too close.' },
      { done: cues.length > 0, tab: 'cues', text: 'Record a cue', hint: 'Then switch to Run and press GO.' },
    ];
  }

  function guide() {
    const list = steps();
    const next = list.findIndex((s) => !s.done);
    if (next < 0 || guideHidden) return null;
    return h(
      'section',
      { class: 'guide', 'aria-label': 'Get started' },
      h(
        'div',
        { class: 'guide-head' },
        h('h2', {}, 'Get started'),
        h('span', { class: 'guide-count tnum' }, `${list.filter((s) => s.done).length}/${list.length}`),
        h(
          'button',
          {
            type: 'button',
            class: 'link',
            'data-fk': 'guide:hide',
            onclick: () => {
              guideHidden = true;
              writeGuideHidden(true);
              rerender();
            },
          },
          'Hide',
        ),
      ),
      h(
        'ol',
        { class: 'guide-steps' },
        list.map((s, i) =>
          h(
            'li',
            { class: s.done ? 'done' : i === next ? 'next' : '' },
            h('span', { class: 'guide-mark', 'aria-hidden': 'true' }, s.done ? iconEl('check') : String(i + 1)),
            h(
              'span',
              { class: 'guide-text' },
              i === next
                ? h('button', { type: 'button', class: 'link strong', 'data-fk': `guide:${i}`, onclick: () => showTab(s.tab) }, s.text)
                : h('span', {}, s.text),
              i === next ? h('span', { class: 'hint' }, s.hint) : null,
              h('span', { class: 'sr-only' }, s.done ? ' (done)' : i === next ? ' (next)' : ''),
            ),
          ),
        ),
      ),
    );
  }

  // ---------- Model tab ----------

  function renderModel(body) {
    if (!app.source) {
      add(
        body,
        h(
          'div',
          { class: 'empty-state' },
          h('h3', {}, 'Bring in your set'),
          h('p', {}, 'Import a 3D model of the set, pick the pieces that move, and give each one an axis. The stage view previews everything before you commit.'),
          h(
            'button',
            { type: 'button', class: 'btn-small primary big', 'data-fk': 'import', onclick: () => app.openFilePicker() },
            iconEl('upload'),
            'Import set model…',
          ),
          h('p', { class: 'hint' }, 'FBX (Vectorworks export), glTF / GLB, or OBJ. You can also drag the file onto the stage.'),
          h('button', { type: 'button', class: 'link', 'data-fk': 'sample', onclick: () => app.openSample() }, 'Or try it with a sample set'),
        ),
        app.raw.pieces?.length ? h('p', { class: 'hint' }, 'The demo show is built from simple boxes, so it has no model tree. Its axes can still be jogged in the Axes tab.') : null,
      );
      if (app.selection.pieceId) add(body, pieceInspector(app.raw.pieces.find((p) => p.id === app.selection.pieceId)));
      return;
    }
    add(
      body,
      h('input', {
        type: 'search',
        class: 'search',
        placeholder: 'Find object…',
        'aria-label': 'Find an object in the model',
        'data-fk': 'search',
        value: filter,
        oninput: (e) => {
          filter = e.target.value.trim().toLowerCase();
          el.querySelector('.tree').replaceWith(renderTree());
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

    function toggle(path, hasKids, open) {
      if (!hasKids) return;
      open ? expanded.delete(path) : expanded.add(path);
      rerender();
    }

    function walk(o, path, depth) {
      if (filter && !subtreeMatches(o)) return;
      const piece = pieceByNode.get(path);
      const open = filter ? true : expanded.has(path);
      const hasKids = o.children.length > 0;
      const name = friendlyName(o.name) || (o.isMesh ? '(mesh)' : '(group)');
      rows.push(
        h(
          'div',
          {
            class: `tree-row${app.selection.path === path ? ' selected' : ''}${piece ? ' is-piece' : ''}`,
            role: 'treeitem',
            'aria-level': String(depth + 1),
            'aria-selected': String(app.selection.path === path),
            'aria-expanded': hasKids ? String(open) : null,
            'data-fk': `node:${path}`,
            'data-path': path,
            tabindex: '-1',
            title: o.name && o.name !== name ? o.name : null,
            style: { paddingLeft: `${6 + depth * 14}px` },
            onclick: () => app.select({ path, pieceId: piece?.id ?? null }),
            onkeydown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                app.select({ path, pieceId: piece?.id ?? null });
              } else if (e.key === 'ArrowRight' && hasKids && !open) {
                e.preventDefault();
                toggle(path, hasKids, open);
              } else if (e.key === 'ArrowLeft' && hasKids && open) {
                e.preventDefault();
                toggle(path, hasKids, open);
              }
            },
          },
          h(
            'span',
            {
              class: 'twisty',
              'aria-hidden': 'true',
              onclick: (e) => {
                e.stopPropagation();
                toggle(path, hasKids, open);
              },
            },
            hasKids ? iconEl(open ? 'chevronDown' : 'chevronRight') : '',
          ),
          h('span', { class: 'tree-name' }, name),
          piece ? h('span', { class: 'tag' }, piece.mount ? [iconEl('mount'), axisName.get(piece.mount) ?? piece.mount] : 'static') : null,
        ),
      );
      if (open) o.children.forEach((c, i) => walk(c, path === '' ? String(i) : `${path}/${i}`, depth + 1));
    }
    walk(app.source, '', 0);

    // Roving tabindex: one tab stop for the whole tree (the selected row, else the first).
    const current = rows.find((r) => r.classList.contains('selected')) ?? rows[0];
    if (current) current.tabIndex = 0;
    return h(
      'div',
      {
        class: 'tree',
        role: 'tree',
        'aria-label': 'Model objects',
        onkeydown: (e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
          const items = [...e.currentTarget.querySelectorAll('[role="treeitem"]')];
          const i = items.indexOf(document.activeElement);
          const j = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
          const target = items[Math.max(0, Math.min(items.length - 1, j))];
          if (!target) return;
          e.preventDefault();
          for (const it of items) it.tabIndex = -1;
          target.tabIndex = 0;
          target.focus();
        },
      },
      rows,
    );
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
      h('h3', {}, friendlyName(obj?.name) || '(unnamed)'),
      h('p', { class: 'muted' }, `${meshes} mesh${meshes === 1 ? '' : 'es'} · static scenery`),
      obj?.parent && path !== ''
        ? h('button', { type: 'button', class: 'link', 'data-fk': 'parent', onclick: () => app.select({ path: path.split('/').slice(0, -1).join('/'), pieceId: null }) }, 'Select parent group')
        : null,
      overlap
        ? h('p', { class: 'hint' }, `Part of piece “${overlap.name}”. `, h('button', { type: 'button', class: 'link', onclick: () => app.select({ path: overlap.node, pieceId: overlap.id }) }, 'Select it'))
        : meshes === 0
          ? h('p', { class: 'hint' }, 'No geometry here.')
          : h(
              'div',
              { class: 'btn-row' },
              h('button', { type: 'button', class: 'btn-small primary', 'data-fk': 'make', onclick: () => make('one') }, 'Make piece'),
              meshes > 1 ? h('button', { type: 'button', class: 'btn-small', 'data-fk': 'make-parts', onclick: () => make('parts') }, 'Make piece, box per part') : null,
            ),
      h(
        'p',
        { class: 'hint' },
        'A piece is collision-checked. One box fits the whole object; box per part follows L-shapes and units with gaps. Leave walls and pipes static, or give a piece an axis to make it move.',
      ),
    );

    function make(mode) {
      try {
        const { raw, id } = makePiece(app.raw, app.source, path, friendlyName(obj.name), mode);
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
    const newAxis = (kind) => {
      const { raw, id } = createAxisForPiece(app.raw, kind, piece.id);
      if (app.apply(raw)) app.toast(`Created axis “${raw.axes.find((a) => a.id === id).name}”. Jog it in the Axes tab.`);
    };
    const mountOptions = [['', 'Static (does not move)'], ...axes.map((a) => [a.id, a.name ?? a.id])];
    return h(
      'div',
      { class: 'inspector' },
      h('h3', {}, piece.name),
      field('Name', h('input', { type: 'text', value: piece.name, 'data-fk': 'piece:name', onchange: (e) => edit({ name: e.target.value || piece.id }) })),
      axes.length
        ? field(
            'Moves with',
            select(mountOptions, piece.mount ?? '', (v) => app.apply(setMount(app.raw, piece.id, v)), { 'data-fk': 'piece:mount' }),
          )
        : null,
      h(
        'div',
        { class: 'field' },
        h('span', { class: 'field-label', id: 'new-axis-label' }, piece.mount ? 'Stack a new axis on top' : 'Add an axis'),
        h(
          'div',
          { class: 'btn-row', role: 'group', 'aria-labelledby': 'new-axis-label' },
          Object.entries(AXIS_KINDS).map(([k, v]) =>
            h('button', { type: 'button', class: 'btn-small', 'data-fk': `new-axis:${k}`, onclick: () => newAxis(k) }, iconEl('plus'), v.label),
          ),
        ),
        h('span', { class: 'hint' }, piece.mount ? 'For example a revolve riding a wagon.' : 'New axes are centered on this piece.'),
      ),
      h(
        'label',
        { class: 'check-row' },
        h('input', { type: 'checkbox', checked: piece.check !== false, 'data-fk': 'piece:check', onchange: (e) => edit({ check: e.target.checked }) }),
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
              { 'data-fk': 'piece:fit' },
            ),
            `${piece.boxes?.length ?? 1} box${(piece.boxes?.length ?? 1) === 1 ? '' : 'es'}. Use box per part for L-shapes and units with gaps.`,
          )
        : null,
      piece.node != null
        ? h(
            'button',
            {
              type: 'button',
              class: 'btn-small danger',
              'data-fk': 'piece:remove',
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
    add(
      body,
      axes.length
        ? h(
            'div',
            { class: 'btn-row' },
            h('button', { type: 'button', class: 'btn-small', 'data-fk': 'model-pos', disabled: !idle, onclick: () => app.setPositions(modelPositions(app.show)) }, 'Model positions'),
            h(
              'button',
              { type: 'button', class: 'btn-small', 'data-fk': 'home', disabled: !idle, onclick: () => app.setPositions(Object.fromEntries(app.show.axes.map((a) => [a.id, a.home]))) },
              'Home',
            ),
            idle ? null : h('span', { class: 'hint' }, 'Jog is locked while a cue runs.'),
          )
        : h(
            'div',
            { class: 'empty-state' },
            h('h3', {}, 'No axes yet'),
            h('p', {}, 'Axes are what move: a lift, a fly line, a wagon track or a revolve. Select a piece in the Model tab and use “Add an axis”.'),
            h('button', { type: 'button', class: 'btn-small', 'data-fk': 'to-model', onclick: () => showTab('model') }, 'Go to Model'),
          ),
      axes.map((a) => axisCard(a, idle)),
    );
  }

  function axisKindLabel(a, def) {
    if (AXIS_KINDS[a.kind]) return AXIS_KINDS[a.kind].label;
    if (def.type === 'rotary') return 'Revolve';
    return dirName(def.direction) === 'y' ? 'Vertical' : 'Track';
  }

  /** The axis's spike-tape identity swatch (decorative; the name beside it is the label). */
  function tapeSwatch(color) {
    const el = h('span', { class: 'tape', 'aria-hidden': 'true' });
    el.style.setProperty('--tape', color);
    return el;
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
    const digits = def.type === 'rotary' ? 1 : 3;
    const readout = h('output', { class: 'tnum jog-val' }, `${pos.toFixed(digits)} ${u.pos}`);
    const sel = app.selection.pieceId;
    const dirKey = def.type === 'linear' ? dirName(def.direction) : null;
    const name = a.name ?? a.id;
    const fk = (k) => `axis:${a.id}:${k}`;

    return h(
      'div',
      { class: 'axis-card' },
      h(
        'div',
        { class: 'axis-card-head' },
        tapeSwatch(def.color),
        h('input', { type: 'text', class: 'axis-title', value: name, 'aria-label': 'Axis name', 'data-fk': fk('name'), onchange: (e) => patch({ name: e.target.value || a.id }) }),
        h('span', { class: 'tag' }, axisKindLabel(a, def)),
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
          'aria-label': `${name} position`,
          'aria-valuetext': `${pos.toFixed(digits)} ${u.pos === '°' ? 'degrees' : 'metres'}`,
          'data-fk': fk('jog'),
          oninput: (e) => {
            const v = Number(e.target.value);
            const text = `${v.toFixed(digits)} ${u.pos}`;
            readout.textContent = text;
            e.target.setAttribute('aria-valuetext', `${v.toFixed(digits)} ${u.pos === '°' ? 'degrees' : 'metres'}`);
            jogged = true;
            app.setPositions({ ...app.sim.positions(), [a.id]: v });
          },
          // Tick the guide once the drag ends (rebuilding mid-drag would drop the slider).
          onchange: () => el.querySelector('.guide') && rerender(),
        }),
        readout,
      ),
      h(
        'details',
        {
          open: openSetups.has(a.id),
          ontoggle: (e) => (e.target.open ? openSetups.add(a.id) : openSetups.delete(a.id)),
        },
        h('summary', { 'data-fk': fk('setup') }, 'Setup'),
        h(
          'div',
          { class: 'grid2' },
          field('Rides on', select(parentOptions, a.parent ?? '', (v) => patch({ parent: v || undefined }), { 'data-fk': fk('parent') })),
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
                  { 'data-fk': fk('dir') },
                ),
              )
            : h('span'),
          field(`Home (${u.pos})`, num(a.home ?? 0, (v) => patch({ home: v }), { 'data-fk': fk('home') })),
          field(`Drawn at (${u.pos})`, num(def.modelPosition, (v) => patch({ modelPosition: v }), { 'data-fk': fk('drawn') }), 'Position shown in the model'),
          field(`Min (${u.pos})`, num(a.min, (v) => patch({ min: v }), { 'data-fk': fk('min') })),
          field(`Max (${u.pos})`, num(a.max, (v) => patch({ max: v }), { 'data-fk': fk('max') })),
          field(`Speed (${u.vel})`, num(a.vMax, (v) => patch({ vMax: v }), { min: 0, 'data-fk': fk('v') })),
          field(`Accel (${u.pos}/s²)`, num(a.aMax, (v) => patch({ aMax: v }), { min: 0, 'data-fk': fk('a') })),
        ),
        h(
          'div',
          { class: 'origin-row', role: 'group', 'aria-label': def.type === 'rotary' ? 'Pivot in metres' : 'Origin in metres' },
          h('span', { class: 'field-label' }, def.type === 'rotary' ? 'Pivot (x, y, z m)' : 'Origin (x, y, z m)'),
          ['x', 'y', 'z'].map((axisLetter, i) =>
            num(
              a.origin?.[i] ?? 0,
              (v) => {
                const o = [...(a.origin ?? [0, 0, 0])];
                o[i] = v;
                patch({ origin: o });
              },
              { 'aria-label': axisLetter, 'data-fk': fk(`o${i}`) },
            ),
          ),
        ),
        h(
          'div',
          { class: 'btn-row' },
          sel ? h('button', { type: 'button', class: 'btn-small', 'data-fk': fk('center'), onclick: () => app.apply(originFromPiece(app.raw, a.id, sel)) }, 'Center on selected piece') : null,
          h(
            'button',
            {
              type: 'button',
              class: 'btn-small danger',
              'data-fk': fk('delete'),
              onclick: () => {
                if (confirm(`Delete axis “${name}”? Its pieces stay where they are, as static scenery, and its cue moves are removed.`)) {
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
    showTab,
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

function readGuideHidden() {
  try {
    return localStorage.getItem(GUIDE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeGuideHidden(v) {
  try {
    localStorage.setItem(GUIDE_KEY, v ? '1' : '0');
  } catch {
    // private mode: the guide just comes back next time
  }
}
