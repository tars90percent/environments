import type { RegistryRepository } from "./repository.js";

const referenceFields = new Set(["artifactId", "rawArtifactId", "evidenceArtifactId", "artifactIds"]);
const integrityFields = new Set(["sha256", "contentSha256", "manifestSha256", "payloadSha256", "requestSha256", "storageKey"]);

/** Translate file references at the tool boundary; never rewrite stored evidence or prose. */
export async function registryFileReferences(
  repository: Pick<RegistryRepository, "fileReferences">,
  value: unknown,
  direction: "input" | "output",
  includeIntegrity = false,
): Promise<unknown> {
  const identifiers = new Set<string>();
  visit(value, (identifier) => { identifiers.add(identifier); return identifier; }, false);
  const files = identifiers.size ? await repository.fileReferences([...identifiers]) : [];
  const replacements = new Map(files.map((file) => direction === "input"
    ? [file.reference, file.id]
    : [file.id, file.reference]));
  return visit(value, (identifier) => replacements.get(identifier) ?? identifier, direction === "output" && !includeIntegrity);
}

function visit(value: unknown, replace: (value: string) => string, compact: boolean, reference = false): unknown {
  if (typeof value === "string") return reference ? replace(value) : value;
  if (Array.isArray(value)) return value.map((item) => visit(item, replace, compact, reference));
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const artifact = "storageKey" in record || ("kind" in record && ("sha256" in record || "contentSha256" in record));
  return Object.fromEntries(Object.entries(record)
    .filter(([key]) => !(compact && (integrityFields.has(key) || (artifact && key === "reference"))))
    .map(([key, child]) => [key,
      // Metadata can contain original evidence and arbitrary vendor-defined fields.
      key === "metadata" ? child : visit(child, replace, compact, referenceFields.has(key) || (artifact && key === "id")),
    ]));
}
