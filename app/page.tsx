"use client";

import { useMemo, useState } from "react";

type Tab = "vendors" | "checks" | "criteria";

type Category = {
  name: string;
  count: number;
  description: string;
  examples: string[];
};

type Delta = {
  retained?: number;
  added: number;
  removed: number;
  changedFiles?: number;
  note: string;
};

type Batch = {
  id: string;
  date: string;
  label: string;
  source: string;
  taskCount: number;
  formats: string[];
  delta: Delta;
  inventory: string[];
  categories: Category[];
};

type Vendor = {
  id: string;
  name: string;
  short: string;
  description: string;
  batches: Batch[];
};

const vendors: Vendor[] = [
  {
    id: "deeptune",
    name: "Deeptune",
    short: "DT",
    description: "Coding-agent environment samples delivered across three workspace snapshots.",
    batches: [
      {
        id: "deeptune-2026-07-29",
        date: "2026-07-29",
        label: "Long-horizon revision B",
        source: "deeptune-minimax-long-horizon-new",
        taskCount: 16,
        formats: ["Harbor"],
        delta: { retained: 12, added: 4, removed: 5, changedFiles: 31, note: "Compared with the July 28 snapshot. Twelve task directories remain; package files changed within the retained set." },
        inventory: ["16 task.toml", "16 instructions", "16 Dockerfiles", "16 gold solutions", "16 test scripts", "16 vendor-registry image references"],
        categories: [
          { name: "Protocols & codecs", count: 8, description: "Binary formats, network protocols, and serialization behavior.", examples: ["BGP communities codec", "VXLAN / GPE codec", "CBOR datetime encoding"] },
          { name: "Scientific & planning", count: 4, description: "Numerical, simulation, calendar, and planning environments.", examples: ["SVAR impulse response", "Wildfire containment", "Bearing envelope spectrum"] },
          { name: "Systems & security", count: 4, description: "Build systems, consensus, privacy tooling, and exploit construction.", examples: ["BuildKit frontend", "PBFT checkpointing", "Stack-pivot chain"] },
        ],
      },
      {
        id: "deeptune-2026-07-28",
        date: "2026-07-28",
        label: "Long-horizon revision A",
        source: "deeptune-minimax-long-horizon",
        taskCount: 17,
        formats: ["Harbor"],
        delta: { retained: 0, added: 17, removed: 20, note: "A new cohort rather than an edit of the July 24 set: no task directory names are shared." },
        inventory: ["17 task.toml", "17 instructions", "17 Dockerfiles", "17 gold solutions", "17 test scripts", "17 vendor-registry image references"],
        categories: [
          { name: "Protocols & codecs", count: 10, description: "Network protocols, binary formats, and compatibility behavior.", examples: ["HPACK codec", "HDLC framing", "Profinet DCP"] },
          { name: "Scientific & planning", count: 4, description: "Numerical, planning, calendar, and scheduling environments.", examples: ["Pipedream scheduling", "Monetary-policy IRF", "Thai solar eras"] },
          { name: "Data & infrastructure", count: 3, description: "Schema behavior, data privacy, and build/test infrastructure.", examples: ["Deflaker classifier", "JSON schema datetime", "Anonymizer remapping"] },
        ],
      },
      {
        id: "deeptune-2026-07-24",
        date: "2026-07-24",
        label: "Mixed coding sample",
        source: "deeptune-minimax-coding-main",
        taskCount: 20,
        formats: ["Harbor"],
        delta: { added: 20, removed: 0, note: "First Deeptune submission snapshot present in this workspace." },
        inventory: ["20 task.toml", "20 instructions", "20 Dockerfiles", "20 gold solutions", "20 test scripts", "20 vendor-registry image references"],
        categories: [
          { name: "Security & exploitation", count: 7, description: "Heap, VM, codec, image-format, and cryptanalysis tasks.", examples: ["Heap exploitation", "OpenEXR decoding", "ZipCrypto recovery"] },
          { name: "Systems & infrastructure", count: 5, description: "Consensus, build, cloud, and database migration tasks.", examples: ["ZAB follower sync", "Kubernetes hardening", "Postgres FTS migration"] },
          { name: "Optimization & planning", count: 5, description: "Operations-research, simulation, and numerical tasks.", examples: ["Runway sequencing", "Wildfire suppression", "Mie scattering"] },
          { name: "ML & data", count: 3, description: "Retrieval, WebDataset, and analytical query tasks.", examples: ["Dual encoder", "Shard resampling", "Distinct aggregation"] },
        ],
      },
    ],
  },
  {
    id: "scaler",
    name: "Scaler AI Labs",
    short: "SL",
    description: "A single broad submission organized into eleven top-level task families.",
    batches: [{
      id: "scaler-2026-07-28", date: "2026-07-28", label: "Multi-domain sample", source: "scaler_ai_labs_samples", taskCount: 108, formats: ["Harbor"],
      delta: { added: 108, removed: 0, note: "First Scaler AI Labs submission snapshot present in this workspace." },
      inventory: ["108 task.toml", "108 instructions", "11 category directories", "Task-local and nested environment assets", "Solution and verifier assets present across categories"],
      categories: [
        { name: "Mathematical Reasoning", count: 15, description: "Mathematical problem-solving environments.", examples: ["Reasoning tasks"] },
        { name: "Agentic Skills MD", count: 10, description: "Tasks involving operational skill instructions and repositories.", examples: ["Data intake", "Devtools build", "SRE hardening"] },
        { name: "Competitive Programming", count: 10, description: "Algorithmic programming tasks.", examples: ["Sequence counting", "Graph and game tasks"] },
        { name: "Cybersecurity", count: 10, description: "Security analysis and remediation tasks.", examples: ["Security tasks"] },
        { name: "Long Horizon", count: 10, description: "Long-running repository and system tasks.", examples: ["Long-horizon tasks"] },
        { name: "Network Engineering", count: 10, description: "Network configuration and diagnosis tasks.", examples: ["Network tasks"] },
        { name: "SRE", count: 10, description: "Reliability, incident, and operational tasks.", examples: ["Dependency isolation", "Runbook correction"] },
        { name: "SWE", count: 10, description: "Software engineering repository tasks.", examples: ["Feature and repair tasks"] },
        { name: "DB Administration", count: 9, description: "Database operation and administration tasks.", examples: ["Database tasks"] },
        { name: "ML Engineering", count: 9, description: "Machine-learning infrastructure tasks.", examples: ["ML engineering tasks"] },
        { name: "Ultra Long Horizon", count: 5, description: "The longest-horizon task family in the submission.", examples: ["Ultra-long tasks"] },
      ],
    }],
  },
  {
    id: "prime",
    name: "Prime Intellect",
    short: "PI",
    description: "Portable Harbor samples spanning browser use, terminal work, and code repair.",
    batches: [{
      id: "prime-2026-07-21", date: "2026-07-21", label: "Portable environment samples", source: "prime_intellect_samples", taskCount: 70, formats: ["Harbor"],
      delta: { added: 70, removed: 0, note: "First Prime Intellect submission snapshot present in this workspace." },
      inventory: ["70 task.toml", "70 instructions", "70 gold solution scripts", "70 test scripts", "40 task-local Dockerfiles", "1 shared simulator environment for 30 browser tasks"],
      categories: [
        { name: "Computer use", count: 30, description: "Browser tasks against packaged website simulations.", examples: ["Commerce workflows", "Multi-page synthesis", "Repository browsing"] },
        { name: "Terminal tasks", count: 30, description: "Self-contained terminal tasks with public Docker builds and pytest verifiers.", examples: ["Service repair", "Planning", "Release operations"] },
        { name: "SWE code repair", count: 10, description: "Code-repair tasks across three source packages.", examples: ["Khal", "Marshmallow", "Sigal"] },
      ],
    }],
  },
  {
    id: "collinear",
    name: "Collinear",
    short: "CL",
    description: "A curated delivery package with five materially different task structures.",
    batches: [{
      id: "collinear-2026-07-24", date: "2026-07-24", label: "Long-horizon curated delivery", source: "collinear-long-horizon", taskCount: 23, formats: ["Harbor", "Golden output"],
      delta: { added: 23, removed: 0, note: "First Collinear submission snapshot present in this workspace." },
      inventory: ["23 task.toml", "23 verifier scripts", "21 solution scripts", "2 golden deliverables", "22 Dockerfiles", "Finance tasks use Dockerfile additions instead of a complete base definition"],
      categories: [
        { name: "ML engineering", count: 6, description: "Training and data-pipeline diagnosis and repair.", examples: ["RLVR incidents", "RAG repair", "Weak supervision"] },
        { name: "Cybersecurity", count: 5, description: "Audit-and-patch tasks with seeded vulnerabilities.", examples: ["Java audit", "Rust audit"] },
        { name: "Multi-PR SWE", count: 5, description: "Staged feature work across multiple pull-request phases.", examples: ["Rust library stages", "Python proxy work"] },
        { name: "Zero-to-one coding", count: 5, description: "Build-from-scratch language and algorithm tasks.", examples: ["Priority queue", "B+ tree", "Floating-point conversion"] },
        { name: "Finance", count: 2, description: "Document deliverables graded by weighted rubrics.", examples: ["Financial workbook", "Earnings release"] },
      ],
    }],
  },
  {
    id: "edotenv",
    name: "EdotEnv",
    short: "EE",
    description: "Two non-coding research environments packaged as Harbor tasks.",
    batches: [{
      id: "edotenv-2026-08-11", date: "2026-08-11", label: "External v1 sample", source: "edotenv_samples", taskCount: 2, formats: ["Harbor"],
      delta: { added: 2, removed: 0, note: "First EdotEnv submission snapshot present in this workspace." },
      inventory: ["2 task.toml", "2 instructions", "2 gold solution scripts", "2 test scripts", "Separate agent and verifier environment definitions"],
      categories: [
        { name: "Feature engineering", count: 1, description: "Model construction under a submitted-estimator contract.", examples: ["Feature engineering"] },
        { name: "Long-horizon planning", count: 1, description: "Portfolio planning with replay-based verification.", examples: ["Portfolio planning"] },
      ],
    }],
  },
  {
    id: "physera",
    name: "Physera",
    short: "PH",
    description: "Animation Bench tasks with reference media and evaluated model outputs.",
    batches: [{
      id: "physera-2026-07-27", date: "2026-07-27", label: "Animation Bench sample", source: "sample_animation_tasks", taskCount: 3, formats: ["Harbor", "Media references"],
      delta: { added: 3, removed: 0, note: "First Physera sample snapshot present in this workspace." },
      inventory: ["3 task.toml", "3 instructions", "3 Dockerfiles", "3 test scripts", "Reference screenshots and animations", "Evaluated outputs for four model families"],
      categories: [
        { name: "Frontend animation", count: 3, description: "Reproduction of interactive web animation and transitions.", examples: ["Canvas carousel", "Tablet transition", "Menu hover"] },
      ],
    }],
  },
];

