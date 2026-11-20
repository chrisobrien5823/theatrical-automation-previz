import { describe, it, expect } from 'vitest';
import demo from '../src/shows/demo.json';
import { loadShow } from '../src/core/show.js';
import { Simulator } from '../src/core/simulator.js';
import {
  decodeOsc,
  encodeOsc,
  encodeOscBundle,
  oscMessages,
  oscCommand,
  parseOscParam,
  OSC_BRIDGE_DEFAULT_PORT,
} from '../src/core/osc.js';

const { show } = loadShow(demo);
const hex = (b) => Buffer.from(b).toString('hex');

describe('encodeOsc / decodeOsc', () => {
  it('matches the OSC 1.0 spec example byte for byte', () => {
    // Same layout as the spec example "/oscillator/4/frequency" ,f (440.5, since whole numbers go as int)
    const bytes = encodeOsc('/oscillator/4/frequency', [440.5]);
    expect(hex(bytes)).toBe(
      '2f6f7363696c6c61746f722f342f6672657175656e637900' + '2c660000' + '43dc4000',
    );
  });

  it('pads strings to 4 bytes, including the terminator', () => {
    expect(encodeOsc('/go').length).toBe(4 + 4); // "/go\0" + ",\0\0\0"
    expect(encodeOsc('/abc').length).toBe(8 + 4); // "/abc\0" needs 8
  });

  it('round-trips ints, floats, strings, booleans, null and blobs', () => {
    const blob = new Uint8Array([1, 2, 3, 4, 5]);
    const m = decodeOsc(encodeOsc('/previz/test', [3, -7, 2.5, 'Q3 Revolve', true, false, null, blob]));
    expect(m.address).toBe('/previz/test');
    expect(m.types).toBe('iifsTFNb');
    expect(m.args.slice(0, 7)).toEqual([3, -7, 2.5, 'Q3 Revolve', true, false, null]);
    expect(Array.from(m.args[7])).toEqual([1, 2, 3, 4, 5]);
  });

  it('decodes doubles and 64-bit ints from other senders', () => {
    const buf = new Uint8Array(4 + 4 + 8 + 8);
    buf.set(new TextEncoder().encode('/x'), 0);
    buf.set(new TextEncoder().encode(',dh'), 4);
    const v = new DataView(buf.buffer);
    v.setFloat64(8, 1.25);
    v.setBigInt64(16, 9007199254740993n);
    const m = decodeOsc(buf);
    expect(m.args).toEqual([1.25, 9007199254740993n]);
  });

  it('accepts an old-style message with no type tags', () => {
    expect(decodeOsc(new TextEncoder().encode('/go\0'))).toEqual({ address: '/go', types: '', args: [] });
  });

  it('keeps UTF-8 in strings', () => {
    expect(decodeOsc(encodeOsc('/previz/standby', ['Q3 – ä'])).args[0]).toBe('Q3 – ä');
  });

  it('rejects malformed packets instead of guessing', () => {
    expect(() => decodeOsc(new Uint8Array(0))).toThrow();
    expect(() => decodeOsc(new Uint8Array(6))).toThrow(/multiple of 4/);
    expect(() => decodeOsc(new TextEncoder().encode('go\0\0'))).toThrow(/start with "\/"/);
    const cut = encodeOsc('/x', [1]).slice(0, 8); // tags say "i" but the int is missing
    expect(() => decodeOsc(cut)).toThrow(/cut short/);
    const odd = encodeOsc('/x', ['s']);
    odd[5] = 'q'.charCodeAt(0); // unknown tag
    expect(() => decodeOsc(odd)).toThrow(/not supported/);
    const unterminated = new TextEncoder().encode('/abc');
    expect(() => decodeOsc(unterminated)).toThrow(/not terminated/);
  });

  it('refuses to encode what OSC cannot carry', () => {
    expect(() => encodeOsc('go')).toThrow();
    expect(() => encodeOsc('/go', [{}])).toThrow();
  });
});

describe('bundles', () => {
  it('decodes nested bundles and flattens their messages in order', () => {
    const inner = encodeOscBundle([encodeOsc('/previz/standby', [3]), encodeOsc('/previz/go')]);
    const outer = encodeOscBundle([encodeOsc('/previz/reset'), inner]);
    const p = decodeOsc(outer);
    expect(p.bundle).toBe(true);
    expect(p.time).toBe(1n);
    expect(oscMessages(p).map((m) => m.address)).toEqual(['/previz/reset', '/previz/standby', '/previz/go']);
  });

  it('rejects a bundle whose element size runs past the end', () => {
    const b = encodeOscBundle([encodeOsc('/previz/go')]);
    new DataView(b.buffer).setInt32(16, 64);
    expect(() => decodeOsc(b)).toThrow(/cut short/);
  });
});

