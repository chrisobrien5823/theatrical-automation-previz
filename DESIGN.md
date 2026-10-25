---
name: Stage Automation Previz
description: The status side of an automation desk, in a browser; lamps with words, spike-tape colours for identity, and a clearance conflict as the loudest thing on screen.
colors:
  rack-black: "#0b1016"
  anodized-panel: "#18202a"
  raised-plate: "#222c38"
  raised-plate-hi: "#2b3745"
  recessed-well: "#0f151c"
  hairline-rule: "#33404f"
  control-edge: "#6b7e94"
  stage-overlay: "#111921"
  panel-white: "#e6edf3"
  pure-white: "#ffffff"
  placeholder-grey: "#7f90a3"
  engraved-grey: "#a3b3c4"
  idle-ink: "#8da0b4"
  link-blue: "#7fb8e6"
  steel: "#c9d6e3"
  steel-wash: "#2a4560"
  selection-wash: "#6b8fb866"
  go-green: "#38d97a"
  go-ink: "#06160c"
  go-pressed: "#2cc46a"
  go-unlit: "#14241c"
  go-unlit-ink: "#6a947b"
  go-unlit-rim: "#24402f"
  standby-amber: "#ffb020"
  standby-ink: "#1a1200"
  moving-cyan: "#4cc3ff"
  clash-red: "#ff5a5a"
  clash-wash: "#351820"
  clash-wash-deep: "#4a1a24"
  clash-ink: "#200005"
  clash-flash: "#ff9a9a"
  clash-pale: "#ffd6d6"
  clash-dim: "#e7a3a3"
  clash-flash-deep: "#6d141c"
  stop-disabled-ink: "#c79ca0"
  stop-red: "#c8262f"
  unlit-lamp: "#34414f"
  unlit-lamp-rim: "#566a80"
  tape-bone: "#e6e2d6"
  tape-violet: "#b48ae6"
  tape-pink: "#f074b6"
  tape-indigo: "#7b8df2"
  tape-orange: "#ee8348"
  tape-tan: "#c49a6c"
typography:
  display:
    fontFamily: "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.04em"
  state:
    fontFamily: "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0"
  body:
    fontFamily: "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
  lamp-word:
    fontFamily: "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.04em"
  legend:
    fontFamily: "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.1em"
  numeral:
    fontFamily: "'Hanken Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.3
    fontFeature: "tnum"
rounded:
  square: "0"
  lamp: "50%"
spacing:
  sp-1: "4px"
  sp-2: "8px"
  sp-3: "12px"
  sp-4: "16px"
  sp-5: "24px"
