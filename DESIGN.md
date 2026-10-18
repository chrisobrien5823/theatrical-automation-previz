---
name: Stage Automation Previz
description: The status side of an automation desk, in a browser; lamps with words, and a clearance conflict as the loudest thing on screen.
colors:
  rack-black: "#090c10"
  anodized-panel: "#10151b"
  raised-plate: "#171e27"
  raised-plate-hi: "#1d2631"
  recessed-well: "#0b1015"
  hairline-rule: "#232d39"
  control-edge: "#5a6c81"
  panel-white: "#e6edf3"
  engraved-grey: "#93a4b6"
  link-blue: "#7fb8e6"
  steel: "#c9d6e3"
  steel-wash: "#1f3346"
  go-green: "#38d97a"
  go-ink: "#06160c"
  go-unlit: "#15301f"
  standby-amber: "#ffb020"
  standby-ink: "#1a1200"
  moving-cyan: "#4cc3ff"
  clash-red: "#ff5a5a"
  clash-wash: "#2a1014"
  clash-wash-deep: "#3b1219"
  estop-red: "#c8262f"
  collar-yellow: "#ffcc00"
  unlit-lamp: "#26313d"
typography:
  display:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.12em"
  headline:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.04em"
  title:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
  state-word:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.16em"
  label:
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif"
    fontSize: "12.5px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.14em"
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
  readout:
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Consolas, monospace"
    fontSize: "20px"
    fontWeight: 700
    fontFeature: "tnum"
  numeral:
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Consolas, monospace"
    fontSize: "14px"
    fontWeight: 700
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
    textColor: "#6f9b80"
    rounded: "{rounded.control}"
    height: "76px"
  button-stop:
    backgroundColor: "{colors.estop-red}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    height: "56px"
  estop-collar:
    backgroundColor: "{colors.collar-yellow}"
    rounded: "{rounded.panel}"
    padding: "4px"
  button-reset:
    backgroundColor: "{colors.raised-plate}"
    textColor: "{colors.panel-white}"
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
    textColor: "{colors.recessed-well}"
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
    typography: "{typography.state-word}"
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
    typography: "{typography.numeral}"
    rounded: "{rounded.tick}"
    padding: "3px 7px"
  lamp:
    backgroundColor: "{colors.unlit-lamp}"
    rounded: "{rounded.lamp}"
    size: "10px"
---

# Design System: Stage Automation Previz

## Overview

**Creative North Star: "The Status Side of the Desk"**

The screen reads like the status panel of an automation console. A blue-steel rack-black ground holds anodized panels, small engraved uppercase legends in a cool grey, and a row of lamps. Every axis and every cue carries a lamp and a word, and the lamp colours are a fixed vocabulary: green ready, amber standby, cyan moving, red clearance. When two pieces come inside clearance, that is the loudest, clearest thing on the screen: red lamps on the axis bus, a red-ruled cue row, a red alert, and a measured white dimension line in the 3D view. After the cue ends, a "Caught in Q3" card stays up with a Replay button.

The density is a working panel's, not a dashboard's. The right column is a fixed 380 px control strip. Rows are ruled, not carded. Numbers sit in a tabular mono so a moving readout never jitters. Controls are ordinary web buttons, tabs and selects with square-shouldered 4 px corners. The world's character comes from type, palette and the lamp, not from simulated hardware chrome. The one physical device it borrows literally is the yellow e-stop collar around STOP.

The world rejects the category default: a grey dark dashboard with one accent colour and rounded floating cards.

**Key Characteristics:**
- Rack-black ground with tonal steps for panels, plates and wells; no decorative gradients.
- Lamps (unlit disc, lit with a halo) always paired with an uppercase word.
- One meaning per lamp colour, everywhere in the app.
- Barlow Condensed engraved legends and transport; JetBrains Mono for numbers only; system sans for prose.
- Ruled cue sheet with full-width state bands.
- The gap is drawn as a drafting dimension in the 3D view, measured from the same data the clearance check uses.

## Colors

A near-black blue-steel neutral ramp carries everything; saturated colour appears only as lamp signals, each with one meaning.

### Primary
- **GO Green** (go-green): ready and GO. The GO button face, the lit ready lamp, the done mark in the Rig guide, and the preflight "clear" check on a cue. Text on it is **GO Ink** (go-ink). Unlit, it becomes **GO Unlit** (go-unlit) with a muted green legend.

### Secondary
- **Standby Amber** (standby-amber): waiting on the operator. The standby lamp and legend, the standby cue band, a halted (Stopped) HUD lamp and its mid-cue note, skipped cues' state word, and the press-and-hold bar that re-standbys a cue. Never used for selection.
- **Moving Cyan** (moving-cyan): an axis or cue in motion. The moving lamp and MOVE word on the axis bus, the running cue band, the progress bar, the axis position tick and the MOVING tag on the Axes tab.

