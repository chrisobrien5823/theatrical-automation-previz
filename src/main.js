// Bootstrap: project (show JSON + optional model) -> simulator -> scene -> UI -> render loop.

// Self-hosted face (bundled, so the offline and single-file builds carry it): Hanken Grotesk
// for everything, with tabular figures wherever a number changes or lines up.
import '@fontsource/hanken-grotesk/latin-400.css';
import '@fontsource/hanken-grotesk/latin-500.css';
import '@fontsource/hanken-grotesk/latin-600.css';
import '@fontsource/hanken-grotesk/latin-700.css';
import './styles.css';
import demoShow from './shows/demo.json';
import { loadShow } from './core/show.js';
import { Simulator } from './core/simulator.js';
import { piecePoses, mountChain } from './core/rig.js';
import { buildPairs, checkClearance, ConflictTracker, pieceClosestPoints } from './core/clearance.js';
import { preflightShow } from './core/preflight.js';
import { modelPositions } from './core/edit.js';
import { createScene, CAMERA_PRESETS } from './render/scene.js';
import { createPieces } from './render/pieces.js';
import { createPicking } from './render/picking.js';
import { createGapMarker } from './render/gapMarker.js';
import { ModelView } from './model/modelView.js';
import { readModelFiles, isModelFile } from './model/import.js';
import { saveProject, loadProject, download, autosave, loadAutosave, clearAutosave, exportGlb } from './model/project.js';
import { createCueList } from './ui/cuelist.js';
import { createReadouts } from './ui/readouts.js';
import { createLog } from './ui/log.js';
import { formatGap, esc } from './ui/format.js';
import { icon } from './ui/icons.js';
import { createAxisBus } from './ui/axisBus.js';
import { selectTabButton, tabKeydown } from './ui/tabs.js';
import { createRigPanel } from './ui/editor/rigPanel.js';
import { openImportDialog } from './ui/editor/importDialog.js';
import sampleSetUrl from '../samples/test-set.glb?url';

const SIM_STEP = 0.01; // fixed 10 ms sim step, same as preflight, so live and predicted results agree

const $ = (id) => document.getElementById(id);
const ui = {
  go: $('go'),
  stop: $('stop'),
  reset: $('reset'),
  standby: $('standby'),
  progress: $('progressBar'),
  showName: $('showName'),
  hudCue: $('hudCue'),
  hudTime: $('hudTime'),
  lamp: $('statusLamp'),
  stateWord: $('statusWord'),
  standbyLamp: $('standbyLamp'),
  standbyNote: $('standbyNote'),
  alert: $('alert'),
  caught: $('caught'),
  announce: $('announce'),
  speed: $('speed'),
  runPanel: $('runPanel'),
  rigPanel: $('rigPanel'),
};

const view = createScene($('viewport'));
const gapMarker = createGapMarker(view, $('stage'));
const axisBus = createAxisBus($('axisBus'));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Keep the camera's aim in the part of the stage the overlays leave clear. On a phone the conflict
// alert docks under the axis bus, so room is reserved for it at the top; on a laptop it sits low.
const phoneLayout = window.matchMedia('(max-width: 820px)');
function updateViewInsets() {
  const top = document.querySelector('.stage-top').offsetHeight;
  $('stage').style.setProperty('--stage-top-h', `${top}px`);
  const camsEl = $('cams');
  const cams = camsEl.offsetHeight + 24; // the control plus its margin and some air above it
  view.setInsets(top + (phoneLayout.matches ? 48 : 0), cams + (phoneLayout.matches ? 0 : 52));
}
new ResizeObserver(updateViewInsets).observe(document.querySelector('.stage-top'));
phoneLayout.addEventListener('change', updateViewInsets);
const cueList = createCueList($('cueList'), {
  onSelect: (i) => standbyCue(i),
  onHint: () => toast('Hold a cue to put it in standby.'),
});
const readouts = createReadouts($('axes'));
const log = createLog($('log'), $('logCount'), { onJump: (i) => loadStateBefore(i) });

let project = { raw: demoShow, source: null };
let show, sim, pairs, pieces, modelView, tracker, preflight, stateBefore;
let hits = [];
let ran = new Set(); // cue indices that actually ran since the last reset (the rest before standby were skipped)
let halted = null; // cue that was STOPped mid-move; axes are parked short of its targets until GO / RESET
let caught = null; // { cueIndex, w }: the worst clearance conflict of the last cue, shown until the next GO / RESET
let framedThisCue = false; // the camera swings to the first conflict of a cue, once
let speed = 1;
let mode = 'run';
let boxesVisible = true;
let selection = { path: null, pieceId: null };

