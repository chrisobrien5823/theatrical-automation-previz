import { describe, it, expect } from 'vitest';
import { loadShow, TAPE_COLORS, nextTapeColor } from '../src/core/show.js';
import demo from '../src/shows/demo.json';

const axis = (id, extra = {}) => ({ id, type: 'linear', home: 0, min: -1, max: 1, vMax: 1, aMax: 1, ...extra });

describe('spike-tape identity colours', () => {
  it('keeps a colour named in the show', () => {
    const { show } = loadShow({ axes: [axis('a', { color: '#123456' })], pieces: [], cues: [] });
    expect(show.axes[0].color).toBe('#123456');
  });

  it('gives axes without a colour distinct palette colours, and replaces a malformed one', () => {
    const { show } = loadShow({ axes: [axis('a'), axis('b'), axis('c', { color: 'not a colour' })], pieces: [], cues: [] });
    expect(show.axes.map((a) => a.color)).toEqual(TAPE_COLORS.slice(0, 3));
  });

  it('pieces take their axis colour unless they name their own; static pieces stay neutral', () => {
    const { show } = loadShow({
      axes: [axis('a', { color: '#abcdef' })],
      pieces: [
        { id: 'p1', mount: 'a', size: [1, 1, 1] },
        { id: 'p2', mount: 'a', size: [1, 1, 1], color: '#111111' },
        { id: 'p3', size: [1, 1, 1] },
      ],
      cues: [],
    });
    expect(show.pieces.map((p) => p.color)).toEqual(['#abcdef', '#111111', '#8a8f98']);
  });

  it('nextTapeColor skips colours already in use and cycles when all are taken', () => {
    expect(nextTapeColor([TAPE_COLORS[0].toUpperCase()])).toBe(TAPE_COLORS[1]);
    expect(nextTapeColor(TAPE_COLORS)).toBe(TAPE_COLORS[0]);
  });

  it('the demo names a distinct colour per axis', () => {
    expect(new Set(demo.axes.map((a) => a.color)).size).toBe(demo.axes.length);
    for (const a of demo.axes) expect(TAPE_COLORS).toContain(a.color);
  });
});
