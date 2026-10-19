import { describe, expect, it } from 'vitest';
import { formatTaskLabel } from './legacy-format';

describe('formatTaskLabel', () => {
  it('formats priority and owner', () => {
    expect(formatTaskLabel({ priority: 'high', owner: 'student' })).toBe('HIGH · STUDENT');
  });

  it.each([null, undefined])('handles missing task %s', (task) => {
    expect(formatTaskLabel(task)).toBe('SIN-DATOS');
  });

  it.each([
    [{}, 'NORMAL · SIN-ASIGNAR'],
    [{ priority: '', owner: '' }, 'NORMAL · SIN-ASIGNAR'],
    [{ priority: 2, owner: 123 }, '2 · 123']
  ])('preserves defaults and string conversion', (task, expected) => {
    expect(formatTaskLabel(task)).toBe(expected);
  });
});
