// Load + validate a show file (axes, pieces, cues). Returns a normalized copy plus warnings.
// Throws on errors that would make the show unrunnable (missing ids, bad references).

const DEFAULT_CLEARANCE = 0.15;

export function loadShow(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Show file must be a JSON object');
  const warnings = [];
  const errors = [];

  const axes = (raw.axes ?? []).map((a, i) => {
    if (!a.id) errors.push(`axes[${i}] is missing "id"`);
    if (a.type !== 'linear' && a.type !== 'rotary') errors.push(`axis "${a.id}": type must be "linear" or "rotary"`);
    if (!(a.vMax > 0) || !(a.aMax > 0)) errors.push(`axis "${a.id}": vMax and aMax must be > 0`);
    const min = a.min ?? -Infinity;
    const max = a.max ?? Infinity;
    if (min > max) errors.push(`axis "${a.id}": min > max`);
    const home = a.home ?? 0;
    let direction = [0, 1, 0];
    if (a.direction !== undefined) {
      const d = vec3(a.direction, [NaN, NaN, NaN]);
      const len = Math.hypot(...d);
      if (!(len > 0)) errors.push(`axis "${a.id}": direction must be a non-zero [x, y, z]`);
      else if (a.type === 'rotary' && (Math.abs(d[0]) > 1e-9 || Math.abs(d[2]) > 1e-9)) {
        errors.push(`axis "${a.id}": rotary axes can only turn about vertical (direction [0, 1, 0])`);
      } else direction = d.map((v) => v / len);
    }
    return {
      id: a.id,
      name: a.name ?? a.id,
      type: a.type,
      origin: vec3(a.origin),
      direction,
      parent: a.parent ?? null,
      home,
      // Where this axis sits in an imported model's drawing (pieces were drawn at this position).
      modelPosition: a.modelPosition ?? home,
      min,
      max,
      vMax: a.vMax,
      aMax: a.aMax,
    };
  });

  const axisById = new Map();
  for (const a of axes) {
    if (axisById.has(a.id)) errors.push(`duplicate axis id "${a.id}"`);
    axisById.set(a.id, a);
  }
  for (const a of axes) {
    if (a.parent && !axisById.has(a.parent)) errors.push(`axis "${a.id}": unknown parent "${a.parent}"`);
  }
  checkParentCycles(axes, axisById, errors);

  const pieceIds = new Set();
  const pieces = (raw.pieces ?? []).map((p, i) => {
    if (!p.id) errors.push(`pieces[${i}] is missing "id"`);
    if (pieceIds.has(p.id)) errors.push(`duplicate piece id "${p.id}"`);
    pieceIds.add(p.id);
    if (p.mount && !axisById.has(p.mount)) errors.push(`piece "${p.id}": unknown mount axis "${p.mount}"`);
    // Collision boxes in the piece's own frame. A plain box piece is its own single box;
    // model pieces carry boxes fitted to their mesh at rig time.
    let boxes;
    let size = null;
    if (Array.isArray(p.boxes) && p.boxes.length) {
      boxes = p.boxes.map((b) => ({ offset: vec3(b.offset), size: vec3(b.size, [NaN, NaN, NaN]), yaw: b.yaw ?? 0 }));
      if (p.size) size = vec3(p.size, [1, 1, 1]);
    } else {
      if (p.node && !p.size) errors.push(`piece "${p.id}": model pieces need "boxes" (fit them in Rig mode)`);
      size = vec3(p.size, [1, 1, 1]);
      boxes = [{ offset: [0, 0, 0], size, yaw: 0 }];
    }
    for (const b of boxes) if (b.size.some((s) => !(s > 0))) errors.push(`piece "${p.id}": box size values must be > 0`);
    return {
      id: p.id,
      name: p.name ?? p.id,
      mount: p.mount ?? null,
      offset: vec3(p.offset),
      size,
      boxes,
      node: p.node ?? null, // path of the model node this piece draws (null = drawn as a box)
      yaw: p.yaw ?? 0,
      color: p.color ?? '#8a8f98',
      shape: p.shape ?? 'box',
      check: p.check ?? true,
    };
  });

  const ignorePairs = (raw.ignorePairs ?? []).map((pair) => {
    for (const id of pair) if (!pieceIds.has(id)) warnings.push(`ignorePairs: unknown piece "${id}"`);
    return [pair[0], pair[1]];
  });

  const cueIds = new Set();
  const cues = (raw.cues ?? []).map((c, i) => {
    const id = String(c.id ?? i + 1);
    if (cueIds.has(id)) errors.push(`duplicate cue id "${id}"`);
    cueIds.add(id);
    const moves = (c.moves ?? []).map((m) => {
      const axis = axisById.get(m.axis);
      if (!axis) {
        errors.push(`cue ${id}: unknown axis "${m.axis}"`);
        return m;
      }
      let target = m.target;
      if (typeof target !== 'number') errors.push(`cue ${id}: move on "${m.axis}" needs a numeric target`);
      if (target < axis.min || target > axis.max) {
        const clamped = Math.min(axis.max, Math.max(axis.min, target));
        warnings.push(`cue ${id}: ${axis.name} target ${target} outside limits [${axis.min}, ${axis.max}], clamped to ${clamped}`);
        target = clamped;
      }
      let vMax = m.vMax ?? axis.vMax;
      if (vMax > axis.vMax) {
        warnings.push(`cue ${id}: ${axis.name} vMax ${vMax} exceeds axis limit, using ${axis.vMax}`);
        vMax = axis.vMax;
      }
      return { axis: m.axis, target, delay: Math.max(0, m.delay ?? 0), vMax };
    });
    return {
      id,
      name: c.name ?? `Cue ${id}`,
      note: c.note ?? '',
      moves,
      follow: c.follow ?? false,
    };
  });

  let model = null;
  if (raw.model) {
    const scale = raw.model.scale ?? 1;
    if (!(scale > 0)) errors.push('model.scale must be > 0');
    const upAxis = raw.model.upAxis ?? 'y';
    if (upAxis !== 'y' && upAxis !== 'z') errors.push('model.upAxis must be "y" or "z"');
    model = { name: raw.model.name ?? 'model', scale, upAxis, offset: vec3(raw.model.offset) };
  }
  if (!model && pieces.some((p) => p.node)) errors.push('pieces reference model nodes but the show has no "model"');

  if (errors.length) {
    const err = new Error(`Show file has ${errors.length} error(s):\n- ${errors.join('\n- ')}`);
    err.errors = errors;
    throw err;
  }

  return {
    show: {
      name: raw.name ?? 'Untitled show',
      clearance: raw.clearance ?? DEFAULT_CLEARANCE,
      model,
      axes,
      pieces,
      ignorePairs,
      cues,
    },
    warnings,
  };
}

function vec3(v, fallback = [0, 0, 0]) {
  if (!Array.isArray(v) || v.length !== 3) return [...fallback];
  return v.map(Number);
}

function checkParentCycles(axes, axisById, errors) {
  for (const a of axes) {
    const seen = new Set();
    let cur = a;
    while (cur && cur.parent) {
      if (seen.has(cur.id)) {
        errors.push(`axis "${a.id}": parent chain has a cycle`);
        break;
      }
      seen.add(cur.id);
      cur = axisById.get(cur.parent);
    }
  }
}
