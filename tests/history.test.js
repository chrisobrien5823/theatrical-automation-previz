import { describe, it, expect } from 'vitest';
import demo from '../src/shows/demo.json';
import { History, describeEdit } from '../src/core/history.js';
import { removeAxis, recordCue, preserveFrames } from '../src/core/edit.js';
import { loadShow } from '../src/core/show.js';

// A tiny stand-in for the app: holds the current document and loads whatever history hands back.
function harness(start, { refuse = () => false } = {}) {
  const app = { raw: start, history: new History() };
  app.edit = (next, opts) => {
    app.history.record(app.raw, next, opts);
    app.raw = next;
  };
  const apply = (raw) => {
    if (refuse(raw)) return false;
    app.raw = raw;
    return true;
  };
  app.undo = () => app.history.undo(app.raw, apply);
  app.redo = () => app.history.redo(app.raw, apply);
  return app;
}

describe('History', () => {
  it('starts empty', () => {
    const h = new History();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.undoLabel).toBe(null);
    expect(h.undo({}, () => true)).toBe(null);
    expect(h.redo({}, () => true)).toBe(null);
  });

  it('undoes and redoes edits in order, with labels', () => {
    const a = { v: 'a' };
    const b = { v: 'b' };
    const c = { v: 'c' };
    const app = harness(a);
    app.edit(b, { label: 'Rename' });
    app.edit(c, { label: 'Move' });
    expect(app.history.undoLabel).toBe('Move');

    expect(app.undo()).toBe('Move');
    expect(app.raw).toBe(b);
    expect(app.history.redoLabel).toBe('Move');
    expect(app.undo()).toBe('Rename');
    expect(app.raw).toBe(a);
    expect(app.history.canUndo).toBe(false);

    expect(app.redo()).toBe('Rename');
    expect(app.raw).toBe(b);
    expect(app.redo()).toBe('Move');
    expect(app.raw).toBe(c);
    expect(app.history.canRedo).toBe(false);
  });

  it('ignores no-op edits', () => {
    const a = { v: 'a' };
    const h = new History();
    expect(h.record(a, a)).toBe(false);
    expect(h.canUndo).toBe(false);
  });

  it('drops the redo stack on a new edit', () => {
    const app = harness({ v: 0 });
    app.edit({ v: 1 });
    app.undo();
    expect(app.history.canRedo).toBe(true);
    app.edit({ v: 2 });
    expect(app.history.canRedo).toBe(false);
    app.undo();
    expect(app.raw.v).toBe(0);
  });

  it('merges repeat edits of the same field inside the window into one step', () => {
    const h = new History({ mergeMs: 1000 });
    const docs = [0, 1, 2, 3, 4].map((v) => ({ v }));
    h.record(docs[0], docs[1], { merge: 'axis:lift:speed', now: 0 });
    h.record(docs[1], docs[2], { merge: 'axis:lift:speed', now: 600 });
    h.record(docs[2], docs[3], { merge: 'axis:lift:speed', now: 1200 }); // 600 ms after the last one
    expect(h.past).toHaveLength(1);
    // A different field, or a long pause, starts a new step.
    h.record(docs[3], docs[4], { merge: 'axis:lift:accel', now: 1300 });
    expect(h.past).toHaveLength(2);
    let raw = docs[4];
    h.undo(raw, (r) => ((raw = r), true));
    h.undo(raw, (r) => ((raw = r), true));
    expect(raw).toBe(docs[0]); // straight back past all three merged speed edits
  });

  it('does not merge after a pause', () => {
    const h = new History({ mergeMs: 1000 });
    h.record({}, {}, { merge: 'k', now: 0 });
    h.record({}, {}, { merge: 'k', now: 5000 });
    expect(h.past).toHaveLength(2);
  });

  it('never merges into a redone step', () => {
    const h = new History({ mergeMs: 1000 });
    const [a, b, c] = [{}, {}, {}];
    let raw = b;
    h.record(a, b, { merge: 'k', now: Date.now() });
    h.undo(raw, (r) => ((raw = r), true));
    h.redo(raw, (r) => ((raw = r), true));
    h.record(b, c, { merge: 'k', now: Date.now() });
    expect(h.past).toHaveLength(2);
  });

  it('keeps at most `limit` steps, dropping the oldest', () => {
    const h = new History({ limit: 3 });
    const docs = [0, 1, 2, 3, 4, 5].map((v) => ({ v }));
    for (let i = 1; i < docs.length; i++) h.record(docs[i - 1], docs[i], { label: `e${i}` });
    expect(h.past.map((s) => s.label)).toEqual(['e3', 'e4', 'e5']);
  });

  it('leaves history untouched when the app refuses a document', () => {
    const a = { v: 'a', bad: true };
    const b = { v: 'b' };
    const app = harness(a, { refuse: (raw) => raw.bad });
    app.edit(b, { label: 'Fix' });
    expect(app.undo()).toBe(null);
    expect(app.raw).toBe(b);
    expect(app.history.canUndo).toBe(true);
    expect(app.history.canRedo).toBe(false);
  });

  it('round-trips real Rig edits on the demo show without touching the documents', () => {
    const app = harness(demo);
    const snapshot = JSON.stringify(demo);
    const axisId = demo.axes[0].id;

    app.edit(removeAxis(app.raw, axisId), { label: 'Remove axis' });
    const from = Object.fromEntries(demo.axes.slice(1).map((a) => [a.id, a.home ?? 0]));
    const to = { ...from, [demo.axes[1].id]: (from[demo.axes[1].id] ?? 0) + 1 };
    const { raw: recorded, cue } = recordCue(app.raw, from, to);
    expect(cue).not.toBe(null);
    app.edit(recorded, { label: `Record Q${cue.id}` });
    expect(loadShow(app.raw).show.axes).toHaveLength(demo.axes.length - 1);

    app.undo();
    app.undo();
    expect(app.raw).toBe(demo);
    expect(JSON.stringify(demo)).toBe(snapshot); // edits are pure: the original was never mutated
    expect(loadShow(app.raw).show.axes).toHaveLength(demo.axes.length);

    app.redo();
    app.redo();
    expect(app.raw).toBe(recorded);
    expect(app.raw.cues.at(-1).id).toBe(cue.id);
  });
});