// ---------- App API (used by the Rig-mode editor) ----------

const app = {
  get raw() {
    return project.raw;
  },
  get source() {
    return project.source;
  },
  get show() {
    return show;
  },
  get sim() {
    return sim;
  },
  get preflight() {
    return preflight;
  },
  get selection() {
    return selection;
  },
  get boxesVisible() {
    return boxesVisible;
  },
  log,
  toast,
  load,
  /** Apply an edited show document to the current project, keeping axis positions. */
  apply(raw, opts = {}) {
    return load(raw, project.source, { keep: true, ...opts });
  },
  select(sel) {
    selection = { path: sel.path ?? null, pieceId: sel.pieceId ?? null };
    updateOutline();
    rig.rerender();
  },
  setPositions(positions) {
    if (sim.state !== 'idle') return;
    sim.load(positions, sim.cueIndex);
  },
  setBoxesVisible(v) {
    boxesVisible = v;
    pieces.setBoxesVisible(mode === 'rig' && v);
  },
  setMode,
  openFilePicker() {
    $('fileInput').click();
  },
  /** Import the bundled CAD-style sample set (millimetres, Z-up), so Rig mode can be tried without a model. */
  async openSample() {
    try {
      toast('Loading the sample set…');
      const blob = await (await fetch(sampleSetUrl)).blob();
      await openFiles([new File([blob], 'test-set.glb', { type: 'model/gltf-binary' })]);
    } catch (err) {
      toast(`Could not load the sample set: ${err.message}`);
    }
  },
  frameModel() {
    if (modelView) view.frameBounds(modelView.bounds());
  },
};

const rig = createRigPanel(ui.rigPanel, app);
const picking = createPicking(view, {
  enabled: () => mode === 'rig',
  targets: () => [pieces.group, ...(modelView ? [modelView.root] : [])],
  onPick: (obj) => {
    if (!obj) return app.select({});
    const pieceId = pieces.pieceIdOf(obj);
    const piece = pieceId ? show.pieces.find((p) => p.id === pieceId) : null;
    app.select({ pieceId, path: piece ? piece.node : (modelView?.pathOf(obj) ?? null) });
  },
});

// ---------- Project loading ----------

/**
 * Load a show document (+ optional model scene).
 * opts.keep    keep axis positions, cue pointer and log (used for edits)
 * opts.quiet   don't log or autosave (import preview)
 * opts.standby cue index to standby after loading
 */
function load(raw, source, { keep = false, quiet = false, standby } = {}) {
  let result;
  try {
    result = loadShow(raw);
  } catch (err) {
    if (keep) toast(err.message.replace(/^Show file has \d+ error\(s\):\n- /, ''));
    else {
      log.info(`Could not load show: ${err.message}`);
      selectTab('log');
    }
    return false;
  }

  if (keep && sim && sim.state !== 'idle') {
    sim.stop();
    while (sim.state !== 'idle') sim.step(SIM_STEP);
  }
  const prevPositions = keep && sim ? sim.positions() : null;
  const prevIndex = keep && sim ? sim.cueIndex : 0;

  project = { raw, source };
  show = result.show;
  pieces?.dispose();
  modelView = source && show.model ? new ModelView(source, show.model) : null;
  const atModel = modelPositions(show);
  pieces = createPieces(view.scene, show, modelView, piecePoses(show, atModel));
  pieces.setBoxesVisible(mode === 'rig' && boxesVisible);
  pairs = buildPairs(show);

  // Model projects start with axes where the drawing shows them; edits keep current positions.
  let positions;
  if (prevPositions) positions = Object.fromEntries(show.axes.map((a) => [a.id, prevPositions[a.id] ?? a.modelPosition]));
  else if (source) positions = atModel;
  sim = new Simulator(show, { positions, cueIndex: Math.min(standby ?? prevIndex, show.cues.length) });
  sim.on(onSimEvent);
  tracker = new ConflictTracker();
  hits = [];
  halted = null;
  caught = null;
  if (!keep) ran = new Set();

  // State of the stage before each cue when the show is run in order from home (for "jump to cue").
  const home = Object.fromEntries(show.axes.map((a) => [a.id, a.home]));
  const chain = preflightShow(show, home, 0, { pairs });
  stateBefore = chain.map((r, i) => (i === 0 ? home : chain[i - 1].endPositions));
  preflight = chain;

  ui.showName.textContent = show.name;
  document.title = `${show.name} · Stage Previz`;
  cueList.setShow(show);
  readouts.setShow(show);
  axisBus.setShow(show);
  if (!keep) {
    log.clear();
    if (!quiet) {
      for (const w of result.warnings) log.info(`Show warning: ${w}`);
      log.info(`Loaded "${show.name}": ${show.axes.length} axes, ${show.pieces.length} pieces, ${show.cues.length} cues, clearance ${show.clearance} m. Checked every 10 ms of show time at any playback speed.`);
    }
  } else {
    for (const w of result.warnings) toast(w);
  }
  refreshPreflight();
  refreshUi();

  // Drop a selection that no longer exists.
  if (selection.pieceId && !show.pieces.some((p) => p.id === selection.pieceId)) selection.pieceId = null;
  if (!keep) selection = { path: null, pieceId: null };
  updateOutline();
  rig.rerender();
  if (!quiet) scheduleAutosave();
  return true;
}