components:
  button-go:
    backgroundColor: "{colors.go-green}"
    textColor: "{colors.go-ink}"
    typography: "{typography.display}"
    rounded: "{rounded.square}"
    height: "76px"
  button-go-unlit:
    backgroundColor: "{colors.go-unlit}"
    textColor: "{colors.go-unlit-ink}"
    typography: "{typography.state}"
    rounded: "{rounded.square}"
    height: "76px"
  button-stop:
    backgroundColor: "{colors.stop-red}"
    textColor: "#ffffff"
    typography: "{typography.state}"
    rounded: "{rounded.square}"
    height: "56px"
  button-reset:
    backgroundColor: "{colors.raised-plate}"
    textColor: "{colors.panel-white}"
    typography: "{typography.state}"
    rounded: "{rounded.square}"
    height: "56px"
  button-small:
    backgroundColor: "{colors.raised-plate-hi}"
    textColor: "{colors.panel-white}"
    rounded: "{rounded.square}"
    padding: "0 11px"
    height: "32px"
  button-small-primary:
    backgroundColor: "{colors.steel}"
    textColor: "#0b1015"
    rounded: "{rounded.square}"
    padding: "0 11px"
    height: "32px"
  input-field:
    backgroundColor: "{colors.recessed-well}"
    textColor: "{colors.panel-white}"
    rounded: "{rounded.square}"
    padding: "6px 8px"
    height: "32px"
  tab:
    textColor: "{colors.engraved-grey}"
    typography: "{typography.title}"
    height: "38px"
  tab-selected:
    textColor: "#ffffff"
  segment-selected:
    backgroundColor: "{colors.steel-wash}"
    textColor: "#ffffff"
  hud-ready:
    backgroundColor: "{colors.stage-overlay}"
    textColor: "{colors.panel-white}"
    typography: "{typography.state}"
    padding: "8px 14px"
  hud-clash:
    backgroundColor: "{colors.clash-red}"
    textColor: "{colors.clash-ink}"
    typography: "{typography.state}"
    padding: "8px 14px"
  hud-stopped:
    backgroundColor: "{colors.standby-amber}"
    textColor: "{colors.standby-ink}"
    typography: "{typography.state}"
    padding: "8px 14px"
  hud-caught:
    backgroundColor: "{colors.clash-wash-deep}"
    textColor: "{colors.clash-red}"
    typography: "{typography.state}"
    padding: "8px 14px 6px"
  cue-row-conflict:
    backgroundColor: "{colors.clash-wash}"
    textColor: "{colors.panel-white}"
    padding: "10px 8px"
  alert-clearance:
    backgroundColor: "{colors.clash-wash}"
    textColor: "{colors.clash-pale}"
    rounded: "{rounded.square}"
    padding: "8px 14px"
  caught-card:
    backgroundColor: "{colors.anodized-panel}"
    textColor: "{colors.engraved-grey}"
    rounded: "{rounded.square}"
    padding: "10px 8px 10px 14px"
  gap-label:
    backgroundColor: "#ffffff"
    textColor: "{colors.clash-ink}"
    typography: "{typography.title}"
    rounded: "{rounded.square}"
    padding: "4px 9px"
  lamp:
    backgroundColor: "{colors.unlit-lamp}"
    rounded: "{rounded.lamp}"
    size: "10px"
  tape-swatch:
    backgroundColor: "{colors.tape-bone}"
    width: "4px"
    height: "14px"
---

# Design System: Stage Automation Previz

## Overview

**Creative North Star: "The Status Side of the Desk"**

The screen reads like the status panel of an automation console. A blue-steel rack-black ground holds slate panels, small legends in a cool grey, and a row of lamps. Every axis and every cue carries a lamp and a word, and the lamp colours are a fixed vocabulary: green ready, amber standby, cyan moving, red clearance. When two pieces come inside clearance, that is the loudest, clearest thing on the screen: the HUD strip itself turns solid red, the clashing axes go red on the bus, the cue row is red-ruled, and a measured white dimension line with its gap in millimetres is drawn in the 3D view. After the cue ends the strip rests on a deep red "Caught" state and a "Caught in Q3" card stays up with a Replay button until it is dismissed.

Colour has two jobs and they never share a hue. Lamps say what state a thing is in. Spike-tape colours, one per axis, say which axis or piece it is, the way a crew marks a deck with coloured tape. The same tape colour follows an axis from its bus cell to its card to the pieces riding it in the 3D view.

The density is a working panel's, not a dashboard's. The right column is a control strip, 380 px on a laptop and wider on big screens. Rows are ruled, not carded. One family, Hanken Grotesk, sets everything in a five-size scale; numbers use tabular figures so a moving readout never jitters. Everything is cut square: controls, bars, cards and the stage overlays have no radius and no drop shadow, and the only circles are the lamps and the Rig guide's step marks. The world's character comes from the palette, the lamp and the tape, not from simulated hardware chrome. STOP is a ramped stop, not an instant E-STOP, so it is a plain saturated red key with nothing around it.

The world rejects the category default: a grey dark dashboard with one accent colour and rounded floating cards.

**Key Characteristics:**
- Rack-black ground with tonal steps for panels, plates and wells; no decorative gradients and no drop shadows.
- Flat lamps (a disc with a lighter rim, no glow) always paired with a short word.
- One meaning per lamp colour, everywhere in the app; identity is carried by spike tape, never by lamp colours.
- One family (Hanken Grotesk) in five sizes; tabular figures for every number.
- Square-cut everything; hairline rules separate regions.
- The HUD strip changes its whole ground with the state: solid red on a clash, solid amber when stopped, a deep red "Caught" rest after.
- Ruled cue sheet with full-width state bands.
- The gap is drawn as a drafting dimension in the 3D view, measured from the same data the clearance check uses, and written in millimetres.

## Colors

A near-black blue-steel neutral ramp carries everything; saturated colour appears as lamp signals, each with one meaning, and as small spike-tape swatches that name an axis.

