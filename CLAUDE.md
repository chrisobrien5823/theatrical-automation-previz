# Stage Automation Previz

Browser-based 3D previsualization of scenic automation cues, with clearance/collision checking between moving pieces. Portfolio project to demo at Rock Lititz on **Nov 6, 2026** (target audience: TAIT and other entertainment automation companies).

## About me
- Graduating DeSales University, May 2027: B.S. Computer Science, minor in Theater Design/Tech.
- Run sound on a Yamaha DM7 at my theater; know QLab and show operations.
- Goal: entry-level role in entertainment automation / show control.

## What the demo must show
- A simple stage with three axes: a **lift**, a **turntable**, and a **flown piece**.
- A **cue list** with GO / reset. Each cue moves one or more axes to target positions.
- Realistic motion: trapezoidal (stretch: S-curve) velocity profiles with max speed and accel per axis.
- **Clearance checking**: bounding boxes per piece; if two pieces come within a set clearance during a cue, highlight them red and log which cue and time caused it.
- A sample cue sequence that deliberately triggers a near-miss.
- Works well on a **phone** (booth demo) and has an offline-friendly build. Record a backup video.

## Tech choices
- Plain web app: Three.js, no backend. Keep it deployable as static files.
- Cue data in a JSON file so cues are easy to edit.
- Keep motion math separate from rendering so it can be unit-tested.

## Codebase conventions
- `src/core/` must never import Three.js; everything there is unit-tested with Vitest (`npm test`).
- Rendering and clearance both use poses from `src/core/rig.js`, so what is drawn is what is checked.
- Demo show lives in `src/shows/demo.json`; `tests/preflight.test.js` asserts Q3 is the only flagged cue. Retune both together.

## Status (as of Sat Oct 17, 2026)
The original 3.5-week plan is done in its first day. Live at https://chrisobrien5823.github.io/theatrical-automation-previz/ (every push to `main` deploys via `.github/workflows/deploy.yml`; never re-run an old Actions run, it republishes old code).
- **Run mode:** demo show (lift, revolve, fly), trapezoid motion, GO / STOP (ramped) / RESET, preflight ⚠ badges, live red highlighting, conflict log, camera presets, 1×/2×/4× speed, phone layout, offline service worker, single-file USB build.
- **Rig mode (laptop, ≥ 820 px wide):** import `.glb/.gltf/.fbx/.obj` → make pieces (one box or box per part) → lift / fly / wagon / revolve axes (stackable) → jog with live gaps → record and edit cues → Save `.previz` (show + model in one file) + browser autosave.
- **Real model tested:** the university theater's Vectorworks FBX (`samples/O'Brien P&P 3D Model.fbx`, git-ignored; keep it and its `.previz` saves private).
- 51 unit tests pass (`npm test`). Details of decisions and gotchas are in claude-mem (project `3D_Previz_Software`) and the open to-dos in its `rock-lititz-demo` work-state list.

Still open before Nov 6: real-phone test, offline test, USB backup check, QR code, AutoCAD stage file (when it arrives; must be 3D), backup video, pitch practice.

## Next session focus: UI changes and animation smoothness
Start by asking which items matter most, then measure before changing (frame times in the browser, on desktop and a real phone).

**Animation smoothness: known causes to check first**
1. **Stepped rendering (likely the biggest visible judder).** `frame()` in `src/main.js` advances the sim in whole 10 ms steps (`SIM_STEP`) and draws the position at the last step boundary. At 60 Hz that alternates 1 and 2 steps per frame; on 120 Hz phones it's 0 or 1. Fix: keep the 10 ms steps for clearance checks (live and preflight must stay identical), but draw poses at the exact time by sampling the motion profiles at `cueTime + leftover accumulator`.
2. **Motion profile shape.** Trapezoid profiles have instant acceleration changes, which look abrupt. Add the jerk-limited **S-curve** option in `src/core/profile.js` behind the same `planMove()` interface, with unit tests like the trapezoid ones.
3. **Hitches at the end of a cue.** `refreshPreflight()` re-sweeps the rest of the show synchronously on `cueComplete`. It's fine for the demo but may stall on big models; move it to `requestIdleCallback` or a Web Worker (the core is pure JS, so it can run in a worker).
4. **Rig edits rebuild the whole scene** (`load()` with `keep: true`). Jogging doesn't, but every field edit does. Consider updating only what changed.
5. **Phone GPU cost.** Soft shadows + pixel ratio up to 2 (`src/render/scene.js`). Consider adaptive quality (drop shadows / pixel ratio if frames run long).
6. **Per-frame DOM writes.** Axis readouts and the HUD set text every frame; only update when values change.

**UI ideas (pick with the user)**
- Timeline scrubber for the current cue, with conflict windows marked; drag to any moment.
- 3D gap indicator: a line between the two closest points with a distance label.
- Friendlier default piece names (strip Vectorworks prefixes like `Solid_Subtraction_Set_`).
- Undo / redo in Rig mode.
- Velocity readout sparkline per axis; a clearer "moving" state.
- First-run hints for Rig mode (import → make piece → add axis → jog → record).
- Booth polish: larger HUD text on phones, an idle "attract" loop that replays the Q3 near-miss.

Keep the existing rules: `src/core/` stays Three.js-free and tested; `tests/preflight.test.js` must still flag only Q3 in the demo. Edit files with the Edit tool or Bash, not PowerShell `Set-Content` (it corrupts the UI's UTF-8 symbols).

## Stretch ideas (only if time remains)
- **Operator training mode:** inject faults (axis stall, overshoot, e-stop) for the user to respond to.
- **Timecode sync:** cues follow SMPTE timecode like a concert tour.
- **OSC input:** accept GO messages from QLab (QLab Network cue → this app).

## Talking point for the conference
"I built a small previz tool that flags clearance problems between automation axes. How does your team handle that in Navigator?"

## Later projects (after Nov 6, not now)
- Free DCA-automation tool for the Yamaha DM7 over OSC (UDP 49900; DCA assign, DCA/channel names, channel on/off, PEQ bank select), optionally driven by QLab.
- Truck pack planner, networked cue light system (ESP32), sACN/Art-Net network monitor.