function refreshPreflight() {
  const fresh = preflightShow(show, sim.positions(), sim.cueIndex, { pairs });
  preflight = preflight.map((old, i) => fresh[i] ?? old);
  cueList.setPreflight(fresh.map((r, i) => r ?? preflight[i]));
}

let preflightTimer = null;
function refreshPreflightSoon() {
  clearTimeout(preflightTimer);
  preflightTimer = setTimeout(() => {
    refreshPreflight();
    refreshUi();
  }, 200);
}

function loadStateBefore(i) {
  if (!sim || sim.state !== 'idle' || !stateBefore[i]) return;
  sim.load(stateBefore[i], i);
  caught = null;
  // The stage now looks exactly as if Q1 … Q(i-1) had run in order from home.
  ran = new Set(show.cues.slice(0, i).map((_, k) => k));
  log.info(`Loaded the stage as it stands before Q${show.cues[i].id}. GO to replay it.`);
  refreshUi();
}

/** Put a cue in standby from the cue list. Axes stay where they are; cues jumped over count as skipped. */
function standbyCue(i) {
  if (!sim) return;
  if (sim.state !== 'idle') return toast('The cue list is locked while a cue runs. STOP first.');
  const from = sim.cueIndex;
  if (i === from || !sim.standby(i)) return;
  const cue = show.cues[i];
  if (i > from) {
    const span = from === i - 1 ? `Q${show.cues[from].id}` : `Q${show.cues[from].id}–Q${show.cues[i - 1].id}`;
    log.info(`Standby Q${cue.id}, skipped ${span}. Axes stay where they are; preflight now runs from here.`);
  } else {
    log.info(`Standby Q${cue.id} (back). Axes stay where they are; preflight now runs from here.`);
  }
  for (const k of [...ran]) if (k >= i) ran.delete(k);
  refreshUi();
}

function updateOutline() {
  let obj = null;
  if (mode === 'rig') {
    if (selection.pieceId) obj = pieces.holder(selection.pieceId);
    else if (selection.path != null && modelView) obj = modelView.node(selection.path);
  }
  picking.outline(obj);
}

// ---------- Autosave ----------

let autosaveTimer = null;
let glbCache = { source: null, glb: null };
function scheduleAutosave() {
  // The bundled demo is never autosaved; anything imported or edited is.
  if (project.raw === demoShow) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    try {
      if (project.source && glbCache.source !== project.source) {
        glbCache = { source: project.source, glb: await exportGlb(project.source) };
      }
      await autosave(project.raw, project.source ? glbCache.glb : null);
    } catch {
      // best-effort
    }
  }, 800);
}

// ---------- Simulator events ----------

