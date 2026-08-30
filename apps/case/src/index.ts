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
const inFlight = new Set<string>();
const chatQueues = new Map<string, Promise<void>>();

await state.load();
const agent = new ChatAgent(state, larkRuntimeEnv);
await agent.initialize();

let registryServer: RegistryServer | undefined;
let registry: PostgresRegistry | undefined;
if (config.registryDatabaseUrl && config.registryCatalogToken && config.registryUploadToken) {
  registry = new PostgresRegistry(config.registryDatabaseUrl);
  await registry.initialize();
  const artifactStore = config.registryS3 ? new ArtifactStore(config.registryS3) : undefined;
  registryServer = await startRegistryServer({
    repository: registry,
    artifactStore,
    catalogToken: config.registryCatalogToken,
    uploadToken: config.registryUploadToken,
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
      const slot = agent.currentAuthSlot();
      await state.resetChat(event.chat_id, slot, event.message_id);
      agent.reset(event.chat_id, slot);
      await gateway.reply(
        event.message_id,
        `Started a new Codex session for the ${slot} credential slot. Your next message in this slot will have no previous Codex conversation history.`,
      );
      console.log(`Reset ${slot} Codex session for ${event.chat_id}`);
      return;
    }

    if (command) {
      if (!config.adminUserIds.has(event.sender_id)) {
        await state.markProcessed(event.message_id);
        await gateway.reply(event.message_id, "This command is restricted to CASE admins.");
        return;
      }
      if (command.kind === "auth-help") {
        await state.markProcessed(event.message_id);
        await gateway.reply(event.message_id, authHelp());
        return;
      }
      if (command.kind === "auth-status") {
        const status = await agent.authStatus();
        await state.markProcessed(event.message_id);
        await gateway.reply(event.message_id, formatAuthStatus(status));
        return;
      }
      const result = await agent.useAuthSlot(command.slot);
      await state.markProcessed(event.message_id);
      await gateway.reply(event.message_id, formatAuthSwitch(command.slot, result));
      return;
    }

    const response = await agent.respond(event);
    await gateway.reply(event.message_id, response.text);
    await state.recordSuccess(event.chat_id, response.authSlot, response.threadId, event.message_id);
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
console.log(
  `Codex credential slots enabled (active=${agent.currentAuthSlot()}, admins=${config.adminUserIds.size}, automatic-switching=disabled)`,
);
await gateway.listen(enqueue);

function safeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
}

function authHelp(): string {
  return [
    "CASE Codex credential commands:",
    "/auth status",
    "/auth use primary",
    "/auth use backup",
    "Switching is manual; CASE never fails over automatically.",
  ].join("\n");
}

function formatAuthStatus(status: Awaited<ReturnType<ChatAgent["authStatus"]>>): string {
  return [
    "CASE Codex credentials",
    `Active: ${status.active}`,
    `Primary: ${status.slots.primary}`,
    `Backup: ${status.slots.backup}`,
    "Automatic switching: disabled",
  ].join("\n");
}

function formatAuthSwitch(slot: "primary" | "backup", result: Awaited<ReturnType<ChatAgent["useAuthSlot"]>>): string {
  if (result === "switched") {
    return `CASE now uses the ${slot} credential slot. Its Codex conversation history is kept separate from the other slot. Automatic switching remains disabled.`;
  }
  if (result === "already-active") return `The ${slot} credential slot is already active. No change was made.`;
  if (result === "signed-out") return `The ${slot} credential slot is signed out. No change was made.`;
  return `CASE could not verify the ${slot} credential slot. No change was made.`;
}
