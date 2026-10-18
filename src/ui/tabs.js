// ARIA tabs: roving tabindex plus arrow / Home / End keys. Works for tablists that are rebuilt on render.

/** Mark the tab whose data-<key> equals value as selected; only it stays in the Tab order. */
export function selectTabButton(tablist, key, value) {
  for (const b of tablist.querySelectorAll('[role="tab"]')) {
    const on = b.dataset[key] === value;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  }
}

/** Keydown handler for a tablist: moves focus and selection with the arrow keys. */
export function tabKeydown(e, onPick) {
  const tabs = [...e.currentTarget.querySelectorAll('[role="tab"]')].filter((b) => !b.disabled && b.offsetParent !== null);
  const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  const next = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
  if (next == null) return;
  e.preventDefault();
  const b = tabs[(next + tabs.length) % tabs.length];
  onPick(b);
  // The pick may rebuild the tablist; focus the button that now carries the same id.
  ((b.id && document.getElementById(b.id)) || b).focus();
}
