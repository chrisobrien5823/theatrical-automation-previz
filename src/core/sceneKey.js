// A fingerprint of everything the 3D scene is built from, so a Rig mode edit can tell whether
// the meshes need rebuilding. Two shows with the same key draw the same scene; only piece poses
// can differ, and those are applied every frame from core poses.
//
// Lists exactly what createPieces (src/render/pieces.js) and ModelView read. If either starts
// reading another field, add it here, or edits to that field will not show up in the scene.

import { piecePoses } from './rig.js';
import { modelPositions } from './edit.js';

export function sceneKey(show) {
  // A model piece's mesh is placed relative to its pose at the axes' model positions, so
  // anything that shifts that pose (axis origin, mount, modelPosition) changes the build.
  // Box pieces are built around their own frame and don't care where it is.
  const modelPoses = show.pieces.some((p) => p.node) ? piecePoses(show, modelPositions(show)) : null;

  const pieces = show.pieces.map((p) => ({
    id: p.id,
    node: p.node,
    size: p.size ?? null,
    shape: p.shape,
    boxes: p.boxes,
    color: p.color,
    check: p.check,
    modelPose: p.node ? modelPoses.get(p.id) : null,
  }));

  const m = show.model;
  const model = m ? { scale: m.scale, upAxis: m.upAxis, offset: m.offset, floor: m.floor } : null;
  return JSON.stringify({ model, pieces });
}
