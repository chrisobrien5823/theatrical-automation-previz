// Bootstrap: show data -> simulator -> scene -> UI -> render loop.

import './styles.css';
import demoShow from './shows/demo.json';
import { loadShow } from './core/show.js';
import { Simulator } from './core/simulator.js';
import { piecePoses } from './core/rig.js';
import { buildPairs, checkClearance, ConflictTracker } from './core/clearance.js';
import { preflightShow } from './core/preflight.js';
import { createScene, CAMERA_PRESETS } from './render/scene.js';
import { createPieces } from './render/pieces.js';
import { createCueList } from './ui/cuelist.js';
import { createReadouts } from './ui/readouts.js';
import { createLog } from './ui/log.js';
import { formatGap } from './ui/format.js';

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
};

const view = createScene($('viewport'));
const cueList = createCueList($('cueList'), { onSelect: (i) => sim?.standby(i) });
const readouts = createReadouts($('axes'));
const log = createLog($('log'), $('logCount'), { onJump: (i) => loadStateBefore(i) });

let show, sim, pairs, pieces, tracker, preflight, stateBefore;
let hits = [];
let speed = 1;

// ---------- Show loading ----------

function useShow(raw, label) {
  let result;
  try {
    result = loadShow(raw);
  } catch (err) {
    log.info(`Could not load ${label}: ${err.message}`);
    selectTab('log');
    return false;
  }
  show = result.show;
  pieces?.dispose();
  pieces = createPieces(view.scene, show);
  pairs = buildPairs(show);
  sim = new Simulator(show);
  sim.on(onSimEvent);
  tracker = new ConflictTracker();
  hits = [];

  // State of the stage before each cue when the show is run in order from home (for "jump to cue").
  const home = sim.positions();
  const chain = preflightShow(show, home, 0, { pairs });
  stateBefore = chain.map((r, i) => (i === 0 ? home : chain[i - 1].endPositions));
  preflight = chain;

  ui.showName.textContent = show.name;
  document.title = `${show.name} · Stage Previz`;
  cueList.setShow(show);
  readouts.setShow(show);
  log.clear();
  for (const w of result.warnings) log.info(`Show warning: ${w}`);
  log.info(`Loaded "${show.name}": ${show.axes.length} axes, ${show.pieces.length} pieces, ${show.cues.length} cues, clearance ${show.clearance} m`);
  refreshPreflight();
  refreshUi();
  return true;
}

function refreshPreflight() {
  const fresh = preflightShow(show, sim.positions(), sim.cueIndex, { pairs });
  preflight = preflight.map((old, i) => fresh[i] ?? old);
  cueList.setPreflight(fresh.map((r, i) => r ?? preflight[i]));
}

function loadStateBefore(i) {
  if (!sim || sim.state !== 'idle' || !stateBefore[i]) return;
  sim.load(stateBefore[i], i);
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
  if (e.target.closest('input, select, textarea')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    go();
  } else if (e.code === 'Escape') {
    stop();
  } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
    reset();
  }
});

// ---------- Tabs, cameras, file loading ----------

function selectTab(name) {
  for (const b of document.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === name));
  for (const s of document.querySelectorAll('.tab')) s.hidden = s.id !== `tab-${name}`;
}
function selectTabIfPhone(name) {
  if (window.matchMedia('(max-width: 820px), (max-height: 520px)').matches) selectTab(name);
}
for (const b of document.querySelectorAll('.tabs button')) b.addEventListener('click', () => selectTab(b.dataset.tab));

for (const name of Object.keys(CAMERA_PRESETS)) {
  const b = document.createElement('button');
  b.textContent = name;
  b.addEventListener('click', () => view.setPreset(name));
  $('cams').appendChild(b);
}

async function loadFile(file) {
  try {
    useShow(JSON.parse(await file.text()), file.name);
  } catch (err) {
    log.info(`Could not read ${file.name}: ${err.message}`);
    selectTab('log');
  }
}
$('fileInput').addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (f) loadFile(f);
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
  const f = e.dataTransfer.files[0];
  if (f) loadFile(f);
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
    ui.hudCue.textContent = 'Ready';
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
  readouts.update(sim.axisStates());
  refreshHud();
  view.render(dt);
  requestAnimationFrame(frame);
}

useShow(demoShow, 'demo show');
requestAnimationFrame(frame);

// ---------- Offline support ----------
if (!__SINGLE_FILE__ && import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