describe('describeEdit', () => {
  const edit = (fn) => {
    const next = structuredClone(demo);
    fn(next);
    return describeEdit(demo, next);
  };
  const axis = demo.axes[0];
  const piece = demo.pieces[0];

  it('names added and removed pieces and axes, without merging', () => {
    const removed = describeEdit(demo, removeAxis(demo, axis.id));
    expect(removed).toEqual({ label: `Remove axis “${axis.name}”`, merge: null });
    expect(edit((r) => r.pieces.splice(0, 1))).toEqual({ label: `Remove piece “${piece.name}”`, merge: null });
    expect(edit((r) => r.axes.push({ ...axis, id: 'new', name: 'New lift' })).label).toBe('Add axis “New lift”');
  });

  it('names recorded, deleted and reordered cues', () => {
    expect(edit((r) => r.cues.push({ id: '99', moves: [] })).label).toBe('Record Q99');
    expect(edit((r) => r.cues.splice(1, 1)).label).toBe(`Delete Q${demo.cues[1].id}`);
    expect(edit((r) => r.cues.reverse()).label).toBe('Reorder cues');
  });

  it('gives single-field edits a merge key per item and field', () => {
    const speed = edit((r) => (r.axes[0].vMax = 9));
    expect(speed).toEqual({ label: `${axis.name} speed`, merge: `axis:${axis.id}:vMax` });
    expect(edit((r) => (r.axes[0].name = 'Big lift'))).toEqual({ label: `Rename axis “${axis.name}”`, merge: `axis:${axis.id}:name` });
    const cue = demo.cues[0];
    expect(edit((r) => (r.cues[0].moves[0].target += 1))).toEqual({ label: `Q${cue.id} target`, merge: `cue:${cue.id}:m0:target` });
    expect(edit((r) => (r.cues[0].follow = !r.cues[0].follow)).label).toBe(`Q${cue.id} follow`);
    expect(edit((r) => r.cues[0].moves.push({ axis: axis.id, target: 0 })).label).toBe(`Add move to Q${cue.id}`);
  });

  it('labels a remount by the mount, not the offset it re-derives', () => {
    const mounted = demo.pieces.find((p) => p.mount);
    const next = preserveFrames(demo, (r) => (r.pieces.find((p) => p.id === mounted.id).mount = undefined));
    expect(describeEdit(demo, next).label).toBe(`${mounted.name} mount`);
  });

  it('falls back to a plain label', () => {
    expect(describeEdit(demo, structuredClone(demo)).label).toBe('Edit');
  });
});
