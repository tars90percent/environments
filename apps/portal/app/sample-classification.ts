import type { CatalogTask } from "./catalog";

/** Family/version identity never depends on vendor, delivery, interface or capability. */
export function sampleGroup(task: CatalogTask): { id: string; displayName: string; family?: string; version?: string | null } {
  const classification = task.classification;
  if (!classification) return task.benchmark;
  const group = classification.benchmarkGroup;
  if (!group) return { id: `capability:${classification.capability.id}`, displayName: classification.capability.displayName };
  const version = group.version ?? (group.family === "Terminal-Bench" ? "Unversioned" : null);
  return { id: `benchmark:${group.id}`, displayName: version ? `${group.family} · ${version}` : group.family, family: group.family, version: group.version };
}

export function sampleCapability(task: CatalogTask) {
  return task.classification?.capability ?? { id: "unspecified", displayName: "Unclassified", description: "Awaiting classification review." };
}

const capabilityChinese: Record<string, string> = {
  "Software Engineering": "软件工程",
  "Systems & Infrastructure": "系统与基础设施",
  "Cybersecurity": "网络安全",
  "Machine Learning Engineering": "机器学习工程",
  "Data Engineering & Analytics": "数据工程与分析",
  "Scientific & Engineering Analysis": "科学与工程分析",
  "Clinical Reasoning": "临床推理",
  "Mathematics & Algorithms": "数学与算法",
  "Business & Professional Workflows": "商业与专业工作流",
  "Research & Information Synthesis": "研究与信息综合",
  "Design & Creative Production": "设计与创意制作",
  "Multimodal Understanding": "多模态理解",
  "Language & Instruction Following": "语言与指令遵循",
  "Planning & Strategic Decision-Making": "规划与战略决策",
  "Unclassified": "待分类",
};

export function capabilityLabel(displayName: string, language: "en" | "zh"): string {
  return language === "zh" ? capabilityChinese[displayName] ?? displayName : displayName;
}
