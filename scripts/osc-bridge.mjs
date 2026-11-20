#!/usr/bin/env node
/**
 * OSC bridge: QLab (or any OSC sender) → UDP → this script → WebSocket → the previz page.
 *
 * A web page can't open a UDP socket, so this small Node script listens for OSC on UDP and passes
 * each packet, byte for byte, to every page connected over a WebSocket. The page decodes it with
 * src/core/osc.js. No npm packages: just Node's dgram, http and crypto.
 *
 *   node scripts/osc-bridge.mjs                     UDP 0.0.0.0:53100 → ws://127.0.0.1:53180
 *   node scripts/osc-bridge.mjs --udp 8000 --ws 9000 --ws-host 0.0.0.0
 *   node scripts/osc-bridge.mjs --send /previz/go 3 send one OSC message to the bridge and exit
 *
 * Then open the app with ?osc (or ?osc=9000, or ?osc=ws://192.168.1.20:53180).
 * In QLab: Settings → Network, add a destination at this computer's IP, port 53100, then use a
 * Network cue with an OSC message such as  /previz/go  or  /previz/go 3  or  /previz/stop.
 */
import dgram from 'node:dgram';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { decodeOsc, encodeOsc, oscMessages, OSC_BRIDGE_DEFAULT_PORT } from '../src/core/osc.js';

export const UDP_DEFAULT_PORT = 53100; // not QLab's own 53000/53001, so both can run on one Mac
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/** One WebSocket frame, server → client: FIN set, not masked. */
export function wsFrame(payload, opcode = 0x2) {
  const n = payload.length;
  const head = n < 126 ? Buffer.alloc(2) : n < 65536 ? Buffer.alloc(4) : Buffer.alloc(10);
  head[0] = 0x80 | opcode;
  if (n < 126) head[1] = n;
  else if (n < 65536) {
    head[1] = 126;
    head.writeUInt16BE(n, 2);
  } else {
    head[1] = 127;
    head.writeBigUInt64BE(BigInt(n), 2);
  }
  return Buffer.concat([head, Buffer.from(payload)]);
}

/**
 * Pull complete client frames off the front of `buf` (client frames are always masked).
 * Returns the frames and whatever bytes are left over for the next 'data' event.
 */
export function readWsFrames(buf) {
  const frames = [];
  let at = 0;
  while (buf.length - at >= 2) {
    const opcode = buf[at] & 0x0f;
    const masked = (buf[at + 1] & 0x80) !== 0;
    let len = buf[at + 1] & 0x7f;
    let p = at + 2;
    if (len === 126) {
      if (buf.length - p < 2) break;
      len = buf.readUInt16BE(p);
      p += 2;
    } else if (len === 127) {
      if (buf.length - p < 8) break;
      len = Number(buf.readBigUInt64BE(p));
      p += 8;
    }
    const maskLen = masked ? 4 : 0;
    if (buf.length - p < maskLen + len) break;
    const payload = Buffer.from(buf.subarray(p + maskLen, p + maskLen + len));
    if (masked) for (let i = 0; i < len; i++) payload[i] ^= buf[p + (i & 3)];
    frames.push({ opcode, payload });
    at = p + maskLen + len;
  }
  return { frames, rest: buf.subarray(at) };
}

/** Short text for the console: "/previz/go 3" or "bundle(2): /previz/stop; /previz/reset". */
export function describePacket(packet) {
  const one = (m) => [m.address, ...m.args.map((a) => (typeof a === 'string' ? JSON.stringify(a) : String(a)))].join(' ');
  if (!packet.bundle) return one(packet);
  const msgs = oscMessages(packet);
  return `bundle(${msgs.length}): ${msgs.map(one).join('; ')}`;
}

/**
 * Start the bridge. Resolves once both sockets are listening.
 * @returns {Promise<{ udpPort: number, wsPort: number, clients: () => number, close: () => Promise<void> }>}
 */
