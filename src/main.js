// Bootstrap: project (show JSON + optional model) -> simulator -> scene -> UI -> render loop.

import './styles.css';
import demoShow from './shows/demo.json';
import { loadShow } from './core/show.js';
import { Simulator } from './core/simulator.js';
import { piecePoses } from './core/rig.js';
import { buildPairs, checkClearance, ConflictTracker } from './core/clearance.js';
import { preflightShow } from './core/preflight.js';
import { modelPositions } from './core/edit.js';
import { createScene, CAMERA_PRESETS } from './render/scene.js';
import { createPieces } from './render/pieces.js';
import { createPicking } from './render/picking.js';
import { ModelView } from './model/modelView.js';
import { readModelFiles, isModelFile } from './model/import.js';
import { saveProject, loadProject, download, autosave, loadAutosave, clearAutosave, exportGlb } from './model/project.js';
import { createCueList } from './ui/cuelist.js';
import { createReadouts } from './ui/readouts.js';
import { createLog } from './ui/log.js';
import { formatGap } from './ui/format.js';
import { createRigPanel } from './ui/editor/rigPanel.js';
import { openImportDialog } from './ui/editor/importDialog.js';

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
  dot: $('statusDot'),
  alert: $('alert'),
  speed: $('speed'),
  runPanel: $('runPanel'),
  rigPanel: $('rigPanel'),
};

const view = createScene($('viewport'));
const cueList = createCueList($('cueList'), { onSelect: (i) => sim?.standby(i) });
const readouts = createReadouts($('axes'));
const log = createLog($('log'), $('logCount'), { onJump: (i) => loadStateBefore(i) });

let project = { raw: demoShow, source: null };
let show, sim, pairs, pieces, modelView, tracker, preflight, stateBefore;
let hits = [];
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

  // State of the stage before each cue when the show is run in order from home (for "jump to cue").
  const home = Object.fromEntries(show.axes.map((a) => [a.id, a.home]));
  const chain = preflightShow(show, home, 0, { pairs });
  stateBefore = chain.map((r, i) => (i === 0 ? home : chain[i - 1].endPositions));
  preflight = chain;

  ui.showName.textContent = show.name;
  document.title = `${show.name} · Stage Previz`;
  cueList.setShow(show);
  readouts.setShow(show);
  if (!keep) {
    log.clear();
    if (!quiet) {
      for (const w of result.warnings) log.info(`Show warning: ${w}`);
      log.info(`Loaded "${show.name}": ${show.axes.length} axes, ${show.pieces.length} pieces, ${show.cues.length} cues, clearance ${show.clearance} m`);
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
      log.info(`GO Q${cue.id} ${cue.name} (${sim.cueDuration.toFixed(1)} s)`);
      trackHits(checkClearance(show, sim.positions(), pairs), cue, 0);
      break;
    }
    case 'cueComplete':
      closeWindows();
      log.info(`Q${cue.id} complete`);
      refreshPreflight();
      break;
    case 'stopping':
      log.info(`STOP during Q${cue.id} at t=${ev.cueTime.toFixed(2)} s`);
      break;
    case 'stopped':
      closeWindows();
      log.info(`Axes at rest. GO re-runs Q${cue.id} from here.`);
      refreshPreflight();
      break;
    case 'reset':
      log.info('RESET: all axes home, standby Q' + (show.cues[0]?.id ?? '—'));
      refreshPreflight();
      break;
    case 'load':
      refreshPreflightSoon(); // jogging fires this on every slider tick
      break;
    case 'standby':
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
    selectTabIfPhone('log');
  }
  for (const w of closed) log.conflictUpdated(w, true);
  for (const w of tracker.open.values()) log.conflictUpdated(w, false);
}

