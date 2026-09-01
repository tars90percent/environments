import { exportSubmissions, type HarborExportResult } from "./harbor-export-cli.js";
import { localArtifactStore, localHarborTaskStore } from "./registry/local.js";
import type { RegistryRepository } from "./registry/repository.js";
import type { AppendTasksInput } from "./registry/types.js";

export type HarborTaskPublication =
  | {
      status: "not_applicable";
      submissionId: string;
      reason: "registration_contains_no_harbor_tasks";
    }
  | ({
      status: "completed";
      submissionId: string;
    } & HarborExportResult);

export async function registerTaskSetWithHarborPublication<T extends object>(input: {
  registration: Pick<AppendTasksInput, "submissionId" | "tasks">;
  register: () => Promise<T>;
  publish: (submissionId: string) => Promise<HarborExportResult>;
}): Promise<T & { harborTaskPublication: HarborTaskPublication }> {
  const registered = await input.register();
  const containsHarborTask = input.registration.tasks.some(
    (task) => task.kind === "task" && task.format === "harbor",
  );
  if (!containsHarborTask) {
    return {
      ...registered,
      harborTaskPublication: {
        status: "not_applicable",
        submissionId: input.registration.submissionId,
        reason: "registration_contains_no_harbor_tasks",
      },
    };
  }

  const publication = await input.publish(input.registration.submissionId);
  return {
    ...registered,
    harborTaskPublication: {
      status: "completed",
      submissionId: input.registration.submissionId,
      ...publication,
    },
  };
}

export async function publishSubmissionHarborTasks(
  repository: RegistryRepository,
  submissionId: string,
): Promise<HarborExportResult> {
  return exportSubmissions({
    repository,
    sourceStore: localArtifactStore(),
    destinationStore: localHarborTaskStore(),
    submissionIds: [submissionId],
  });
}