describe('oscCommand', () => {
  const cmd = (address, args = [], types) => oscCommand({ address, args, types }, show);
  const q = (id) => show.cues.findIndex((c) => c.id === id);

  it('maps the plain transport addresses', () => {
    expect(cmd('/previz/go')).toEqual({ type: 'go' });
    expect(cmd('/previz/stop')).toEqual({ type: 'stop' });
    expect(cmd('/previz/reset')).toEqual({ type: 'reset' });
    expect(cmd('/PREVIZ/GO/')).toEqual({ type: 'go' }); // case and a trailing slash don't matter
  });

  it('takes a cue as an int, a string, "Q3", or in the address', () => {
    expect(cmd('/previz/go', [3], 'i')).toEqual({ type: 'go', cueIndex: q('3') });
    expect(cmd('/previz/go', ['3'], 's')).toEqual({ type: 'go', cueIndex: q('3') });
    expect(cmd('/previz/go', ['q3'], 's')).toEqual({ type: 'go', cueIndex: q('3') });
    expect(cmd('/previz/standby', [2], 'i')).toEqual({ type: 'standby', cueIndex: q('2') });
    expect(cmd('/previz/cue/4/go')).toEqual({ type: 'go', cueIndex: q('4') });
    expect(cmd('/previz/cue/Q2/standby')).toEqual({ type: 'standby', cueIndex: q('2') });
  });

  it('treats button-surface press / release floats as presses, not cue numbers', () => {
    expect(cmd('/previz/go', [1], 'f')).toEqual({ type: 'go' }); // press
    expect(cmd('/previz/go', [true], 'T')).toEqual({ type: 'go' });
    expect(cmd('/previz/go', [0], 'f').type).toBe('ignore'); // release
    expect(cmd('/previz/stop', [false], 'F').type).toBe('ignore');
    expect(cmd('/previz/cue/3/go', [0], 'f').type).toBe('ignore');
    expect(cmd('/previz/go', [1], 'i')).toEqual({ type: 'go', cueIndex: q('1') }); // int 1 is cue 1
  });

  it('ignores other apps’ addresses and reports mistakes in ours', () => {
    expect(cmd('/cue/3/start').type).toBe('ignore');
    expect(cmd('/previzzz/go').type).toBe('ignore');
    expect(cmd('/previz/jump').error).toMatch(/unknown address/);
    expect(cmd('/previz/go', [99], 'i').error).toMatch(/no cue 99/);
    expect(cmd('/previz/standby').error).toMatch(/needs a cue/);
    expect(cmd('/previz/go', [1, 2], 'ii').error).toMatch(/at most one/);
    expect(cmd('/previz/cue/3/stop').error).toMatch(/unknown address/);
  });

  it('works on messages straight off the wire', () => {
    expect(oscCommand(decodeOsc(encodeOsc('/previz/go', [3])), show)).toEqual({ type: 'go', cueIndex: q('3') });
    expect(oscCommand(decodeOsc(encodeOsc('/previz/go', [1.0])), show)).toEqual({ type: 'go', cueIndex: q('1') });
  });

  it('drives the real Simulator: OSC "go 3" from home runs Q3', () => {
    const home = Object.fromEntries(show.axes.map((a) => [a.id, a.home]));
    const sim = new Simulator(show, { positions: home });
    const c = oscCommand(decodeOsc(encodeOsc('/previz/go', ['3'])), show);
    expect(sim.standby(c.cueIndex)).toBe(true);
    expect(sim.go()).toBe(true);
    expect(sim.activeCue.id).toBe('3');
    while (sim.state !== 'idle') sim.step(0.01);
    for (const m of show.cues[q('3')].moves) expect(sim.positions()[m.axis]).toBeCloseTo(m.target, 6);
  });
});

describe('parseOscParam', () => {
  it('is off unless asked for', () => {
    expect(parseOscParam(null)).toBe(null);
    expect(parseOscParam('off')).toBe(null);
    expect(parseOscParam('nonsense')).toBe(null);
  });
  it('builds the bridge URL from a port or takes a ws:// URL', () => {
    expect(parseOscParam('')).toBe(`ws://localhost:${OSC_BRIDGE_DEFAULT_PORT}`);
    expect(parseOscParam('on', '192.168.1.20')).toBe(`ws://192.168.1.20:${OSC_BRIDGE_DEFAULT_PORT}`);
    expect(parseOscParam('9000')).toBe('ws://localhost:9000');
    expect(parseOscParam('99999')).toBe(null);
    expect(parseOscParam('ws://10.0.0.5:53180')).toBe('ws://10.0.0.5:53180');
    expect(parseOscParam('javascript:alert(1)')).toBe(null);
  });
});
