import { describe, it, expect } from 'vitest';
import { preserveFrames, removeAxis, recordCue, endOfShowPositions, uniqueId, modelPositions } from '../src/core/edit.js';
import { loadShow } from '../src/core/show.js';
import { piecePoses } from '../src/core/rig.js';

const base = {
  axes: [{ id: 'wagon', type: 'linear', direction: [1, 0, 0], origin: [0, 0, 0], home: 0, min: -5, max: 5, vMax: 1, aMax: 1 }],
  pieces: [{ id: 'wall', offset: [4, 1, 2], yaw: 15, size: [2, 2, 0.2] }],
  cues: [],
};

function worldAtModel(raw, id) {
  const show = loadShow(raw).show;
  return piecePoses(show, modelPositions(show)).get(id);
}

describe('preserveFrames', () => {
  it('attaching a static piece to an axis leaves it where it was drawn', () => {
    const before = worldAtModel(base, 'wall');
    const next = preserveFrames(base, (r) => {
      r.pieces[0].mount = 'wagon';
      r.axes[0].origin = [3, 0, 1];
      r.axes[0].modelPosition = 2; // drawing shows the wagon 2 m along its track
    });
    const after = worldAtModel(next, 'wall');
    for (const k of ['x', 'y', 'z', 'yaw']) expect(after[k]).toBeCloseTo(before[k], 9);
    // ...and it now rides the wagon.
    const show = loadShow(next).show;
    expect(piecePoses(show, { wagon: 3 }).get('wall').x).toBeCloseTo(before.x + 1, 9);
  });

  it('works through a revolve stacked on a wagon', () => {
    const raw = structuredClone(base);
    raw.axes.push({ id: 'rev', type: 'rotary', parent: 'wagon', origin: [1, 0.2, 0], vMax: 10, aMax: 5, modelPosition: 30 });
    const before = worldAtModel(raw, 'wall');
    const next = preserveFrames(raw, (r) => (r.pieces[0].mount = 'rev'));
    const after = worldAtModel(next, 'wall');
    for (const k of ['x', 'y', 'z', 'yaw']) expect(after[k]).toBeCloseTo(before[k], 9);
  });
});

describe('removeAxis', () => {
  it('drops the axis, keeps its pieces in place as static, and strips its cue moves', () => {
    const raw = preserveFrames(base, (r) => (r.pieces[0].mount = 'wagon'));
    raw.cues = [{ id: '1', moves: [{ axis: 'wagon', target: 1 }] }];
    const before = worldAtModel(raw, 'wall');
    const next = removeAxis(raw, 'wagon');
    expect(next.axes).toHaveLength(0);
    expect(next.pieces[0].mount).toBeUndefined();
    expect(next.cues[0].moves).toHaveLength(0);
    const after = worldAtModel(next, 'wall');
    expect(after.x).toBeCloseTo(before.x, 9);
  });
});

describe('recordCue', () => {
  it('records only the axes that moved, numbered after the last cue', () => {
    const raw = { ...base, axes: [...base.axes, { id: 'lift', type: 'linear', home: -1, vMax: 1, aMax: 1 }] };
    const from = endOfShowPositions(raw);
    const { raw: next, cue } = recordCue(raw, from, { wagon: 2.5, lift: -1 });
    expect(cue).toMatchObject({ id: '1', moves: [{ axis: 'wagon', target: 2.5 }] });
    expect(endOfShowPositions(next)).toMatchObject({ wagon: 2.5, lift: -1 });
  });

  it('returns no cue if nothing moved', () => {
    expect(recordCue(base, { wagon: 0 }, { wagon: 0 }).cue).toBeNull();
  });
});

describe('uniqueId', () => {
  it('slugs and de-duplicates', () => {
    expect(uniqueId('Wagon wall run', [])).toBe('wagon-wall-run');
    expect(uniqueId('Wall', ['wall', 'wall-2'])).toBe('wall-3');
  });
});
