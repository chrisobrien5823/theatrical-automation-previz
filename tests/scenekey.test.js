import { describe, it, expect } from 'vitest';
import demo from '../src/shows/demo.json';
import { loadShow } from '../src/core/show.js';
import { sceneKey } from '../src/core/sceneKey.js';

const box = { size: [1, 1, 1], offset: [0, 0, 0], yaw: 0 };

const axis = (over = {}) => ({ id: 'lift', type: 'linear', origin: [0, 0, 0], home: 0, min: -5, max: 5, vMax: 1, aMax: 1, ...over });

/** A small imported-model rig: one model piece on a lift, one static box piece. */
function modelRig() {
  return {
    name: 'rig',
    clearance: 0.1,
    model: { name: 'm', scale: 0.001, upAxis: 'z', offset: [0, 0, 0] },
    axes: [axis()],
    pieces: [
      { id: 'wall', node: '0/1', mount: 'lift', boxes: [box], offset: [0, 1, 0] },
      { id: 'deck', size: [4, 0.2, 4], offset: [0, -0.1, 0] },
    ],
    cues: [{ id: '1', name: 'Up', moves: [{ axis: 'lift', target: 2 }] }],
  };
}

const key = (raw) => sceneKey(loadShow(raw).show);

/** The key of `base` after applying `edit` to a copy. */
function keyAfter(base, edit) {
  const raw = structuredClone(base);
  edit(raw);
  return key(raw);
}

describe('sceneKey', () => {
  it('is stable for the same show', () => {
    expect(key(demo)).toBe(key(structuredClone(demo)));
    expect(key(modelRig())).toBe(key(modelRig()));
  });

  describe('edits the meshes do not depend on keep the key', () => {
    const cases = {
      'cue target': (r) => { r.cues[0].moves[0].target += 0.5; },
      'adding a cue': (r) => { r.cues.push({ id: '99', name: 'New', moves: [] }); },
      'show name': (r) => { r.name = 'Renamed'; },
      'clearance': (r) => { r.clearance = 0.4; },
      'axis speed and accel': (r) => { r.axes[0].vMax = 0.123; r.axes[0].aMax = 0.2; },
      'axis limits': (r) => { r.axes[0].min = -3; },
      'axis name': (r) => { r.axes[0].name = 'Renamed'; },
      'piece name': (r) => { r.pieces[0].name = 'Renamed'; },
    };
    for (const [name, edit] of Object.entries(cases)) {
      it(name, () => {
        expect(keyAfter(modelRig(), edit)).toBe(key(modelRig()));
      });
    }

    it('moving or remounting a box piece (only its holder pose changes)', () => {
      const moved = (r) => { const d = r.pieces[1]; d.offset = [1, 2, 3]; d.yaw = 45; d.mount = 'lift'; d.color = '#8a8f98'; };
      expect(keyAfter(modelRig(), moved)).toBe(key(modelRig()));
    });

    it('moving an axis that only carries box pieces', () => {
      const base = modelRig();
      base.pieces = [{ id: 'deck', size: [4, 0.2, 4], mount: 'lift', color: '#123456' }];
      expect(keyAfter(base, (r) => { r.axes[0].origin = [2, 0, 0]; })).toBe(key(base));
    });
  });

  describe('edits the meshes do depend on change the key', () => {
    const cases = {
      'box piece size': (r) => { r.pieces[1].size = [5, 0.2, 4]; },
      'box piece colour': (r) => { r.pieces[1].color = '#ff0000'; },
      'box piece shape': (r) => { r.pieces[1].shape = 'cylinder'; },
      'piece clearance checking': (r) => { r.pieces[1].check = false; },
      'collision boxes': (r) => { r.pieces[0].boxes = [{ ...box, size: [2, 1, 1] }]; },
      'adding a piece': (r) => { r.pieces.push({ id: 'new', size: [1, 1, 1] }); },
      'removing a piece': (r) => { r.pieces.pop(); },
      'which model node a piece draws': (r) => { r.pieces[0].node = '0/2'; },
      'model scale': (r) => { r.model.scale = 0.0254; },
      'model up axis': (r) => { r.model.upAxis = 'y'; },
      'model offset': (r) => { r.model.offset = [0, 1, 0]; },
      'stage floor': (r) => { r.model.floor = true; },
    };
    for (const [name, edit] of Object.entries(cases)) {
      it(name, () => {
        expect(keyAfter(modelRig(), edit)).not.toBe(key(modelRig()));
      });
    }

    it('anything that shifts where a model piece was drawn', () => {
      const base = key(modelRig());
      expect(keyAfter(modelRig(), (r) => { r.axes[0].origin = [1, 0, 0]; })).not.toBe(base);
      expect(keyAfter(modelRig(), (r) => { r.axes[0].modelPosition = 2; })).not.toBe(base);
      expect(keyAfter(modelRig(), (r) => { r.pieces[0].offset = [0, 2, 0]; })).not.toBe(base);
      expect(keyAfter(modelRig(), (r) => { delete r.pieces[0].mount; })).not.toBe(base);
    });
  });
});