### Primary
- **GO Green** (go-green): ready and GO. The GO button face, the lit ready lamp, the done mark in the Rig guide, and the preflight "clear" check on a cue. Text on it is **GO Ink** (go-ink). While a cue runs, GO is an unlit key: **GO Unlit** (go-unlit) with a 1px **GO Unlit Rim** (go-unlit-rim) and a muted green legend, **GO Unlit Ink** (go-unlit-ink, 4.7:1), so STOP is the live control.

### Secondary
- **Standby Amber** (standby-amber): waiting on the operator. The standby lamp and legend, the standby cue band, the solid HUD ground while a cue is stopping or stopped (text on it is **Standby Ink**, standby-ink), skipped cues' state word, and the press-and-hold bar that re-standbys a cue. Never used for selection.
- **Moving Cyan** (moving-cyan): an axis or cue in motion. The moving lamp and MOVE word on the axis bus, the running cue band, the progress bar, the axis position tick and the MOVING tag on the Axes tab.

### Tertiary
- **Clash Red** (clash-red): clearance, and only clearance. Clash lamps, the CLASH word, the solid HUD ground on a live conflict, the conflict cue band, the clearance alert border, preflight warning badges, the Log count, gap numbers in the log, and the ring around the gap label. Paired with **Clash Wash** (clash-wash) for alert, bus and band grounds and **Clash Wash Deep** (clash-wash-deep) for actual contact, for a clashing bus cell, and for the HUD's resting "Caught" state.
- **Clash Ink** (clash-ink): text on any solid Clash Red fill (the live HUD strip, the "+n more" chip, the Log count) and on the white gap label. 6.5:1 on Clash Red.
- **Clash Flash** (clash-flash): the second step of the HUD's contact flash, and the quiet red used for danger controls (delete).
- **Clash Flash Deep** (clash-flash-deep): the dark step of the alert's contact flash.
- **Stop Disabled Ink** (stop-disabled-ink): the muted legend on a disabled STOP, 6.5:1 on its dull red face.
- **Clash Pale** (clash-pale) and **Clash Dim** (clash-dim): the alert's text on the Clash Wash ground, the sentence and its secondary parts ("clearance 150 mm", the live "now" label); 12.2:1 and 7.8:1.
- **Stop Red** (stop-red): the STOP button face. A darker, more saturated red than Clash Red, reserved for the stop control. White legend, 5.6:1.
- **Steel** (steel): selection and the active view. The underline on the selected tab, segment and mode switch, the next-step mark in the Rig guide, the primary small button, the drop-target outline, and `accent-color` for native controls. **Steel Wash** (steel-wash) is the selected segment and selected tree-row ground; **Selection Wash** (selection-wash) is the translucent highlight behind selected text.

### Spike Tape (identity)
One colour per axis, defined in the show data (`TAPE_COLORS` in `src/core/show.js`, `color` on each axis in `demo.json`) and handed down to the UI and the 3D pieces. It shows as a 4 px bar swatch beside the axis name on the axis bus, the Axes card and the Rig axis card, and as the colour of the pieces that axis carries. A piece with no colour of its own takes its axis's tape; static pieces stay neutral grey.
- **Bone** (tape-bone): Lift in the demo, first in the palette.
- **Violet** (tape-violet): Revolve in the demo.
- **Pink** (tape-pink): Fly in the demo.
- **Indigo** (tape-indigo), **Orange** (tape-orange), **Tan** (tape-tan): the next three, handed to further axes in order; the palette cycles once all six are taken. Missing or malformed colours fall back to the next free one.

