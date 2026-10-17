// Kinematics: axis positions -> world poses of axes and pieces.
// Every rotation in a stage rig like this is about the vertical (Y) axis, so a pose is
// { x, y, z, yaw } with yaw in radians. Rendering and clearance both use these poses,
// so what you see is exactly what gets checked.
//
// Coordinate convention (matches Three.js): +Y up, +X stage left (house right), +Z downstage.
// Yaw follows Object3D.rotation.y: x' = cos*x + sin*z, z' = -sin*x + cos*z.

const DEG = Math.PI / 180;

export function compose(parent, local) {
  const c = Math.cos(parent.yaw);
  const s = Math.sin(parent.yaw);
  return {
    x: parent.x + c * local.x + s * local.z,
    y: parent.y + local.y,
    z: parent.z - s * local.x + c * local.z,
    yaw: parent.yaw + local.yaw,
  };
}

const IDENTITY = { x: 0, y: 0, z: 0, yaw: 0 };

/** World pose of the moving carriage of each axis, given current axis positions. */
export function axisPoses(show, positions) {
  const byId = new Map(show.axes.map((a) => [a.id, a]));
  const poses = new Map();

  function poseOf(id) {
    if (poses.has(id)) return poses.get(id);
    const a = byId.get(id);
    const parent = a.parent ? poseOf(a.parent) : IDENTITY;
    const pos = positions[id] ?? a.home;
    const [ox, oy, oz] = a.origin;
    const local =
      a.type === 'linear'
        ? { x: ox, y: oy + pos, z: oz, yaw: 0 }
        : { x: ox, y: oy, z: oz, yaw: pos * DEG };
    const pose = compose(parent, local);
    poses.set(id, pose);
    return pose;
  }

  for (const a of show.axes) poseOf(a.id);
  return poses;
}

/** World pose of each piece's box center. */
export function piecePoses(show, positions) {
  const ap = axisPoses(show, positions);
  const out = new Map();
  for (const p of show.pieces) {
    const parent = p.mount ? ap.get(p.mount) : IDENTITY;
    const [x, y, z] = p.offset;
    out.set(p.id, compose(parent, { x, y, z, yaw: p.yaw * DEG }));
  }
  return out;
}

/** The chain of axes a piece rides on (its mount, the mount's parent, ...). */
export function mountChain(show, piece) {
  const byId = new Map(show.axes.map((a) => [a.id, a]));
  const chain = [];
  let id = piece.mount;
  while (id) {
    chain.push(id);
    id = byId.get(id).parent;
  }
  return chain;
}
