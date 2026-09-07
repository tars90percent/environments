"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { callId, contentBlocks, demoTrajectory, object, parseTrajectory, pretty, type Block, type Trajectory } from "./trajectory";
import "./viewer.css";

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    upload: <><path d="M12 16V3m-5 5 5-5 5 5" /><path d="M4 15v5h16v-5" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
    arrow: <path d="m9 5 7 7-7 7" />,
    code: <><path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18" /></>,
    tool: <><path d="m5 6 6 6-6 6m9 0h5" /></>,
    user: <><circle cx="12" cy="8" r="3" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
    assistant: <><path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6Z" /></>,
    system: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" /><circle cx="15" cy="17" r="2" /></>,
    file: <><path d="M14 3H5v18h14V8Zm0 0v5h5M8 13h8m-8 4h6" /></>,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    brain: <><path d="M9 4a3 3 0 0 0-5 3 4 4 0 0 0-1 7 4 4 0 0 0 6 5V4Zm6 0a3 3 0 0 1 5 3 4 4 0 0 1 1 7 4 4 0 0 1-6 5V4ZM5 10h4m6 4h4" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.file}</svg>;
}

function Copy({ value, label = "Copy" }: { value: string; label?: string }) {
  const [state, setState] = useState("");
  useEffect(() => { if (state) { const timer = setTimeout(() => setState(""), 1800); return () => clearTimeout(timer); } }, [state]);
  return <button className="tv-copy" onClick={async () => {
    try { await navigator.clipboard.writeText(value); setState("Copied"); }
    catch { setState("Copy unavailable"); }
  }} title={label} aria-label={state || label}><Icon name={state === "Copied" ? "check" : "copy"} size={14} /><span>{state || label}</span></button>;
}

