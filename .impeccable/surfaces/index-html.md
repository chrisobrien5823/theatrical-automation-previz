---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["src/styles.css"]
---

## Scope

The whole app shell (`index.html`): Run mode (stage view, HUD, cue list, transport, axes, log) and Rig mode (model, axes, cues editor). Visitor mode: **Operate**. Two audiences equally: automation pros judging the booth demo on a phone, and theater techs rigging their own model on a laptop. Voice: plain at the door, console-terse deeper in.

## Direction contract

THESIS: The screen reads like the status side of an automation desk: every axis and cue carries a lamp and a word, and a clearance conflict is the loudest, clearest thing on it, shown as a measured line in 3D and kept on screen after the cue. It refuses the category default of a grey dark dashboard with one accent and rounded cards.

OWN-WORLD: Blue-steel rack black ground, anodized panels, engraved uppercase legends in a cool grey. Lamps are the signature: unlit discs that light green (ready/GO), amber (standby/stopped), cyan (moving) or red (clearance), always with a word beside them. STOP sits inside a yellow e-stop collar. Square-shouldered 4 px controls, tabular mono only for numbers, cue numbers and measurements. Controls stay standard web buttons, tabs, selects.

STORY: A visitor sees the preflight warning on Q3 before pressing GO, watches the gap line and red lamps when the wall sweeps the riser, and is left with "Caught in Q3" plus a Replay. A tech imports a model and follows the five-step guide to a recorded cue.

FIRST VIEWPORT: Desktop: stage fills the left; a solid HUD strip on top (state lamp + word left, cue and time right) with the axis lamp bus under it; camera segmented control bottom-left; conflict alert and caught card bottom-centre. Right panel 380 px: show name and Run/Rig switch, standby lamp row, GO (2 parts) / collared STOP / RESET, progress, Cues/Axes/Log tabs. Phone: stage top half, same strip and bus, panel below with GO in thumb reach.

FORM: User-pinned direction ("operator-station feel": axis state lamps, GO/standby lamp, e-stop region, fixed-width readouts), translated per Operate rules into type, palette, density and one signature move (the lamp bus). seed:5fea20aa7972b09e (the roll assigned its own index 3; the user-pinned direction beats the roll and was kept)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Booth attract loop (auto-replaying Q2 → Q3 → Q5) is not built.
- Undo / redo in Rig mode is not built.
