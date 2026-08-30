import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AuthSlot } from "./types.js";

const execFileAsync = promisify(execFile);

export type AuthSlotState = "signed-in" | "signed-out" | "unavailable";

export type AuthStatus = {
  active: AuthSlot;
  slots: Record<AuthSlot, AuthSlotState>;
};

export async function inspectCodexLogin(
  codexPath: string,
  codexHome: string,
  environment: NodeJS.ProcessEnv,
): Promise<AuthSlotState> {
  const env = definedEnvironment({ ...environment, CODEX_HOME: codexHome });
  try {
    await execFileAsync(codexPath, ["login", "status"], {
      env,
      timeout: 15_000,
      maxBuffer: 64 * 1024,
    });
    return "signed-in";
  } catch (error) {
    const failure = error as { code?: string | number; stdout?: string; stderr?: string };
    const output = `${failure.stdout ?? ""}\n${failure.stderr ?? ""}`;
    if (failure.code === 1 && /not logged in/i.test(output)) return "signed-out";
    return "unavailable";
  }
}

function definedEnvironment(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}