const criteria = [
  ["Comparable trajectories", "At least four complete trajectories per task from M3 and four from the declared frontier reference system, with model and harness metadata."],
  ["Reward baselines", "Repeated gold runs return 1 and repeated untouched runs return 0."],
  ["Public rebuild", "The Dockerfile rebuilds without a private base image or inaccessible dependency."],
  ["Gold solution", "A gold solution or task-appropriate golden deliverable is included."],
  ["Container-local execution", "Solution and test scripts run inside the environment without undeclared host data or variables."],
  ["Declared evaluation settings", "Pass-rate and turn-count targets are recorded before evaluation."],
  ["Portable format", "Harbor is preferred. Other formats remain visible when their source structure and mapping status are documented."],
];

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("vendors");
  const [selectedVendorId, setSelectedVendorId] = useState("deeptune");
  const [query, setQuery] = useState("");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set(["deeptune-2026-07-29"]));

  const matchingVendors = useMemo(() => vendors.filter((vendor) => {
    const haystack = [vendor.name, vendor.description, ...vendor.batches.flatMap((batch) => [batch.label, batch.source, ...batch.categories.map((category) => category.name)])].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [query]);

  const selectedVendor = vendors.find((vendor) => vendor.id === selectedVendorId) ?? vendors[0];
  const vendorTaskRecords = selectedVendor.batches.reduce((sum, batch) => sum + batch.taskCount, 0);
  const totalBatches = vendors.reduce((sum, vendor) => sum + vendor.batches.length, 0);
  const totalTaskRecords = vendors.reduce((sum, vendor) => sum + vendor.batches.reduce((batchSum, batch) => batchSum + batch.taskCount, 0), 0);

  function selectVendor(vendorId: string) {
    const vendor = vendors.find((item) => item.id === vendorId);
    setSelectedVendorId(vendorId);
    setTab("vendors");
    if (vendor?.batches[0]) setExpandedBatches(new Set([vendor.batches[0].id]));
  }

  function toggleBatch(batchId: string) {
    setExpandedBatches((current) => {
      const next = new Set(current);
      if (next.has(batchId)) next.delete(batchId); else next.add(batchId);
      return next;
    });
  }

  return (
    <div className="app-shell">
      <div className="demo-notice">Prototype registry · workspace-derived submission metadata · vendor source packages remain read-only</div>
      <header className="global-header">
        <a className="wordmark" href="#top" onClick={() => setTab("vendors")}><span>小</span><strong>小环境</strong></a>
        <label className="global-search"><span aria-hidden="true">⌕</span><input aria-label="Search vendors, batches, and categories" onChange={(event) => setQuery(event.target.value)} placeholder="Search vendors, batches, and categories" value={query} /></label>
        <nav aria-label="Global navigation"><button onClick={() => setTab("criteria")} type="button">Criteria</button><span className="avatar" aria-label="Researcher profile">R</span></nav>
      </header>

      <main id="top">
        <section className="registry-header">
          <div><p className="eyebrow">RL ENVIRONMENT SUBMISSIONS</p><h1>Vendor sample registry</h1><p>Append-only records of who submitted what, when, and in which package shape.</p></div>
          <div className="registry-stats"><span><strong>{vendors.length}</strong> vendors</span><span><strong>{totalBatches}</strong> batches</span><span><strong>{totalTaskRecords}</strong> task records</span></div>
          <nav className="repo-tabs" aria-label="Registry sections">
            {(["vendors", "checks", "criteria"] as Tab[]).map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)} type="button">{item[0].toUpperCase() + item.slice(1)}{item === "vendors" && <span>{vendors.length}</span>}</button>)}
          </nav>
        </section>

        <div className="page-body">
          {tab === "vendors" && <div className="portal-grid">
            <aside className="vendor-sidebar" aria-label="Vendors">
              <div className="sidebar-head"><strong>Vendors</strong><span>{matchingVendors.length}</span></div>
              <div className="vendor-list">
                {matchingVendors.map((vendor) => {
                  const records = vendor.batches.reduce((sum, batch) => sum + batch.taskCount, 0);
                  return <button className={selectedVendor.id === vendor.id ? "active" : ""} key={vendor.id} onClick={() => selectVendor(vendor.id)} type="button"><span className="vendor-mark">{vendor.short}</span><span><strong>{vendor.name}</strong><small>{plural(vendor.batches.length, "batch", "batches")} · {records} records</small></span></button>;
                })}
                {matchingVendors.length === 0 && <div className="sidebar-empty">No matching vendors</div>}
              </div>
            </aside>

            <section className="vendor-main" aria-labelledby="vendor-name">
              <header className="vendor-profile">
                <span className="vendor-mark large">{selectedVendor.short}</span>
                <div><div className="vendor-kicker">Vendor</div><h2 id="vendor-name">{selectedVendor.name}</h2><p>{selectedVendor.description}</p><div className="vendor-meta"><span>{plural(selectedVendor.batches.length, "submission batch", "submission batches")}</span><span>{vendorTaskRecords} task records retained</span><span>{selectedVendor.batches.at(-1)?.date} — {selectedVendor.batches[0]?.date}</span></div></div>
              </header>

              <section className="submission-history" aria-labelledby="history-title">
                <div className="section-title"><div><h3 id="history-title">Submission history</h3><p>Every observed batch remains separate. Deltas describe package changes, not research quality.</p></div><span>Newest first</span></div>

                <div className="batch-list">
                  {selectedVendor.batches.map((batch, index) => <BatchCard batch={batch} isExpanded={expandedBatches.has(batch.id)} isLatest={index === 0} key={batch.id} onToggle={() => toggleBatch(batch.id)} />)}
                </div>
              </section>
            </section>
          </div>}

          {tab === "checks" && <ChecksView />}
          {tab === "criteria" && <CriteriaView />}
        </div>
      </main>
    </div>
  );
}