function onSimEvent(ev) {
  const cue = ev.cue;
  switch (ev.type) {
    case 'cueStart': {
      tracker = new ConflictTracker();
      halted = null;
      caught = null;
      framedThisCue = false;
      log.info(sim.cueDuration >= 0.05 ? `GO Q${cue.id} ${cue.name} (${sim.cueDuration.toFixed(1)} s)` : `GO Q${cue.id} ${cue.name} (instant: axes already in position)`);
      trackHits(checkClearance(show, sim.positions(), pairs), cue, 0);
      break;
    }
    case 'cueComplete':
      closeWindows();
      ran.add(show.cues.indexOf(cue));
      setCaught(cue);
      log.info(`Q${cue.id} complete`);
      refreshPreflight();
      break;
    case 'stopping':
      log.info(`STOP during Q${cue.id} at t=${ev.cueTime.toFixed(2)} s`);
      break;
    case 'stopped':
      closeWindows();
      halted = cue;
      setCaught(cue);
      log.info(`Axes at rest, short of Q${cue.id}'s targets. GO re-runs Q${cue.id} from here.`);
      refreshPreflight();
      break;
    case 'reset':
      halted = null;
      caught = null;
      ran = new Set();
      log.info('RESET: all axes home, standby Q' + (show.cues[0]?.id ?? '—'));
      refreshPreflight();
      break;
    case 'load':
      halted = null;
      caught = null;
      refreshPreflightSoon(); // jogging fires this on every slider tick
      break;
    case 'standby':
      halted = null;
      caught = null;
      refreshPreflight();
      break;
    case 'endOfShow':
      log.info('End of cue list. RESET to start over.');
      break;
  }
  refreshUi();
}

function trackHits(stepHits, cue, cueTime) {
  const { opened, closed } = tracker.update(stepHits, cue.id, cueTime);
  const cueIndex = show.cues.indexOf(cue);
  for (const w of opened) {
    log.conflictOpened(w, cueIndex);
    announce(`Clearance conflict in Q${w.cueId}: ${w.aName} and ${w.bName} inside ${show.clearance.toFixed(3)} metres.`);
    if (!framedThisCue) framedThisCue = frameConflict(w);
  }
  for (const w of closed) log.conflictUpdated(w, true);
  for (const w of tracker.open.values()) log.conflictUpdated(w, false);
}

function closeWindows() {
  for (const w of tracker.flush()) log.conflictUpdated(w, true);
}

/** After a cue ends (or is stopped), keep its worst conflict on screen until the next GO / RESET. */
function setCaught(cue) {
  const windows = tracker.closed.filter((w) => w.cueId === cue.id);
  if (!windows.length) return;
  const w = windows.reduce((a, b) => (b.minGap < a.minGap ? b : a));
  caught = { cueIndex: show.cues.indexOf(cue), w, more: windows.length - 1 };
  announce(
    `Caught in Q${cue.id}: ${w.aName} and ${w.bName} came within ${w.severity === 'contact' ? 'contact' : w.minGap.toFixed(3) + ' metres'} against a clearance of ${show.clearance.toFixed(3)}.`,
  );
}

/** Swing the camera side-on to a gap that just opened, unless the user is steering or prefers less motion. */
function frameConflict(w) {
  if (reducedMotion.matches) return true;
  const a = show.pieces.find((p) => p.id === w.a);
  const b = show.pieces.find((p) => p.id === w.b);
  const pts = a && b && pieceClosestPoints(show, sim.positions(), a, b);
  if (!pts) return false;
  const mid = { x: (pts.a[0] + pts.b[0]) / 2, y: (pts.a[1] + pts.b[1]) / 2, z: (pts.a[2] + pts.b[2]) / 2 };
  const dir = { x: pts.b[0] - pts.a[0], y: pts.b[1] - pts.a[1], z: pts.b[2] - pts.a[2] };
  const moved = view.focusGap(mid, dir);
  if (moved) setActiveCam(null);
  return true;
}

function announce(text) {
  ui.announce.textContent = '';
  // A fresh text node after a tick makes screen readers read it even when the text repeats.
  setTimeout(() => (ui.announce.textContent = text), 30);
}

function replayCaught() {
  if (!caught || sim.state !== 'idle') return;
  const i = caught.cueIndex;
  loadStateBefore(i);
  go();
}

// ---------- Transport ----------

function go() {
  sim?.go();
}
function stop() {
  sim?.stop();
}
function reset() {
  if (!sim) return;
  if (sim.state !== 'idle') {
    sim.stop();
    // Finish the ramp instantly so RESET always works, then home.
    while (sim.state !== 'idle') sim.step(SIM_STEP);
  }
  sim.reset();
}

