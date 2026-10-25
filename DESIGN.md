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
  engraved-grey: "#a3b3c4"
  idle-ink: "#8da0b4"
  link-blue: "#7fb8e6"
  steel: "#c9d6e3"
  steel-wash: "#2a4560"
  go-green: "#38d97a"
  go-ink: "#06160c"
  go-unlit: "#1b3a2a"
  standby-amber: "#ffb020"
  standby-ink: "#1a1200"
  moving-cyan: "#4cc3ff"
  clash-red: "#ff5a5a"
  clash-wash: "#351820"
  clash-wash-deep: "#4a1a24"
  estop-red: "#c8262f"
  collar-yellow: "#ffcc00"
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
  tick: "3px"
  control: "4px"
  panel: "6px"
  lamp: "50%"
spacing:
  hair: "4px"
  tight: "6px"
  base: "8px"
  row: "10px"
  gutter: "12px"
  inset: "14px"
  roomy: "16px"
components:
  button-go:
    backgroundColor: "{colors.go-green}"
    textColor: "{colors.go-ink}"
    typography: "{typography.display}"
    rounded: "{rounded.control}"
    height: "76px"
  button-go-disabled:
    backgroundColor: "{colors.go-unlit}"
    textColor: "#7fae92"
    rounded: "{rounded.control}"
    height: "76px"
  button-stop:
    backgroundColor: "{colors.estop-red}"
    textColor: "#ffffff"
    typography: "{typography.state}"
    rounded: "{rounded.control}"
    height: "56px"
  estop-collar:
    backgroundColor: "{colors.collar-yellow}"
    rounded: "{rounded.panel}"
    padding: "4px"
  button-reset:
    backgroundColor: "{colors.raised-plate}"
    textColor: "{colors.panel-white}"
    typography: "{typography.state}"
    rounded: "{rounded.control}"
    height: "56px"
  button-small:
    backgroundColor: "{colors.raised-plate-hi}"
    textColor: "{colors.panel-white}"
    rounded: "{rounded.control}"
    padding: "0 11px"
    height: "32px"
  button-small-primary:
    backgroundColor: "{colors.steel}"
    textColor: "#0b1015"
    rounded: "{rounded.control}"
    padding: "0 11px"
    height: "32px"
  input-field:
    backgroundColor: "{colors.recessed-well}"
    textColor: "{colors.panel-white}"
    rounded: "{rounded.control}"
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
  cue-row-conflict:
    backgroundColor: "{colors.clash-wash}"
    textColor: "{colors.panel-white}"
    padding: "10px 8px"
  alert-clearance:
    backgroundColor: "{colors.clash-wash}"
    textColor: "#ffd6d6"
    rounded: "{rounded.control}"
    padding: "8px 14px"
  gap-label:
    backgroundColor: "#ffffff"
    textColor: "#200005"
    typography: "{typography.label}"
    rounded: "{rounded.tick}"
    padding: "3px 7px"
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

The screen reads like the status panel of an automation console. A blue-steel rack-black ground holds slate panels, small legends in a cool grey, and a row of lamps. Every axis and every cue carries a lamp and a word, and the lamp colours are a fixed vocabulary: green ready, amber standby, cyan moving, red clearance. When two pieces come inside clearance, that is the loudest, clearest thing on the screen: red lamps on the axis bus, a red-ruled cue row, a red alert, and a measured white dimension line in the 3D view. After the cue ends, a "Caught in Q3" card stays up with a Replay button.

Colour has two jobs and they never share a hue. Lamps say what state a thing is in. Spike-tape colours, one per axis, say which axis or piece it is, the way a crew marks a deck with coloured tape. The same tape colour follows an axis from its bus cell to its card to the pieces riding it in the 3D view.

The density is a working panel's, not a dashboard's. The right column is a fixed 380 px control strip. Rows are ruled, not carded. One family, Hanken Grotesk, sets everything in a five-size scale; numbers use tabular figures so a moving readout never jitters. Controls are ordinary web buttons, tabs and selects with square-shouldered 4 px corners. The world's character comes from the palette, the lamp and the tape, not from simulated hardware chrome. The one physical device it borrows literally is the yellow e-stop collar around STOP.

The world rejects the category default: a grey dark dashboard with one accent colour and rounded floating cards.

**Key Characteristics:**
- Rack-black ground with tonal steps for panels, plates and wells; no decorative gradients.
- Flat lamps (a disc with a lighter rim, no glow) always paired with a short word.
- One meaning per lamp colour, everywhere in the app; identity is carried by spike tape, never by lamp colours.
- One family (Hanken Grotesk) in five sizes; tabular figures for every number.
- Ruled cue sheet with full-width state bands.
- The gap is drawn as a drafting dimension in the 3D view, measured from the same data the clearance check uses.

