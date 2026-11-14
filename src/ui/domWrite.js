// Write-if-changed helpers for DOM that is refreshed every frame (axis readouts, axis bus, HUD,
// gap marker). Each helper remembers the last value it wrote to an element in a WeakMap and skips
// the write when the new value is the same, so a stage at rest causes no DOM writes at all and a
// moving one only touches the fields whose text actually changed.
//
// Why a cache instead of comparing with the DOM (el.textContent !== text): reading layout-backed
// properties is not free either, and some reads (style, hidden on SVG) don't round-trip exactly.
// The cache is plain JS, so it can be unit-tested with stand-in objects (no browser needed).
//
// Rule: an element written through these helpers should only be written through them; a direct
// write elsewhere leaves the cache stale (call forget(el) after one).

const cache = new WeakMap(); // element -> Map(slot -> last written value)

/** True (and remembers value) if `value` differs from what was last written to el's `slot`. */
export function changed(el, slot, value) {
  let slots = cache.get(el);
  if (!slots) cache.set(el, (slots = new Map()));
  if (slots.has(slot) && Object.is(slots.get(slot), value)) return false;
  slots.set(slot, value);
  return true;
}

/** Drop what is remembered for el (after writing it some other way). */
export function forget(el) {
  cache.delete(el);
}

export function writeText(el, text) {
  if (changed(el, 'text', text)) el.textContent = text;
}

export function writeHidden(el, hidden) {
  hidden = !!hidden;
  if (changed(el, 'hidden', hidden)) el.hidden = hidden;
}

export function writeStyle(el, prop, value) {
  if (changed(el, `style:${prop}`, value)) el.style[prop] = value;
}

export function writeData(el, key, value) {
  if (changed(el, `data:${key}`, value)) el.dataset[key] = value;
}

export function writeAttr(el, name, value) {
  if (changed(el, `attr:${name}`, value)) el.setAttribute(name, value);
}
