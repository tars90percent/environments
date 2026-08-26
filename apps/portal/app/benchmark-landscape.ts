import type { CatalogSnapshot, CatalogSubmission, CatalogTask, CatalogVendor } from "./catalog";

export type BenchmarkCategoryId =
  | "software-engineering"
  | "systems-infrastructure"
  | "tool-use"
  | "security"
  | "science-reasoning"
  | "specialized"
  | "other";

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
};

export const benchmarkCategoryDefinitions: BenchmarkCategoryDefinition[] = [
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
  ...assign("software-engineering", [
    "agentic-coding-benchmark",
    "autoresearch-kernel",
    "codebase-qa",
    "codebase-repair",
    "deep-swe",
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

export function buildBenchmarkLandscape(catalog: CatalogSnapshot): BenchmarkLandscape {
  const records = catalog.vendors.flatMap((vendor) => vendor.submissions.flatMap((submission) => submission.tasks
    .filter((task) => task.kind === "task" && task.format === "harbor")
    .map((task) => ({ task, submission, vendor }))));
  const recordsByBenchmark = new Map<string, HarborTaskContext[]>();
  for (const record of records) {
    const existing = recordsByBenchmark.get(record.task.benchmark.id) ?? [];
    existing.push(record);
    recordsByBenchmark.set(record.task.benchmark.id, existing);
  }

  const groups = [...recordsByBenchmark.entries()].map(([id, benchmarkRecords]): BenchmarkGroup => ({
    id,
    displayName: benchmarkRecords[0]?.task.benchmark.displayName ?? id,
    categoryId: benchmarkCategoryId(id),
    taskCount: benchmarkRecords.length,
    vendorCount: new Set(benchmarkRecords.map((record) => record.vendor.id)).size,
    submissionCount: new Set(benchmarkRecords.map((record) => record.submission.id)).size,
    records: benchmarkRecords.sort((left, right) => left.vendor.name.localeCompare(right.vendor.name)
      || right.submission.date.localeCompare(left.submission.date)
      || left.task.title.localeCompare(right.task.title)),
  })).sort(compareBenchmarkGroups);

  const categories = benchmarkCategoryDefinitions.map((definition): BenchmarkCategoryGroup => {
    const categoryGroups = groups.filter((group) => group.categoryId === definition.id);
    return {
      ...definition,
      taskCount: categoryGroups.reduce((sum, group) => sum + group.taskCount, 0),
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
  };
}

function compareBenchmarkGroups(left: BenchmarkGroup, right: BenchmarkGroup): number {
  return right.taskCount - left.taskCount || left.displayName.localeCompare(right.displayName);
}

function assign(categoryId: BenchmarkCategoryId, benchmarkIds: string[]): Array<[string, BenchmarkCategoryId]> {
  return benchmarkIds.map((benchmarkId) => [benchmarkId, categoryId]);
}
