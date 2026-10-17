// Import dialog: pick units, up axis and origin while previewing the model on stage.

import { h, select, field } from './dom.js';
import { guessUnits, UNIT_SCALES } from '../../model/import.js';
import { ModelView, modelSettings } from '../../model/modelView.js';

const UNIT_LABELS = { m: 'Meters', cm: 'Centimeters', mm: 'Millimeters', in: 'Inches', ft: 'Feet' };
const TRI_WARN = 1_500_000;

/**
 * @param app      the app API from main.js
 * @param imported { scene, name, stats } from readModelFiles()
 */
export function openImportDialog(app, imported) {
  const prev = { raw: app.raw, source: app.source };
  const s = { unit: guessUnits(imported.scene), upAxis: 'y', origin: 'keep', floor: true };
  const guessed = s.unit;

  const sizeLine = h('p', { class: 'mono size' });
  const body = h('div', { class: 'modal-body' });
  const dlg = h(
    'div',
    { class: 'modal', role: 'dialog', 'aria-label': 'Import model' },
    h('h2', {}, `Import “${imported.name}”`),
    body,
    h(
      'div',
      { class: 'modal-actions' },
      h('button', { class: 'file-btn', onclick: cancel }, 'Cancel'),
      h('button', { class: 'btn btn-go small', onclick: accept }, 'Import'),
    ),
  );
  const overlay = h('div', { class: 'modal-wrap' }, dlg);
  document.getElementById('stage').append(overlay);

  function render() {
    body.replaceChildren(
      ...[
      h(
        'p',
        { class: 'muted' },
        `${imported.stats.meshes} meshes · ${imported.stats.triangles.toLocaleString()} triangles · ${imported.stats.nodes} nodes`,
      ),
      ...(imported.notes ?? []).map((n) => h('p', { class: 'hint' }, n)),
      imported.stats.triangles > TRI_WARN
        ? h('p', { class: 'warn-text' }, 'Large model: it may be slow on phones. Consider simplifying the export.')
        : null,
      field(
        'Units',
        select(
          Object.keys(UNIT_SCALES).map((u) => [u, UNIT_LABELS[u] + (u === guessed ? ' (guessed)' : '')]),
          s.unit,
          (v) => update({ unit: v }),
        ),
      ),
      field('Up axis', select([['y', 'Y up (glTF standard)'], ['z', 'Z up (CAD style)']], s.upAxis, (v) => update({ upAxis: v })), 'If the set is lying on its back, switch this.'),
      field(
        'Origin',
        select(
          [
            ['keep', 'Keep drawing origin'],
            ['floor', 'Center it, lowest point on the floor'],
          ],
          s.origin,
          (v) => update({ origin: v }),
        ),
      ),
      field(
        'Stage floor',
        select(
          [
            ['yes', 'Add a floor at height 0'],
            ['no', 'None (the model has its own deck)'],
          ],
          s.floor ? 'yes' : 'no',
          (v) => update({ floor: v === 'yes' }),
        ),
        'Visual only. Turn it off if the model has a deck with traps or a pit.',
      ),
      sizeLine,
      h('p', { class: 'hint' }, 'Check one known dimension (e.g. proscenium width) against the size above.'),
      ].filter(Boolean),
    );
  }

  function rawFor() {
    let model = { ...modelSettings({ name: imported.name, unit: s.unit, upAxis: s.upAxis }), floor: s.floor };
    if (s.origin === 'floor') {
      const b = new ModelView(imported.scene, model).bounds();
      model = { ...model, offset: [-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2] };
    }
    return { name: imported.name, clearance: 0.15, model, axes: [], pieces: [], cues: [] };
  }

  function update(patch) {
    Object.assign(s, patch);
    render();
    preview();
  }

  function preview() {
    const raw = rawFor();
    app.load(raw, imported.scene, { quiet: true });
    const b = new ModelView(imported.scene, raw.model).bounds();
    const sz = b.max.clone().sub(b.min);
    sizeLine.textContent = `Size: ${sz.x.toFixed(2)} m wide × ${sz.y.toFixed(2)} m high × ${sz.z.toFixed(2)} m deep`;
    app.frameModel();
  }

  function accept() {
    overlay.remove();
    app.load(rawFor(), imported.scene);
    app.log.info(`Imported model "${imported.name}" (${UNIT_LABELS[s.unit]}, ${s.upAxis.toUpperCase()} up). Pick objects in Rig mode to make moving pieces.`);
    app.setMode('rig');
  }

  function cancel() {
    overlay.remove();
    app.load(prev.raw, prev.source, { quiet: true });
  }

  render();
  preview();
}
