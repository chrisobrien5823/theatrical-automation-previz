// The 3D scene's neutrals, kept in the same blue-steel family as the UI (see :root in styles.css).
// Axis and piece identity colours (spike tape) come from the show data, not from here.

export const SCENE = {
  ground: '#0b1016', // = --ground: scene background, fog and the page behind it
  pit: '#0f1720', // trap-room floor below the deck
  gridMajor: '#273443',
  gridMinor: '#1a2530',
  skyFill: '#c9d4ff',
  groundFill: '#1a222c',
  deck: '#2c3745', // stage floor for imported models; the demo deck uses the same colour
  edgeStatic: '#3b4858', // outline on pieces that are not clearance-checked
  edgeChecked: '#e6edf3', // outline on clearance-checked pieces
  boxLine: '#8fb3d6', // collision-box overlay: steel, because amber is reserved for standby
};