### Neutral
- **Rack Black** (rack-black): the page ground, the browser theme colour and the 3D scene background.
- **Anodized Panel** (anodized-panel): the right-hand control panel, the camera control, the caught card and the import modal.
- **Stage Overlay** (stage-overlay): the HUD and axis bus strips over the 3D view. Opaque: the stage never shows through a bar. (The toast takes Raised Plate Hi with a Control Edge border.)
- **Raised Plate** (raised-plate) / **Raised Plate Hi** (raised-plate-hi): cards inside the panel (Rig cards, inspector), RESET, small buttons and hover steps.
- **Recessed Well** (recessed-well): inputs, the Rig guide, model tree, progress and axis-limit tracks.
- **Hairline Rule** (hairline-rule): decorative dividers: cue sheet rules, HUD and bus borders, tab baseline, panel edges.
- **Control Edge** (control-edge): borders on interactive controls, 3.9:1 on the panel and 3.4:1 on raised plates.
- **Panel White** (panel-white): primary text.
- **Pure White** (pure-white): the focus ring, the selected tab, segment and Run/Rig label, the gap label's ground and dimension line, STOP's legend, and a clashing bus cell's position. Never a surface.
- **Placeholder Grey** (placeholder-grey): input placeholder text, 5.6:1 on the well.
- **Engraved Grey** (engraved-grey): legends, secondary text, inactive tabs and done cues.
- **Idle Ink** (idle-ink): lamp words at rest (IN POS, PEND), a step quieter than the legend grey.
- **Link Blue** (link-blue): text links and the log's "jump to" hint.
- **Unlit Lamp** (unlit-lamp) with its rim (unlit-lamp-rim): the lamp disc at rest.

The 3D scene's own neutrals (pit floor, grid lines, deck, piece outlines, collision-box overlay) live in `src/render/palette.js`, kept in the same blue-steel family: the scene ground equals Rack Black, clearance-checked pieces are outlined in Panel White, and the collision-box overlay is steel-blue because amber is reserved for standby.

### Named Rules
**The One Meaning Rule.** Each lamp colour means one thing everywhere: green ready/GO, amber standby/held/skipped, cyan moving, red clearance. If a new state does not fit one of those meanings, it gets a neutral treatment and a word, not a borrowed colour.

**The Steel Selection Rule.** Selection, focus of attention and the active view are steel, never amber. Amber is spoken for by standby.

**The Plain Stop Rule.** STOP is a ramped stop, so it is a plain Stop Red key with a white legend, no collar and no ring. No instant E-STOP control exists in the app; if one is ever added it gets its own treatment, designed then, and STOP does not borrow it.

**The Spike Tape Rule.** Identity colour comes from the show's tape palette and answers "which axis or piece?"; lamp colour answers "what state?". Tape appears as a small swatch beside a name or on the piece itself, never as a lamp, a state band, a text colour or a fill behind words. A new axis takes the next free tape colour; never reuse a lamp hue as tape.

**The Ink On Solid Rule.** Text on a solid state fill takes that fill's ink (Clash Ink on red, Standby Ink on amber, GO Ink on green), never white or grey, and a lamp on a solid ground of its own colour lights white with an ink ring.

## Typography

**Font:** Hanken Grotesk (with system-ui, -apple-system, Segoe UI, Roboto, sans-serif), self-hosted via @fontsource at 400, 500, 600 and 700. It sets everything: legends, states, transport, cue names, sentences and numbers.

**Character:** One plain, slightly humanist grotesque in five sizes. Hierarchy comes from size and weight; case and tracking are spent only on the few words that behave like engraved lamp legends.

### Hierarchy
- **Display** (700, 36px, 0.04em; `--t-display`): the GO legend. Steps down to 22px (600) while GO is unlit, and to 22px in short landscape.
- **State** (700, 22px, 1 line; `--t-state`): the HUD state word (Ready, Running, Conflict, Stopping, Stopped, Caught; -0.01em), STOP and RESET (0.04em; 17px at ≤420 px), and the live axis position on the Axes tab (600).
- **Title** (600, 17px, 1.2; `--t-title`): cue names (clamped to two lines), the standby cue, axis names, the show name (700), the HUD cue and time (500), the gap label (700), the Caught card's heading, the Run/Rig switch, headings. Tabs use the same size, uppercase at 0.04em.
- **Body** (400, 14px, 1.4; `--t-body`): sentences, hints, alerts, the caught card's detail line, log text, control text, and numbers in lists and readouts (500-600). Empty-state prose caps at 46ch.
- **Label** (600, 12px, 0.02em; `--t-label`): field labels, hints, timestamps, meta lines, move-table headers, and the phone bus and docked bars.
- **Lamp word** (700, 12px, 0.04em): the short words under or beside lamps: STBY, RUN, CLASH, DONE, SKIP, PEND, MOVE, IN POS.
- **Standby legend** (700, 12px, 0.1em, uppercase): the one engraved legend, "Standby", in amber.

