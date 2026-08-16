import { ChatAgent } from "./agent.js";
import { parseAgentCommand } from "./commands.js";
import { config, validateConfig } from "./config.js";
import { FeishuGateway } from "./feishu.js";
import { prepareLarkRuntimeEnv } from "./lark-runtime.js";
import { isEligiblePilotMessage } from "./pilot-policy.js";
import { StateStore } from "./state.js";
import type { FeishuMessageEvent } from "./types.js";
import { ArtifactStore } from "./registry/artifacts.js";
import { startRegistryServer, type RegistryServer } from "./registry/api.js";
import { PostgresRegistry } from "./registry/postgres.js";

validateConfig();

const larkRuntimeEnv = await prepareLarkRuntimeEnv(process.env);

const state = new StateStore(config.stateFile);
const gateway = new FeishuGateway({
  executable: config.larkCli,
  profile: config.larkProfile,
  env: larkRuntimeEnv,
});
const agent = new ChatAgent(state, larkRuntimeEnv);
const inFlight = new Set<string>();
const chatQueues = new Map<string, Promise<void>>();

await state.load();
await agent.initialize();

let registryServer: RegistryServer | undefined;
let registry: PostgresRegistry | undefined;
if (config.registryDatabaseUrl && config.registryCatalogToken && config.registryReviewToken && config.registryUploadToken && config.registryAdminToken) {
  registry = new PostgresRegistry(config.registryDatabaseUrl);
  await registry.initialize();
  const artifactStore = config.registryS3 ? new ArtifactStore(config.registryS3) : undefined;
  registryServer = await startRegistryServer({
    repository: registry,
    artifactStore,
    catalogToken: config.registryCatalogToken,
    reviewToken: config.registryReviewToken,
    uploadToken: config.registryUploadToken,
    adminToken: config.registryAdminToken,
    port: config.registryPort,
  });
  console.log(`CASE registry listening on port ${config.registryPort}`);
}

function eligible(event: FeishuMessageEvent): boolean {
  return isEligiblePilotMessage(
    event,
    {
      allowGroupChats: config.allowGroupChats,
      allowAllUsers: config.allowAllUsers,
      allowedUserIds: config.allowedUserIds,
    },
    state.hasProcessed(event.message_id),
    inFlight.has(event.message_id),
  );
}

async function handle(event: FeishuMessageEvent): Promise<void> {
  if (!eligible(event)) return;
  inFlight.add(event.message_id);
  try {
    const command = parseAgentCommand(event.content);
    if (command?.kind === "new") {
      await state.resetChat(event.chat_id, event.message_id);
      agent.reset(event.chat_id);
      await gateway.reply(
        event.message_id,
        "Started a new Codex session. Your next message will have no previous Codex conversation history.",
      );
      console.log(`Reset Codex session for ${event.chat_id}`);
      return;
    }

    const response = await agent.respond(event);
    await gateway.reply(event.message_id, response.text);
    await state.recordSuccess(event.chat_id, response.threadId, event.message_id);
    console.log(`Replied to ${event.message_id} in ${event.chat_id}`);
  } catch (error) {
    console.error(`Failed to process ${event.message_id}:`, safeError(error));
    try {
      await state.markProcessed(event.message_id);
      await gateway.reply(event.message_id, "I couldn't complete that request. Please try again.");
    } catch (replyError) {
      console.error("Could not send failure reply:", safeError(replyError));
    }
  } finally {
    inFlight.delete(event.message_id);
  }
}

function enqueue(event: FeishuMessageEvent): Promise<void> {
  const previous = chatQueues.get(event.chat_id) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => handle(event));
  chatQueues.set(event.chat_id, next);
  void next.finally(() => {
    if (chatQueues.get(event.chat_id) === next) chatQueues.delete(event.chat_id);
  });
  return next;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    gateway.stop();
    void registryServer?.close();
    void registry?.close();
    process.exitCode = 0;
  });
}

console.log(
  `Feishu Codex agent starting (groups=${config.allowGroupChats ? "enabled" : "disabled"}, users=${config.allowAllUsers ? "all" : config.allowedUserIds.size})`,
);
console.log(
  `Codex permissions (sandbox=${config.codexSandboxMode}, network=${config.codexNetworkAccess ? "enabled" : "disabled"}, web=${config.codexWebSearchMode}, approvals=${config.codexApprovalPolicy}, reviewer=${config.codexApprovalsReviewer})`,
);
await gateway.listen(enqueue);

function safeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
}
