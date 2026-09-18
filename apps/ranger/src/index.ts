import { loadEnvFile } from "node:process";
import { chmod, writeFile, rename } from "node:fs/promises";
import { join, dirname } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { readConfig } from "./config.js";
import { State } from "./state.js";
import { Gateway } from "./gateway.js";
import { createAgent, prepareWorkspace } from "./agent.js";
import { Service } from "./service.js";
import { importWakeups } from "./wakeups.js";

try { loadEnvFile(); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
process.umask(0o077);
const config = readConfig();
await prepareWorkspace(config);
const state = new State(join(config.data,"state.sqlite"));
await chmod(join(config.data,"state.sqlite"),0o600);
// Preserve the normal OS environment and explicit tool configuration. Do not inject
// CASE's database, Railway, or other agents' credentials into this process.
const environment = {...process.env,
  PATH:`${dirname(config.harnessPath)}:${dirname(config.larkPath)}:${process.env.PATH || "/usr/bin:/bin"}`,
  LARKSUITE_CLI_CONFIG_DIR:config.larkConfig,
  LARKSUITE_CLI_NO_UPDATE_NOTIFIER:"1", LARKSUITE_CLI_NO_SKILLS_NOTIFIER:"1",
};
const gateway = new Gateway(config,environment);
const service = new Service(config,state,createAgent(config,state,environment),gateway);
let stopping = false;
const stop = () => { stopping=true; service.stop(); gateway.stop(); };
process.once("SIGTERM",stop); process.once("SIGINT",stop);
const recovered = state.recover();
console.log(JSON.stringify({event:"ranger_start",model:config.model,sandbox:config.sandbox,recovered}));

async function loop(operation: () => Promise<void>, interval: number) {
  while (!stopping) { await operation(); if (!stopping) await sleep(interval); }
}
async function health() {
  const target = join(config.data,"health.json");
  await writeFile(`${target}.tmp`,JSON.stringify({updatedAt:new Date().toISOString(),feishuReady:gateway.ready,...service.status()}),{mode:0o600});
  await rename(`${target}.tmp`,target);
}
const tasks = [
  gateway.listen(message => service.receive(message)),
  loop(() => gateway.ready ? service.work() : Promise.resolve(),500),
  loop(() => gateway.ready ? service.deliver() : Promise.resolve(),300),
  loop(async () => { await importWakeups(config.data,state); await health(); },5000),
];
try { await Promise.race(tasks); }
catch (error) { console.error(JSON.stringify({event:"ranger_stopped",errorType:error instanceof Error ? error.name : "unknown"})); process.exitCode=1; }
finally { stop(); await Promise.allSettled(tasks); await health(); state.close(); }
