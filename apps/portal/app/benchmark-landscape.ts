import { landscapeGroup, procurementGroup, sampleGroup, sampleCapability } from "./sample-classification";
import type { CatalogSnapshot, CatalogSubmission, CatalogTask, CatalogVendor } from "./catalog";

export type BenchmarkCategoryId =
  | "active-procurement"
  | "software-engineering"
  | "systems-infrastructure"
  | "tool-use"
  | "security"
  | "science-reasoning"
  | "specialized"
  | "other"
  | "benchmark-families"
  | "capability-only";

export type BenchmarkCategoryDefinition = {
  id: BenchmarkCategoryId;
  label: { en: string; zh: string };
  description: { en: string; zh: string };
};

export type HarborTaskContext = {
  task: CatalogTask;
  submission: CatalogSubmission;
  vendor: CatalogVendor;
};

export type BenchmarkGroup = {
  id: string;
  displayName: string;
  categoryId: BenchmarkCategoryId;
  taskCount: number;
  vendorCount: number;
  submissionCount: number;
  records: HarborTaskContext[];
  capabilityId?: string;
  capabilities?: Array<{ id: string; displayName: string; taskCount: number }>;
  inventoryDirectionId?: string;
  shortlist?: { vendorIds: readonly string[]; records: HarborTaskContext[]; vendorCount: number };
};

export type BenchmarkCategoryGroup = BenchmarkCategoryDefinition & {
  taskCount: number;
  benchmarkCount: number;
  groups: BenchmarkGroup[];
};

export type BenchmarkLandscape = {
  taskCount: number;
  benchmarkCount: number;
  vendorCount: number;
  groups: BenchmarkGroup[];
  categories: BenchmarkCategoryGroup[];
  capabilities: Array<{ id: string; displayName: string; taskCount: number }>;
};

export const benchmarkCategoryDefinitions: BenchmarkCategoryDefinition[] = [
  {
    id: "active-procurement",
    label: { en: "Under Active Procurement", zh: "采购进行中" },
    description: {
      en: "Benchmark directions currently under active procurement.",
      zh: "当前正在推进采购的基准方向。",
    },
  },
  {
    id: "software-engineering",
    label: { en: "Software engineering", zh: "软件工程" },
    description: {
      en: "Repository-scale coding, repair, codebase understanding, and implementation.",
      zh: "代码库级开发、修复、理解与实现任务。",
    },
  },
  {
    id: "systems-infrastructure",
    label: { en: "Systems & infrastructure", zh: "系统与基础设施" },
    description: {
      en: "Terminal work, SRE, databases, networks, ML systems, and long-running engineering.",
      zh: "终端、SRE、数据库、网络、机器学习系统及长时程工程任务。",
    },
  },
  {
    id: "tool-use",
    label: { en: "Tool use & knowledge work", zh: "工具使用与知识工作" },
    description: {
      en: "Browser, desktop, MCP, agent-skill, and professional workflow environments.",
      zh: "浏览器、桌面、MCP、智能体技能及专业工作流环境。",
    },
  },
  {
    id: "security",
    label: { en: "Cybersecurity", zh: "网络安全" },
    description: {
      en: "Exploit development, vulnerability discovery, and adversarial environments.",
      zh: "漏洞利用、漏洞发现及对抗性环境。",
    },
  },
  {
    id: "science-reasoning",
    label: { en: "Science & reasoning", zh: "科学与推理" },
    description: {
      en: "Mathematics, algorithms, molecular and STEM reasoning, and simulated worlds.",
      zh: "数学、算法、分子与 STEM 推理及模拟世界。",
    },
  },
  {
    id: "specialized",
    label: { en: "Specialized applications", zh: "专业应用" },
    description: {
      en: "Domain-specific creative, healthcare, and design environments.",
      zh: "面向创意、医疗和设计等专业领域的环境。",
    },
  },
  {
    id: "other",
    label: { en: "Other directions", zh: "其他方向" },
    description: {
      en: "New benchmark directions not yet placed in a broader portal group.",
      zh: "尚未归入更广泛门户分组的新基准方向。",
    },
  },
];

const benchmarkCategories: Partial<Record<string, BenchmarkCategoryId>> = Object.fromEntries([
  ...assign("active-procurement", ["terminal-bench-science", "terminal-bench-3-4", "deep-swe"]),
  ...assign("software-engineering", [
    "agentic-coding-benchmark",
    "autoresearch-kernel",
    "codebase-qa",
    "codebase-repair",
    "doc2repo",
    "frontier-cs",
    "frontier-swe",
    "long-horizon-coding",
    "program-bench",
    "smart-contract-coding",
    "swe",
    "swe-atlas",
    "swe-bench",
    "swe-marathon",
    "vision2web",
  ]),
  ...assign("systems-infrastructure", [
    "database-administration",
    "e-env-feature-engineering",
    "e-env-long-horizon-planning",
    "long-horizon-rl",
    "machine-learning-engineering",
    "network-engineering",
    "sre",
    "terminal-bench",
    "terminal-bench-2-1",
    "terminal-bench-3",
    "frontier-bench",
    "terminal-bench-4",
    "ultra-long-horizon",
  ]),
  ...assign("tool-use", [
    "agentic-skills-md",
    "android-mock-shopping",
    "browser-automation-crm",
    "browser-automation-ecommerce",
    "cowork",
    "des-t8",
    "gdpval-knowledge-work",
    "long-horizon-mcp",
    "toolathlon",
    "working-agent",
  ]),
  ...assign("security", ["cybersecurity", "cybergym", "rl-exploits"]),
  ...assign("science-reasoning", [
    "competitive-programming",
    "hillclimb",
    "mathematical-reasoning",
    "molecular-bench",
    "stem-rl-env",
    "worldsims",
  ]),
  ...assign("specialized", [
    "animation-bench",
    "cad-generation-and-understanding",
    "opendental-eob-posting",
  ]),
]);

