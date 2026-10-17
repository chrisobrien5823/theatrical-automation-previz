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
    return {
      id: a.id,
      name: a.name ?? a.id,
      type: a.type,
      origin: vec3(a.origin),
      parent: a.parent ?? null,
      home,
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
    const size = vec3(p.size, [1, 1, 1]);
    if (size.some((s) => !(s > 0))) errors.push(`piece "${p.id}": size values must be > 0`);
    return {
      id: p.id,
      name: p.name ?? p.id,
      mount: p.mount ?? null,
      offset: vec3(p.offset),
      size,
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

  if (errors.length) {
    const err = new Error(`Show file has ${errors.length} error(s):\n- ${errors.join('\n- ')}`);
    err.errors = errors;
    throw err;
  }

  return {
    show: {
      name: raw.name ?? 'Untitled show',
      clearance: raw.clearance ?? DEFAULT_CLEARANCE,
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
