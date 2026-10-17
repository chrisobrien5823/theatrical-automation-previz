// Tiny DOM builder for the editor panels: h('div', { class: 'x', onclick }, child, ...).

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Append children with the same rules as h(): arrays flattened, null/false skipped. */
export function add(parent, ...children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    parent.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return parent;
}

/** <select> with [value, label] options. */
export function select(options, value, onchange, attrs = {}) {
  return h(
    'select',
    { ...attrs, onchange: (e) => onchange(e.target.value) },
    options.map(([v, label]) => h('option', { value: v, selected: String(v) === String(value) }, label)),
  );
}

/** Number input that commits on change; empty or invalid input is ignored. */
export function num(value, onchange, attrs = {}) {
  return h('input', {
    type: 'number',
    step: 'any',
    value: Number.isFinite(value) ? +Number(value).toFixed(4) : '',
    ...attrs,
    onchange: (e) => {
      const v = Number.parseFloat(e.target.value);
      if (Number.isFinite(v)) onchange(v);
    },
  });
}

export function field(label, control, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control, hint ? h('span', { class: 'hint' }, hint) : null);
}
