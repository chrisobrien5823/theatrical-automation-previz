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

## Importing a set model (Rig mode, laptop)
1. **Open…** (or drag onto the stage) a `.glb`, `.fbx` or `.obj`, or a `.gltf` together with its
   `.bin` and textures. From Vectorworks, **File → Export → FBX** works directly.
   The import dialog guesses the units, lets you switch Y-up / Z-up (CAD exports are often Z-up),
   can add a stage floor at height 0, and shows the model's overall size so you can check it
   against a known dimension. Lights and cameras in the export are dropped; all faces render
   two-sided (soft goods are often zero-thickness planes).
2. **Model tab:** click an object in 3D or in the list → **Make piece** (or *box per part* for
   L-shapes and units with gaps). Pieces are collision-checked; leave walls, pipes and masking static.
3. **Moves with → ＋ New Lift / Fly / Wagon / Revolve** creates an axis centered on the piece and
   attaches it. Choosing ＋ New on a piece that already moves stacks the new axis on the old one
   (e.g. a revolve riding a wagon). For a revolve, make the *disc* a piece first so the pivot is its center,
   then attach the scenery to that revolve.
4. **Axes tab:** drag a slider to jog; clashing pieces turn red with the live gap shown on top.
   *Setup* holds limits, speed/accel, travel direction, pivot/origin and "Drawn at" (the position
   the model shows the axis in).
5. **Cues tab:** **● Record cue** saves the jogged positions (only axes that moved). Edit targets,
   delays and order; preflight ⚠ badges update as you go.
6. **Save** downloads a `.previz` file (show + model in one file). Work is also autosaved in the
   browser. Open a `.previz` on a phone to run it (Rig mode is laptop-only).

`samples/test-set.glb` is a generated CAD-style test model (millimeters, Z-up, layer groups):
`node scripts/make-test-model.mjs` rebuilds it. Real set models in `samples/` are git-ignored.

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
- `src/core/`: pure JS, no Three.js (profiles, rig kinematics, simulator, clearance, preflight,
  show loader, box fitting, rig edit operations).
- `src/model/`: glTF import, the displayed model copy, `.previz` save/load and autosave.
- `src/render/`: Three.js scene, piece meshes, click-to-select.
- `src/ui/`: cue list, axis readouts, conflict log; `src/ui/editor/` is Rig mode.
