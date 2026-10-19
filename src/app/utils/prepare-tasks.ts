import { appConfig } from '../../environments/environment';
import { Task } from '../models/api.models';
import { formatTaskLabel } from './legacy-format';

export function prepareTasks(tasks: Task[]): { all: Task[]; visible: Task[] } {
  const all = tasks.map((task) => task.status === appConfig.archivedStatus
    ? { ...task }
    : { ...task, label: formatTaskLabel(task) });
  const visible = all.filter((task) => task.status !== appConfig.archivedStatus);
  visible.sort((left, right) => {
    if (left.priority === undefined || right.priority === undefined) {
      return 1;
    }
    return left.priority > right.priority ? -1 : 1;
  });
  return { all, visible };
}