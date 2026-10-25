import { describe, it, expect } from 'vitest';
import { formatGap, formatClearance, spokenGap, spokenClearance } from '../src/ui/format.js';

describe('formatGap (metres in, millimetres out)', () => {
  it('shows whole mm from 10 mm up', () => {
    expect(formatGap(0.065)).toBe('65 mm');
    expect(formatGap(0.064)).toBe('64 mm');
    expect(formatGap(0.15)).toBe('150 mm');
    expect(formatGap(1.2)).toBe('1200 mm');
  });
  it('keeps float noise from dropping a millimetre', () => {
    expect(formatGap(0.057)).toBe('57 mm'); // 0.057 * 1000 = 56.99999999999999
    expect(formatGap(0.145)).toBe('145 mm');
  });
  it('shows one decimal below 10 mm', () => {
    expect(formatGap(0.0064)).toBe('6.4 mm');
    expect(formatGap(0.0005)).toBe('0.5 mm');
  });
  it('rounds to the nearest mm (nearest 0.1 mm below 10 mm)', () => {
    expect(formatGap(0.0638)).toBe('64 mm');
    expect(formatGap(0.0642)).toBe('64 mm');
    expect(formatGap(0.00964)).toBe('9.6 mm');
  });
  it('never prints 10.0 mm', () => {
    expect(formatGap(0.00999)).toBe('10 mm');
  });
  it('keeps contact as CONTACT', () => {
    expect(formatGap(0)).toBe('CONTACT');
    expect(formatGap(1e-7)).toBe('CONTACT');
  });
});

describe('formatClearance', () => {
  it('rounds and drops a trailing .0', () => {
    expect(formatClearance(0.15)).toBe('150 mm');
    expect(formatClearance(0.1525)).toBe('152.5 mm');
    expect(formatClearance(0.2)).toBe('200 mm');
  });
});

describe('spoken forms', () => {
  it('spell out the unit for the live region', () => {
    expect(spokenGap(0.064)).toBe('64 millimetres');
    expect(spokenGap(0)).toBe('contact');
    expect(spokenClearance(0.15)).toBe('150 millimetres');
  });
});