### Named Rules
**The Tabular Figures Rule.** Every number that changes or lines up (cue numbers, times, positions, gaps, counts, units, key caps) is set in Hanken Grotesk with tabular figures (`.tnum`, or `font-variant-numeric: tabular-nums` on the element). No second face for numbers.

**The Spent Caps Rule.** Tracked uppercase is rationed to the Standby legend, tabs, GO / STOP / RESET and the short lamp words (the camera presets FOH / SL / SR / TOP are also upper case, being codes). Everything else is mixed case. A new label is mixed case at 12px, not a new engraved legend.

**The Five Sizes Rule.** Type uses 12, 14, 17, 22 and 36 px (`--t-label`, `--t-body`, `--t-title`, `--t-state`, `--t-display`) and nothing between.

## Layout

A two-column desk: the 3D stage fills the left (`minmax(0, 1fr)`) and the control panel sits on the right, full viewport height (100dvh). The panel is `--panel-w: clamp(380px, 27vw, 480px)`: 380 px on laptops, growing on wide screens so cue names get room. The stage carries two solid bars on top, ruled by 1 px hairlines. The **HUD** is one run: state lamp and word on the left, then, after a 1 px rule, the cue and its time, so the state and the cue it belongs to sit together. Directly under it is the **axis bus**, one equal-width cell per axis; inside each cell the lamp, tape swatch, name, state word and position are grouped at the cell's left rather than spread to opposite ends. The camera segmented control (FOH / SL / SR / TOP) sits bottom-left. The clearance alert and the caught card stack bottom-centre, above the camera control, as one ruled block (the card's top border is overlapped with the alert's bottom).

The panel stacks top to bottom: show name and Run/Rig switch; the **transport deck** (standby lamp row, GO 2fr / STOP 1fr / RESET 1fr with 8px gaps, a 3px progress bar, then the standby note, which sits below the transport so GO and STOP never move when it appears); Cues/Axes/Log tabs; the scrolling tab body; and a footer with speed, file buttons and, in Run mode only, key hints on their own row. Space runs on a named scale (`--sp-1..5`: 4/8/12/16/24px): 8px inside the deck, 12px between panel groups, 16px between the deck and the tabs. In Rig mode a new selection scrolls its piece panel into view, the model tree shrinks while a piece panel is open, and the Get-started guide shows only the next step once step 1 is done (All steps expands it).

Responsive rules, as built:
- **≤820 px (phone portrait):** single column. Stage on top, panel below capped at 58dvh with tabs capped at 30dvh. The show name, Run/Rig switch, key hints, Save and every other desktop-only control are hidden (Rig mode is laptop-only).
  - **Bus cells are two lines:** the lamp with its word, then the axis's tape swatch, a short code and its position (LIFT, REV, FLY4: `axisCodes` in `src/ui/format.js`, or an optional `short` field on the axis). Every lamp keeps its word and every position stays visible at any phone width; the full name is read out to screen readers, not drawn.
  - **One docked bar** (`--dock-h: 44px`) sits directly under the bus, full width. The live conflict alert and, after the cue, the Caught card share this one slot, so the stage under it never changes size when one replaces the other; if both exist (a stopped cue) the live alert wins. The full sentence lives in the Log tab.
  - **The camera control moves off the stage** into the panel footer, a full-width row of four equal 44px buttons under the thumb. The stage keeps only the HUD, the bus and the docked bar over it.
  - Only the live cue (standby, running, conflict) keeps its description, so more cues fit above the footer.