## Colors

A near-black blue-steel neutral ramp carries everything; saturated colour appears as lamp signals, each with one meaning, and as small spike-tape swatches that name an axis.

### Primary
- **GO Green** (go-green): ready and GO. The GO button face, the lit ready lamp, the done mark in the Rig guide, and the preflight "clear" check on a cue. Text on it is **GO Ink** (go-ink). Unlit, it becomes **GO Unlit** (go-unlit) with a muted green legend.

### Secondary
- **Standby Amber** (standby-amber): waiting on the operator. The standby lamp and legend, the standby cue band, a halted (Stopped) HUD lamp and its mid-cue note, skipped cues' state word, and the press-and-hold bar that re-standbys a cue. Never used for selection.
- **Moving Cyan** (moving-cyan): an axis or cue in motion. The moving lamp and MOVE word on the axis bus, the running cue band, the progress bar, the axis position tick and the MOVING tag on the Axes tab.

### Tertiary
- **Clash Red** (clash-red): clearance, and only clearance. Clash lamps, the CLASH word, the conflict cue band, the clearance alert border, preflight warning badges, the Log count, gap numbers in the log, and the ring around the gap label. Paired with **Clash Wash** (clash-wash) for alert, bus and band grounds and **Clash Wash Deep** (clash-wash-deep) for actual contact.
- **E-stop Red** (estop-red): the STOP button face. A darker, more saturated red than Clash Red, reserved for the stop control.
- **Collar Yellow** (collar-yellow): the e-stop collar around STOP. Nothing else. When STOP is disabled the collar dims to a dull olive (#4d4420).
- **Steel** (steel): selection and the active view. The underline on the selected tab, segment and mode switch, the next-step mark in the Rig guide, the primary small button, the drop-target outline, and `accent-color` for native controls. **Steel Wash** (steel-wash) is the selected segment and selected tree-row ground.

### Spike Tape (identity)
One colour per axis, defined in the show data (`TAPE_COLORS` in `src/core/show.js`, `color` on each axis in `demo.json`) and handed down to the UI and the 3D pieces. It shows as a 4 px bar swatch beside the axis name on the axis bus, the Axes card and the Rig axis card, and as the colour of the pieces that axis carries. A piece with no colour of its own takes its axis's tape; static pieces stay neutral grey.
- **Bone** (tape-bone, #e6e2d6): Lift in the demo, first in the palette.
- **Violet** (tape-violet): Revolve in the demo.
- **Pink** (tape-pink): Fly in the demo.
- **Indigo** (tape-indigo), **Orange** (tape-orange), **Tan** (tape-tan): the next three, handed to further axes in order; the palette cycles once all six are taken. Missing or malformed colours fall back to the next free one.

### Neutral
- **Rack Black** (rack-black): the page ground, the browser theme colour and the 3D scene background.
- **Anodized Panel** (anodized-panel): the right-hand control panel and the camera control, caught card and modal (at high opacity).
- **Stage Overlay** (stage-overlay): the HUD and axis bus strips laid over the 3D view, used translucent.
- **Raised Plate** (raised-plate) / **Raised Plate Hi** (raised-plate-hi): cards inside the panel (axis readouts, Rig cards, inspector, log entries), RESET, small buttons and hover steps.
- **Recessed Well** (recessed-well): inputs, the Rig guide, model tree, progress and axis-limit tracks.
- **Hairline Rule** (hairline-rule): decorative dividers: cue sheet rules, HUD and bus borders, tab baseline, panel edges.
- **Control Edge** (control-edge): borders on interactive controls, 3.9:1 on the panel and 3.4:1 on raised plates.
- **Panel White** (panel-white): primary text.
- **Engraved Grey** (engraved-grey): legends, secondary text, inactive tabs and done cues.
- **Idle Ink** (idle-ink): lamp words at rest (IDLE, PEND), a step quieter than the legend grey.
- **Link Blue** (link-blue): text links and the log's "jump to" hint.
- **Unlit Lamp** (unlit-lamp) with its rim (unlit-lamp-rim): the lamp disc at rest.

The 3D scene's own neutrals (pit floor, grid lines, deck, piece outlines, collision-box overlay) live in `src/render/palette.js`, kept in the same blue-steel family: the scene ground equals Rack Black, clearance-checked pieces are outlined in Panel White, and the collision-box overlay is steel-blue because amber is reserved for standby.

### Named Rules
**The One Meaning Rule.** Each lamp colour means one thing everywhere: green ready/GO, amber standby/held/skipped, cyan moving, red clearance. If a new state does not fit one of those meanings, it gets a neutral treatment and a word, not a borrowed colour.

**The Steel Selection Rule.** Selection, focus of attention and the active view are steel, never amber. Amber is spoken for by standby.

**The Collar Rule.** Collar yellow appears only as the ring around STOP. It is the single literal piece of desk hardware in the world.

**The Spike Tape Rule.** Identity colour comes from the show's tape palette and answers "which axis or piece?"; lamp colour answers "what state?". Tape appears as a small swatch beside a name or on the piece itself, never as a lamp, a state band, a text colour or a fill behind words. A new axis takes the next free tape colour; never reuse a lamp hue as tape.

## Typography

**Font:** Hanken Grotesk (with system-ui, -apple-system, Segoe UI, Roboto, sans-serif), self-hosted via @fontsource at 400, 500, 600 and 700. It sets everything: legends, states, transport, cue names, sentences and numbers.

**Character:** One plain, slightly humanist grotesque in five sizes. Hierarchy comes from size and weight; case and tracking are spent only on the few words that behave like engraved lamp legends.

### Hierarchy
- **Display** (700, 36px, 0.04em; `--t-display`): the GO legend. Steps down to 22px in short landscape.
- **State** (700, 22px, 1 line; `--t-state`): the HUD state word (Ready, Running, Conflict, Stopped; -0.01em), STOP and RESET (0.04em; 17px at ≤420 px), and the live axis position on the Axes tab (600).
- **Title** (600, 17px, 1.2; `--t-title`): cue names (clamped to two lines), the standby cue, axis names, the show name (700), the HUD cue and time (500), the Run/Rig switch, headings. Tabs use the same size, uppercase at 0.04em.
- **Body** (400, 14px, 1.4; `--t-body`): sentences, hints, alerts, the caught card, log text, control text, and numbers in lists and readouts (500-600). Empty-state prose caps at 46ch.
- **Label** (600, 12px, 0.02em; `--t-label`): field labels, hints, timestamps, meta lines, move-table headers, gap numbers on the dimension label.
- **Lamp word** (700, 12px, 0.04em): the short words under or beside lamps: STBY, RUN, CLASH, DONE, SKIP, PEND, MOVE, IDLE.
- **Standby legend** (700, 12px, 0.1em, uppercase): the one engraved legend, "Standby", in amber.

### Named Rules
**The Tabular Figures Rule.** Every number that changes or lines up (cue numbers, times, positions, gaps, counts, units, key caps) is set in Hanken Grotesk with tabular figures (`.tnum`, or `font-variant-numeric: tabular-nums` on the element). No second face for numbers.

**The Spent Caps Rule.** Tracked uppercase is rationed to the Standby legend, tabs, GO / STOP / RESET and the eight short lamp words. Everything else is mixed case. A new label is mixed case at 12px, not a new engraved legend.

**The Five Sizes Rule.** Type uses 12, 14, 17, 22 and 36 px (`--t-label`, `--t-body`, `--t-title`, `--t-state`, `--t-display`) and nothing between.

## Layout

A two-column desk: the 3D stage fills the left (`minmax(0, 1fr)`) and a fixed 380 px control panel sits on the right, full viewport height (100dvh). The stage carries a solid top strip: the HUD (state lamp and word on the left, cue and time on the right) with the axis bus directly under it, one equal-width cell per axis, separated by 1 px rules. The camera segmented control sits bottom-left. The clearance alert and the caught card stack bottom-centre, above the camera control.

The panel stacks top to bottom: show name and Run/Rig switch; standby lamp row; transport (GO 2fr, collared STOP 1fr, RESET 1fr, 8px gaps); a 3px progress bar; Cues/Axes/Log tabs; the scrolling tab body; and a footer with speed, file buttons and key hints. Panel inset is 12px 14px. Internal gaps run on 4/6/8/10/12px steps, with 16px for the empty state and modal.

Responsive rules, as built:
- **≤820 px (phone portrait):** single column. Stage on top, panel below capped at 58dvh with tabs capped at 30dvh. The show name, Run/Rig switch, key hints, Save and every other desktop-only control are hidden (Rig mode is laptop-only). Alert and caught card dock under the axis bus so they never cover the gap. Bus cells tighten to 5px 8px at 12px.
- **≤420 px:** bus positions are hidden (every lamp keeps its word; positions live in the Axes tab). GO drops to 68px tall; STOP and RESET to 17px.
- **Short landscape (height ≤520 px, width ≥560 px):** back to two columns with a 300 px panel; buttons 44px tall, GO 52px at 22px; cue notes hidden.
- **Coarse pointer:** camera buttons, file buttons, selects, tabs and the caught card's buttons grow to 44px; camera buttons are at least 48px wide.
- Safe-area insets pad the HUD top, panel bottom, camera control and message stack.

## Elevation & Depth

Flat by default, layered by tone: Rack Black ground, Anodized Panel, Raised Plate, Raised Plate Hi, with Recessed Well for anything that holds a value. Hairline rules, not shadows, separate regions. Lamps are flat: a filled disc with a 1px lighter rim, no inset, no halo, no glow. Shadows exist only where a thing floats over the 3D stage (alert, caught card, toast, modal, gap label), plus the white focus ring's black halo. The HUD and bus strips are translucent Stage Overlay rather than shadowed.

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 6px 20px #0009`): alert and toast over the stage.
- **Card overlay** (`box-shadow: 0 10px 30px #000a`): the caught card.
- **Modal** (`box-shadow: 0 16px 40px #000c`): the import dialog.
- **Gap label** (`box-shadow: 0 0 0 1px var(--clr), 0 2px 8px #0008`): a Clash Red ring and a small drop under the dimension label.
- **Focus** (`outline: 2px solid #fff; outline-offset: 2px; box-shadow: 0 0 0 5px #000c`): every focusable element; inside segmented controls and rows the outline moves inset (-3px) and the halo is dropped.

### Named Rules
**The Tonal Plate Rule.** Panels and cards gain depth by stepping up the neutral ramp, never by a shadow. A shadow means the thing floats over the 3D stage.

**The Flat Lamp Rule.** A lit lamp is a solid disc in its state colour with a rim mixed 55% toward white. No halo, glow or coloured shadow on a lamp or anything else; state is read from colour plus the word beside it.

## Shapes

Square-shouldered. Controls, inputs, alerts and rows of the log take a 4px corner; panels, cards, the caught card, modal and Rig guide take 6px; small tags (badges, kbd, the gap label, the alert's "more" chip) take 3px. Lamps and the Rig guide's step marks are full circles; the Log count is a pill. Spike-tape swatches are 4px-wide square bars (14px tall; 22px on the Rig axis card). Borders are 1px: Control Edge on interactive things, Hairline Rule on decoration. Selected segments and tabs are marked by a 2px Steel underline, not a fill change alone. The e-stop collar is a 4px Collar Yellow ring at 6px radius around a 4px button.

## Components

### Buttons
Heavy, square and legible from arm's length.
- **Shape:** gently squared (4px).
- **GO:** GO Green face, GO Ink legend, Hanken Grotesk 700 at 36px, 0.04em tracking, 76px tall, spanning half the transport. Hover lightens (#4ce489), active darkens (#2cc46a) and presses down 1px. Disabled turns GO Unlit with a 1px green inset edge.
- **STOP:** E-stop Red face, white legend, 22px, 56px tall, inside the Collar Yellow ring; focus offset is 6px so the ring clears the collar. Disabled: dull red face, collar dims to olive.
- **RESET:** Raised Plate with a Control Edge border, 22px.
- **Small (Rig):** 32px, Raised Plate Hi with Control Edge border, 14px 600 with an optional 14px icon. Primary variant is Steel with dark ink. Big variant is 40px. Disabled at 45% opacity.
- **File buttons and Replay:** outlined (Control Edge), transparent or Raised Plate, 14px 500-600.
- **Links:** Link Blue, underlined at 3px offset.

### Lamp (signature)
A flat 10px disc in Unlit Lamp with a lighter rim at rest, filling with its state colour when lit. States: ready/go (green), standby (amber), moving (cyan), clash (red), off/idle (unlit). It is always paired with a word: HUD state word, Standby legend, bus word (MOVE / CLASH / IDLE), or cue-row state text (STBY / RUN / CLASH / DONE / SKIP / PEND).

**The Lamp-and-Word Rule.** A lamp never appears alone. State is never carried by colour only; the word is present at every breakpoint.

### Axis Bus
One cell per axis across the top of the stage: lamp, tape swatch, axis name, state word, and (above 420 px) the position as a tabular number. A moving axis turns its word cyan; a clashing axis tints the whole cell Clash Wash (#351820e6) and turns name and word red. Word choice is deliberate: CLASH, never CLR, because to a stage crew CLR means clear.

### Axis Cards
Axes tab: a Raised Plate card per axis with the tape swatch beside the name (and a cyan MOVING tag while moving), the live position at 22px, limits beneath and a track with a cyan position tick. Rig mode's axis card repeats the swatch at 22px tall beside the axis title, above its jog slider.

### Cue Sheet
Ruled rows on the panel ground, no cards. Columns: state (lamp over state word), cue number as a tabular figure, name (17px 600) with meta and notes beneath, and time. The live row gets a full-width band in its lamp colour, ruled top and bottom: standby amber, running cyan, conflict red. Done rows go Engraved Grey; skipped rows strike through the name and set SKIP in amber. Preflight shows a red warning badge or a green check. On touch, re-standbying a cue is a deliberate press-and-hold with an amber bar filling along the row's bottom edge (450ms).

**The Ruled Sheet Rule.** The cue list is a sheet, not a stack of cards: 1px Hairline Rule between rows, state carried by full-width bands.

### Tabs and Segmented Controls
- **Tabs (Cues / Axes / Log):** 17px 600 uppercase at 0.04em, Engraved Grey; selected goes white with a 2px Steel underline. The Log tab carries a red count pill when conflicts are logged.
- **Segmented (camera, Run/Rig):** one outlined 4px group, internal Hairline Rule dividers; selected segment is Steel Wash with white text and an inset 2px Steel underline.

### Inputs / Fields
- **Style:** Recessed Well ground, 1px Control Edge, 4px radius, 6px 8px padding, 32px tall. Units sit beside numbers in Engraved Grey at 12px.
- **Focus:** a 2px white outline at 0 offset replaces the border.
- **Labels:** 12px 600 Engraved Grey above the field, mixed case.

### Clearance Alert and Caught Card
- **Alert:** Clash Wash ground, 1px Clash Red border, pale red text, a red warning icon and the gap in white at 17px 600. On actual contact the ground deepens and, if reduced motion is not requested, flashes in two steps at 0.8s.
- **Caught card:** Anodized Panel at high opacity, 1px Clash Red border, 6px radius, a red lamp, "Caught in Q…" in 17px 600, the pair, gap and time, and a Replay button. Rises 8px into place over 0.35s (reduced motion: no animation). Stays until dismissed, the next GO or RESET.

### Gap Dimension (signature)
The closest points of the worst clashing pair, drawn as a drafting dimension over the 3D view: a 2px white line with square caps and 7px end ticks, a dashed 1px leader to a white label above the midpoint, and the measured distance on the label (dark ink, ringed in Clash Red). At contact the line collapses to a 9px white circle. The points come from the core clearance code, so the line is the measurement.

**The Measured Line Rule.** Any drawn gap, pose or conflict comes from the same data the clearance check uses. Never draw an approximate or decorative indicator.

### Icons
A small stroked set on a 16px grid, 1.75 stroke, round caps, currentColor, inline SVG. Decorative by default; labelled when the icon is the only content. The favicon is a steel ring with a green bar on a rack-black tile.

## Do's and Don'ts

### Do:
- **Do** pair every lamp with a short word, at every breakpoint.
- **Do** keep each lamp colour to its one meaning: green ready/GO, amber standby/held/skipped, cyan moving, red clearance.
- **Do** carry axis and piece identity in spike-tape colours from the show data, as a small swatch beside a name or on the piece.
- **Do** mark selection and the active view with Steel and a 2px Steel underline.
- **Do** set every number in Hanken Grotesk with tabular figures.
- **Do** separate regions with 1px Hairline Rule and step depth with the neutral ramp.
- **Do** use the white 2px focus ring with its black halo on everything focusable.
- **Do** keep the clearance conflict the loudest thing on screen and keep the caught card up after the cue.
- **Do** keep touch targets at 44px on coarse pointers.
- **Do** stay within the five type sizes (12, 14, 17, 22, 36 px).

### Don't:
- **Don't** use amber for selection, hover or general warnings; it means standby.
- **Don't** use Collar Yellow anywhere but the ring around STOP.
- **Don't** use Clash Red for anything that is not a clearance conflict.
- **Don't** use a lamp colour as spike tape, or tape as a state colour, band or text colour.
- **Don't** add a second typeface, or set new tracked-uppercase legends beyond the Standby legend, tabs, transport and lamp words.
- **Don't** turn the cue list into cards, or put the main panel content in floating rounded cards.
- **Don't** add glow, halos or coloured shadows to lamps or anything else; shadows are only for things floating over the stage.
- **Don't** draw a gap or conflict indicator that is not computed by the clearance check.
- **Don't** abbreviate the clash word to CLR.
