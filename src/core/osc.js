/**
 * Open Sound Control (OSC 1.0) packets: decode and encode, plus the map from an OSC message to a
 * transport command for this app. Pure JS on Uint8Array / DataView so it runs in the browser, in
 * Node (tools/osc-bridge.mjs) and in Vitest alike.
 *
 * An OSC packet is either a message or a bundle. Everything is big-endian and padded to 4 bytes:
 *   message = address string, type-tag string (",ifs"), then one argument per tag
 *   bundle  = "#bundle", 8-byte time tag, then [int32 size, packet] repeated (packets may nest)
 */

const PREFIX = '/previz';

/** Supported type tags. Tags with no payload (T F N I) carry their value in the tag itself. */
const NO_PAYLOAD = { T: true, F: false, N: null, I: Infinity };

const utf8 = new TextDecoder('utf-8', { fatal: false });
const utf8enc = new TextEncoder();

const pad4 = (n) => (n + 3) & ~3;

function readString(bytes, at) {
  let end = at;
  while (end < bytes.length && bytes[end] !== 0) end++;
  if (end >= bytes.length) throw new Error('OSC string is not terminated');
  return { value: utf8.decode(bytes.subarray(at, end)), next: pad4(end + 1) };
}

function need(bytes, at, n) {
  if (at + n > bytes.length) throw new Error('OSC packet is cut short');
}

/**
 * Decode one OSC packet.
 * @param {Uint8Array|ArrayBuffer} input
 * `types` keeps the tag letters ("if s"), because the command map needs to tell a float 1.0 button
 * press from an int cue number 1.
 * @returns {{ address: string, types: string, args: any[] } | { bundle: true, time: bigint, packets: object[] }}
 */
export function decodeOsc(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length === 0 || bytes.length % 4 !== 0) throw new Error('OSC packet size must be a multiple of 4');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] === 0x23 /* # */) return decodeBundle(bytes, view);
  if (bytes[0] !== 0x2f /* / */) throw new Error('OSC address must start with "/"');

  const addr = readString(bytes, 0);
  let at = addr.next;
  // A message with no type-tag string is legal in old senders: treat it as no arguments.
  if (at >= bytes.length) return { address: addr.value, types: '', args: [] };
  const tags = readString(bytes, at);
  if (tags.value[0] !== ',') throw new Error('OSC type tags must start with ","');
  at = tags.next;

  const args = [];
  for (const tag of tags.value.slice(1)) {
    if (tag in NO_PAYLOAD) {
      args.push(NO_PAYLOAD[tag]);
      continue;
    }
    switch (tag) {
      case 'i':
        need(bytes, at, 4);
        args.push(view.getInt32(at));
        at += 4;
        break;
      case 'f':
        need(bytes, at, 4);
        args.push(view.getFloat32(at));
        at += 4;
        break;
      case 'd':
        need(bytes, at, 8);
        args.push(view.getFloat64(at));
        at += 8;
        break;
      case 'h':
        need(bytes, at, 8);
        args.push(view.getBigInt64(at));
        at += 8;
        break;
      case 's':
      case 'S': {
        const s = readString(bytes, at);
        args.push(s.value);
        at = s.next;
        break;
      }
      case 'b': {
        need(bytes, at, 4);
        const n = view.getInt32(at);
        need(bytes, at + 4, n);
        args.push(bytes.slice(at + 4, at + 4 + n));
        at = pad4(at + 4 + n);
        break;
      }
      default:
        throw new Error(`OSC type tag "${tag}" is not supported`);
    }
  }
  return { address: addr.value, types: tags.value.slice(1), args };
}

function decodeBundle(bytes, view) {
  const head = readString(bytes, 0);
  if (head.value !== '#bundle') throw new Error('OSC bundle must start with "#bundle"');
  need(bytes, head.next, 8);
  const time = view.getBigUint64(head.next);
  const packets = [];
  let at = head.next + 8;
  while (at < bytes.length) {
    need(bytes, at, 4);
    const n = view.getInt32(at);
    if (n <= 0 || n % 4 !== 0) throw new Error('OSC bundle element has a bad size');
    need(bytes, at + 4, n);
    packets.push(decodeOsc(bytes.subarray(at + 4, at + 4 + n)));
    at += 4 + n;
  }
  return { bundle: true, time, packets };
}

/** All messages in a packet, bundles flattened in order. */
export function oscMessages(packet) {
  return packet.bundle ? packet.packets.flatMap(oscMessages) : [packet];
}

function writeString(out, s) {
  const b = utf8enc.encode(s);
  const buf = new Uint8Array(pad4(b.length + 1));
  buf.set(b);
  out.push(buf);
}

/**
 * Encode one OSC message. JS numbers become int32 when whole and in range, float32 otherwise;
 * strings "s", booleans T/F, null N, Uint8Array blobs "b". Used by tests and the bridge's self-test.
 */
