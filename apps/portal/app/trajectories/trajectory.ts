export type JsonObject = Record<string, unknown>;
export type Block = JsonObject & { type: string };
export type Result = { block: Block; messageIndex: number };
export type Step = {
  id: string;
  messageIndex: number;
  role: string;
  blocks: Block[];
  raw: JsonObject;
  title: string;
  search: string;
};
export type Trajectory = {
  raw: JsonObject;
  model: string;
  steps: Step[];
  results: Map<string, Result[]>;
  messageCount: number;
  toolCount: number;
  errorCount: number;
  thinkingCount: number;
  settings: JsonObject;
};

export function object(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function pretty(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "";
}

export function contentBlocks(value: unknown): Block[] {
  if (value == null) return [];
  if (typeof value === "string") return [{ type: "text", text: value }];
  if (Array.isArray(value)) return value.map((block) => object(block)
    ? { ...block, type: typeof block.type === "string" ? block.type : "unknown" }
    : { type: "unknown", value: block });
  return [{ type: "unknown", value }];
}

export function blockText(block: Block): string {
  if (block.type === "text") return pretty(block.text);
  if (block.type === "thinking") return pretty(block.thinking);
  return pretty(block);
}

export function callId(block: Block): string {
  return typeof block.id === "string" ? block.id : "";
}

function shortText(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 120);
}

export function parseTrajectory(text: string): Trajectory {
  let raw: unknown;
  try { raw = JSON.parse(text.replace(/^\uFEFF/, "")); }
  catch { throw new Error("This isn’t valid JSON. Open a trajectory JSON file or paste the complete JSON object."); }
  if (!object(raw) || !Array.isArray(raw.messages)) {
    throw new Error('Expected a JSON object with a "messages" array.');
  }
  const results = new Map<string, Result[]>();
  const normalized = raw.messages.map((message, i) => {
    if (!object(message) || typeof message.role !== "string") {
      throw new Error(`Message ${i + 1} must be an object with a string "role".`);
    }
    const blocks = contentBlocks(message.content);
    if (typeof message.reasoning_content === "string") blocks.unshift({ type: "thinking", thinking: message.reasoning_content });
    if (Array.isArray(message.tool_calls)) {
      for (const call of message.tool_calls) {
        if (object(call) && object(call.function)) {
          let input = call.function.arguments;
          if (typeof input === "string") { try { input = JSON.parse(input); } catch { /* Preserve non-JSON arguments. */ } }
          blocks.push({ type: "tool_use", id: call.id, name: call.function.name, input });
        } else blocks.push({ type: "unknown", value: call });
      }
    }
    if (message.role === "tool" && typeof message.tool_call_id === "string") {
      return { message, blocks: [{ type: "tool_result", tool_use_id: message.tool_call_id, content: message.content, is_error: message.is_error } as Block] };
    }
    return { message, blocks };
  });
  // Pair by explicit IDs, never adjacency: parallel calls can return out of order.
  const calls = new Set(normalized.flatMap(({ blocks }) => blocks.filter((b) => b.type === "tool_use").map(callId)).filter(Boolean));
  let toolCount = 0, errorCount = 0, thinkingCount = 0;
  normalized.forEach(({ blocks }, messageIndex) => {
    for (const block of blocks) {
      if (block.type === "tool_use") toolCount++;
      if (block.type === "thinking") thinkingCount++;
      if (block.type === "tool_result") {
        if (block.is_error === true) errorCount++;
        if (typeof block.tool_use_id === "string" && calls.has(block.tool_use_id)) {
          const list = results.get(block.tool_use_id) ?? [];
          list.push({ block, messageIndex });
          results.set(block.tool_use_id, list);
        }
      }
    }
  });
  const steps: Step[] = [];
  normalized.forEach(({ message, blocks }, messageIndex) => {
    const visible = blocks.filter((b) => !(b.type === "tool_result" && typeof b.tool_use_id === "string" && calls.has(b.tool_use_id)));
    if (blocks.length && !visible.length) return;
    const tools = visible.filter((b) => b.type === "tool_use");
    const text = visible.filter((b) => b.type === "text").sort((a, b) => blockText(b).length - blockText(a).length)[0];
    const heading = text && blockText(text).match(/^#{1,6}\s+(.+)$/m)?.[1];
    const title = tools.length
      ? tools.map((b) => typeof b.input === "object" && object(b.input) && typeof b.input.description === "string" ? b.input.description : pretty(b.name) || "Tool call").join(" · ")
      : text ? shortText(heading || blockText(text)) : visible.some((b) => b.type === "thinking") ? "Thinking" : "Message";
    const linked = tools.flatMap((b) => results.get(callId(b)) ?? []);
    steps.push({ id: `message-${messageIndex}`, messageIndex, role: message.role as string, blocks: visible, raw: message,
      title, search: [message.role, pretty(message), ...linked.map((r) => pretty(r.block))].join("\n").toLowerCase() });
  });
  const settings = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== "messages"));
  return { raw, model: typeof raw.model === "string" ? raw.model : "Model not specified", steps, results,
    messageCount: raw.messages.length, toolCount, errorCount, thinkingCount, settings };
}

// Original, synthetic example. Real trajectories are loaded only by the reader.
export const demoTrajectory = JSON.stringify({
  model: "Example agent",
  system: "Inspect the project, make the requested change, and verify the result.",
  messages: [
    { role: "user", content: [{ type: "text", text: "Add a friendly empty state to the project list. Keep it simple and accessible." }] },
    { role: "assistant", content: [
      { type: "thinking", thinking: "I’ll inspect the list component and its tests first, then add an empty state using the existing design conventions." },
      { type: "tool_use", id: "demo-read", name: "Read", input: { file_path: "src/ProjectList.tsx" } },
    ] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "demo-read", content: "export function ProjectList({ projects }) {\n  return <ul>{projects.map(project => <li key={project.id}>{project.name}</li>)}</ul>;\n}" }] },
    { role: "assistant", content: [
      { type: "text", text: "The list currently renders nothing when there are no projects. I’ll add a short explanation and a link to create the first project." },
      { type: "tool_use", id: "demo-edit", name: "Edit", input: { file_path: "src/ProjectList.tsx", new_string: 'if (!projects.length) {\n  return (\n    <section aria-label="No projects">\n      <h2>A fresh start</h2>\n      <p>Your projects will appear here.</p>\n      <a href="/projects/new">Create a project</a>\n    </section>\n  );\n}' } },
    ] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "demo-edit", content: "File updated." }] },
    { role: "assistant", content: [{ type: "tool_use", id: "demo-test", name: "Bash", input: { command: "npm test -- ProjectList", description: "Verify the project list" } }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "demo-test", content: "PASS  src/ProjectList.test.tsx\n  ✓ displays existing projects\n  ✓ shows a helpful empty state\n  ✓ links to project creation\n\nTests: 3 passed, 3 total", is_error: false }] },
    { role: "assistant", content: [{ type: "text", text: "Added a friendly empty state with a link to create a project. Existing project lists work as before. All three tests pass." }] },
  ], tools: [{ name: "Read", description: "Read a file." }, { name: "Edit", description: "Edit a file." }, { name: "Bash", description: "Run a shell command." }],
}, null, 2);
