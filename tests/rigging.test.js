import { describe, it, expect } from 'vitest';
import { fitPrism, convexHull, boxesInFrame, boxPose } from '../src/core/fit.js';
import { compose, relative, axisPoses, piecePoses } from '../src/core/rig.js';
import { piecePrisms, piecesGap, checkClearance, corners, prism } from '../src/core/clearance.js';
import { loadShow } from '../src/core/show.js';

const DEG = Math.PI / 180;

/** The 8 corners of a box (as a flat xyz array), using the same yaw convention as the app. */
function boxPoints(center, size, yawDeg) {
  const p = prism(size, { x: center[0], y: center[1], z: center[2], yaw: yawDeg * DEG });
  const out = [];
  for (const [x, z] of corners(p)) out.push(x, p.y0, z, x, p.y1, z);
  return out;
}

describe('fitPrism', () => {
  it('recovers an axis-aligned box', () => {
    const f = fitPrism(boxPoints([1, 2, 3], [4, 2, 0.5], 0));
    expect(f.center[0]).toBeCloseTo(1, 9);
    expect(f.center[1]).toBeCloseTo(2, 9);
    expect(f.center[2]).toBeCloseTo(3, 9);
    expect(f.size[0]).toBeCloseTo(4, 9);
    expect(f.size[1]).toBeCloseTo(2, 9);
    expect(f.size[2]).toBeCloseTo(0.5, 9);
    expect(f.yaw).toBeCloseTo(0, 9);
  });

  for (const yaw of [30, -20, 44, 60, 90, 135]) {
    it(`recovers a box drawn at ${yaw} deg (same footprint)`, () => {
      const f = fitPrism(boxPoints([0, 1, 0], [4, 2, 0.3], yaw));
      expect(f.yaw).toBeGreaterThan(-45);
      expect(f.yaw).toBeLessThanOrEqual(45);
      expect(f.size[0] * f.size[2]).toBeCloseTo(4 * 0.3, 6); // tight, not an inflated AABB
      // Same rectangle: every original corner lies on the fitted box's boundary.
      const key = ([x, z]) => [x, z].map((v) => (Math.abs(v) < 1e-7 ? 0 : v).toFixed(6)).join(',');
      const a = corners(prism(f.size, boxPose(f))).map(key).sort();
      const b = corners(prism([4, 2, 0.3], { x: 0, y: 1, z: 0, yaw: yaw * DEG })).map(key).sort();
      expect(a).toEqual(b);
    });
  }

  it('gives zero-thickness flats a sliver of depth', () => {
    const f = fitPrism([0, 0, 0, 2, 0, 0, 0, 3, 0, 2, 3, 0]);
    expect(f.size[2]).toBeGreaterThan(0);
    expect(f.size[0]).toBeCloseTo(2, 9);
  });

  it('convex hull drops interior points', () => {
    expect(convexHull([[0, 0], [2, 0], [2, 2], [0, 2], [1, 1]])).toHaveLength(4);
  });
});