function BatchCard({ batch, isExpanded, isLatest, onToggle }: { batch: Batch; isExpanded: boolean; isLatest: boolean; onToggle: () => void }) {
  return <article className="batch-card">
    <button aria-expanded={isExpanded} className="batch-summary" onClick={onToggle} type="button">
      <span className="batch-date"><strong>{batch.date}</strong>{isLatest && <small>Latest snapshot</small>}</span>
      <span className="batch-name"><strong>{batch.label}</strong><code>{batch.source}</code></span>
      <span className="batch-count"><strong>{batch.taskCount}</strong><small>task records</small></span>
      <span className="format-stack">{batch.formats.map((format) => <i key={format}>{format}</i>)}</span>
      <span className="disclosure">{isExpanded ? "−" : "+"}</span>
    </button>

    {isExpanded && <div className="batch-body">
      <div className="delta-block">
        <div className="delta-grid">
          {batch.delta.retained !== undefined && <span><strong>{batch.delta.retained}</strong><small>retained</small></span>}
          <span><strong>{batch.delta.added}</strong><small>added</small></span>
          <span><strong>{batch.delta.removed}</strong><small>removed</small></span>
          {batch.delta.changedFiles !== undefined && <span><strong>{batch.delta.changedFiles}</strong><small>files differ</small></span>}
        </div>
        <p>{batch.delta.note}</p>
      </div>

      <div className="batch-section-head"><h4>Task categories</h4><span>{plural(batch.categories.length, "category", "categories")}</span></div>
      <div className="category-table">
        {batch.categories.map((category) => <div key={category.name}><span className="category-count">{category.count}</span><span><strong>{category.name}</strong><small>{category.description}</small></span><span className="example-list">{category.examples.map((example) => <i key={example}>{example}</i>)}</span></div>)}
      </div>

    </div>}
  </article>;
}

