import { ArtifactStore } from "./artifacts.js";
import { PostgresRegistry } from "./postgres.js";

export type LocalRegistry = {
  repository: PostgresRegistry;
  artifactStore: ArtifactStore;
  close(): Promise<void>;
};

export async function openLocalRegistry(environment: NodeJS.ProcessEnv = process.env): Promise<LocalRegistry> {
  const repository = await openLocalRepository(environment);
  const artifactStore = localArtifactStore(environment);
  return { repository, artifactStore, close: () => repository.close() };
}

export async function openLocalRepository(environment: NodeJS.ProcessEnv = process.env): Promise<PostgresRegistry> {
  const repository = new PostgresRegistry(required(environment, "DATABASE_URL"));
  await repository.initialize();
  return repository;
}

export function localArtifactStore(environment: NodeJS.ProcessEnv = process.env): ArtifactStore {
  return new ArtifactStore({
    endpoint: required(environment, "AWS_ENDPOINT_URL"),
    accessKeyId: required(environment, "AWS_ACCESS_KEY_ID"),
    secretAccessKey: required(environment, "AWS_SECRET_ACCESS_KEY"),
    bucket: required(environment, "AWS_S3_BUCKET_NAME"),
    region: environment.AWS_DEFAULT_REGION?.trim() || "auto",
  });
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required for trusted local registry operations`);
  return value;
}