describe('rig: relative() and wagons', () => {
  it('compose(parent, relative(parent, world)) is the identity', () => {
    const parent = { x: 1.5, y: 2, z: -3, yaw: 37 * DEG };
    const world = { x: -4, y: 0.5, z: 7, yaw: -12 * DEG };
    const back = compose(parent, relative(parent, world));
    for (const k of ['x', 'y', 'z', 'yaw']) expect(back[k]).toBeCloseTo(world[k], 12);
  });

  const { show } = loadShow({
    axes: [
      { id: 'wagon', type: 'linear', direction: [1, 0, 0], origin: [-3, 0, 0], vMax: 1, aMax: 1 },
      { id: 'rev', type: 'rotary', parent: 'wagon', origin: [0, 0.2, 0], vMax: 10, aMax: 5 },
    ],
    pieces: [
      { id: 'wall', mount: 'rev', offset: [0, 1, 1], size: [2, 2, 0.2] },
      { id: 'post', offset: [3, 1, 1], size: [0.2, 2, 0.2] },
    ],
  });

  it('wagon travels along its direction', () => {
    expect(axisPoses(show, { wagon: 2.5, rev: 0 }).get('wagon')).toMatchObject({ x: -0.5, y: 0, z: 0 });
  });

  it('revolve stacked on a wagon carries its piece', () => {
    const p = piecePoses(show, { wagon: 3, rev: 90 }).get('wall');
    // rev at (0, 0.2, 0); wall offset (0, 1, 1) rotated 90 deg about Y -> (1, 1.2, 0)
    expect(p.x).toBeCloseTo(1, 9);
    expect(p.y).toBeCloseTo(1.2, 9);
    expect(p.z).toBeCloseTo(0, 9);
  });

  it('rejects a tilted rotary axis', () => {
    expect(() => loadShow({ axes: [{ id: 'r', type: 'rotary', direction: [1, 0, 0], vMax: 1, aMax: 1 }] })).toThrow(/vertical/);
  });

  it('normalizes linear directions', () => {
    const { show: s } = loadShow({ axes: [{ id: 'w', type: 'linear', direction: [0, 0, 5], vMax: 1, aMax: 1 }] });
    expect(s.axes[0].direction).toEqual([0, 0, 1]);
  });
});

describe('compound pieces', () => {
  // An L-shaped wall: a 4 m run along X plus a 2 m return along Z at its +X end.
  const L = {
    id: 'L',
    name: 'L wall',
    boxes: [
      { offset: [0, 0, 0], size: [4, 3, 0.2], yaw: 0 },
      { offset: [1.9, 0, 1.1], size: [0.2, 3, 2], yaw: 0 },
    ],
  };

  it('gap is the min over box pairs, and the empty inside corner is really empty', () => {
    const { show } = loadShow({
      pieces: [
        { ...L, offset: [0, 1.5, 0] },
        // A post sitting inside the L's corner, which a single bounding box would swallow.
        { id: 'post', offset: [0, 1.5, 1.2], size: [0.3, 3, 0.3] },
      ],
    });
    const poses = piecePoses(show, {});
    const gap = piecesGap(piecePrisms(show.pieces[0], poses.get('L')), piecePrisms(show.pieces[1], poses.get('post')));
    // Post spans z 1.05..1.35; the run's face is at z 0.1, so the gap is 0.95. The return is farther away.
    expect(gap).toBeCloseTo(0.95, 9);
    expect(checkClearance(show, {})).toEqual([]);
  });

  it('boxesInFrame round-trips world boxes through a rotated piece frame', () => {
    const frame = { x: 2, y: 1, z: -1, yaw: 25 * DEG };
    const world = [{ center: [3, 1.5, 0], size: [1, 1, 1], yaw: 10 }];
    const [local] = boxesInFrame(frame, world);
    const back = compose(frame, { x: local.offset[0], y: local.offset[1], z: local.offset[2], yaw: local.yaw * DEG });
    expect(back.x).toBeCloseTo(3, 9);
    expect(back.z).toBeCloseTo(0, 9);
    expect(back.yaw / DEG).toBeCloseTo(10, 9);
  });
});

describe('show validation: model fields', () => {
  it('model pieces need fitted boxes', () => {
    expect(() => loadShow({ model: { name: 'm' }, pieces: [{ id: 'p', node: '0/1' }] })).toThrow(/boxes/);
  });

  it('node pieces need a model block', () => {
    expect(() =>
      loadShow({ pieces: [{ id: 'p', node: '0/1', boxes: [{ size: [1, 1, 1] }] }] }),
    ).toThrow(/no "model"/);
  });

  it('modelPosition defaults to home', () => {
    const { show } = loadShow({ axes: [{ id: 'a', type: 'linear', home: 2, vMax: 1, aMax: 1 }] });
    expect(show.axes[0].modelPosition).toBe(2);
  });
});
