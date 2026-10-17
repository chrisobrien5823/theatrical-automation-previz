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