function TextContent({ text, code = false }: { text: string; code?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 5000 || text.split("\n").length > 65;
  return <div className="tv-text-wrap">
    <pre className={`${code ? "tv-code" : "tv-prose"}${long && !expanded ? " tv-truncated" : ""}`}>{long && !expanded ? text.slice(0, 5000).split("\n").slice(0, 65).join("\n") : text || "(empty)"}</pre>
    {long && <button className="tv-expand" onClick={() => setExpanded(!expanded)}>{expanded ? "Show less" : `Show full content · ${text.length.toLocaleString()} characters`}<Icon name="arrow" size={12} /></button>}
  </div>;
}

function Content({ block }: { block: Block }) {
  if (block.type === "text") return <TextContent text={pretty(block.text)} />;
  // Retain unfamiliar/multimodal blocks without fetching URLs or executing markup.
  return <TextContent text={pretty(block)} code />;
}

function ToolCall({ block, trajectory }: { block: Block; trajectory: Trajectory }) {
  const results = trajectory.results.get(callId(block)) ?? [];
  const error = results.some((result) => result.block.is_error === true);
  const status = !results.length ? "No result" : error ? "Error" : "Returned";
  const input = block.input;
  const command = object(input) && typeof input.command === "string" ? input.command : null;
  const extras = command && object(input) ? Object.fromEntries(Object.entries(input).filter(([key]) => key !== "command" && key !== "description")) : null;
  return <section className={`tv-tool-card${error ? " tv-tool-error" : ""}`}>
    <header><span className="tv-tool-name"><Icon name="tool" />{pretty(block.name) || "Tool call"}</span><span className={`tv-status ${error ? "error" : results.length ? "returned" : "pending"}`}><i />{status}</span></header>
    <div className="tv-tool-input"><div className="tv-section-label"><span>{command ? "Command" : "Input"}</span><Copy value={pretty(input)} label="Copy input" /></div>
      <TextContent text={command ?? pretty(input)} code />
      {extras && Object.keys(extras).length > 0 && <details className="tv-extra"><summary>Other arguments</summary><TextContent text={pretty(extras)} code /></details>}
    </div>
    {results.map((result, i) => <div className="tv-tool-output" key={i}>
      <div className="tv-section-label"><span>Output <small>· message {result.messageIndex + 1}{result.block.is_error === true ? " · error" : ""}</small></span><Copy value={pretty(result.block.content)} label="Copy output" /></div>
      {contentBlocks(result.block.content).map((content, j) => <Content block={content} key={j} />)}
      {result.block.content == null && <span className="tv-muted">No output content supplied.</span>}
    </div>)}
    {!results.length && <div className="tv-tool-output tv-muted">This file does not include a matching result.</div>}
    {callId(block) && <footer title={callId(block)}>{callId(block)}</footer>}
  </section>;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="tv-dialog" onCancel={(event) => { event.preventDefault(); close(); }}>
    <header><h2>{title}</h2><button className="tv-icon-button" aria-label="Close dialog" onClick={close}><Icon name="close" /></button></header>{children}
  </dialog>;
}

export default function TrajectoryViewer() {
  const [trajectory, setTrajectory] = useState<Trajectory | null>(null);
  const [filename, setFilename] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [showSystem, setShowSystem] = useState(false);
  const [view, setView] = useState("read");
  const [modal, setModal] = useState<"paste" | "metadata" | null>(null);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const loadVersion = useRef(0);
  const detailRef = useRef<HTMLDivElement>(null);
  const visible = useMemo(() => trajectory?.steps.filter((step) =>
    (showSystem || (step.role !== "system" && step.role !== "developer")) &&
    (role === "all" || (role === "tools" ? step.blocks.some((b) => b.type === "tool_use" || b.type === "tool_result") : step.role === role)) &&
    (!query.trim() || step.search.includes(query.trim().toLowerCase()))) ?? [], [trajectory, showSystem, role, query]);
  const selected = visible.find((step) => step.id === selectedId) ?? visible[0];
  const currentIndex = selected ? visible.indexOf(selected) : -1;
  const systemCount = trajectory?.steps.filter((step) => step.role === "system" || step.role === "developer").length ?? 0;

  function load(text: string, name: string) {
    try {
      const parsed = parseTrajectory(text);
      setTrajectory(parsed); setFilename(name); setSelectedId(""); setQuery(""); setRole("all"); setView("read");
      setShowSystem(parsed.steps.length > 0 && parsed.steps.every((step) => step.role === "system" || step.role === "developer"));
      setError(""); setModal(null); setPasted("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not read this trajectory."); }
  }

  async function openFile(file?: File) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { setError("Choose a file smaller than 50 MB."); return; }
    const version = ++loadVersion.current;
    setLoading(true);
    try { const text = await file.text(); if (version === loadVersion.current) load(text, file.name); }
    catch { setError("Could not open this file. Try selecting it again."); }
    finally { if (version === loadVersion.current) setLoading(false); }
  }

  useEffect(() => { detailRef.current?.scrollTo({ top: 0 }); }, [selected?.id, view]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (modal || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)))) return;
      if (event.key === "/") { event.preventDefault(); searchRef.current?.focus(); }
      if (["ArrowDown", "j", "ArrowUp", "k"].includes(event.key) && visible.length) {
        event.preventDefault(); const next = Math.max(0, Math.min(visible.length - 1, currentIndex + (["j", "ArrowDown"].includes(event.key) ? 1 : -1)));
        setSelectedId(visible[next].id);
        document.getElementById(`outline-${visible[next].id}`)?.scrollIntoView({ block: "nearest" });
      }
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [visible, currentIndex, modal]);

  return <div className="tv-app" lang="en" onDragOver={(event) => { event.preventDefault(); if (event.dataTransfer.types.includes("Files")) setDragging(true); }}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
    onDrop={(event) => { event.preventDefault(); setDragging(false); void openFile(event.dataTransfer.files[0]); }}>
    <input ref={fileRef} type="file" accept=".json,.txt,application/json,text/plain" hidden aria-label="Open trajectory file" onChange={(event) => { void openFile(event.target.files?.[0]); event.target.value = ""; }} />
    <header className="tv-header"><a href="/trajectories" className="tv-brand"><span className="tv-brand-symbol"><i /><i /><i /></span>Trajectory<span className="tv-brand-sub">viewer</span></a>
      <div className="tv-header-actions"><span className="tv-local"><i />Local to your browser</span><button className="tv-button" onClick={() => { setError(""); setModal("paste"); }}><Icon name="code" size={15} />Paste JSON</button><button className="tv-button tv-primary" disabled={loading} onClick={() => fileRef.current?.click()}><Icon name="upload" size={15} />{loading ? "Opening…" : "Open file"}</button></div>
    </header>
    {error && modal !== "paste" && <div className="tv-error-banner" role="alert">{error}<button className="tv-icon-button" aria-label="Dismiss error" onClick={() => setError("")}><Icon name="close" size={14} /></button></div>}
    {!trajectory ? <main className="tv-welcome">
      <div className="tv-welcome-inner"><div className="tv-kicker">FROM PROMPT TO RESULT</div><h1>Every step.<br /><span>A clearer picture.</span></h1><p>A quiet place to read an agent’s work.<br />Follow its thinking, inspect tool calls, and see what came back.</p>
        <button className="tv-dropzone" onClick={() => fileRef.current?.click()}><span className="tv-upload-icon"><Icon name="upload" size={23} /></span><strong>Drop a trajectory here</strong><span>or click to choose a JSON file</span><small>Messages, thinking, and tool results · up to 50 MB</small></button>
        <div className="tv-example">Just looking around? <button onClick={() => load(demoTrajectory, "example-trajectory.json")}>Explore an example <Icon name="arrow" size={12} /></button></div>
      </div><div className="tv-welcome-foot"><span>01 &nbsp; Follow the conversation</span><span>02 &nbsp; Inspect each tool call</span><span>03 &nbsp; Keep the full context</span></div>
    </main> : <>
      <section className="tv-run-header"><div><div className="tv-kicker">{filename === "example-trajectory.json" ? "SYNTHETIC EXAMPLE" : "AGENT TRAJECTORY"}</div><h1>{filename}</h1><p><span className="tv-model">{trajectory.model}</span><span>{trajectory.messageCount} messages</span><span>{trajectory.toolCount} tool calls</span><span>{trajectory.thinkingCount} thinking blocks</span>{trajectory.errorCount > 0 && <span className="tv-error-text">{trajectory.errorCount} tool {trajectory.errorCount === 1 ? "error" : "errors"}</span>}</p></div><button className="tv-button" onClick={() => setModal("metadata")}><Icon name="system" size={15} />Request details</button></section>
      <div className="tv-workspace"><aside className="tv-sidebar" aria-label="Trajectory outline">
        <div className="tv-outline-header"><span>OUTLINE</span><span>{visible.length} steps</span></div>
        <label className="tv-search"><Icon name="search" size={16} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search trajectory…" aria-label="Search trajectory" /><kbd>/</kbd></label>
        <div className="tv-filters">{[["all", "All"], ["assistant", "Agent"], ["user", "User"], ["tools", "Tools"]].map(([value, label]) => <button key={value} aria-pressed={role === value} className={role === value ? "active" : ""} onClick={() => setRole(value)}>{label}</button>)}</div>
        {systemCount > 0 && <label className="tv-system-toggle"><input type="checkbox" checked={showSystem} onChange={(event) => setShowSystem(event.target.checked)} />Show system messages<span>{systemCount}</span></label>}
        <nav className="tv-outline-list" aria-label="Steps">{visible.map((step, i) => {
          const hasTools = step.blocks.some((b) => b.type === "tool_use");
          const errors = step.blocks.some((b) => b.type === "tool_result" ? b.is_error === true : (trajectory.results.get(callId(b)) ?? []).some((r) => r.block.is_error === true));
          return <button id={`outline-${step.id}`} key={step.id} className={`tv-outline-item ${selected?.id === step.id ? "selected" : ""}`} aria-current={selected?.id === step.id ? "step" : undefined} onClick={() => setSelectedId(step.id)}>
            <span className="tv-step-index">{String(i + 1).padStart(2, "0")}</span><span className="tv-outline-body"><span className="tv-outline-role"><Icon name={hasTools ? "tool" : step.role} size={13} />{step.role === "assistant" ? "Agent" : step.role}<span className="tv-outline-msg">m{step.messageIndex + 1}</span>{errors && <i className="tv-error-dot" title="Tool error" />}</span><span className="tv-outline-title">{step.title || "Empty message"}</span></span>
          </button>;
        })}{!visible.length && <div className="tv-no-matches">No matching steps.<button onClick={() => { setRole("all"); setQuery(""); setShowSystem(true); }}>Clear filters</button></div>}</nav>
        <footer className="tv-sidebar-footer"><span><kbd>↑</kbd> <kbd>↓</kbd> to navigate</span><span>Results paired by ID</span></footer>
      </aside>
      <section className="tv-detail" aria-label="Selected step">
        <header className="tv-detail-toolbar"><div className="tv-view-toggle"><button className={view === "read" ? "active" : ""} aria-pressed={view === "read"} onClick={() => setView("read")}>Read</button><button className={view === "raw" ? "active" : ""} aria-pressed={view === "raw"} onClick={() => setView("raw")}>Raw message</button></div><div className="tv-step-nav"><span>{currentIndex + 1} / {visible.length}</span><button className="tv-icon-button tv-prev" aria-label="Previous step" disabled={currentIndex <= 0} onClick={() => setSelectedId(visible[currentIndex - 1].id)}><Icon name="arrow" size={14} /></button><button className="tv-icon-button" aria-label="Next step" disabled={currentIndex >= visible.length - 1} onClick={() => setSelectedId(visible[currentIndex + 1].id)}><Icon name="arrow" size={14} /></button></div></header>
        <div className="tv-detail-scroll" ref={detailRef}>{selected ? <article className="tv-message" key={`${filename}-${selected.id}-${view}`}>
          <header className="tv-message-header"><span className={`tv-role-icon ${selected.role}`}><Icon name={selected.role} size={20} /></span><div><h2>{selected.role === "assistant" ? "Agent" : selected.role.charAt(0).toUpperCase() + selected.role.slice(1)}</h2><p>Message {selected.messageIndex + 1}<span>·</span>{selected.blocks.length} content {selected.blocks.length === 1 ? "block" : "blocks"}</p></div><Copy value={pretty(selected.raw)} label="Copy message" /></header>
          {view === "raw" ? <TextContent text={pretty(selected.raw)} code /> : <div className="tv-blocks">{selected.blocks.map((block, i) => {
            if (block.type === "tool_use") return <ToolCall block={block} trajectory={trajectory} key={i} />;
            if (block.type === "thinking") return <details className="tv-thinking" key={i}><summary><Icon name="brain" size={16} /><strong>Thinking</strong><span>{pretty(block.thinking).length.toLocaleString()} characters</span><Icon name="arrow" size={13} /></summary><div><Copy value={pretty(block.thinking)} label="Copy thinking" /><TextContent text={pretty(block.thinking)} /></div></details>;
            if (block.type === "tool_result") return <section className="tv-tool-card" key={i}><header><strong>Unmatched tool result</strong><span className="tv-status">{block.is_error === true ? "Error" : "No matching call"}</span></header><div className="tv-tool-output"><TextContent text={pretty(block)} code /></div></section>;
            return <div className="tv-content" key={i}>{block.type !== "text" && <div className="tv-section-label">{block.type} block</div>}<Content block={block} /></div>;
          })}{!selected.blocks.length && <p className="tv-muted">This message has no content blocks. See Raw message for the original record.</p>}</div>}
          {currentIndex < visible.length - 1 && <button className="tv-next-step" onClick={() => setSelectedId(visible[currentIndex + 1].id)}><span>Next step<strong>{visible[currentIndex + 1].title}</strong></span><Icon name="arrow" /></button>}
        </article> : <div className="tv-detail-empty"><Icon name="search" size={26} /><h2>{trajectory.messageCount ? "No matching steps" : "An empty trajectory"}</h2><p>{trajectory.messageCount ? "Try a different search or include system messages." : "This file has no messages. Request details are still available."}</p></div>}</div>
      </section></div>
    </>}
    {dragging && <div className="tv-drag-overlay"><Icon name="upload" size={36} /><h2>Drop to open trajectory</h2><p>The file stays in your browser.</p></div>}
    {modal === "paste" && <Modal title="Paste a trajectory" close={() => { setModal(null); setError(""); }}><p className="tv-modal-intro">Paste the complete JSON object containing the messages array.</p><textarea className="tv-paste" value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder={'{\n  "model": "…",\n  "messages": […]\n}'} aria-label="Trajectory JSON" spellCheck={false} />{error && <p className="tv-paste-error" role="alert">{error}</p>}<footer><span>Processed locally. Never uploaded.</span><button className="tv-button tv-primary" disabled={!pasted.trim()} onClick={() => load(pasted, "pasted-trajectory.json")}>Open trajectory<Icon name="arrow" size={14} /></button></footer></Modal>}
    {modal === "metadata" && trajectory && <Modal title="Request details" close={() => setModal(null)}><p className="tv-modal-intro">Original request fields, including system context, tool definitions, and model settings.</p><div className="tv-metadata">{Object.entries(trajectory.settings).map(([key, value]) => <details key={key}><summary><span>{key}</span><small>{Array.isArray(value) ? `${value.length} items` : object(value) ? `${Object.keys(value).length} fields` : pretty(value).slice(0, 55)}</small><Icon name="arrow" size={13} /></summary><div><Copy value={pretty(value)} /><TextContent text={pretty(value)} code /></div></details>)}{!Object.keys(trajectory.settings).length && <p className="tv-muted">This file contains no request metadata.</p>}</div></Modal>}
  </div>;
}