function closeWindows() {
  for (const w of tracker.flush()) log.conflictUpdated(w, true);
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

function setMode(m) {
  mode = m;
  for (const b of document.querySelectorAll('.mode-switch button')) b.setAttribute('aria-selected', String(b.dataset.mode === m));
  ui.runPanel.hidden = m !== 'run';
  ui.rigPanel.hidden = m !== 'rig';
  pieces.setBoxesVisible(m === 'rig' && boxesVisible);
  updateOutline();
  if (m === 'rig') rig.rerender();
}
for (const b of document.querySelectorAll('.mode-switch button')) b.addEventListener('click', () => setMode(b.dataset.mode));

function selectTab(name) {
  for (const b of ui.runPanel.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
  for (const s of ui.runPanel.querySelectorAll('.tab')) s.hidden = s.id !== `tab-${name}`;
}
function selectTabIfPhone(name) {
  if (window.matchMedia('(max-width: 820px), (max-height: 520px)').matches) selectTab(name);
}
for (const b of ui.runPanel.querySelectorAll('.tabs button')) b.addEventListener('click', () => selectTab(b.dataset.tab));

for (const name of Object.keys(CAMERA_PRESETS)) {
  const b = document.createElement('button');
  b.textContent = name;
  b.addEventListener('click', () => view.setPreset(name));
  $('cams').appendChild(b);
}

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

function refreshUi() {
  const running = sim.state !== 'idle';
  // While a cue runs, standby shows the one after it (what the next GO will take once this completes).
  const nextIndex = sim.state === 'running' ? sim.cueIndex + 1 : sim.cueIndex;
  const next = show.cues[nextIndex];
  ui.go.disabled = running || !sim.nextCue;
  ui.stop.disabled = sim.state !== 'running';
  const flagged = next && preflight[nextIndex]?.conflicts.length;
  ui.standby.textContent = next ? `Q${next.id} ${next.name}${flagged ? '  ⚠' : ''}` : 'End of list';
  ui.standby.style.color = flagged ? 'var(--red)' : '';
  cueList.setState({
    standbyIndex: sim.cueIndex,
    runningIndex: running ? show.cues.indexOf(sim.activeCue) : null,
  });
}

function refreshHud() {
  const running = sim.state !== 'idle';
  if (running) {
    const c = sim.activeCue;
    ui.hudCue.textContent = `${sim.state === 'stopping' ? 'STOPPING' : 'Q' + c.id} ${c.name}`;
    ui.hudTime.textContent = `${sim.cueTime.toFixed(2)} / ${sim.cueDuration.toFixed(2)} s`;
    ui.progress.style.width = `${Math.min(100, (100 * sim.cueTime) / (sim.cueDuration || 1))}%`;
  } else {
    ui.hudCue.textContent = mode === 'rig' ? 'Rig mode' : 'Ready';
    ui.hudTime.textContent = '';
    ui.progress.style.width = '0%';
  }
  ui.dot.className = `dot ${hits.length ? 'conflict' : sim.state === 'idle' ? '' : sim.state}`;

  if (hits.length) {
    const worst = hits.reduce((a, b) => (b.gap < a.gap ? b : a));
    ui.alert.hidden = false;
    ui.alert.classList.toggle('contact', worst.severity === 'contact');
    ui.alert.textContent = `⚠ ${worst.a.name} ↔ ${worst.b.name}: ${formatGap(worst.gap)}` + (hits.length > 1 ? ` (+${hits.length - 1})` : '');
  } else {
    ui.alert.hidden = true;
  }
}

// ---------- Render loop ----------

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
  hits = checkClearance(show, positions, pairs);
  pieces.update(piecePoses(show, positions));
  const sev = new Map();
  for (const h of hits) {
    for (const id of [h.a.id, h.b.id]) if (sev.get(id) !== 'contact') sev.set(id, h.severity);
  }
  pieces.highlight(sev, elapsed);
  picking.update();
  readouts.update(sim.axisStates());
  refreshHud();
  view.render(dt);
  requestAnimationFrame(frame);
}

load(demoShow, null);
requestAnimationFrame(frame);

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
