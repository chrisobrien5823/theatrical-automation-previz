// End to end through the real bridge script: UDP in, WebSocket out, using Node's built-in
// WebSocket client (Node 22+) in place of the browser.
import { describe, it, expect } from 'vitest';
import { startBridge, sendOsc, wsFrame, readWsFrames, describePacket } from '../scripts/osc-bridge.mjs';
import { decodeOsc, encodeOsc, encodeOscBundle } from '../src/core/osc.js';

describe('WebSocket framing', () => {
  it('uses the 7-, 16- and 64-bit length forms', () => {
    expect(wsFrame(new Uint8Array(10)).subarray(0, 2)).toEqual(Buffer.from([0x82, 10]));
    expect(wsFrame(new Uint8Array(300)).subarray(0, 4)).toEqual(Buffer.from([0x82, 126, 1, 44]));
    const big = wsFrame(new Uint8Array(70000));
    expect(big[1]).toBe(127);
    expect(big.readBigUInt64BE(2)).toBe(70000n);
  });

  it('unmasks client frames and keeps a partial frame for later', () => {
    const mask = [0x11, 0x22, 0x33, 0x44];
    const text = Buffer.from('hi!');
    const masked = Buffer.from(text.map((b, i) => b ^ mask[i & 3]));
    const frame = Buffer.concat([Buffer.from([0x81, 0x80 | 3, ...mask]), masked]);
    const { frames, rest } = readWsFrames(Buffer.concat([frame, frame.subarray(0, 4)]));
    expect(frames).toHaveLength(1);
    expect(frames[0].opcode).toBe(1);
    expect(frames[0].payload.toString()).toBe('hi!');
    expect(rest.length).toBe(4);
  });
});

describe('describePacket', () => {
  it('prints messages and bundles for the console', () => {
    expect(describePacket(decodeOsc(encodeOsc('/previz/go', ['3'])))).toBe('/previz/go "3"');
    const b = decodeOsc(encodeOscBundle([encodeOsc('/previz/stop'), encodeOsc('/previz/reset')]));
    expect(describePacket(b)).toBe('bundle(2): /previz/stop; /previz/reset');
  });
});

describe('osc-bridge', () => {
  it('passes valid OSC from UDP to every connected page and drops junk', async () => {
    const bridge = await startBridge({ udpPort: 0, wsPort: 0, log: () => {} });
    const got = [];
    const ws = new WebSocket(`ws://127.0.0.1:${bridge.wsPort}`);
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (e) => got.push(decodeOsc(new Uint8Array(e.data)));
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });
    try {
      await new Promise((r) => setTimeout(r, 20)); // let the server register the socket
      expect(bridge.clients()).toBe(1);
      const dgram = await import('node:dgram');
      const junk = dgram.createSocket('udp4');
      await new Promise((r) => junk.send(Buffer.from('not osc!'), bridge.udpPort, '127.0.0.1', r));
      junk.close();
      await sendOsc('/previz/go', [3], { port: bridge.udpPort });
      await sendOsc('/previz/stop', [], { port: bridge.udpPort });
      for (let i = 0; i < 100 && got.length < 2; i++) await new Promise((r) => setTimeout(r, 10));
      expect(got.map((m) => [m.address, m.args])).toEqual([
        ['/previz/go', [3]],
        ['/previz/stop', []],
      ]);
    } finally {
      ws.close();
      await bridge.close();
    }
  });
});
