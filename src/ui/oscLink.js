// WebSocket link to scripts/osc-bridge.mjs. Hands each binary message (one raw OSC packet) to
// onPacket and reports 'open' / 'closed' through onStatus. Reconnects with a growing wait (1 s up
// to 10 s), so the page can be opened before the bridge is started, or survive a bridge restart.

export function connectOsc(url, { onPacket, onStatus }) {
  let ws = null;
  let wait = 1000;
  let timer = 0;
  let stopped = false;
  let wasOpen = false;

  function open() {
    if (stopped) return;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      onStatus('error', err.message); // a malformed URL throws here and won't get better on retry
      return;
    }
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => {
      wait = 1000;
      wasOpen = true;
      onStatus('open');
    };
    ws.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) onPacket(new Uint8Array(e.data));
    };
    ws.onclose = () => {
      if (wasOpen) onStatus('closed');
      wasOpen = false;
      if (stopped) return;
      timer = setTimeout(open, wait);
      wait = Math.min(wait * 2, 10000);
    };
  }

  open();
  return {
    close() {
      stopped = true;
      clearTimeout(timer);
      ws?.close();
    },
  };
}