function ChecksView() {
  const rows = vendors.flatMap((vendor) => vendor.batches.map((batch) => ({ vendor: vendor.name, batch })));
  return <section aria-labelledby="checks-title">
    <div className="content-title"><div><p className="eyebrow">SUBMISSION INVENTORY</p><h2 id="checks-title">Recorded package evidence</h2><p>These are observed package facts only. No quality or acceptance verdict is attached.</p></div><code>workspace snapshot · 2026-08-12</code></div>
    <div className="checks-card batch-index">
      <div className="checks-row checks-head"><span>Vendor</span><span>Batch</span><span>Tasks</span><span>Formats</span><span>Observed inventory</span></div>
      {rows.map(({ vendor, batch }) => <div className="checks-row" key={batch.id}><strong>{vendor}</strong><span><b>{batch.date}</b><small>{batch.label}</small></span><span>{batch.taskCount}</span><span className="format-stack">{batch.formats.map((format) => <i key={format}>{format}</i>)}</span><span>{batch.inventory.slice(0, 3).join(" · ")}</span></div>)}
    </div>
  </section>;
}

function CriteriaView() {
  return <section aria-labelledby="criteria-title">
    <div className="content-title"><div><p className="eyebrow">CURRENT INTAKE CONTRACT</p><h2 id="criteria-title">Documented criteria</h2><p>Only the conditions currently specified for environment and task intake are listed here.</p></div><span className="criteria-count">7 criteria</span></div>
    <div className="criteria-layout">
      <ol className="criteria-list">{criteria.map(([title, text], index) => <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol>
      <aside className="criteria-aside"><strong>Interpretation boundary</strong><p>A record says what was delivered, what changed, and which deterministic checks have evidence.</p><p>It does not say whether a task is difficult, novel, useful, well-designed, or worth purchasing. Researchers make those judgments.</p></aside>
    </div>
  </section>;
}