- **≤420 px:** GO drops to 68px tall; STOP and RESET to 17px; the Caught card's Replay drops its cue number.
- **≤359 px:** the alert drops the live "now" figure and the Caught bar drops its time, so the pair keeps the room.
- **Short landscape (height ≤520 px, width ≥560 px):** back to two columns with a 300 px panel; buttons 44px tall, GO 52px at 22px; cue notes hidden.
- **Coarse pointer:** every control (camera buttons, file buttons, selects, tabs, the caught bar's buttons, Rig buttons, fields, tree rows) grows to a 44px target; camera buttons are at least 48px wide.
- Safe-area insets pad the HUD top, panel bottom, camera control and message stack.

## Elevation & Depth

Flat, and layered by tone only: Rack Black ground, Anodized Panel, Raised Plate, Raised Plate Hi, with Recessed Well for anything that holds a value. There are no drop shadows anywhere. Hairline rules, not shadows, separate regions; the bars, alert, caught card, toast and modal that sit over the 3D stage are opaque and ruled with a 1px border, so what is underneath never shows through. Lamps are flat: a filled disc with a 1px lighter rim, no inset, no halo, no glow. Depth marks that do exist are inset state marks and rings, never offsets.

### Ring and Mark Vocabulary
- **Focus** (`outline: 2px solid #fff; outline-offset: 2px; box-shadow: 0 0 0 5px #000c`): every focusable element. Inside segmented controls, rows and the docked bar's buttons the outline moves inset (-3px) and the halo is dropped, so a neighbouring edge or the stage edge never clips it.
- **Gap label ring** (`box-shadow: 0 0 0 1px var(--clr)`): a 1px Clash Red ring around the white dimension label, so it reads on any surface in the 3D view.
- **Selected underline** (`box-shadow: inset 0 -2px 0 var(--steel)`): selected segments and mode switch; tabs use a 2px bottom border.
- **Clash top rule** (`box-shadow: inset 0 3px 0 var(--clr)`): a clashing bus cell.
- **Inset edge** (`box-shadow: inset 0 0 0 1px <colour>`): the unlit GO key, warning badges and log rows, the axis limit track.

### Named Rules
**The Tonal Plate Rule.** Panels and cards gain depth by stepping up the neutral ramp, never by a shadow. Anything over the 3D stage is solid and ruled.

**The Flat Lamp Rule.** A lit lamp is a solid disc in its state colour with a rim mixed 55% toward white. No halo, glow or coloured shadow on a lamp or anything else; state is read from colour plus the word beside it.

## Shapes

Square-cut. Controls, inputs, bars, alerts, cards, the caught card, the modal, rows and the Rig guide all take a 0 radius; a corner is a hard 90 degrees. The only circles are the lamps (10px discs) and the Rig guide's step marks (20px). The Log count is a square chip, not a pill. Spike-tape swatches are 4px-wide square bars (14px tall; 22px on the Rig axis card). Borders are 1px: Control Edge on interactive things, Hairline Rule on decoration; the empty state and the file drop target are dashed. Selected segments and tabs are marked by a 2px Steel underline, not a fill change alone. Regions are separated by hairline rules rather than floating boxes: the panel is one column of ruled bands, and the stage bars are two solid ruled strips.

### Named Rules
**The Square Cut Rule.** Everything is cut square. Round means a bulb: the only circles are lamps and the Rig guide's step marks. There is no radius token other than 0 and 50%, and a new component does not get a corner.

## Components

### Buttons
Heavy, square and legible from arm's length.
- **Shape:** square-cut (0 radius).
- **GO:** GO Green face, GO Ink legend, Hanken Grotesk 700 at 36px, 0.04em tracking, 76px tall (68px ≤420, 52px short landscape), spanning half the transport. Hover lightens (#4ce489), active darkens (GO Pressed, go-pressed) and presses down 1px. **While a cue runs it is an unlit key:** GO Unlit face, GO Unlit Ink legend at 22px 600, a 1px GO Unlit Rim inset edge, so it stops being the biggest green block and STOP is the live control.
- **STOP:** Stop Red face, white legend, 22px, 56px tall, a plain key (no collar, no ring). Hover lightens (#d93039). Disabled: dull dark red face (#3a1a1e) with a muted legend.
- **RESET:** Raised Plate with a Control Edge border, 22px.
- **Small (Rig):** 32px, Raised Plate Hi with Control Edge border, 14px 600 with an optional 14px icon. Primary variant is Steel with dark ink. Big variant is 40px. Danger variant takes Clash Flash text. Disabled at 45% opacity. 44px on a coarse pointer.
- **File buttons and Replay:** outlined (Control Edge), transparent or Raised Plate, 14px 500-600.
- **Links:** Link Blue, underlined at 3px offset.

### Lamp (signature)
A flat 10px disc in Unlit Lamp with a lighter rim at rest, filling with its state colour when lit. States: ready/go (green), standby (amber), moving (cyan), clash (red), off/idle (unlit). It is always paired with a word: HUD state word, Standby legend, bus word (MOVE / CLASH / IN POS), or cue-row state text (STBY / RUN / CLASH / DONE / SKIP / PEND).

**The Lamp-and-Word Rule.** A lamp never appears alone. State is never carried by colour only; the word is present at every breakpoint.

### HUD Strip (signature)
The strip along the top of the stage is the state, so it changes its whole ground, not only its lamp: the state lamp and word, then a hairline rule, then the cue and its time (17px 500).
- **Ready / running:** the quiet Stage Overlay ground with Panel White text.
- **Conflict:** a solid Clash Red ground with Clash Ink text and a Clash Ink bottom rule; the lamp lights white with an ink ring. On actual contact the ground flashes to Clash Flash in two steps at 0.8s (not under reduced motion).
- **Stopping / stopped:** a solid Standby Amber ground with Standby Ink text; the lamp lights white with an ink ring.
- **Caught:** the resting state after a cue that was caught inside clearance. A Clash Wash Deep ground, the word "Caught" in Clash Red, and a 3px Clash Red bottom rule, until the Caught card is dismissed or the next GO / RESET. It replaces the green READY that used to disagree with the red card.

**The Loudest Strip Rule.** A live conflict is the loudest thing on the screen, and the HUD strip carries it: solid red, not a small lamp on a quiet strip. Nothing else is allowed a solid red ground.

### Axis Bus
One cell per axis across the top of the stage: lamp, tape swatch, axis name, state word and position, grouped at the cell's left, separated from the next cell by a 1px rule. The state word is **MOVE** while moving (cyan) and **IN POS** at rest (Idle Ink). A clashing axis turns its cell Clash Wash Deep with a 3px Clash Red top rule, red name and word and a white position. Word choice is deliberate: CLASH, never CLR, because to a stage crew CLR means clear; and IN POS, not IDLE, because that is what an operator's desk says of an axis at its target. On a phone each cell is two lines with a short axis code (see Layout).

### Axis Cards
Axes tab: a ruled row per axis with the tape swatch beside the name (and a cyan MOVING tag while moving), the live position at 22px, limits beneath and a track with a cyan position tick. Rig mode's axis card repeats the swatch at 22px tall beside the axis title, above its jog slider.

### Cue Sheet
Ruled rows on the panel ground, no cards. Columns: state (lamp over state word), cue number as a tabular figure, name (17px 600) with meta and notes beneath, and time. The live row gets a full-width band in its lamp colour, ruled top and bottom: standby amber, running cyan, conflict red. Done rows go Engraved Grey; skipped rows strike through the name and set SKIP in amber. Preflight shows a red warning badge ("min 64 mm") or a green check. A cue that ran and was caught reads **DONE** over a red **CLASH** after the run, on the quiet done ground, so the result stays in the sheet without a second red band. On touch, re-standbying a cue is a deliberate press-and-hold with an amber bar filling along the row's bottom edge (450ms).

**The Ruled Sheet Rule.** The cue list is a sheet, not a stack of cards: 1px Hairline Rule between rows, state carried by full-width bands.

### Tabs and Segmented Controls
- **Tabs (Cues / Axes / Log):** 17px 600 uppercase at 0.04em, Engraved Grey; selected goes white with a 2px Steel underline. The Log tab carries a red count chip when conflicts are logged.
- **Segmented (camera, Run/Rig):** one outlined square group, internal Hairline Rule dividers; selected segment is Steel Wash with white text and an inset 2px Steel underline. The camera presets are FOH, SL, SR and TOP, all upper case. On a phone the camera group lives in the panel footer as four equal 44px cells.

### Inputs / Fields
- **Style:** Recessed Well ground, 1px Control Edge, square, 6px 8px padding, 32px tall (44px on coarse pointers). Units sit beside numbers in Engraved Grey at 12px.
- **Focus:** a 2px white outline at 0 offset replaces the border.
- **Labels:** 12px 600 Engraved Grey above the field, mixed case.

### Clearance Alert and Caught Card
- **Alert:** Clash Wash ground, 1px Clash Red border, Clash Pale text, a red warning icon, the pair, the live gap as "now 67 mm" (the gap in white at 17px 600) and "clearance 150 mm" in Clash Dim. On actual contact the ground deepens and, if reduced motion is not requested, flashes in two steps at 0.8s.
- **Caught card:** Anodized Panel ground, 1px Clash Red border, square, a red lamp, "Caught in Q…" in 17px 600, then the pair, "min 64 mm" (the minimum reached, not the live gap), time and clearance, and a Replay button and a close. Rises 8px into place over 0.35s (reduced motion: no animation). Stays until dismissed, the next GO or RESET.
- **Docked on a phone:** both become one 44px bar under the axis bus (see Layout); the card is a single row (lamp, "Caught in Q3", pair, min gap, time, Replay, close) and the full sentence is in the Log.

**The Live Versus Minimum Rule.** A gap number is always labelled with what it is: "now" for the live gap while pieces are moving, "min" for the closest approach the check recorded (badges, Caught card, log). Two unlabelled gap numbers never share the screen.

**The Millimetre Rule.** Gaps and clearance are shown in millimetres, the unit of a drawing, a Vectorworks model and a tape measure: whole mm from 10 up, one decimal below (6.4 mm), "CONTACT" at zero. Metres stay in the data and the show JSON; `formatGap` and `formatClearance` in `src/ui/format.js` are the only places the unit changes.

### Gap Dimension (signature)
The closest points of the worst clashing pair, drawn as a drafting dimension over the 3D view: a 2px white line with square caps and end ticks, a dashed 1px leader up to a white label floating 44px above the midpoint, and the measured distance on the label (17px 700 Clash Ink on white, 4px 9px padding, ringed in Clash Red). The drawn line has a 24px minimum length, a visual floor so a tiny gap is still a visible line, while the label keeps the true value. At contact the line collapses to a white circle outline. The points come from the core clearance code, so the line is the measurement.

**The Measured Line Rule.** Any drawn gap, pose or conflict comes from the same data the clearance check uses. Never draw an approximate or decorative indicator; the 24px floor stretches only the drawing, never the number.

### Icons
A small stroked set on a 16px grid, 1.75 stroke, round caps, currentColor, inline SVG. Decorative by default; labelled when the icon is the only content. The favicon is a steel ring with a green bar on a rack-black tile.

## Do's and Don'ts

### Do:
- **Do** pair every lamp with a short word, at every breakpoint.
- **Do** keep each lamp colour to its one meaning: green ready/GO, amber standby/held/skipped, cyan moving, red clearance.
- **Do** carry axis and piece identity in spike-tape colours from the show data, as a small swatch beside a name or on the piece.
- **Do** let a live conflict take the whole HUD strip: solid Clash Red, Clash Ink text.
- **Do** keep the Caught resting state and card up after the cue, until dismissed, the next GO or RESET.
- **Do** write gaps in millimetres and label them "now" or "min".
- **Do** mark selection and the active view with Steel and a 2px Steel underline.
- **Do** set every number in Hanken Grotesk with tabular figures.
- **Do** separate regions with 1px Hairline Rule and step depth with the neutral ramp.
- **Do** cut every control, bar and card square; keep circles for lamps and guide marks.
- **Do** use the white 2px focus ring with its black halo on everything focusable, inset where an edge would clip it.
- **Do** keep touch targets at 44px on coarse pointers, and on the phone dock one bar under the bus.
- **Do** stay within the five type sizes (12, 14, 17, 22, 36 px).

### Don't:
- **Don't** use amber for selection, hover or general warnings; it means standby.
- **Don't** wrap STOP in a collar or ring, or give it an instant E-STOP look; it is a ramped stop.
- **Don't** use Clash Red for anything that is not a clearance conflict.
- **Don't** use a lamp colour as spike tape, or tape as a state colour, band or text colour.
- **Don't** add a second typeface, or set new tracked-uppercase legends beyond the Standby legend, tabs, transport and lamp words.
- **Don't** turn the cue list into cards, or put the main panel content in floating rounded cards.
- **Don't** add drop shadows, glow, halos or coloured shadows to lamps or anything else; overlays are opaque and ruled.
- **Don't** round a corner, except a lamp and the Rig guide's step marks.
- **Don't** draw a gap or conflict indicator that is not computed by the clearance check, or show a gap without saying whether it is live or minimum.
- **Don't** abbreviate the clash word to CLR, or call an axis at its target IDLE.
