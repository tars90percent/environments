import { ChatAgent } from "./agent.js";
import {
  AuthorizationError,
  LarkAuthorizationManager,
} from "./authorization.js";
import { parseAgentCommand } from "./commands.js";
import { config, validateConfig } from "./config.js";
import { FeishuGateway } from "./feishu.js";
import { prepareLarkRuntimeEnv } from "./lark-runtime.js";
import { isEligiblePilotMessage } from "./pilot-policy.js";
import { StateStore } from "./state.js";
import type { FeishuMessageEvent } from "./types.js";

validateConfig();

const larkRuntimeEnv = await prepareLarkRuntimeEnv(process.env);

const state = new StateStore(config.stateFile);
const gateway = new FeishuGateway({
  executable: config.larkCli,
  profile: config.larkProfile,
  env: larkRuntimeEnv,
});
const authorization = new LarkAuthorizationManager({
  executable: config.larkCli,
  profile: config.larkProfile,
  env: larkRuntimeEnv,
  stateFile: config.authStateFile,
  qrDirectory: config.authQrDirectory,
  defaultDomains: config.authDefaultDomains,
  pollTimeoutMs: config.authPollTimeoutMs,
});
const agent = new ChatAgent(state, larkRuntimeEnv);
const inFlight = new Set<string>();
const chatQueues = new Map<string, Promise<void>>();

await state.load();
await authorization.initialize();
await agent.initialize();

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

    if (command?.kind === "invalid") {
      await state.markProcessed(event.message_id);
      await gateway.reply(event.message_id, command.message);
      return;
    }

    if (command?.kind === "authorize") {
      const started = await authorization.start(
        event.chat_id,
        event.sender_id,
        command.request,
      );
      await state.markProcessed(event.message_id);
      const message =
        started.kind === "user-authorization"
          ? [
              "Authorize the Railway agent to act through your Feishu account:",
              started.verificationUrl,
              "",
              "Open the link or scan the QR code below. When Feishu says it is complete, return here and send /authorized.",
              started.expiresAt
                ? `This request expires at ${new Date(started.expiresAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Shanghai" })} China time.`
                : undefined,
            ]
              .filter((line): line is string => line !== undefined)
              .join("\n")
          : [
              "The Feishu app itself needs an additional permission before user authorization can continue:",
              started.verificationUrl,
              "",
              "Open the link or scan the QR code below. After the app permission is approved, send /authorize again.",
              started.detail,
            ]
              .filter((line): line is string => Boolean(line))
              .join("\n");
      await gateway.reply(event.message_id, message);
      try {
        await gateway.replyImage(event.message_id, started.qrPath);
      } catch (error) {
        console.error("Could not attach the Feishu authorization QR image:", safeError(error));
      } finally {
        if (started.kind === "app-configuration") {
          await authorization.discardQr(started.qrPath);
        }
      }
      return;
    }

    if (command?.kind === "authorized") {
      const result = await authorization.complete(event.chat_id, event.sender_id);
      await state.markProcessed(event.message_id);
      await gateway.reply(event.message_id, completionMessage(result));
      return;
    }

    if (command?.kind === "auth-status") {
      const result = await authorization.status(event.sender_id);
      await state.markProcessed(event.message_id);
      const message =
        result.kind === "ready"
          ? `Your Feishu user login is stored on the Railway volume and verified${result.userName ? ` for ${result.userName}` : ""}.`
          : result.kind === "missing"
            ? "This Railway agent does not have your Feishu user login yet. Send /authorize to start."
            : `Your Feishu user login is stored, but it needs attention${result.detail ? `: ${result.detail}` : ". Send /authorize to refresh it."}`;
      await gateway.reply(event.message_id, message);
      return;
    }

    const response = await agent.respond(event);
    await gateway.reply(event.message_id, response.text);
    await state.recordSuccess(event.chat_id, response.threadId, event.message_id);
    console.log(`Replied to ${event.message_id} in ${event.chat_id}`);
  } catch (error) {
    console.error(`Failed to process ${event.message_id}:`, safeError(error));
    if (error instanceof AuthorizationError) {
      try {
        await state.markProcessed(event.message_id);
        await gateway.reply(event.message_id, error.userMessage);
      } catch (replyError) {
        console.error("Could not send authorization error reply:", safeError(replyError));
      }
    } else {
      try {
        await state.markProcessed(event.message_id);
        await gateway.reply(
          event.message_id,
          "I couldn't complete that request. Please try again. If this was authorization, send /auth-status to see the current state.",
        );
      } catch (replyError) {
        console.error("Could not send failure reply:", safeError(replyError));
      }
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

function completionMessage(
  result: Awaited<ReturnType<LarkAuthorizationManager["complete"]>>,
): string {
  switch (result.kind) {
    case "ready":
      return `Authorization complete. The Railway agent now has a renewable Feishu user login${result.userName ? ` for ${result.userName}` : ""}, stored on its persistent volume and verified with Feishu.`;
    case "pending":
      return "Feishu has not completed the authorization yet. Finish it in the browser, then send /authorized again.";
    case "missing":
      return "There is no active authorization request for this chat. Send /authorize to create a new one.";
    case "expired":
      return "That authorization request expired. Send /authorize to create a fresh link and QR code.";
    case "wrong-user":
      return "The Feishu account that authorized does not match the person who requested it. The mismatched login was removed from the agent profile. Send /authorize and complete it with the same Feishu account you are messaging from.";
  }
}

function safeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
}