ui.go.addEventListener('click', go);
ui.stop.addEventListener('click', stop);
ui.reset.addEventListener('click', reset);
ui.speed.addEventListener('change', () => (speed = Number(ui.speed.value)));

window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, select, textarea, summary')) return;
  if (document.querySelector('.modal-wrap')) return;
  // Space is GO everywhere in Run mode, like a show-control desk. In the Rig panel, tabs and footer
  // it keeps its normal meaning so keyboard users can press the focused button.
  if (e.code === 'Space' && e.target.closest?.('#rigPanel, [role="tablist"], .cams, .panel-foot, .chip')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    go();
  } else if (e.code === 'Escape') {
    stop();
  } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
    reset();
  }
});

// ---------- Modes, tabs, cameras ----------

// Rig mode needs room for the panel and precise pointing; phones and narrow windows stay in Run.
const rigFits = window.matchMedia('(min-width: 821px) and (min-height: 521px)');
rigFits.addEventListener('change', () => {
  if (!rigFits.matches && mode === 'rig') {
    setMode('run');
    toast('Rig mode needs a laptop-sized window (at least 820 px wide). Back in Run mode.');
  }
});

function setMode(m) {
  if (m === 'rig' && !rigFits.matches) {
    toast('Rig mode needs a laptop-sized window (at least 820 px wide). This project opens in Run mode here.');
    m = 'run';
  }
  mode = m;
  if (m === 'rig' && caught) {
    caught = null; // the Run-mode result card doesn't belong over editing
    renderCaught();
  }
  selectTabButton(document.querySelector('.mode-switch'), 'mode', m);
  ui.runPanel.hidden = m !== 'run';
  ui.rigPanel.hidden = m !== 'rig';
  pieces.setBoxesVisible(m === 'rig' && boxesVisible);
  updateOutline();
  if (m === 'rig') rig.rerender();
}
const modeSwitch = document.querySelector('.mode-switch');
for (const b of modeSwitch.querySelectorAll('[role="tab"]')) b.addEventListener('click', () => setMode(b.dataset.mode));
modeSwitch.addEventListener('keydown', (e) => tabKeydown(e, (b) => setMode(b.dataset.mode)));

const runTabs = ui.runPanel.querySelector('.tabs');
function selectTab(name) {
  selectTabButton(runTabs, 'tab', name);
  for (const s of ui.runPanel.querySelectorAll('.tab')) s.hidden = s.id !== `tab-${name}`;
}
for (const b of runTabs.querySelectorAll('[role="tab"]')) b.addEventListener('click', () => selectTab(b.dataset.tab));
runTabs.addEventListener('keydown', (e) => tabKeydown(e, (b) => selectTab(b.dataset.tab)));

const camButtons = new Map();
function setActiveCam(name) {
  for (const [n, b] of camButtons) b.setAttribute('aria-pressed', String(n === name));
}
for (const name of Object.keys(CAMERA_PRESETS)) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = name;
  b.addEventListener('click', () => {
    view.setPreset(name);
    setActiveCam(name);
  });
  camButtons.set(name, b);
  $('cams').appendChild(b);
}
setActiveCam('FOH');
view.controls.addEventListener('start', () => setActiveCam(null));

let toastTimer = null;
const toastEl = Object.assign(document.createElement('div'), { className: 'toast', hidden: true });
$('stage').append(toastEl);
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastEl.hidden = true), 3500);
}

// ---------- Files: open, drop, save ----------

async function openFiles(fileList) {
  const files = [...fileList];
  if (!files.length) return;
  try {
    if (files.some(isModelFile)) {
      toast('Reading model…');
      openImportDialog(app, await readModelFiles(files));
      return;
    }
    const f = files[0];
    const { raw, source } = await loadProject(await f.text());
    if (load(raw, source) && source) setMode('rig');
  } catch (err) {
    log.info(`Could not open ${files.map((f) => f.name).join(', ')}: ${err.message}`);
    toast(err.message);
    selectTab('log');
  }
}

$('openFile').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', (e) => {
  openFiles(e.target.files);
  e.target.value = '';
});
window.addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.classList.add('drop-hint');
});
window.addEventListener('dragleave', (e) => {
  if (!e.relatedTarget) document.body.classList.remove('drop-hint');
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('drop-hint');
  openFiles(e.dataTransfer.files);
});

