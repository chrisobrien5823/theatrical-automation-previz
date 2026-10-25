import { describe, it, expect } from 'vitest';
import { loadShow } from '../src/core/show.js';
import { axisCodes } from '../src/ui/format.js';
import demo from '../src/shows/demo.json';

const ax = (name, extra = {}) => ({ name, ...extra });

describe('axis short codes (phone bus)', () => {
  it('derives readable codes for the demo axes', () => {
    expect(axisCodes(loadShow(demo).show.axes)).toEqual(['LIFT', 'REV', 'FLY4']);
  });

  it('keeps the trailing number and keeps codes within five characters', () => {
    expect(axisCodes([ax('Wagon 12'), ax('Elevator 3')])).toEqual(['WAG12', 'ELE3']);
  });

  it('separates axes that would share a code', () => {
    const codes = axisCodes([ax('Lift DSC'), ax('Lift USC'), ax('Lift DSC')]);
    expect(new Set(codes).size).toBe(3);
    expect(codes[0]).toBe('LIFT');
  });

  it('uses the show\'s own short code when given, and falls back to the id for nameless axes', () => {
    expect(axisCodes([ax('Lift DSC', { short: 'dsc' }), { id: 'fly7' }])).toEqual(['DSC', 'FLY7']);
  });
});

describe('optional axis "short" field', () => {
  const axis = (extra) => ({ id: 'a', type: 'linear', home: 0, min: -1, max: 1, vMax: 1, aMax: 1, ...extra });
  it('is passed through trimmed and capped, and absent when blank or not a string', () => {
    const { show } = loadShow({ axes: [axis({ short: ' LIFT ' }), axis({ id: 'b', short: '' }), axis({ id: 'c', short: 5 }), axis({ id: 'd', short: 'TOOLONGCODE' })], pieces: [], cues: [] });
    expect(show.axes.map((a) => a.short)).toEqual(['LIFT', undefined, undefined, 'TOOLO']);
  });
});
