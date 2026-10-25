export function formatGap(m) {
  return m <= 1e-6 ? 'CONTACT' : `${m.toFixed(3)} m`;
}

export function unitOf(axisDef) {
  return axisDef.type === 'rotary' ? { pos: '°', vel: '°/s' } : { pos: 'm', vel: 'm/s' };
}

/**
 * Short, unambiguous codes for axes, for tight displays (the phone axis bus): the show's own `short`
 * when it has one, else the first word (whole if 4 letters or fewer, else 3 letters) plus a trailing
 * number. "Lift DSC" -> LIFT, "Revolve" -> REV, "Fly LS 4" -> FLY4. Clashes are separated with the
 * initials of the other words, then a counter. Returns codes in axis order.
 */
export function axisCodes(axes) {
  const used = new Set();
  return axes.map((a) => {
    const name = String(a.name ?? a.id ?? '').trim();
    const words = name.split(/\s+/).filter(Boolean);
    const first = (words[0] ?? '').replace(/[^A-Za-z0-9]/g, '');
    const head = first.length <= 4 ? first : first.slice(0, 3);
    const hasTail = words.length > 1 && /^\d+$/.test(words[words.length - 1]);
    const tail = hasTail ? words[words.length - 1] : '';
    const middle = words.slice(1, hasTail ? -1 : undefined).map((w) => w.replace(/[^A-Za-z0-9]/g, '')[0] ?? '').join('');
    const fit = (c) => c.toUpperCase().slice(0, 5);
    const build = (extra) => (head + extra).toUpperCase().slice(0, Math.max(1, 5 - tail.length)) + tail; // the number always survives
    let code = a.short ? fit(a.short) : build('') || fit(String(a.id ?? '?'));
    if (used.has(code)) code = build(middle);
    for (let n = 2, base = code; used.has(code); n++) code = fit(base.slice(0, 4)) + n;
    used.add(code);
    return code;
  });
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function clockTime(d = new Date()) {
  return d.toTimeString().slice(0, 8);
}

// Vectorworks names solids after the modeling operation that made them; the operation is noise
// in an outliner. "Solid_Subtraction_Set_Wall_A" -> "Wall A".
const CAD_PREFIX = /^(?:solid[ _]?(?:subtraction|addition|intersection)(?:[ _]?set)?|extrude(?:[ _]along[ _]path)?|sweep|tapered[ _]extrude|generic[ _]solid)[ _-]*/i;

/** Display name for a model object: CAD operation prefixes dropped, underscores back to spaces. */
export function friendlyName(name) {
  if (!name) return '';
  const spaced = String(name).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const stripped = spaced.replace(CAD_PREFIX, '').trim();
  return /[a-z]/i.test(stripped) ? stripped : spaced;
}