$('saveProject').addEventListener('click', async () => {
  try {
    toast('Saving…');
    const text = await saveProject(project.raw, project.source);
    download(text, `${(show.name || 'project').replace(/[^\w.-]+/g, '_')}.previz`);
    toast('Project saved to your downloads.');
  } catch (err) {
    toast(`Save failed: ${err.message}`);
  }
});

$('loadDemo').addEventListener('click', () => {
  if (project.raw !== demoShow && !confirm('Switch to the built-in demo? Unsaved changes to this project will be lost (use Save first to keep them).')) return;
  clearAutosave();
  load(demoShow, null);
  setMode('run');
});

// ---------- UI refresh ----------

/** Set text only when it changed (the HUD refreshes every frame). */
function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}
function setLamp(el, state) {
  if (el.dataset.state !== state) el.dataset.state = state;
}

function refreshUi() {
  const running = sim.state !== 'idle';
  // While a cue runs, standby shows the one after it (what the next GO will take once this completes).
  const nextIndex = sim.state === 'running' ? sim.cueIndex + 1 : sim.cueIndex;
  const next = show.cues[nextIndex];
  ui.go.disabled = running || !sim.nextCue;
  ui.stop.disabled = sim.state !== 'running';
  const flagged = next && preflight[nextIndex]?.conflicts.length;
  ui.standby.innerHTML = next ? `<span class="tnum">Q${esc(next.id)}</span> ${esc(next.name)}` + (flagged ? ` ${icon('warn', 'preflight conflict')}` : '') : 'End of list';
  ui.standby.classList.toggle('flagged', !!flagged);
  setLamp(ui.standbyLamp, next ? (flagged ? 'clash' : 'standby') : 'off');

  const skipped = sim.cueIndex > 0 && [...Array(sim.cueIndex).keys()].some((k) => !ran.has(k));
  const note = halted
    ? `Stopped mid-cue: axes are short of Q${halted.id}'s targets. GO finishes it from here.`
    : skipped && !running
      ? 'Cues were skipped, so the stage is not where the show expects. Preflight runs from the current positions.'
      : '';
  ui.standbyNote.hidden = !note;
  setText(ui.standbyNote, note);

  cueList.setState({
    standbyIndex: sim.cueIndex,
    runningIndex: running ? show.cues.indexOf(sim.activeCue) : null,
    ran,
    conflict: running && hits.length > 0,
  });
  renderCaught();
}

let caughtShown = null;
function renderCaught() {
  if (caught === caughtShown) return;
  caughtShown = caught;
  ui.caught.hidden = !caught;
  if (!caught) return ui.caught.replaceChildren();
  const { w, more, cueIndex } = caught;
  const cue = show.cues[cueIndex];
  const gap = w.severity === 'contact' ? 'contact' : `<span class="tnum">${formatGap(w.minGap)}</span>`;
  ui.caught.innerHTML = `
    <span class="lamp" data-state="clash"></span>
    <div class="caught-text">
      <b>Caught in Q${esc(cue.id)}</b>
      <span>${esc(w.aName)} ↔ ${esc(w.bName)} came within ${gap} at t=<span class="tnum">${w.tMin.toFixed(2)} s</span>. Clearance is <span class="tnum">${formatGap(show.clearance)}</span>.${more ? ` +${more} more in the log.` : ''}</span>
    </div>
    <button type="button" class="caught-replay">${icon('replay')}Replay Q${esc(cue.id)}</button>
    <button type="button" class="caught-close" aria-label="Dismiss">${icon('close')}</button>`;
  ui.caught.querySelector('.caught-replay').addEventListener('click', replayCaught);
  ui.caught.querySelector('.caught-close').addEventListener('click', () => {
    caught = null;
    renderCaught();
  });
}

