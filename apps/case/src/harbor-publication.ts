import {
  exportSubmissions,
  pruneInactiveSubmissionHarborTaskPrefixes,
  type HarborExportResult,
  type HarborFormatValidation,
  type HarborPruneResult,
  type HarborTaskRegistrationClassification,
} from "./harbor-export-cli.js";
import { localArtifactStore, localHarborTaskStore } from "./registry/local.js";
import type { RegistryRepository } from "./registry/repository.js";
import type { AppendTasksInput, ReconcileSubmissionTasksInput } from "./registry/types.js";

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
  registration: AppendTasksInput;
  classify: () => Promise<HarborTaskRegistrationClassification<AppendTasksInput["tasks"][number]>>;
  register: (registration: AppendTasksInput) => Promise<T>;
  publish: (submissionId: string) => Promise<HarborExportResult>;
}): Promise<T & { harborFormatValidation: HarborFormatValidation; harborTaskPublication: HarborTaskPublication }> {
  const classification = await input.classify();
  const registration = { ...input.registration, tasks: classification.tasks };
  const containsHarborTask = registration.tasks.some(
    (task) => task.kind === "task" && task.format === "harbor",
  );
  const registered = await input.register(registration);
  if (!containsHarborTask) {
    return {
      ...registered,
      harborFormatValidation: classification.validation,
      harborTaskPublication: {
        status: "not_applicable",
        submissionId: registration.submissionId,
        reason: "registration_contains_no_harbor_tasks",
      },
    };
  }

  const publication = await input.publish(registration.submissionId);
  return {
    ...registered,
    harborFormatValidation: classification.validation,
    harborTaskPublication: {
      status: "completed",
      submissionId: registration.submissionId,
      ...publication,
    },
  };
}

export async function reconcileTaskSetWithHarborPublication<T extends object>(input: {
  registration: ReconcileSubmissionTasksInput;
  classify: () => Promise<HarborTaskRegistrationClassification<ReconcileSubmissionTasksInput["tasks"][number]>>;
  register: (registration: ReconcileSubmissionTasksInput) => Promise<T>;
  publish: (submissionId: string) => Promise<HarborExportResult>;
  prune: (submissionId: string) => Promise<HarborPruneResult>;
}): Promise<T & { harborFormatValidation: HarborFormatValidation; harborTaskPublication: HarborTaskPublication; harborTaskPruning: HarborPruneResult }> {
  const classification = await input.classify();
  const registration = { ...input.registration, tasks: classification.tasks };
  const containsHarborTask = registration.tasks.some(
    (task) => task.kind === "task" && task.format === "harbor",
  );
  const registered = await input.register(registration);
  const harborTaskPublication: HarborTaskPublication = containsHarborTask
    ? {
        status: "completed",
        submissionId: registration.submissionId,
        ...await input.publish(registration.submissionId),
      }
    : {
        status: "not_applicable",
        submissionId: registration.submissionId,
        reason: "registration_contains_no_harbor_tasks",
      };
  const harborTaskPruning = await input.prune(registration.submissionId);
  return { ...registered, harborFormatValidation: classification.validation, harborTaskPublication, harborTaskPruning };
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

export async function pruneSubmissionHarborTasks(
  repository: RegistryRepository,
  submissionId: string,
): Promise<HarborPruneResult> {
  return pruneInactiveSubmissionHarborTaskPrefixes({
    repository,
    destinationStore: localHarborTaskStore(),
    submissionId,
  });
}
