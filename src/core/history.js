// Undo / redo for Rig-mode edits.
//
// Every Rig edit is pure (src/core/edit.js and rigOps take a raw show document and return a new one),
// so history is just two stacks of whole documents: no inverse operations to write or get wrong.
// Documents are never mutated after they are handed to the app, so the stacks can hold references.

export class History {
  /**
   * @param {object} [opts]
   * @param {number} [opts.limit=100]    most undo steps kept; the oldest fall off
   * @param {number} [opts.mergeMs=1500] edits with the same `merge` key this close together are one step
   */
  constructor({ limit = 100, mergeMs = 1500 } = {}) {
    this.limit = limit;
    this.mergeMs = mergeMs;
    this.clear();
  }

  clear() {
    this.past = []; // [{ raw, label, merge, at }], newest last; raw is the document BEFORE the edit
    this.future = []; // [{ raw, label }], next redo last; raw is the document AFTER the undone edit
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }

  /** Label of the step Undo would revert, or null. */
  get undoLabel() {
    return this.past.at(-1)?.label ?? null;
  }

  /** Label of the step Redo would re-apply, or null. */
  get redoLabel() {
    return this.future.at(-1)?.label ?? null;
  }

  /**
   * Record that an edit replaced `before` with `after`.
   * `merge` (optional) is a key like "axis:lift:speed": a repeat of the same key within `mergeMs`
   * folds into the previous step, so nudging one field several times undoes in one go.
   * A new edit always drops the redo stack, as in any editor.
   */
  record(before, after, { label = 'Edit', merge = null, now = Date.now() } = {}) {
    if (before === after) return false;
    this.future = [];
    const last = this.past.at(-1);
    if (merge && last && last.merge === merge && now - last.at <= this.mergeMs) {
      last.at = now; // keep the older `before`, so one Undo goes back past every merged edit
      return true;
    }
    this.past.push({ raw: before, label, merge, at: now });
    if (this.past.length > this.limit) this.past.splice(0, this.past.length - this.limit);
    return true;
  }

  /**
   * Step back from `current`. `apply(raw)` loads the older document and returns true if it took;
   * the stacks only change when it did, so a document the app refuses leaves history untouched.
   * Returns the label of the undone step, or null.
   */
  undo(current, apply) {
    const step = this.past.at(-1);
    if (!step || !apply(step.raw)) return null;
    this.past.pop();
    this.future.push({ raw: current, label: step.label });
    return step.label;
  }

  /** Re-apply the last undone step from `current`, the same way. Returns its label, or null. */
  redo(current, apply) {
    const step = this.future.at(-1);
    if (!step || !apply(step.raw)) return null;
    this.future.pop();
    // Never merged into: a redone step stays its own step.
    this.past.push({ raw: current, label: step.label, merge: null, at: -Infinity });
    return step.label;
  }
}

// ---------- Step labels ----------

const FIELD_NAMES = {
  name: 'name',
  vMax: 'speed',
  aMax: 'accel',
  jMax: 'jerk',
  home: 'home',
  min: 'min',
  max: 'max',
  modelPosition: 'drawn-at position',
  origin: 'origin',
  direction: 'direction',
  parent: 'rides on',
  mount: 'mount',
  fit: 'boxes',
  follow: 'follow',
  moves: 'moves',
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const nameOf = (o) => o?.name ?? o?.id ?? '?';
const byId = (list) => new Map((list ?? []).map((o) => [o.id, o]));

/**
 * A short label for what changed between two show documents, for the Undo / Redo buttons and toasts
 * ("Remove axis “Lift”", "Lift speed", "Record Q4"). Also returns a `merge` key for edits to a single
 * field, so repeated nudges of one field (spinner clicks) become one undo step; structural edits
 * (adding, removing, reordering) never merge.
 */
export function describeEdit(before, after) {
  for (const [kind, key] of [
    ['piece', 'pieces'],
    ['axis', 'axes'],
  ]) {
    const a = byId(before?.[key]);
    const b = byId(after?.[key]);
    const added = [...b.keys()].filter((id) => !a.has(id));
    const removed = [...a.keys()].filter((id) => !b.has(id));
    if (added.length) return { label: `Add ${kind} “${nameOf(b.get(added[0]))}”`, merge: null };
    if (removed.length) return { label: `Remove ${kind} “${nameOf(a.get(removed[0]))}”`, merge: null };
  }

  const ca = before?.cues ?? [];
  const cb = after?.cues ?? [];
  if (cb.length > ca.length) {
    const ids = new Set(ca.map((c) => c.id));
    const added = cb.find((c) => !ids.has(c.id)) ?? cb.at(-1);
    return { label: `Record Q${added.id}`, merge: null };
  }
  if (cb.length < ca.length) {
    const ids = new Set(cb.map((c) => c.id));
    const gone = ca.find((c) => !ids.has(c.id)) ?? ca.at(-1);
    return { label: `Delete Q${gone.id}`, merge: null };
  }
  if (!same(ca.map((c) => c.id), cb.map((c) => c.id))) return { label: 'Reorder cues', merge: null };

  // Remounting or re-parenting re-derives every piece's offset and yaw (preserveFrames), so look for
  // a named field first and only fall back to those side effects when nothing else changed.
  let fallback = null;
  for (const [kind, key] of [
    ['axis', 'axes'],
    ['piece', 'pieces'],
  ]) {
    const a = byId(before?.[key]);
    for (const o of after?.[key] ?? []) {
      const field = changedField(a.get(o.id), o);
      if (!field) continue;
      const step = fieldStep(kind, o.id, nameOf(a.get(o.id)), field);
      if (field in FIELD_NAMES) return step;
      fallback ??= step;
    }
  }
  for (let i = 0; i < cb.length; i++) {
    const field = changedField(ca[i], cb[i]);
    if (!field) continue;
    if (field === 'moves' && ca[i].moves.length !== cb[i].moves.length) {
      return { label: `${cb[i].moves.length > ca[i].moves.length ? 'Add move to' : 'Remove move from'} Q${cb[i].id}`, merge: null };
    }
    if (field === 'moves') {
      const mi = cb[i].moves.findIndex((m, j) => !same(m, ca[i].moves[j]));
      const mf = changedField(ca[i].moves[mi], cb[i].moves[mi]);
      return { label: `Q${cb[i].id} ${mf === 'axis' ? 'move axis' : mf}`, merge: `cue:${cb[i].id}:m${mi}:${mf}` };
    }
    return fieldStep('cue', cb[i].id, `Q${cb[i].id}`, field);
  }
  if (!same(before?.clearance, after?.clearance)) return { label: 'Clearance', merge: 'show:clearance' };
  return fallback ?? { label: 'Edit', merge: null };
}

/** The field that changed between two versions of one item. Named fields win over side effects (offset, yaw). */
function changedField(a, b) {
  if (!a || !b) return null;
  const changed = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !same(a[k], b[k]));
  return changed.find((k) => k in FIELD_NAMES) ?? changed[0] ?? null;
}

function fieldStep(kind, id, name, field) {
  // Changing a piece's mount or an axis's parent re-derives offsets too, but it is still one user action.
  const what = FIELD_NAMES[field] ?? field;
  const label = field === 'name' ? `Rename ${kind} “${name}”` : `${name} ${what}`;
  return { label, merge: `${kind}:${id}:${field}` };
}
