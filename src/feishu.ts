import { execFile, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import { basename, dirname, resolve } from "node:path";
import type { FeishuMessageEvent } from "./types.js";

const execFileAsync = promisify(execFile);

export type FeishuGatewayOptions = {
  executable: string;
  profile?: string;
  env?: NodeJS.ProcessEnv;
};

export class FeishuGateway {
  private consumer?: ChildProcessWithoutNullStreams;
  private stopping = false;

  constructor(private readonly options: FeishuGatewayOptions) {}

  async listen(handler: (event: FeishuMessageEvent) => Promise<void>): Promise<void> {
    const args = [
      ...this.profileArgs(),
      "event",
      "consume",
      "im.message.receive_v1",
      "--as",
      "bot",
    ];

    const consumer = spawn(this.options.executable, args, {
      // lark-cli treats stdin EOF as a graceful stop signal for unbounded consumers.
      stdio: ["pipe", "pipe", "pipe"] as const,
      env: this.options.env,
    });
    this.consumer = consumer;

    const closed = new Promise<number | null>((resolve) => consumer.once("close", resolve));
    consumer.stderr.on("data", (chunk) => process.stderr.write(chunk));
    consumer.on("error", (error) => {
      console.error("Unable to start lark-cli event consumer:", error);
    });

    const lines = createInterface({ input: consumer.stdout, crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line) as FeishuMessageEvent;
        void handler(event).catch((error) => console.error("Message handler failed:", error));
      } catch (error) {
        console.error("Ignoring malformed Feishu event:", error);
      }
    }

    const exitCode = await closed;
    if (this.stopping) return;
    throw new Error(`Feishu event consumer stopped unexpectedly (exit ${exitCode ?? "signal"})`);
  }

  async reply(messageId: string, text: string): Promise<void> {
    const idempotencyKey = `codex-${messageId}`.slice(0, 50);
    const args = [
      ...this.profileArgs(),
      "im",
      "+messages-reply",
      "--as",
      "bot",
      "--message-id",
      messageId,
      "--text",
      text,
      "--idempotency-key",
      idempotencyKey,
      "--json",
    ];
    await execFileAsync(this.options.executable, args, {
      env: this.options.env,
      maxBuffer: 2 * 1024 * 1024,
    });
  }

  async replyImage(messageId: string, imagePath: string): Promise<void> {
    const absolutePath = resolve(imagePath);
    const idempotencyKey = `codex-auth-qr-${messageId}`.slice(0, 50);
    const args = [
      ...this.profileArgs(),
      "im",
      "+messages-reply",
      "--as",
      "bot",
      "--message-id",
      messageId,
      "--image",
      `./${basename(absolutePath)}`,
      "--idempotency-key",
      idempotencyKey,
      "--json",
    ];
    await execFileAsync(this.options.executable, args, {
      cwd: dirname(absolutePath),
      env: this.options.env,
      maxBuffer: 2 * 1024 * 1024,
    });
  }

  stop(): void {
    this.stopping = true;
    this.consumer?.stdin.end();
    this.consumer?.kill("SIGTERM");
  }

  private profileArgs(): string[] {
    return this.options.profile ? ["--profile", this.options.profile] : [];
  }
}