### Tertiary
- **Clash Red** (clash-red): clearance, and only clearance. Clash lamps, the CLASH word, the conflict cue band, the clearance alert border, preflight warning badges, the Log count, gap numbers in the log, and the ring around the gap label. Paired with **Clash Wash** (clash-wash) for alert and band grounds and **Clash Wash Deep** (clash-wash-deep) for actual contact.
- **E-stop Red** (estop-red): the STOP button face. A darker, more saturated red than Clash Red, reserved for the stop control.
- **Collar Yellow** (collar-yellow): the e-stop collar around STOP. Nothing else. When STOP is disabled the collar dims to a dull olive (#4d4420).
- **Steel** (steel): selection and the active view. The underline on the selected tab, segment and mode switch, the next-step mark in the Rig guide, the primary small button, the drop-target outline, and `accent-color` for native controls. **Steel Wash** (steel-wash) is the selected segment and selected tree-row ground.

### Neutral
- **Rack Black** (rack-black): the page ground and the 3D scene background.
- **Anodized Panel** (anodized-panel): the right-hand control panel and floating overlays (caught card, modal, camera control, at high opacity).
- **Raised Plate** (raised-plate) / **Raised Plate Hi** (raised-plate-hi): cards inside the panel (axis readouts, Rig cards, inspector, log entries), RESET, and hover steps.
- **Recessed Well** (recessed-well): inputs, the Rig guide, model tree, progress and axis-limit tracks.
- **Hairline Rule** (hairline-rule): decorative dividers: cue sheet rules, HUD and bus borders, tab baseline, panel edges.
- **Control Edge** (control-edge): borders on interactive controls, at 3:1 against the panel.
- **Panel White** (panel-white): primary text.
- **Engraved Grey** (engraved-grey): legends, secondary text, inactive tabs and done cues.
- **Link Blue** (link-blue): text links and the log's "jump to" hint.
- **Unlit Lamp** (unlit-lamp): the lamp disc at rest.

### Named Rules
**The One Meaning Rule.** Each lamp colour means one thing everywhere: green ready/GO, amber standby/held/skipped, cyan moving, red clearance. If a new state does not fit one of those meanings, it gets a neutral treatment and a word, not a borrowed colour.

**The Steel Selection Rule.** Selection, focus of attention and the active view are steel, never amber. Amber is spoken for by standby.

**The Collar Rule.** Collar yellow appears only as the ring around STOP. It is the single literal piece of desk hardware in the world.

## Typography

**Display Font:** Barlow Condensed (with Arial Narrow, sans-serif), self-hosted via @fontsource at 600 and 700
**Body Font:** system-ui (with -apple-system, Segoe UI, Roboto, sans-serif)
**Label/Mono Font:** JetBrains Mono (with ui-monospace, SF Mono, Consolas, monospace), self-hosted via @fontsource at 500 and 700, always with tabular numerals

**Character:** A condensed, engraved-plate grotesque for everything an operator reads at a glance (legends, states, transport, cue names) against a plain system sans for sentences, with a tabular mono kept strictly for numbers.

### Hierarchy
- **Display** (700, 36px, 1, 0.12em): the GO legend. Steps down to 26px at ≤420 px and 22px in short landscape. STOP and RESET use the same face at 20px.
- **Headline** (700, 18px, 1.2, 0.04em): the show name at the top of the panel.
- **Title** (600, 16–17px, 1.2, 0.02–0.03em): cue names (clamped to two lines), the standby cue, axis names.
- **State word** (700, 15px, 0.16em, uppercase): the HUD state word (Ready, Running, Conflict, Stopped) and the tab labels (0.1em). Bus and cue-row state words (MOVE, CLASH, STBY, RUN, DONE, SKIP) use the same face at 11–12px.
- **Body** (400, 14px, 1.4): sentences, hints, alerts, the caught card, log text (12.5px). Empty-state prose caps at 46ch.
- **Label** (700, 12.5px, 0.14em, uppercase): engraved panel legends: Standby, field labels, the Rig guide heading, move-table headers (10px).
- **Readout** (700, 20px, tabular): live axis position on the Axes tab.
- **Numeral** (700, 11–16px, tabular): cue numbers, HUD time, bus positions, gap measurements, log timestamps, kbd keys, the Log count.

### Named Rules
**The Numbers-Only Mono Rule.** JetBrains Mono sets numbers, cue numbers, units and measurements, nothing else. Sentences are never in mono.

**The Engraved Legend Rule.** Small labels are Barlow Condensed 700, uppercase, tracked 0.10–0.16em, in Engraved Grey. They name a control or a group; they are not marketing kickers.

## Layout

A two-column desk: the 3D stage fills the left (`minmax(0, 1fr)`) and a fixed 380 px control panel sits on the right, full viewport height (100dvh). The stage carries a solid top strip: the HUD (state lamp and word on the left, cue and time on the right) with the axis bus directly under it, one equal-width cell per axis, separated by 1 px rules. The camera segmented control sits bottom-left. The clearance alert and the caught card stack bottom-centre, above the camera control.

The panel stacks top to bottom: show name and Run/Rig switch; standby lamp row; transport (GO 2fr, collared STOP 1fr, RESET 1fr, 8px gaps); a 3px progress bar; Cues/Axes/Log tabs; the scrolling tab body; and a footer with speed, file buttons and key hints. Panel inset is 12px 14px. Internal gaps run on 4/6/8/10/12px steps, with 16px for the empty state and modal.

Responsive rules, as built:
- **≤820 px (phone portrait):** single column. Stage on top, panel below capped at 58dvh with tabs capped at 30dvh. The show name, Run/Rig switch, key hints, Save and every other desktop-only control are hidden (Rig mode is laptop-only). Alert and caught card dock under the axis bus so they never cover the gap. Bus cells tighten to 5px 8px at 11px.
- **≤420 px:** bus positions are hidden (every lamp keeps its word; positions live in the Axes tab). GO drops to 26px / 68px tall; STOP and RESET to 14px.
- **Short landscape (height ≤520 px, width ≥560 px):** back to two columns with a 300 px panel; buttons 44px tall, GO 52px; cue notes hidden.
- **Coarse pointer:** camera buttons, file buttons, selects, tabs and the caught card's buttons grow to 44px; camera buttons are at least 48px wide.
- Safe-area insets pad the HUD top, panel bottom, camera control and message stack.

## Elevation & Depth

Flat by default, layered by tone: Rack Black ground, Anodized Panel, Raised Plate, Raised Plate Hi, with Recessed Well for anything that holds a value. Hairline rules, not shadows, separate regions. Shadows exist in three places only: the lamp's inset and halo, soft drop shadows under overlays that float over the 3D view (alert, caught card, toast, modal, gap label), and the white focus ring's black halo.

### Shadow Vocabulary
- **Lamp at rest** (`box-shadow: inset 0 1px 1px #0008, 0 0 0 1px #00000080`): an unlit, slightly recessed disc.
- **Lamp lit** (`box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 22%, transparent), 0 0 10px 1px color-mix(in srgb, var(--c) 40%, transparent)`): a halo in the lamp's own colour.
- **Overlay** (`box-shadow: 0 6px 20px #0009`): alert and toast over the stage.
- **Card overlay** (`box-shadow: 0 10px 30px #000a`): the caught card.
- **Modal** (`box-shadow: 0 16px 40px #000c`): the import dialog.
- **Focus** (`outline: 2px solid #fff; outline-offset: 2px; box-shadow: 0 0 0 5px #000c`): every focusable element; inside segmented controls and rows the outline moves inset (-3px) and the halo is dropped.

### Named Rules
**The Tonal Plate Rule.** Panels and cards gain depth by stepping up the neutral ramp, never by a shadow. A shadow means the thing floats over the 3D stage.

**The Only Glow Rule.** Glow belongs to lit lamps. No other element gets a coloured halo.

## Shapes

Square-shouldered. Controls, inputs, alerts and rows of the log take a 4px corner; panels, cards, the caught card, modal and Rig guide take 6px; small tags (badges, kbd, the gap label) take 3px. Lamps and the Rig guide's step marks are full circles; the Log count is a pill. Borders are 1px: Control Edge on interactive things, Hairline Rule on decoration. Selected segments and tabs are marked by a 2px Steel underline, not a fill change alone. The e-stop collar is a 4px Collar Yellow ring at 6px radius around a 4px button.

## Components

### Buttons
Heavy, square and legible from arm's length.
- **Shape:** gently squared (4px).
- **GO:** GO Green face, GO Ink legend, Barlow Condensed 700 at 36px, 0.12em tracking, 76px tall, spanning half the transport. Hover lightens (#4ce489), active darkens (#2cc46a) and presses down 1px. Disabled turns GO Unlit with a 1px green inset edge.
- **STOP:** E-stop Red face, white legend, 20px, 56px tall, inside the Collar Yellow ring; focus offset is 6px so the ring clears the collar. Disabled: dull red face, collar dims to olive.
- **RESET:** Raised Plate with a Control Edge border, 20px.
- **Small (Rig):** 32px, Raised Plate Hi with Control Edge border, 12.5px 700 system sans with an optional 14px icon. Primary variant is Steel with dark ink. Big variant is 40px. Disabled at 45% opacity.
- **File buttons and Replay:** outlined (Control Edge), transparent or Raised Plate, system sans 600–700.
- **Links:** Link Blue, underlined at 3px offset.

### Lamp (signature)
An unlit 10px disc (8px on the axis bus) that lights in its state colour with a soft halo. States: ready/go (green), standby (amber), moving (cyan), clash (red), off/idle (unlit). It is always paired with a word: HUD state word, Standby legend, bus word (MOVE / CLASH / IDLE), or cue-row state text (STBY / RUN / CLASH / DONE / SKIP / PEND).

**The Lamp-and-Word Rule.** A lamp never appears alone. State is never carried by colour only; the word is present at every breakpoint.

### Axis Bus
One cell per axis across the top of the stage: lamp, axis name, state word, and (above 420 px) the position in mono. A moving axis turns its word cyan; a clashing axis tints the whole cell red (#2a1014e6) and turns name and word red. Word choice is deliberate: CLASH, never CLR, because to a stage crew CLR means clear.

### Cue Sheet
Ruled rows on the panel ground, no cards. Columns: state (lamp over state word), cue number in mono, name in Barlow Condensed with meta and notes beneath, and time. The live row gets a full-width band in its lamp colour, ruled top and bottom: standby amber, running cyan, conflict red. Done rows go Engraved Grey; skipped rows strike through the name and set SKIP in amber. Preflight shows a red warning badge or a green check. On touch, re-standbying a cue is a deliberate press-and-hold with an amber bar filling along the row's bottom edge (450ms).

**The Ruled Sheet Rule.** The cue list is a sheet, not a stack of cards: 1px Hairline Rule between rows, state carried by full-width bands.

### Tabs and Segmented Controls
- **Tabs (Cues / Axes / Log):** Barlow Condensed 700 15px uppercase, Engraved Grey; selected goes white with a 2px Steel underline. The Log tab carries a red mono count when conflicts are logged.
- **Segmented (camera, Run/Rig):** one outlined 4px group, internal Hairline Rule dividers; selected segment is Steel Wash with white text and an inset 2px Steel underline.

### Inputs / Fields
- **Style:** Recessed Well ground, 1px Control Edge, 4px radius, 6px 8px padding, 32px tall. Units sit beside numbers in mono Engraved Grey.
- **Focus:** a 2px white outline at 0 offset replaces the border.
- **Labels:** engraved legend style above the field.

### Clearance Alert and Caught Card
- **Alert:** Clash Wash ground, 1px Clash Red border, pale red text, a red warning icon and the gap in white mono at 16px. On actual contact the ground deepens and, if reduced motion is not requested, flashes in two steps at 0.8s.
- **Caught card:** Anodized Panel at high opacity, 1px Clash Red border, 6px radius, a red lamp, "Caught in Q…" in bold, the pair, gap and time, and a Replay button. Rises 8px into place over 0.35s (reduced motion: no animation). Stays until dismissed, the next GO or RESET.

### Gap Dimension (signature)
The closest points of the worst clashing pair, drawn as a drafting dimension over the 3D view: a 2px white line with square caps and 7px end ticks, a dashed 1px leader to a white label above the midpoint, and the measured distance in mono on the label (dark ink, ringed in Clash Red). At contact the line collapses to a 9px white circle. The points come from the core clearance code, so the line is the measurement.

**The Measured Line Rule.** Any drawn gap, pose or conflict comes from the same data the clearance check uses. Never draw an approximate or decorative indicator.

### Icons
A small stroked set on a 16px grid, 1.75 stroke, round caps, currentColor, inline SVG. Decorative by default; labelled when the icon is the only content.

## Do's and Don'ts

### Do:
- **Do** pair every lamp with an uppercase word, at every breakpoint.
- **Do** keep each lamp colour to its one meaning: green ready/GO, amber standby/held/skipped, cyan moving, red clearance.
- **Do** mark selection and the active view with Steel and a 2px Steel underline.
- **Do** set every number, cue number and measurement in JetBrains Mono with tabular numerals, and only those.
- **Do** separate regions with 1px Hairline Rule and step depth with the neutral ramp.
- **Do** use the white 2px focus ring with its black halo on everything focusable.
- **Do** keep the clearance conflict the loudest thing on screen and keep the caught card up after the cue.
- **Do** keep touch targets at 44px on coarse pointers.

### Don't:
- **Don't** use amber for selection, hover or general warnings; it means standby.
- **Don't** use Collar Yellow anywhere but the ring around STOP.
- **Don't** use Clash Red for anything that is not a clearance conflict.
- **Don't** set sentences, labels or names in mono.
- **Don't** turn the cue list into cards, or put the main panel content in floating rounded cards.
- **Don't** add glow or coloured halos to anything but a lit lamp.
- **Don't** draw a gap or conflict indicator that is not computed by the clearance check.
- **Don't** abbreviate the clash word to CLR.
