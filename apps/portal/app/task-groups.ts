import type { CatalogTask, TaskKind } from "./catalog";

export type SubmissionTaskGroup = {
  id: string;
  benchmark: CatalogTask["benchmark"];
  kind: TaskKind;
  tasks: CatalogTask[];
};

export function groupSubmissionTasks(tasks: CatalogTask[]): SubmissionTaskGroup[] {
  const groups = new Map<string, SubmissionTaskGroup>();
  for (const task of tasks) {
    const id = `${task.benchmark.id}:${task.kind}`;
    const group = groups.get(id) ?? { id, benchmark: task.benchmark, kind: task.kind, tasks: [] };
    group.tasks.push(task);
    groups.set(id, group);
  }
  return [...groups.values()];
}
