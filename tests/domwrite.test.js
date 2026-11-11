import { describe, it, expect } from 'vitest';
import demo from '../src/shows/demo.json';
import { loadShow } from '../src/core/show.js';
import { Simulator } from '../src/core/simulator.js';
import { changed, forget, writeText, writeHidden, writeStyle, writeData, writeAttr } from '../src/ui/domWrite.js';
import { readoutFields } from '../src/ui/readouts.js';
import { unitOf } from '../src/ui/format.js';

/** A stand-in element that counts every write (no DOM needed). */
function fakeEl() {
  const el = { writes: 0, dataset: {}, attrs: {} };
  const style = {};
  el.style = new Proxy(style, { set: (o, k, v) => (el.writes++, (o[k] = v), true) });
  let text = '';
  let hidden = false;
  Object.defineProperty(el, 'textContent', { get: () => text, set: (v) => (el.writes++, (text = v)) });
  Object.defineProperty(el, 'hidden', { get: () => hidden, set: (v) => (el.writes++, (hidden = v)) });
  el.setAttribute = (k, v) => (el.writes++, (el.attrs[k] = v));
  return el;
}

describe('domWrite helpers', () => {
  it('write the first value, then skip repeats', () => {
    const el = fakeEl();
    writeText(el, 'a');
    writeText(el, 'a');
    writeText(el, 'a');
    expect(el.textContent).toBe('a');
    expect(el.writes).toBe(1);
    writeText(el, 'b');
    expect(el.textContent).toBe('b');
    expect(el.writes).toBe(2);
  });

  it('write the first value even if it equals the default (the cache starts empty)', () => {
    const el = fakeEl();
    writeText(el, '');
    writeHidden(el, false);
    expect(el.writes).toBe(2);
  });

  it('keep separate slots per element and per property', () => {
    const a = fakeEl();
    const b = fakeEl();
    writeStyle(a, 'left', '10%');
    writeStyle(a, 'width', '10%');
    writeStyle(b, 'left', '10%');
    writeData(a, 'state', 'idle');
    writeAttr(a, 'x1', '1.0');
    expect({ ...a.style }).toEqual({ left: '10%', width: '10%' });
    expect({ ...b.style }).toEqual({ left: '10%' });
    expect(a.dataset.state).toBe('idle');
    expect(a.attrs.x1).toBe('1.0');
    expect(changed(a, 'style:left', '10%')).toBe(false);
    expect(changed(b, 'style:width', '10%')).toBe(true);
  });

  it('treat hidden as a boolean', () => {
    const el = fakeEl();
    writeHidden(el, 1);
    writeHidden(el, true);
    expect(el.hidden).toBe(true);
    expect(el.writes).toBe(1);
  });

  it('write again after forget()', () => {
    const el = fakeEl();
    writeText(el, 'x');
    forget(el);
    writeText(el, 'x');
    expect(el.writes).toBe(2);
  });
});

describe('readoutFields', () => {
  const linear = { type: 'linear', min: 0, max: 4, units: 'm' };
  it('formats position, velocity and the limit tick', () => {
    const u = { pos: 'm', vel: 'm/s' };
    expect(readoutFields({ pos: 1, vel: 0.5, moving: true, def: linear }, u)).toEqual({
      pos: '1.000 m',
      vel: 'v  0.50 m/s',
      moving: true,
      left: '25%',
    });
    expect(readoutFields({ pos: -1, vel: -0.25, moving: false, def: linear }, u).left).toBe('0%');
    expect(readoutFields({ pos: 2, vel: 0, moving: false, def: { type: 'rotary' } }, u).left).toBe('50%');
  });

  it('rounds the tick to 0.1 % so float noise is not a change', () => {
    const u = { pos: 'm', vel: 'm/s' };
    const a = readoutFields({ pos: 1.0000001, vel: 0, def: linear }, u);
    const b = readoutFields({ pos: 1.0000002, vel: 0, def: linear }, u);
    expect(a.left).toBe(b.left);
  });
});

// The point of the change: count readout writes over the demo show at 60 Hz. Before, every field of
// every axis was written every frame; now a field is written only when its text changes.
describe('readout writes over the demo show', () => {
  const { show } = loadShow(demo);
  const FIELDS = 4; // pos, vel, MOVING tag, limit tick

  function play(script) {
    const sim = new Simulator(show);
    const rows = new Map(show.axes.map((a) => [a.id, { u: unitOf(a), els: [fakeEl(), fakeEl(), fakeEl(), fakeEl()] }]));
    let frames = 0;
    const frame = () => {
      frames++;
      for (const s of sim.axisStatesAt(0)) {
        const { u, els } = rows.get(s.id);
        const f = readoutFields(s, u);
        writeText(els[0], f.pos);
        writeText(els[1], f.vel);
        writeHidden(els[2], !f.moving);
        writeStyle(els[3], 'left', f.left);
      }
    };
    script(sim, frame);
    let writes = 0;
    for (const r of rows.values()) for (const el of r.els) writes += el.writes;
    return { frames, before: frames * show.axes.length * FIELDS, writes };
  }

  it('writes nothing after the first frame while the stage is at rest', () => {
    const { before, writes } = play((sim, frame) => {
      for (let i = 0; i < 120; i++) frame();
    });
    expect(before).toBe(120 * show.axes.length * FIELDS);
    expect(writes).toBe(show.axes.length * FIELDS); // filling the empty cache, once
  });

  it('writes well under half the fields while the whole show runs', () => {
    const { frames, before, writes } = play((sim, frame) => {
      frame();
      while (sim.nextCue) {
        sim.go();
        for (let i = 0; i < 60 * 60 && sim.state !== 'idle'; i++) {
          sim.step(1 / 60);
          frame();
        }
        for (let i = 0; i < 30; i++) frame(); // a beat between cues
      }
    });
    expect(frames).toBeGreaterThan(600);
    expect(writes).toBeLessThan(before / 2);
  });
});
