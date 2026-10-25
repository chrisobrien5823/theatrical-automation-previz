// Rig-mode operations that need the model geometry (fitting) or create axes for pieces.
// Pure show edits live in src/core/edit.js; this file adds the Three.js-dependent parts.

import { ModelView } from '../../model/modelView.js';
import { fitPrism, boxPose, boxesInFrame } from '../../core/fit.js';
import { preserveFrames, uniqueId, modelPositions } from '../../core/edit.js';
import { loadShow, nextTapeColor } from '../../core/show.js';
import { axisPoses, piecePoses, relative, IDENTITY } from '../../core/rig.js';

const DEG = Math.PI / 180;

export const AXIS_KINDS = {
  lift: { label: 'Lift', type: 'linear', direction: [0, 1, 0], min: -3, max: 3, vMax: 0.3, aMax: 0.3 },
  fly: { label: 'Fly', type: 'linear', direction: [0, 1, 0], min: -12, max: 2, vMax: 1.2, aMax: 0.6 },
  wagonX: { label: 'Wagon (SL↔SR)', type: 'linear', direction: [1, 0, 0], min: -10, max: 10, vMax: 0.5, aMax: 0.3 },
  wagonZ: { label: 'Wagon (US↔DS)', type: 'linear', direction: [0, 0, 1], min: -10, max: 10, vMax: 0.5, aMax: 0.3 },
  revolve: { label: 'Revolve', type: 'rotary', min: -360, max: 360, vMax: 15, aMax: 7.5 },
};

/**
 * Fit collision boxes to a model node, measured on a pristine copy of the model at its drawn
 * position. Returns the piece frame (world pose) and boxes in that frame.
 */
export function fitNode(source, model, path, mode = 'one') {
  const mv = new ModelView(source, model);
  const obj = mv.node(path);
  if (!obj) throw new Error(`Model node ${path} not found`);
  const pts = mv.worldPoints(obj);
  if (!pts.length) throw new Error('That object has no geometry to fit');
  const all = fitPrism(pts);
  const frame = boxPose(all);
  const parts =
    mode === 'parts'
      ? mv
          .parts(obj)
          .map((m) => mv.worldPoints(m))
          .filter((p) => p.length)
          .map((p) => fitPrism(p))
      : [all];
  return { frame, boxes: boxesInFrame(frame, parts) };
}

/** Is `path` the same as, inside, or containing another piece's node? Returns that piece. */
export function overlappingPiece(raw, path) {
  const inside = (a, b) => b === '' || a === b || a.startsWith(`${b}/`);
  return (raw.pieces ?? []).find((p) => p.node != null && (inside(path, p.node) || inside(p.node, path))) ?? null;
}

/** Add a static, collision-checked piece for a model node. */
export function makePiece(raw, source, path, name, mode = 'one') {
  const { frame, boxes } = fitNode(source, raw.model, path, mode);
  const next = structuredClone(raw);
  // GLTFLoader turns spaces in node names into underscores; put them back for display.
  const label = (name || '').replace(/_/g, ' ').trim();
  const id = uniqueId(label || `piece ${path}`, next.pieces.map((p) => p.id));
  next.pieces.push({
    id,
    name: label || id,
    node: path,
    offset: [frame.x, frame.y, frame.z],
    yaw: frame.yaw / DEG,
    boxes,
    fit: mode,
    check: true,
  });
  return { raw: next, id };
}

/** Re-fit a piece's boxes (e.g. switching one box <-> box per part), keeping its mount. */
export function refitPiece(raw, source, pieceId, mode) {
  const i = raw.pieces.findIndex((p) => p.id === pieceId);
  const piece = raw.pieces[i];
  const { frame, boxes } = fitNode(source, raw.model, piece.node, mode);
  // Put the refitted piece in world terms as a static piece, then re-mount it in place.
  const staticRaw = structuredClone(raw);
  staticRaw.pieces[i] = { ...piece, mount: undefined, offset: [frame.x, frame.y, frame.z], yaw: frame.yaw / DEG, boxes, fit: mode };
  return preserveFrames(staticRaw, (r) => (r.pieces[i].mount = piece.mount));
}

export function setMount(raw, pieceId, axisId) {
  return preserveFrames(raw, (r) => {
    r.pieces.find((p) => p.id === pieceId).mount = axisId || undefined;
  });
}

/**
 * Create an axis of the given kind centered on a piece and attach the piece to it. If the piece
 * already rides an axis, the new axis is stacked on that one (e.g. a revolve on a wagon).
 */
export function createAxisForPiece(raw, kind, pieceId) {
  const k = AXIS_KINDS[kind];
  const show = loadShow(raw).show;
  const at = modelPositions(show);
  const piece = raw.pieces.find((p) => p.id === pieceId);
  const parentId = piece?.mount || null;
  const world = piece ? piecePoses(show, at).get(pieceId) : IDENTITY;
  const parentPose = parentId ? axisPoses(show, at).get(parentId) : IDENTITY;
  const o = relative(parentPose, world);

  const short = k.label.split(' ')[0];
  const n = raw.axes.filter((a) => (a.name ?? '').startsWith(short)).length + 1;
  const id = uniqueId(`${short} ${n}`, raw.axes.map((a) => a.id));
  const axis = {
    id,
    name: `${short} ${n}`,
    kind,
    type: k.type,
    color: nextTapeColor(show.axes.map((a) => a.color)),
    origin: [o.x, o.y, o.z].map(round),
    ...(k.direction ? { direction: k.direction } : {}),
    ...(parentId ? { parent: parentId } : {}),
    home: 0,
    modelPosition: 0,
    min: k.min,
    max: k.max,
    vMax: k.vMax,
    aMax: k.aMax,
  };
  const next = preserveFrames(raw, (r) => {
    r.axes.push(axis);
    if (piece) r.pieces.find((p) => p.id === pieceId).mount = id;
  });
  return { raw: next, id };
}

/** Change axis fields, keeping all pieces anchored to the drawing. */
export function updateAxis(raw, axisId, patch) {
  return preserveFrames(raw, (r) => Object.assign(r.axes.find((a) => a.id === axisId), patch));
}

/** Move an axis origin onto a piece's center (in the axis parent's frame). */
export function originFromPiece(raw, axisId, pieceId) {
  const show = loadShow(raw).show;
  const at = modelPositions(show);
  const axis = raw.axes.find((a) => a.id === axisId);
  const world = piecePoses(show, at).get(pieceId);
  const parentPose = axis.parent ? axisPoses(show, at).get(axis.parent) : IDENTITY;
  const o = relative(parentPose, world);
  return updateAxis(raw, axisId, { origin: [o.x, o.y, o.z].map(round) });
}

function round(v) {
  return Math.round(v * 10000) / 10000;
}
