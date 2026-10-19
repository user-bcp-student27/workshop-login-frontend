import { describe, expect, it } from 'vitest';
import { Task } from '../models/api.models';
import { prepareTasks } from './prepare-tasks';

describe('prepareTasks', () => {
  it('preserves exact archive filtering and does not mutate input', () => {
    const tasks: Task[] = [
      { title: 'archived', status: 'ARCHIVED' },
      { title: 'visible', status: 'archived', priority: 'HIGH', owner: 'student' }
    ];
    const prepared = prepareTasks(tasks);
    expect(prepared.all).toHaveLength(2);
    expect(prepared.all[0].label).toBeUndefined();
    expect(prepared.visible).toEqual([{ ...tasks[1], label: 'HIGH · STUDENT' }]);
    expect(tasks[1].label).toBeUndefined();
  });

  it.each<[Task['priority'], Task['priority'], string[]]>([
    ['LOW', 'NORMAL', ['second', 'first']],
    ['HIGH', 'HIGH', ['first', 'second']],
    [1, 2, ['second', 'first']],
    [2, '1', ['first', 'second']],
    [undefined, 'HIGH', ['first', 'second']],
    ['HIGH', undefined, ['first', 'second']]
  ])('matches the characterized order for %s and %s', (first, second, expected) => {
    const tasks: Task[] = [{ title: 'first', priority: first }, { title: 'second', priority: second }];
    expect(prepareTasks(tasks).visible.map((task) => task.title)).toEqual(expected);
  });

  it('supports an empty list', () => {
    expect(prepareTasks([])).toEqual({ all: [], visible: [] });
  });
});