export function benchmarkCategoryId(benchmarkId: string): BenchmarkCategoryId {
  return benchmarkCategories[benchmarkId] ?? "other";
}

// User-selected vendor offerings, confirmed 2026-09-07. This is a presentation
// shortlist, not a review result for every task or submission from these vendors.
const benchmarkShortlists: Partial<Record<string, readonly string[]>> = {
  "deep-swe": ["mercor", "unipat"],
};

export function benchmarkSampleCount(group: BenchmarkGroup): number {
  return group.shortlist?.records.length ?? group.taskCount;
}

export function buildBenchmarkLandscape(catalog: CatalogSnapshot, capabilityId?: string): BenchmarkLandscape {
  const allRecords = catalog.vendors.flatMap((vendor) => vendor.submissions.flatMap((submission) => submission.tasks
    .filter((task) => task.kind === "task" && task.format === "harbor")
    .map((task) => ({ task, submission, vendor }))));
  const capabilities = [...Map.groupBy(allRecords, (record) => sampleCapability(record.task).id)].map(([id, items]) => ({ id, displayName: sampleCapability(items[0]!.task).displayName, taskCount: items.length })).sort((a, b) => a.displayName.localeCompare(b.displayName));
  const records = capabilityId ? allRecords.filter((record) => sampleCapability(record.task).id === capabilityId) : allRecords;
  const recordsByBenchmark = new Map<string, HarborTaskContext[]>();
  for (const record of records) {
    const existing = recordsByBenchmark.get(landscapeGroup(record.task).id) ?? [];
    existing.push(record);
    recordsByBenchmark.set(landscapeGroup(record.task).id, existing);
  }

  const groups = [...recordsByBenchmark.entries()].map(([id, benchmarkRecords]): BenchmarkGroup => {
    const firstTask = benchmarkRecords[0]!.task;
    const identity = sampleGroup(firstTask);
    const classification = firstTask.classification;
    const procurement = procurementGroup(firstTask);
    const inventoryDirectionId = procurement?.id ?? (classification ? undefined : id);
    const vendorIds = benchmarkShortlists[inventoryDirectionId ?? id];
    const shortlistedRecords = vendorIds ? benchmarkRecords.filter((record) => vendorIds.includes(record.vendor.id)) : [];
    return {
      id,
      displayName: procurement?.displayName ?? identity.displayName,
      categoryId: procurement ? "active-procurement" : classification ? identity.family ? "benchmark-families" : "capability-only" : benchmarkCategoryId(id),
      capabilityId,
      inventoryDirectionId,
      capabilities: [...Map.groupBy(benchmarkRecords, (record) => sampleCapability(record.task).id)].map(([id, items]) => ({ id, displayName: sampleCapability(items[0]!.task).displayName, taskCount: items.length })).sort((a, b) => b.taskCount - a.taskCount || a.displayName.localeCompare(b.displayName)),
      taskCount: benchmarkRecords.length,
      vendorCount: new Set(benchmarkRecords.map((record) => record.vendor.id)).size,
      submissionCount: new Set(benchmarkRecords.map((record) => record.submission.id)).size,
      shortlist: vendorIds ? {
        vendorIds,
        records: shortlistedRecords,
        vendorCount: new Set(shortlistedRecords.map((record) => record.vendor.id)).size,
      } : undefined,
      records: benchmarkRecords.sort((left, right) => left.vendor.name.localeCompare(right.vendor.name)
        || right.submission.date.localeCompare(left.submission.date)
        || left.task.title.localeCompare(right.task.title)),
    };
  }).sort(compareBenchmarkGroups);

  const definitions: BenchmarkCategoryDefinition[] = [benchmarkCategoryDefinitions[0]!,
    { id: "benchmark-families", label: { en: "Benchmark families & versions", zh: "基准家族与版本" }, description: { en: "Separate groups for distinguishable versions. Families without a useful version split remain together.", zh: "可区分的版本分别分组；无法有效区分版本的基准按家族归组。" } },
    { id: "capability-only", label: { en: "Samples by capability", zh: "按能力归类的样本" }, description: { en: "Samples without established benchmark attribution, organized by their primary capability.", zh: "尚无明确基准归属的样本，按主要能力类别归组。" } },
    ...benchmarkCategoryDefinitions.slice(1),
  ];
  const categories = definitions.map((definition): BenchmarkCategoryGroup => {
    const categoryGroups = groups.filter((group) => group.categoryId === definition.id);
    return {
      ...definition,
      taskCount: categoryGroups.reduce((sum, group) => sum + benchmarkSampleCount(group), 0),
      benchmarkCount: categoryGroups.length,
      groups: categoryGroups,
    };
  }).filter((category) => category.benchmarkCount > 0);

  return {
    taskCount: records.length,
    benchmarkCount: groups.length,
    vendorCount: new Set(records.map((record) => record.vendor.id)).size,
    groups,
    categories,
    capabilities,
  };
}

function compareBenchmarkGroups(left: BenchmarkGroup, right: BenchmarkGroup): number {
  return right.taskCount - left.taskCount || left.displayName.localeCompare(right.displayName);
}

function assign(categoryId: BenchmarkCategoryId, benchmarkIds: string[]): Array<[string, BenchmarkCategoryId]> {
  return benchmarkIds.map((benchmarkId) => [benchmarkId, categoryId]);
}
