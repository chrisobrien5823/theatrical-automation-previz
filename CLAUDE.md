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

## Plan (about 3.5 weeks)
1. **Week 1 (starts Sat Oct 17):** Three.js stage, three axes, cue list moving pieces between positions.
2. **Week 2:** Motion profiles, bounding boxes, clearance check, conflict log.
3. **Week 3:** Mobile UI polish (GO, reset, cue list panel), demo sequence with intentional near-miss.
4. **Final days:** Backup video, practice a 30-second pitch.

## Stretch ideas (only if time remains)
- **Operator training mode:** inject faults (axis stall, overshoot, e-stop) for the user to respond to.
- **Timecode sync:** cues follow SMPTE timecode like a concert tour.
- **OSC input:** accept GO messages from QLab (QLab Network cue → this app).

## Talking point for the conference
"I built a small previz tool that flags clearance problems between automation axes. How does your team handle that in Navigator?"

## Later projects (after Nov 6, not now)
- Free DCA-automation tool for the Yamaha DM7 over OSC (UDP 49900; DCA assign, DCA/channel names, channel on/off, PEQ bank select), optionally driven by QLab.
- Truck pack planner, networked cue light system (ESP32), sACN/Art-Net network monitor.
