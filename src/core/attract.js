// Booth "attract" loop: after the stage has sat untouched for a while, replay the show's near-miss
// cue on its own, hold on the result, and replay it again, until someone touches the screen.
// Pure logic (no DOM, no Three.js): main.js feeds it frame time and the sim state, and acts on the
// action it returns. Enabled only with `?booth` in the URL, so the normal app never moves by itself.

export const BOOTH_IDLE_DEFAULT = 30; // s untouched before the loop starts
export const BOOTH_HOLD = 6; // s the result (Caught card, gap dimension) stays up between replays

/**
 * `?booth` -> 30 s idle delay; `?booth=20` -> 20 s (clamped to 5 .. 600); absent, `0` or `off` -> null (off).
 * @param {string | null} value  URLSearchParams.get('booth')
 */
export function parseBoothParam(value) {
  if (value == null) return null;
  const v = value.trim().toLowerCase();
  if (v === '' || v === 'on' || v === 'true') return BOOTH_IDLE_DEFAULT;
  if (v === 'off' || v === 'false') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return BOOTH_IDLE_DEFAULT;
  if (n <= 0) return null;
  return Math.min(600, Math.max(5, n));
}

/**
 * The cue the loop replays: the first one whose preflight (run in order from home) found a conflict.
 * @param {{ conflicts: unknown[] }[]} chain  preflightShow(show, home, 0) results
 * @returns {number} cue index, or -1 when the show has no flagged cue (the loop then stays off)
 */
export function attractCueIndex(chain) {
  return chain.findIndex((r) => r && r.conflicts && r.conflicts.length > 0);
}

/**
 * States: 'waiting' (counting untouched idle time) -> 'running' (the replayed cue is moving)
 * -> 'holding' (cue done, result on screen) -> 'running' again, and so on.
 * `tick` returns 'replay' when main.js should load the stage before the cue and GO, 'end' when the
 * loop stopped because the app is no longer in a state it may drive, otherwise null.
 * `poke` is any user input: it restarts the idle count and returns true if the loop was active.
 */
export function createAttract({ idleDelay = BOOTH_IDLE_DEFAULT, hold = BOOTH_HOLD } = {}) {
  let state = 'waiting';
  let timer = 0; // s idle (waiting) or s on the result (holding)

  function tick(dt, { simIdle, eligible }) {
    if (!eligible) {
      const was = state;
      state = 'waiting';
      timer = 0;
      return was === 'waiting' ? null : 'end';
    }
    switch (state) {
      case 'waiting':
        timer = simIdle ? timer + dt : 0; // a cue the user started counts as activity
        if (timer < idleDelay) return null;
        state = 'running';
        return 'replay';
      case 'running':
        if (!simIdle) return null;
        // Cue done (or a GO that had nothing to move): hold on the result before the next replay.
        state = 'holding';
        timer = 0;
        return null;
      case 'holding':
        timer += dt;
        if (timer < hold) return null;
        state = 'running';
        return 'replay';
    }
    return null;
  }

  function poke() {
    const wasActive = state !== 'waiting';
    state = 'waiting';
    timer = 0;
    return wasActive;
  }

  return {
    tick,
    poke,
    get state() {
      return state;
    },
  };
}