export function encodeOsc(address, args = []) {
  if (typeof address !== 'string' || address[0] !== '/') throw new Error('OSC address must start with "/"');
  const parts = [];
  writeString(parts, address);
  let tags = ',';
  const payload = [];
  for (const a of args) {
    if (typeof a === 'number') {
      const word = new DataView(new ArrayBuffer(4));
      if (Number.isInteger(a) && a >= -0x80000000 && a <= 0x7fffffff) {
        tags += 'i';
        word.setInt32(0, a);
      } else {
        tags += 'f';
        word.setFloat32(0, a);
      }
      payload.push(new Uint8Array(word.buffer));
    } else if (typeof a === 'string') {
      tags += 's';
      writeString(payload, a);
    } else if (a === true || a === false) {
      tags += a ? 'T' : 'F';
    } else if (a === null) {
      tags += 'N';
    } else if (a instanceof Uint8Array) {
      tags += 'b';
      const buf = new Uint8Array(4 + pad4(a.length));
      new DataView(buf.buffer).setInt32(0, a.length);
      buf.set(a, 4);
      payload.push(buf);
    } else {
      throw new Error(`Cannot encode ${typeof a} as an OSC argument`);
    }
  }
  writeString(parts, tags);
  parts.push(...payload);
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Wrap already-encoded packets in a bundle with an "immediately" time tag. */
export function encodeOscBundle(packets) {
  const parts = [];
  writeString(parts, '#bundle');
  const tt = new Uint8Array(8);
  tt[7] = 1; // time tag 1 = "immediately"
  parts.push(tt);
  for (const p of packets) {
    const size = new Uint8Array(4);
    new DataView(size.buffer).setInt32(0, p.length);
    parts.push(size, p);
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/**
 * Map an OSC message to a transport command. Addresses (case-insensitive, under /previz):
 *   /previz/go               GO the standby cue
 *   /previz/go <cue>         standby that cue, then GO   (cue id as string or number, e.g. "3" or 3)
 *   /previz/standby <cue>    standby that cue
 *   /previz/stop             ramped STOP
 *   /previz/reset            RESET (home, back to the first cue)
 * Also /previz/cue/<cue>/go and /previz/cue/<cue>/standby, the QLab-style shape.
 *
 * Button surfaces (TouchOSC, Open Stage Control) send float 1.0 on press and 0.0 on release on the
 * same address. So a lone float 1 or T is a press (no cue), a lone 0 or F is a release (ignored),
 * and a cue number is an int, a string, or a float that isn't 0 or 1 (e.g. 2.5). QLab sends
 * `/previz/go 3` as int 3.
 *
 * @param {{ address: string, types?: string, args: any[] }} msg
 * @param {{ cues: { id: string }[] }} show
 * @returns {{ type: 'go'|'stop'|'reset'|'standby', cueIndex?: number } | { type: 'ignore', reason: string } | { error: string }}
 */
export function oscCommand(msg, show) {
  const address = msg.address.replace(/\/+$/, '');
  const lower = address.toLowerCase();
  if (lower !== PREFIX && !lower.startsWith(PREFIX + '/')) return { type: 'ignore', reason: `not a ${PREFIX} address` };
  const path = address.slice(PREFIX.length + 1).split('/').filter(Boolean);
  const args = msg.args;
  const types = msg.types ?? args.map((a) => (typeof a === 'string' ? 's' : Number.isInteger(a) ? 'i' : 'f')).join('');

  // /previz/cue/<id>/<verb>  →  /previz/<verb> <id>
  let verb, cueArg;
  if (path.length === 3 && path[0].toLowerCase() === 'cue') {
    verb = path[2].toLowerCase();
    cueArg = path[1];
    if (isRelease(args)) return { type: 'ignore', reason: 'button release' };
  } else if (path.length === 1) {
    verb = path[0].toLowerCase();
    if (isRelease(args)) return { type: 'ignore', reason: 'button release' };
    // A lone float 1.0 / T is a button press, not a cue number.
    if (args.length === 1 && !isPress(args[0], types[0])) cueArg = args[0];
    if (args.length > 1) return { error: `${address} takes at most one argument` };
  } else {
    return { error: `unknown address ${address}` };
  }

  if (verb === 'stop' || verb === 'reset') {
    if (path.length === 3) return { error: `unknown address ${address}` };
    return { type: verb };
  }
  if (verb !== 'go' && verb !== 'standby') return { error: `unknown address ${address}` };
  if (cueArg === undefined) {
    if (verb === 'standby') return { error: `${address} needs a cue number` };
    return { type: 'go' };
  }
  const cueIndex = findCue(show, cueArg);
  if (cueIndex < 0) return { error: `no cue ${String(cueArg)} in this show` };
  return { type: verb, cueIndex };
}

function isPress(a, type) {
  return a === true || (type === 'f' && a === 1);
}

function isRelease(args) {
  return args.length === 1 && (args[0] === 0 || args[0] === false);
}

function findCue(show, arg) {
  if (typeof arg === 'bigint') arg = Number(arg);
  if (typeof arg === 'number') {
    if (!Number.isFinite(arg)) return -1;
    // Floats arrive as float32: 2.5 is exact, but compare loosely so "2.5" in the show matches.
    const exact = show.cues.findIndex((c) => Number(c.id) === arg);
    if (exact >= 0) return exact;
    return show.cues.findIndex((c) => Math.abs(Number(c.id) - arg) < 1e-4);
  }
  if (typeof arg !== 'string') return -1;
  const want = arg.trim().replace(/^q/i, '');
  return show.cues.findIndex((c) => String(c.id).toLowerCase() === want.toLowerCase());
}

/**
 * Read the `?osc` URL parameter: absent → null (off); empty / "on" → the default local bridge;
 * a port number → that port on this host's bridge; a ws:// or wss:// URL → used as given.
 */
export const OSC_BRIDGE_DEFAULT_PORT = 53180;
export function parseOscParam(value, host = 'localhost') {
  if (value == null) return null;
  const v = value.trim();
  if (v === '' || v.toLowerCase() === 'on' || v.toLowerCase() === 'true') return `ws://${host}:${OSC_BRIDGE_DEFAULT_PORT}`;
  if (v.toLowerCase() === 'off' || v.toLowerCase() === 'false') return null;
  if (/^\d{2,5}$/.test(v) && Number(v) > 0 && Number(v) < 65536) return `ws://${host}:${Number(v)}`;
  if (/^wss?:\/\/[^\s]+$/i.test(v)) return v;
  return null;
}
