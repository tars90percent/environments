import { sampleGroup } from "./sample-classification";
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
    const benchmark = sampleGroup(task);
    const id = `${benchmark.id}:${task.kind}`;
    const group = groups.get(id) ?? { id, benchmark, kind: task.kind, tasks: [] };
    group.tasks.push(task);
    groups.set(id, group);
  }
  return [...groups.values()];
}
