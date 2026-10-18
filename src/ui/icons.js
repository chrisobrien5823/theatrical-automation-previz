// Small stroked icon set (16 px grid, 1.75 stroke, currentColor) so every control draws the same way.

const PATHS = {
  warn: '<path d="M8 2.2 14.6 13.5H1.4Z"/><path d="M8 6.4v3.4"/><path d="M8 11.9v.1"/>',
  check: '<path d="m3 8.4 3.2 3.1L13 4.7"/>',
  trash: '<path d="M2.8 4.3h10.4"/><path d="M6.3 4.3V2.6h3.4v1.7"/><path d="M4.1 4.3l.7 9.1h6.4l.7-9.1"/>',
  up: '<path d="M8 13V3.4"/><path d="M4 7.2 8 3.2l4 4"/>',
  down: '<path d="M8 3v9.6"/><path d="m4 8.8 4 4 4-4"/>',
  close: '<path d="m4 4 8 8"/><path d="m12 4-8 8"/>',
  plus: '<path d="M8 3v10"/><path d="M3 8h10"/>',
  chevronRight: '<path d="m6 3.5 4.5 4.5L6 12.5"/>',
  chevronDown: '<path d="m3.5 6 4.5 4.5L12.5 6"/>',
  record: '<circle cx="8" cy="8" r="4.2" fill="currentColor" stroke="none"/>',
  replay: '<path d="M3 8a5 5 0 1 0 1.6-3.7"/><path d="M3 2.6v2.6h2.6"/>',
  upload: '<path d="M8 10.6V2.8"/><path d="M4.6 6 8 2.6 11.4 6"/><path d="M2.8 10.4v2.8h10.4v-2.8"/>',
  mount: '<path d="M8 2.5 13.5 8 8 13.5 2.5 8Z"/>',
};

/** SVG markup for an icon. Decorative by default; pass a label when the icon is the only content. */
export function icon(name, label) {
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="ico" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${PATHS[name] ?? ''}</svg>`;
}

/** Same icon as a DOM node (for the editor's h() builder). */
export function iconEl(name, label) {
  const t = document.createElement('template');
  t.innerHTML = icon(name, label);
  return t.content.firstChild;
}
