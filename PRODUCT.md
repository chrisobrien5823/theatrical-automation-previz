# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, weighted equally:

- **Automation professionals evaluating it.** Engineers and hiring managers from TAIT and other entertainment automation companies at the Rock Lititz booth (Nov 6, 2026). They often see it on a phone and decide in about 30 seconds whether the builder understands automation: axes, motion profiles, cues, clearance.
- **Theater technicians using it.** Technical directors, automation operators and students at schools and small venues. They import their own set model, rig axes on it, write cues, and check clearance before anything moves on a real stage.

Run mode serves both (watch and operate a show). Rig mode is the working tool for the second group and is laptop-only (≥ 820 px).

## Product Purpose

Browser-based 3D previsualization of scenic automation cues. It runs a cue list (GO / STOP / RESET) of lifts, revolves, flown pieces and wagons with realistic motion, and flags pieces that come within a set clearance: highlighted red, logged with cue, piece pair, time window and minimum gap. A preflight sweep marks problem cues before they are run.

Success: a professional sees the deliberate Q3 near-miss get caught and logged and recognizes real automation thinking; a technician can take a Vectorworks model from import to a checked cue list without help.

## Positioning

Exact clearance checking against the same poses that are drawn ("what is drawn is what is checked"), with per-axis speed and acceleration limits, in a static web app that runs on a phone, offline, or from a single file on a USB stick. No install, no backend, no license. It is a portfolio project, not a replacement for Navigator or other console software; the conference talking point is how professional teams handle clearance in their own tools.

## Operating Context

- Conference booth: phone in hand, noisy and brief; must work offline, with a recorded backup video.
- Rig work: laptop with a set model exported from Vectorworks (FBX) or other CAD (`.glb/.gltf/.fbx/.obj`), often Z-up, in millimeters.
- The builder's frame of reference is show operations: QLab, a Yamaha DM7, cue-based running of a show.
- Terminology to keep: cue, GO, standby, axis, lift, fly, wagon, revolve, home, limits, vMax / aMax, clearance, preflight, piece, jog, record cue.

## Capabilities and Constraints

- Plain static web app (Vite + Three.js), deployed to GitHub Pages from `main`; also a single-file build for USB / `file://`.
- Shows are JSON (`src/shows/demo.json`); Rig work saves as `.previz` (show + model) plus browser autosave.
- Motion math lives in `src/core/`, never imports Three.js, and is unit-tested (Vitest). Rendering and clearance share poses from `src/core/rig.js`.
- The demo show must flag Q3, and only Q3, in preflight.
- Phone layout and an offline service worker exist and must keep working.
- Open before Nov 6: real-phone and offline tests, USB backup check, QR code, an AutoCAD (3D) stage file, backup video.

## Brand Commitments

- Name: **Stage Automation Previz**.
- Voice scales with depth. The product should feel manageable while being complex in function. Entry points and outer functions (first run, import, top-level actions, empty states, hints) use plain, beginner-friendly language. The deeper a user goes (axis setup, limits, cue editing, conflict log), the more the language becomes terse console language: operator terms, units always shown, no explanations a professional would skip.

## Evidence on Hand

- Live site: https://chrisobrien5823.github.io/theatrical-automation-previz/
- Demo show with a deliberate near-miss: Q3, Wall A ↔ Riser, min 0.064 m vs. 0.15 m clearance (`src/shows/demo.json`).
- Generated CAD-style test model: `samples/test-set.glb`.
- Real university theater Vectorworks model (`samples/O'Brien P&P 3D Model.fbx`): private, git-ignored; never publish it or its `.previz` saves.
- No testimonials, users, customers or company endorsements exist. Do not invent any, or imply affiliation with TAIT or any automation vendor.

## Product Principles

1. **What is drawn is what is checked.** Any visual of a pose, gap or conflict comes from the same data the clearance check uses.
2. **Safety signal first.** A clearance conflict is the most important thing on screen whenever one exists, and it is always explained: which cue, which pieces, when, how close.
3. **Simple at the door, deep inside.** Complexity is revealed as the user goes further; the first screen never requires automation knowledge to use.
4. **Show-ready anywhere.** Phone, laptop, offline, single file. A feature that breaks the booth demo does not ship.
5. **Honest about scope.** A previz and learning tool built by a student, not a certified safety system or a vendor product.

## Accessibility & Inclusion

- WCAG 2.2 AA across the UI (contrast, target sizes, focus visibility).
- Keyboard operable: Run mode fully drivable from the keyboard (Space = GO, Esc = STOP, R = RESET exist today); Rig mode controls reachable and usable without a mouse except direct 3D picking, which needs a list alternative (the Model tab list provides one).