let progressShown = -1;
let alertKey = '';
function refreshHud(worst) {
  const running = sim.state !== 'idle';
  let word;
  let lamp;
  if (hits.length) [word, lamp] = ['Conflict', 'clash'];
  else if (sim.state === 'stopping') [word, lamp] = ['Stopping', 'standby']; // amber = held, not a clearance problem
  else if (running) [word, lamp] = ['Running', 'moving'];
  else if (halted) [word, lamp] = ['Stopped', 'standby'];
  else [word, lamp] = [mode === 'rig' ? 'Rig' : 'Ready', 'ready'];
  setText(ui.stateWord, word);
  setLamp(ui.lamp, lamp);

  let pct = 0;
  if (running) {
    const c = sim.activeCue;
    setText(ui.hudCue, `Q${c.id} ${c.name}`);
    setText(ui.hudTime, `${sim.cueTime.toFixed(2)} / ${sim.cueDuration.toFixed(2)} s`);
    pct = Math.min(100, (100 * sim.cueTime) / (sim.cueDuration || 1));
  } else {
    const next = sim.nextCue;
    setText(ui.hudCue, halted ? `Q${halted.id} not at target` : next ? `Standby Q${next.id}` : show.cues.length ? 'End of list' : 'No cues yet');
    setText(ui.hudTime, '');
  }
  pct = Math.round(pct * 10) / 10;
  if (pct !== progressShown) ui.progress.style.width = `${(progressShown = pct)}%`;

  if (worst) {
    const key = `${worst.key}|${worst.severity}|${formatGap(worst.gap)}|${hits.length}`;
    if (key !== alertKey) {
      alertKey = key;
      ui.alert.hidden = false;
      ui.alert.classList.toggle('contact', worst.severity === 'contact');
      ui.alert.innerHTML =
        `${icon('warn')}<span>${esc(worst.a.name)} ↔ ${esc(worst.b.name)}</span><span class="tnum">${formatGap(worst.gap)}</span>` +
        `<span class="alert-limit">of <span class="tnum">${formatGap(show.clearance)}</span></span>` +
        (hits.length > 1 ? `<span class="alert-more">+${hits.length - 1}</span>` : '');
    }
  } else if (alertKey) {
    alertKey = '';
    ui.alert.hidden = true;
  }
}

// ---------- Render loop ----------

// Dev only: `?frames=timer` drives the loop from a timer, for automated checks in a hidden or
// background browser tab where requestAnimationFrame never fires.
const nextFrame =
  import.meta.env.DEV && new URLSearchParams(location.search).get('frames') === 'timer'
    ? (f) => setTimeout(() => f(performance.now()), 16)
    : requestAnimationFrame;

let last = performance.now();
let simAccumulator = 0;
let elapsed = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  elapsed += dt;

  if (sim.state !== 'idle') {
    simAccumulator += dt * speed;
    while (simAccumulator >= SIM_STEP && sim.state !== 'idle') {
      const cue = sim.activeCue;
      sim.step(SIM_STEP);
      simAccumulator -= SIM_STEP;
      // Check every 10 ms sim step (not just every frame) so fast transients are not missed.
      // Skip the step that finished the cue: its windows were already closed by the cueComplete event.
      if (sim.state !== 'idle' && sim.activeCue === cue) {
        trackHits(checkClearance(show, sim.positions(), pairs), cue, sim.cueTime);
      }
    }
    if (sim.state === 'idle') simAccumulator = 0;
  }

  const positions = sim.positions();
  const hadHits = hits.length > 0;
  hits = checkClearance(show, positions, pairs);
  pieces.update(piecePoses(show, positions));
  const sev = new Map();
  const clashing = new Set();
  for (const h of hits) {
    for (const p of [h.a, h.b]) {
      if (sev.get(p.id) !== 'contact') sev.set(p.id, h.severity);
      for (const axisId of mountChain(show, p)) clashing.add(axisId);
    }
  }
  pieces.highlight(sev, reducedMotion.matches ? 0 : elapsed);
  const worst = hits.length ? hits.reduce((a, b) => (b.gap < a.gap ? b : a)) : null;
  gapMarker.set(worst && pieceClosestPoints(show, positions, worst.a, worst.b), worst ? formatGap(worst.gap) : '');
  picking.update();
  const states = sim.axisStates();
  readouts.update(states);
  axisBus.update(states, clashing);
  refreshHud(worst);
  if (hadHits !== hits.length > 0) refreshUi(); // running cue row turns to its conflict state and back
  view.render(dt);
  gapMarker.update();
  nextFrame(frame);
}

load(demoShow, null);
nextFrame(frame);

// Restore the last imported / edited project, if there is one.
loadAutosave().then((saved) => {
  if (!saved || project.raw !== demoShow) return;
  if (load(saved.raw, saved.source)) {
    log.info(`Restored your last project (autosaved ${new Date(saved.savedAt).toLocaleString()}). “Demo” switches back to the demo show.`);
    if (saved.source) app.frameModel();
  }
});

// ---------- Offline support ----------
if (!__SINGLE_FILE__ && import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