export function startBridge({ udpPort = UDP_DEFAULT_PORT, udpHost = '0.0.0.0', wsPort = OSC_BRIDGE_DEFAULT_PORT, wsHost = '127.0.0.1', log = console.log } = {}) {
  const clients = new Set();

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end(`previz OSC bridge: ${clients.size} page(s) connected\n`);
  });

  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if ((req.headers.upgrade || '').toLowerCase() !== 'websocket' || !key) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    const accept = createHash('sha1').update(key + WS_GUID).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    socket.setNoDelay(true);
    clients.add(socket);
    log(`page connected (${clients.size})`);
    let pending = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      const { frames, rest } = readWsFrames(Buffer.concat([pending, chunk]));
      pending = Buffer.from(rest);
      for (const f of frames) {
        if (f.opcode === 0x8) socket.end(wsFrame(f.payload.subarray(0, 2), 0x8)); // echo the close
        else if (f.opcode === 0x9) socket.write(wsFrame(f.payload, 0xa)); // ping → pong
      }
    });
    const drop = () => {
      if (clients.delete(socket)) log(`page disconnected (${clients.size})`);
    };
    socket.on('close', drop);
    socket.on('error', drop);
  });

  const udp = dgram.createSocket('udp4');
  udp.on('message', (msg, from) => {
    let text;
    try {
      text = describePacket(decodeOsc(msg)); // only well-formed OSC is passed on
    } catch (err) {
      log(`dropped ${msg.length} bytes from ${from.address}: ${err.message}`);
      return;
    }
    log(`${from.address}  ${text}  → ${clients.size} page(s)`);
    const frame = wsFrame(msg);
    for (const c of clients) c.write(frame);
  });

  return new Promise((resolve, reject) => {
    udp.once('error', reject);
    server.once('error', reject);
    udp.bind(udpPort, udpHost, () => {
      server.listen(wsPort, wsHost, () => {
        resolve({
          udpPort: udp.address().port,
          wsPort: server.address().port,
          clients: () => clients.size,
          close: () =>
            new Promise((done) => {
              for (const c of clients) c.destroy();
              udp.close();
              server.close(() => done());
            }),
        });
      });
    });
  });
}

/** Send one OSC message over UDP (for `--send` and tests). Numeric-looking args go as int/float. */
export function sendOsc(address, args, { port = UDP_DEFAULT_PORT, host = '127.0.0.1' } = {}) {
  const sock = dgram.createSocket('udp4');
  const packet = encodeOsc(address, args);
  return new Promise((resolve, reject) => {
    sock.send(packet, port, host, (err) => {
      sock.close();
      if (err) reject(err);
      else resolve(packet);
    });
  });
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--udp') opts.udpPort = Number(argv[++i]);
    else if (a === '--ws') opts.wsPort = Number(argv[++i]);
    else if (a === '--ws-host') opts.wsHost = argv[++i];
    else if (a === '--send') {
      opts.send = { address: argv[++i], args: argv.slice(i + 1).map((v) => (/^-?\d+$/.test(v) ? Number(v) : /^-?\d*\.\d+$/.test(v) ? Number(v) : v)) };
      break;
    } else if (a === '--help' || a === '-h') opts.help = true;
    else throw new Error(`unknown option ${a}`);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('usage: node scripts/osc-bridge.mjs [--udp 53100] [--ws 53180] [--ws-host 127.0.0.1]\n       node scripts/osc-bridge.mjs [--udp 53100] --send /previz/go [cue]');
    return;
  }
  if (opts.send) {
    await sendOsc(opts.send.address, opts.send.args, { port: opts.udpPort ?? UDP_DEFAULT_PORT });
    console.log(`sent ${[opts.send.address, ...opts.send.args].join(' ')} to udp ${opts.udpPort ?? UDP_DEFAULT_PORT}`);
    return;
  }
  const b = await startBridge(opts);
  console.log(`OSC in on udp ${b.udpPort}; pages connect to ws://${opts.wsHost ?? '127.0.0.1'}:${b.wsPort} (open the app with ?osc${b.wsPort === OSC_BRIDGE_DEFAULT_PORT ? '' : '=' + b.wsPort})`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
