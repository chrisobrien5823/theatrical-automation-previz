export function formatGap(m) {
  return m <= 1e-6 ? 'CONTACT' : `${m.toFixed(3)} m`;
}

export function unitOf(axisDef) {
  return axisDef.type === 'rotary' ? { pos: '°', vel: '°/s' } : { pos: 'm', vel: 'm/s' };
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
