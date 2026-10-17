// Editing operations on a raw (un-normalized) show document, used by Rig mode.
// Pure: they take the raw JSON and return a new one, so the UI can rebuild from it.

import { loadShow } from './show.js';
import { piecePoses, axisPoses, relative, IDENTITY } from './rig.js';
import { preflightShow } from './preflight.js';

const DEG = Math.PI / 180;
const clone = (o) => structuredClone(o);

/** Axis positions where the model was drawn. */
export function modelPositions(show) {
  return Object.fromEntries(show.axes.map((a) => [a.id, a.modelPosition]));
}

/**
 * Apply an edit to axes or mounts while keeping every piece exactly where the drawing put it.
 * Captures each piece's world frame at the model positions before the edit, applies `mutate`
 * (which may change mounts, axis origins, parents, model positions...), then re-derives each
 * piece's offset relative to its (possibly new) mount.
 */
export function preserveFrames(raw, mutate) {
  const before = loadShow(raw).show;
  const frames = piecePoses(before, modelPositions(before));
  const next = clone(raw);
  mutate(next);
  const after = loadShow(next).show; // validates the edit too
  const axisAt = axisPoses(after, modelPositions(after));
  for (const p of next.pieces ?? []) {
    const world = frames.get(p.id);
    if (!world) continue; // newly added piece: its offset is already in world terms
    const parent = p.mount ? axisAt.get(p.mount) : IDENTITY;
    const local = relative(parent, world);
    p.offset = [local.x, local.y, local.z];
    p.yaw = local.yaw / DEG;
  }
  return next;
}

export function uniqueId(base, taken) {
  const slug =
    String(base)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'item';
  const ids = new Set(taken);
  if (!ids.has(slug)) return slug;
  for (let i = 2; ; i++) if (!ids.has(`${slug}-${i}`)) return `${slug}-${i}`;
}

/** Remove an axis: pieces on it become static (staying put), child axes move to its parent. */
export function removeAxis(raw, axisId) {
  return preserveFrames(raw, (r) => {
    const axis = r.axes.find((a) => a.id === axisId);
    r.axes = r.axes.filter((a) => a.id !== axisId);
    for (const a of r.axes) if (a.parent === axisId) a.parent = axis?.parent ?? undefined;
    for (const p of r.pieces) if (p.mount === axisId) p.mount = axis?.parent ?? undefined;
    for (const c of r.cues ?? []) c.moves = c.moves.filter((m) => m.axis !== axisId);
  });
}

/**
 * Where every axis is at the end of the cue list (or `home` if there are no cues), so a new
 * cue can be recorded as the difference from that.
 */
export function endOfShowPositions(raw) {
  const show = loadShow(raw).show;
  const home = Object.fromEntries(show.axes.map((a) => [a.id, a.home]));
  if (!show.cues.length) return home;
  const results = preflightShow(show, home, 0);
  return results.at(-1).endPositions;
}

/**
 * Append a cue that moves each axis whose position differs from `from` to its value in `to`.
 * Returns { raw, cue } or { raw, cue: null } if nothing moved.
 */
export function recordCue(raw, from, to, { name, eps = 1e-4 } = {}) {
  const moves = [];
  for (const [axis, target] of Object.entries(to)) {
    if (Math.abs((from[axis] ?? target) - target) > eps) moves.push({ axis, target: round(target) });
  }
  if (!moves.length) return { raw, cue: null };
  const next = clone(raw);
  next.cues ??= [];
  const id = nextCueNumber(next.cues);
  const cue = { id, name: name ?? `Cue ${id}`, moves };
  next.cues.push(cue);
  return { raw: next, cue };
}

function nextCueNumber(cues) {
  const nums = cues.map((c) => Number.parseFloat(c.id)).filter(Number.isFinite);
  return String(nums.length ? Math.floor(Math.max(...nums)) + 1 : 1);
}

function round(v) {
  return Math.round(v * 1000) / 1000;
}
