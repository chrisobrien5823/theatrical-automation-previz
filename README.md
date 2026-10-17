# Stage Automation Previz

Browser-based 3D previz of scenic automation cues (lift, turntable, flown piece) with
trapezoidal motion profiles and exact clearance checking between moving pieces.

## Run
```bash
npm install
npm run dev            # http://localhost:5173
npm run dev -- --host  # also reachable from your phone on the same Wi-Fi
npm test               # unit tests for motion, clearance, simulator, demo show
npm run build          # dist/        static site (GitHub Pages), offline after first load
npm run build:single   # dist-single/ one self-contained index.html for USB / file:// backup
```

## Controls
- **GO** (Space), **STOP** (Esc, ramps every axis down at its decel limit), **RESET** (R, all axes home).
- Click a cue to put it in standby. Click a conflict in the Log to load the stage state just before that cue and replay it.
- Camera presets: FOH, SL, SR, Top. Speed 1×/2×/4×.
- **Load show…** (or drag a `.json` onto the stage) to run your own show file.

## Demo script (≈30 s)
1. Q1 preset, Q2 riser up. The cue list already shows **⚠ 0.064 m** on Q3: that's the preflight sweep.
2. Q3: the revolve turns 90° and Wall A's corner sweeps past the riser. Both go red, and the log records
   *Q3 · Wall A ↔ Riser · t=3.42–5.73 s · min 0.064 m at t=4.58 s* (clearance is 0.15 m).
3. Q4–Q6: the same look re-sequenced (riser down, revolve, then riser up) runs clean.

## Show file format (`src/shows/demo.json`)
- `clearance`: minimum allowed gap in meters.
- `axes[]`: `id, name, type ("linear" | "rotary"), origin [x,y,z], home, min, max, vMax, aMax`, optional `parent` axis.
  Linear axes move along Y in meters; rotary axes turn about Y in degrees.
- `pieces[]`: `id, name, mount (axis id or omitted for static), offset [x,y,z] (box center), size [w,h,d], yaw, color, shape ("box" | "cylinder"), check`.
  `check: false` pieces are drawn but not clearance-checked (deck, masking).
- `ignorePairs[]`: `[pieceA, pieceB]` pairs to skip.
- `cues[]`: `id, name, note, moves: [{ axis, target, delay?, vMax? }], follow?` (auto-follow into the next cue).

Coordinates: +Y up, +X stage left, +Z downstage. Targets outside axis limits are clamped with a warning.

## How the clearance check works
Every rotation in the rig is about the vertical axis, so each piece is a yaw-rotated box. The exact
distance between two of them splits into a plan-view part and a vertical part:
`gap = √(d_plan² + d_y²)`, where `d_plan` is the 2D distance between rotated rectangles (SAT for overlap,
vertex-to-edge otherwise). Live playback and the preflight sweep both check every 10 ms of sim time, so they
report identical windows.

## Layout
- `src/core/`: pure JS, no Three.js (profiles, rig kinematics, simulator, clearance, preflight, show loader).
- `src/render/`: Three.js scene and piece meshes.
- `src/ui/`: cue list, axis readouts, conflict log.
