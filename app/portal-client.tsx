"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import type { CatalogBatch, CatalogProcurementSummary, CatalogResearchDemand, CatalogSnapshot, CatalogSourceEvent, CatalogSourceItem, CatalogTask, CatalogVendor, LocalizedCatalogText, SourceFetchStatus, SourceParseStatus, SubmissionReview, SubmissionReviewScope, SubmissionReviewSignal, WorkflowStatus } from "./catalog";

type Language = "zh" | "en";

export type PortalUser = {
  name: string;
  avatarUrl?: string;
};

const copy = {
  zh: {
    vendors: "供应商",
    search: "搜索供应商、提交记录、类别和任务",
    language: "EN",
    languageLabel: "切换至英文",
    accountLabel: "研究员账户",
    signOut: "退出登录",
    title: "环境与任务样本",
    stats: { vendors: "家供应商", submissions: "次提交", tasks: "个任务" },
    vendor: "供应商",
    submission: "次提交",
    submissions: "次提交",
    taskRecords: "条任务记录",
    sampleFiles: "个样本文件",
    declaredTasks: "个申报任务",
    noSamples: "尚无样本",
    noSubmissions: "CASE 尚未记录这家供应商的样本提交。原始联系与来源历史仍由 CASE 保留。",
    history: "提交记录",
    historyNote: "每次收到的交付，或 CASE 对持续维护来源进行的定期记录，都会作为一条带日期的提交记录保留。差异只描述内容变化，不代表研究质量。",
    newest: "最新在前",
    latest: "最新提交",
    taskCategories: "任务类别",
    category: "个类别",
    categories: "个类别",
    noTasks: "任务记录尚未标准化",
    originalSources: "原始来源",
    sourceNote: "保留实时链接，并在 CASE 已抓取时同时保留当时的副本。",
    sourceRecord: "条来源记录",
    sourceRecords: "条来源记录",
    noSource: "尚未关联原始来源",
    legacySource: "这条提交记录早于来源级接收流程，原始消息、链接和文件尚未挂接。",
    noLinks: "没有记录关联文件或链接。",
    senderUnknown: "未记录发送人",
    openOriginal: "打开原始记录",
    messageSnapshot: "下载消息快照",
    viewSource: "打开实时来源",
    downloadSnapshot: "下载留存副本",
    dataset: {
      title: "任务数据集",
      note: "下载此提交中所有可用的精确任务包，包括待核验和需要修复的任务。压缩包内附任务状态、核验记录和内容哈希。",
      packages: "个任务包",
      withChecks: "个已有核验记录",
      missing: "个尚无精确任务包",
      download: "下载完整数据集",
      empty: "当前没有可下载的标准化任务包。",
      taskDownload: "下载任务包",
    },
    mutable: "可变来源",
    captured: "抓取于",
    procurement: {
      evidence: "查看依据",
      updated: "更新于",
      recordedBy: "记录人",
      retrospective: "追溯补录",
      linkedSource: "条关联依据",
      linkedSources: "条关联依据",
      noLinkedSources: "未关联原始依据",
      approx: "约",
      stage: {
        commercial: "商务进展",
        negotiating: "商务洽谈中",
        authorized: "采购已授权",
        contracted: "已签约",
        ordered: "已下单",
        delivering: "交付中",
        delivered: "已交付",
        accepted: "已验收",
        paid: "已付款",
        closed: "未采购",
      },
      commitment: {
        none: "尚未形成采购决定",
        authorized: "已有采购授权",
        contracted: "已有合同承诺",
        ordered: "已有采购订单",
        unknown: "采购承诺状态未记录",
      },
    },
    contactedVendors: "已联系，尚无样本",
    contactedNote: "默认收起，避免干扰样本浏览。",
    upload: {
      action: "上传样本",
      title: "上传研究样本",
      note: "文件将直接保存到 CASE 的不可变对象存储，并登记为一条待核验的提交记录。",
      vendor: "关联供应商",
      label: "提交名称",
      category: "样本类别",
      file: "样本文件",
      comment: "给 CASE 的说明",
      commentPlaceholder: "这份样本来自哪里、希望 CASE 重点检查什么？",
      chooseFile: "选择一个文件或压缩包（最大 250 MB）",
      submit: "保存到 CASE",
      hashing: "正在校验文件…",
      uploading: "正在上传并登记…",
      saved: "样本已保存，CASE 可以开始整理与核验。",
      error: "暂时无法保存这份样本。",
      close: "关闭",
      required: "请填写所有必填项并选择文件。",
    },
    response: {
      title: "研究反馈",
      note: "反馈以本次提交为单位保存。若意见只针对部分任务类别，可以缩小范围。",
      interested: "有意采购完整数据集",
      needsRevision: "修改后再看",
      notInterested: "不感兴趣",
      commentOnly: "仅留言",
      wholeSubmission: "整次提交",
      selectedCategories: "指定任务类别",
      chooseCategories: "选择适用的任务类别",
      commentLabel: "说明",
      commentOptional: "表达采购兴趣时可选；其他反馈需要说明。",
      commentPlaceholder: "哪些地方有价值、缺少什么，或供应商需要修改什么？",
      submit: "提交反馈",
      submitting: "正在提交…",
      saved: "反馈已保存。",
      history: "已有反馈",
      none: "尚无研究员反馈",
      loadError: "暂时无法载入反馈。",
      submitError: "暂时无法保存反馈。",
      categoryRequired: "请至少选择一个任务类别。",
      commentRequired: "请补充说明。",
      scopedTo: "适用于",
      signals: { interested: "有意采购", needs_revision: "需要修改", not_interested: "不感兴趣", comment: "留言" },
    },
    delta: { retained: "保留", added: "新增", removed: "移除", changedFiles: "文件变化" },
    searchEmpty: { eyebrow: "搜索", title: "没有匹配的样本", body: "请尝试供应商、提交记录、类别或任务名称。" },
    loading: { eyebrow: "CASE 目录", title: "正在载入样本库…", body: "正在从 CASE 获取最新的供应商、提交记录、任务与核验记录。" },
    unavailable: { eyebrow: "CASE 目录", title: "样本库暂不可用", fallback: "暂时无法载入共享目录。", tail: "小环境不会展示缓存的供应商数据，因为它不是事实来源。" },
    checks: {
      none: "没有已记录的核验结果",
      pass: "通过",
      fail: "失败",
      blocked: "受阻",
      notRun: "未运行",
    },
    findings: {
      title: "记录发现",
      resolution: "处理结果",
      recordedBy: "记录人",
      taskVersion: "任务版本",
      evidence: "条核验证据",
      kind: {
        observed_fact: "观察事实",
        vendor_claim: "供应商陈述",
        deterministic_result: "确定性结果",
        heuristic_assessment: "启发式评估",
        human_judgment: "人工判断",
        binding_term: "约束条款",
      },
    },
    status: {
      unchecked: "未核验",
      received: "已接收",
      normalizing: "标准化中",
      checking: "核验中",
      needs_vendor_fix: "待供应商修复",
      ready_for_research: "可供研究",
      superseded: "已被替代",
      quarantined: "已隔离",
    },
    fetch: {
      not_requested: "未抓取",
      queued: "等待抓取",
      fetching: "抓取中",
      snapshotted: "快照已保存",
      external_only: "仅外部链接",
      blocked: "抓取受阻",
      failed: "抓取失败",
    },
    parse: {
      not_requested: "未解析",
      queued: "等待解析",
      parsing: "解析中",
      parsed: "已解析",
      partial: "部分解析",
      blocked: "解析受阻",
      failed: "解析失败",
    },
    role: { primary: "主要提交", supplement: "补充提交", correction: "修订", metadata: "元数据", other: "其他" },
  },
  en: {
    vendors: "Vendors",
    search: "Search vendors, submissions, categories, and tasks",
    language: "中",
    languageLabel: "Switch to Chinese",
    accountLabel: "Researcher account",
    signOut: "Sign out",
    title: "Environment & Task Samples",
    stats: { vendors: "vendors", submissions: "submissions", tasks: "tasks" },
    vendor: "Vendor",
    submission: "submission",
    submissions: "submissions",
    taskRecords: "task records",
    sampleFiles: "sample files",
    declaredTasks: "declared tasks",
    noSamples: "no samples yet",
    noSubmissions: "CASE has not recorded a sample submission from this vendor yet. Its contact and source history is still retained by CASE.",
    history: "Submission history",
    historyNote: "Each delivery—or dated observation CASE makes of a continuously maintained source—is retained as a submission record. Deltas describe content changes, never research quality.",
    newest: "Newest first",
    latest: "Latest submission",
    taskCategories: "Task categories",
    category: "category",
    categories: "categories",
    noTasks: "Task records not yet normalized",
    originalSources: "Original sources",
    sourceNote: "Live links are preserved alongside CASE's captured copies when available.",
    sourceRecord: "source record",
    sourceRecords: "source records",
    noSource: "No original source linked yet",
    legacySource: "This submission predates source-level intake. Its original message, links, and files have not yet been attached.",
    noLinks: "No linked files or URLs recorded.",
    senderUnknown: "Sender not recorded",
    openOriginal: "Open original record",
    messageSnapshot: "Download message snapshot",
    viewSource: "Open live source",
    downloadSnapshot: "Download captured copy",
    dataset: {
      title: "Task dataset",
      note: "Download every exact task package available for this submission, including tasks still checking or needing fixes. Status, check records, and content hashes are included inside.",
      packages: "task packages",
      withChecks: "with recorded checks",
      missing: "without an exact package",
      download: "Download complete dataset",
      empty: "No normalized task packages are currently available to download.",
      taskDownload: "Download task package",
    },
    mutable: "mutable source",
    captured: "captured",
    procurement: {
      evidence: "View evidence",
      updated: "Updated",
      recordedBy: "Recorded by",
      retrospective: "Retrospective entry",
      linkedSource: "linked source",
      linkedSources: "linked sources",
      noLinkedSources: "No original evidence linked",
      approx: "Approx.",
      stage: {
        commercial: "Commercial activity",
        negotiating: "Negotiating",
        authorized: "Purchase authorized",
        contracted: "Contracted",
        ordered: "Ordered",
        delivering: "Delivering",
        delivered: "Delivered",
        accepted: "Accepted",
        paid: "Paid",
        closed: "Closed without purchase",
      },
      commitment: {
        none: "No purchase decision",
        authorized: "Purchase authorized",
        contracted: "Contractual commitment",
        ordered: "Purchase order recorded",
        unknown: "Commitment status not recorded",
      },
    },
    contactedVendors: "Contacted, no samples yet",
    contactedNote: "Collapsed by default to keep sample browsing focused.",
    upload: {
      action: "Upload sample",
      title: "Upload a research sample",
      note: "The file will be preserved in CASE's immutable object store and registered as an unchecked submission.",
      vendor: "Associated vendor",
      label: "Submission name",
      category: "Sample category",
      file: "Sample file",
      comment: "Note for CASE",
      commentPlaceholder: "Where did this sample come from, and what should CASE inspect?",
      chooseFile: "Choose one file or archive (250 MB maximum)",
      submit: "Save to CASE",
      hashing: "Verifying file…",
      uploading: "Uploading and registering…",
      saved: "The sample is preserved. CASE can now normalize and evaluate it.",
      error: "This sample could not be saved right now.",
      close: "Close",
      required: "Complete the required fields and choose a file.",
    },
    response: {
      title: "Researcher response",
      note: "Responses are recorded at the submission level. Narrow the scope only when your feedback applies to particular task categories.",
      interested: "Interested in the full set",
      needsRevision: "Revisit after changes",
      notInterested: "Not interested",
      commentOnly: "Comment only",
      wholeSubmission: "Entire submission",
      selectedCategories: "Selected task categories",
      chooseCategories: "Choose the categories this applies to",
      commentLabel: "Comment",
      commentOptional: "Optional when signaling interest; required for every other response.",
      commentPlaceholder: "What is valuable, what is missing, or what should the vendor change?",
      submit: "Submit response",
      submitting: "Submitting…",
      saved: "Response saved.",
      history: "Recorded responses",
      none: "No researcher responses yet",
      loadError: "Responses could not be loaded right now.",
      submitError: "Your response could not be saved right now.",
      categoryRequired: "Select at least one task category.",
      commentRequired: "Add a comment for this response.",
      scopedTo: "Applies to",
      signals: { interested: "Interested", needs_revision: "Needs revision", not_interested: "Not interested", comment: "Comment" },
    },
    delta: { retained: "retained", added: "added", removed: "removed", changedFiles: "files differ" },
    searchEmpty: { eyebrow: "SEARCH", title: "No matching samples", body: "Try a vendor, submission, category, or task name." },
    loading: { eyebrow: "CASE CATALOG", title: "Loading registry…", body: "Fetching the current vendor, submission, task, and check records from CASE." },
    unavailable: { eyebrow: "CASE CATALOG", title: "Registry unavailable", fallback: "The shared catalog could not be loaded.", tail: "No cached vendor data is shown because 小环境 is not a source of truth." },
    checks: {
      none: "No check results recorded",
      pass: "pass",
      fail: "fail",
      blocked: "blocked",
      notRun: "not run",
    },
    findings: {
      title: "Recorded findings",
      resolution: "Resolution",
      recordedBy: "Recorded by",
      taskVersion: "Task version",
      evidence: "check evidence records",
      kind: {
        observed_fact: "Observed fact",
        vendor_claim: "Vendor claim",
        deterministic_result: "Deterministic result",
        heuristic_assessment: "Heuristic assessment",
        human_judgment: "Human judgment",
        binding_term: "Binding term",
      },
    },
    status: {
      unchecked: "Unchecked",
      received: "Received",
      normalizing: "Normalizing",
      checking: "Checking",
      needs_vendor_fix: "Needs vendor fix",
      ready_for_research: "Ready for research",
      superseded: "Superseded",
      quarantined: "Quarantined",
    },
    fetch: {
      not_requested: "Not fetched",
      queued: "Fetch queued",
      fetching: "Fetching",
      snapshotted: "Snapshot saved",
      external_only: "External link",
      blocked: "Fetch blocked",
      failed: "Fetch failed",
    },
    parse: {
      not_requested: "Not parsed",
      queued: "Parse queued",
      parsing: "Parsing",
      parsed: "Parsed",
      partial: "Partly parsed",
      blocked: "Parse blocked",
      failed: "Parse failed",
    },
    role: { primary: "Primary", supplement: "Supplement", correction: "Correction", metadata: "Metadata", other: "Other" },
  },
};

type UiCopy = (typeof copy)[Language];

type MarketView = "supply" | "demand";
type DemandItem = CatalogResearchDemand & {
  checked: boolean;
};

const localized = (en: string, zh: string): LocalizedCatalogText => ({ en, zh });

const demandMatrixSource = {
  sourceLabel: localized("Data Procurement Wiki — demand matrix", "《数据采购》Wiki — 需求矩阵"),
  sourceDate: "2026-08-14",
  sourceUrl: "https://vrfi1sk8a0.feishu.cn/wiki/Fii7wKxOKipox3kYrfVcuCSonrJ",
};

const tarsSampleRequirementSource = {
  sourceLabel: localized("TARS sample requirement", "TARS 样本需求"),
  sourceDate: "2026-08-12",
  sourceUrl: "https://applink.feishu.cn/client/chat/open?openChatId=oc_4e735446cffdf7e72eecbcdf0b3f2856&position=4",
};

const demandPreview: DemandItem[] = [
  {
    id: "long-horizon-greenfield-coding",
    domain: localized("Software engineering", "软件工程"),
    subdomain: localized("Greenfield development", "从零开发"),
    title: localized("Long-horizon 0→1 greenfield development", "长程 0→1 从零开发"),
    note: localized("Create a large project from scratch from a product requirement. ProgramBench and NL2Repo are references, and at least 100 model steps are requested.", "根据产品需求从零创建大型项目。参考 ProgramBench 和 NL2Repo，并要求至少 100 个模型步骤。"),
    ...tarsSampleRequirementSource,
    checked: false,
  },
  {
    id: "long-horizon-feature-development",
    domain: localized("Software engineering", "软件工程"),
    subdomain: localized("Existing codebases", "现有代码库"),
    title: localized("Long-horizon feature development", "长程功能开发"),
    note: localized("Develop a substantial feature within an existing codebase; DeepSWE and EvoCode are reference task families.", "在现有代码库中完成大型功能开发；参考 DeepSWE 和 EvoCode 任务族。"),
    ...demandMatrixSource,
    checked: false,
  },
  {
    id: "repository-aligned-code-quality",
    domain: localized("Software engineering", "软件工程"),
    subdomain: localized("Code quality", "代码质量"),
    title: localized("Code changes that match the repository", "符合代码库风格的改动"),
    note: localized("Produce verifiable changes consistent with the repository's existing developer style and conventions; FrontierCode is the reference.", "产出可验证、且符合代码库既有开发者风格与约定的改动；参考 FrontierCode。"),
    ...demandMatrixSource,
    checked: false,
  },
  {
    id: "difficult-standard-bugfix",
    domain: localized("Software engineering", "软件工程"),
    subdomain: localized("Bug fixing", "缺陷修复"),
    title: localized("Difficult ordinary bug fixes", "高难度常规缺陷修复"),
    note: localized("Normal bug-fix tasks that a strong frontier model completes inconsistently and M3 does not; difficulty must come from the task rather than broken infrastructure.", "强前沿模型也只能不稳定完成、而 M3 无法完成的正常缺陷修复任务；难度必须来自任务本身，而非损坏的基础设施。"),
    ...demandMatrixSource,
    checked: false,
  },
  {
    id: "cuda-optimization",
    domain: localized("ML & systems engineering", "机器学习与系统工程"),
    subdomain: localized("CUDA optimization", "CUDA 优化"),
    title: localized("CUDA optimization environments", "CUDA 优化环境"),
    note: localized("Optimization work represented by KernelBench and FlashInferBench; the source marks this need as urgent.", "以 KernelBench 和 FlashInferBench 为代表的优化任务；来源将该需求标为紧急。"),
    ...demandMatrixSource,
    checked: false,
  },
  {
    id: "ml-research-environments",
    domain: localized("ML & systems engineering", "机器学习与系统工程"),
    subdomain: localized("ML research", "机器学习研究"),
    title: localized("ML research environments", "机器学习研究环境"),
    note: localized("Research tasks similar to MLE Bench, PostTrainBench, MLS Bench, ExpBench, AutoLab, InferenceBench, and SWE-Marathon.", "类似 MLE Bench、PostTrainBench、MLS Bench、ExpBench、AutoLab、InferenceBench 和 SWE-Marathon 的研究任务。"),
    ...tarsSampleRequirementSource,
    checked: false,
  },
  {
    id: "ml-inference-engineering",
    domain: localized("ML & systems engineering", "机器学习与系统工程"),
    subdomain: localized("ML engineering", "机器学习工程"),
    title: localized("ML and inference engineering", "机器学习与推理工程"),
    note: localized("Inspectable environments for infrastructure debugging, vLLM inference, and related ML engineering work; no single benchmark is yet designated.", "用于基础设施调试、vLLM 推理及相关机器学习工程工作的可检查环境；目前尚未指定单一 benchmark。"),
    ...tarsSampleRequirementSource,
    checked: false,
  },
  {
    id: "general-systems-optimization",
    domain: localized("ML & systems engineering", "机器学习与系统工程"),
    subdomain: localized("Systems optimization", "系统优化"),
    title: localized("General systems optimization", "通用系统优化"),
    note: localized("Optimization tasks represented by FrontierSWE, SWEfficiency, GSO Bench, and FrontierCS.", "以 FrontierSWE、SWEfficiency、GSO Bench 和 FrontierCS 为代表的优化任务。"),
    ...demandMatrixSource,
    checked: false,
  },
  {
    id: "paper-reproduction",
    domain: localized("ML & systems engineering", "机器学习与系统工程"),
    subdomain: localized("Paper reproduction", "论文复现"),
    title: localized("Paper reproduction tasks", "论文复现任务"),
    note: localized("Reproduce research results in inspectable environments; PaperBench and NatureBench are references, including non-ML papers.", "在可检查环境中复现研究结果；参考 PaperBench 和 NatureBench，也包括非机器学习论文。"),
    ...demandMatrixSource,
    checked: false,
  },
  {
    id: "terminal-tool-use",
    domain: localized("Tool use", "工具使用"),
    subdomain: localized("Terminal workflows", "终端工作流"),
    title: localized("Terminal and tool-use tasks", "终端与工具使用任务"),
    note: localized("The demand matrix tracks terminal-benchmark and tool-use tasks and notes that one batch has already been purchased; the next increment still needs researcher confirmation.", "需求矩阵记录了终端 benchmark 与工具使用任务，并注明已采购过一批；下一批具体需求仍需研究员确认。"),
    ...demandMatrixSource,
    checked: false,
  },
  {
    id: "cybersecurity-environments-trajectories",
    domain: localized("Cybersecurity", "网络安全"),
    subdomain: localized("Security environments", "安全环境"),
    title: localized("Cybersecurity environments and trajectories", "网络安全环境与轨迹"),
    note: localized("High-quality security tasks with environments and verifiers, plus cyber trajectories; demos are required for inspection.", "带环境和 verifier 的高质量安全任务，以及网络安全轨迹；需要提供 demo 供审查。"),
    ...demandMatrixSource,
    checked: false,
  },
  {
    id: "finance-work-scenarios",
    domain: localized("Finance", "金融"),
    subdomain: localized("Professional work", "专业工作"),
    title: localized("Difficult finance work scenarios", "高难度金融工作场景"),
    note: localized("High-quality, correct, comparatively difficult tasks grounded in realistic finance work.", "以真实金融工作为基础、质量高、答案正确且难度较大的任务。"),
    ...demandMatrixSource,
    checked: false,
  },
  {
    id: "computer-use-office-workflows",
    domain: localized("Computer use", "计算机操作"),
    subdomain: localized("Office workflows", "办公工作流"),
    title: localized("Computer-use and Office workflows", "计算机操作与办公工作流"),
    note: localized("RL tasks and trajectories in professional software, including domain documents such as finance or legal work and educational presentations.", "专业软件中的 RL 任务与轨迹，包括金融、法律等领域文档以及教学类演示文稿。"),
    ...demandMatrixSource,
    checked: false,
  },
  {
    id: "wide-time-sensitive-search",
    domain: localized("Information work", "信息检索"),
    subdomain: localized("Search", "搜索"),
    title: localized("Wide and time-sensitive search", "广度搜索与时效搜索"),
    note: localized("Query-and-answer tasks for wide research and time-sensitive search; WideSearch and SealQA are the named references.", "面向广度研究和时效搜索的问答任务；指定参考为 WideSearch 和 SealQA。"),
    ...demandMatrixSource,
    checked: false,
  },
];

const marketCopy = {
  zh: {
    marketNav: "市场视图",
    nav: { supply: "市场供给", demand: "研究需求" },
    demandSearch: "搜索研究需求",
    demandTitle: "研究需求",
    demandSubtitle: "先按任务领域、子领域和一般任务类型记录研究需求；需求更明确时，再逐步细分。",
    preview: "本地概念预览",
    previewNote: "以下只是用于评审这个简单清单的示例，并非 CASE 中的实时需求。",
    baselineTitle: "所有任务类型的基础要求",
    baselineNote: "这些是最低验收条件，不是研究需求分类。具体模型、工具链和目标范围应随每项需求记录。",
    baselineDifficulty: "非平凡难度 / 通过率",
    baselineDifficultyNote: "对当前目标模型具有足够挑战性；具体通过率目标由当时的研究需求决定。",
    baselineReliability: "环境可靠性与规范性",
    baselineReliabilityNote: "可运行、可重建、自包含且评分可信；不得依赖隐藏私有资源、密钥或损坏的 grader。",
    boardTitle: "当前需要的任务类型",
    boardNote: "以下条目均对应已注明日期的研究需求来源；证据变化时再更新清单。",
    source: "来源",
    complete: "标记完成",
    reopen: "重新打开",
    empty: "没有匹配的研究需求。",
    loading: { eyebrow: "CASE 需求", title: "正在载入研究需求…", body: "正在从 CASE 获取最新的任务类型需求。" },
    unavailable: { eyebrow: "CASE 需求", title: "研究需求暂不可用", body: "暂时无法载入 CASE 中的研究需求；小环境不会展示缓存副本。" },
  },
  en: {
    marketNav: "Market view",
    nav: { supply: "Market supply", demand: "Research demand" },
    demandSearch: "Search research demands",
    demandTitle: "Research demand",
    demandSubtitle: "Track demand first by domain, subdomain, and general task type; split it further as the research need becomes more specific.",
    preview: "Local concept preview",
    previewNote: "These are illustrative items for reviewing the simple checklist. They are not live CASE records.",
    baselineTitle: "Baseline for every task type",
    baselineNote: "These are acceptance conditions, not research-demand categories. The exact model, harness, and target range belong with each sourced demand.",
    baselineDifficulty: "Non-trivial difficulty / pass rate",
    baselineDifficultyNote: "Challenging enough for the current target model; the precise pass-rate target follows the active research requirement.",
    baselineReliability: "Environment reliability & hygiene",
    baselineReliabilityNote: "Runnable, rebuildable, self-contained, and trustworthy to score—without hidden private resources, secrets, or broken graders.",
    boardTitle: "Task types in demand",
    boardNote: "Each item is tied to a dated research-demand source; update the checklist when that evidence changes.",
    source: "Source",
    complete: "Complete",
    reopen: "Reopen",
    empty: "No research demands match this search.",
    loading: { eyebrow: "CASE DEMAND", title: "Loading research demand…", body: "Fetching the latest task-type demand from CASE." },
    unavailable: { eyebrow: "CASE DEMAND", title: "Research demand is unavailable", body: "The demand catalog cannot be loaded from CASE right now; the portal will not show a cached copy." },
  },
} as const;

export default function PortalClient({ user, initialView = "supply", localPreview = false }: { user: PortalUser; initialView?: MarketView; localPreview?: boolean }) {
  const [catalog, setCatalog] = useState<CatalogSnapshot | null>(null);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [unavailableReason, setUnavailableReason] = useState<string>();
  const [activeView, setActiveView] = useState<MarketView>(initialView);
  const [demands, setDemands] = useState<DemandItem[]>(localPreview ? demandPreview : []);
  const [language, setLanguage] = useState<Language>("zh");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [query, setQuery] = useState("");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const vendors = useMemo(() => catalog?.vendors ?? [], [catalog]);
  const sampledVendors = useMemo(() => vendors.filter((vendor) => vendor.batches.length > 0), [vendors]);
  const contactedVendors = useMemo(() => vendors.filter((vendor) => vendor.batches.length === 0), [vendors]);
  const logicalTaskCount = useMemo(() => vendors.reduce((sum, vendor) =>
    sum + logicalTaskCountForVendor(vendor), 0), [vendors]);
  const t = copy[language];

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  useEffect(() => {
    if (localPreview) return;
    let active = true;
    void fetch("/api/catalog", { headers: { accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 503 ? "CASE catalog connection is not configured." : `CASE catalog returned ${response.status}.`);
        return await response.json() as CatalogSnapshot;
      })
      .then((snapshot) => {
        if (!active) return;
        setCatalog(snapshot);
        setDemands(snapshot.demands.map((demand) => ({ ...demand, checked: false })));
        setSelectedVendorId((current) => snapshot.vendors.some((vendor) => vendor.id === current)
          ? current
          : snapshot.vendors.find((vendor) => vendor.batches.length > 0)?.id ?? snapshot.vendors[0]?.id ?? "");
        setExpandedBatches(new Set());
        setCatalogState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setUnavailableReason(error instanceof Error ? error.message : "CASE catalog is temporarily unavailable.");
        setCatalogState("unavailable");
      });
    return () => { active = false; };
  }, [catalogRevision, localPreview]);

  const matchingSampledVendors = useMemo(() => sampledVendors.filter((vendor) => vendorMatches(vendor, query)), [query, sampledVendors]);
  const matchingContactedVendors = useMemo(() => contactedVendors.filter((vendor) => vendorMatches(vendor, query)), [query, contactedVendors]);
  const matchingVendors = [...matchingSampledVendors, ...matchingContactedVendors];

  const selectedVendor = query
    ? matchingVendors.find((vendor) => vendor.id === selectedVendorId) ?? matchingVendors[0]
    : vendors.find((vendor) => vendor.id === selectedVendorId) ?? vendors[0];

  function selectVendor(vendor: CatalogVendor) {
    setSelectedVendorId(vendor.id);
    setExpandedBatches(new Set());
  }

  function toggleBatch(batchId: string) {
    setExpandedBatches((current) => {
      const next = new Set(current);
      if (next.has(batchId)) next.delete(batchId); else next.add(batchId);
      return next;
    });
  }

  function toggleLanguage() {
    const next = language === "zh" ? "en" : "zh";
    setLanguage(next);
  }

  return <div className={`app-shell app-shell-${activeView}`}>
    <header className="global-header">
      <a aria-label="小环境" className="wordmark" href="#top"><Image alt="" height={40} priority src="/favicon.png" width={40} /></a>
      <nav aria-label={marketCopy[language].marketNav} className="market-switch">
        <button aria-pressed={activeView === "supply"} className={activeView === "supply" ? "active" : ""} onClick={() => { setActiveView("supply"); setQuery(""); }} type="button">{marketCopy[language].nav.supply}</button>
        <button aria-pressed={activeView === "demand"} className={activeView === "demand" ? "active" : ""} onClick={() => { setActiveView("demand"); setQuery(""); }} type="button">{marketCopy[language].nav.demand}</button>
      </nav>
      <div className="header-tools">
        <label className="global-search"><span aria-hidden="true">⌕</span><input aria-label={activeView === "supply" ? t.search : marketCopy[language].demandSearch} onChange={(event) => setQuery(event.target.value)} placeholder={activeView === "supply" ? t.search : marketCopy[language].demandSearch} value={query} /></label>
        {activeView === "supply" && <button className="upload-trigger" onClick={() => setUploadOpen(true)} type="button">{t.upload.action}</button>}
        <button aria-label={t.languageLabel} className="language-switch" onClick={toggleLanguage} type="button">{t.language}</button>
        <details className="account-menu">
          <summary aria-label={t.accountLabel} className="avatar">
            {user.avatarUrl ? <Image alt="" height={38} src={user.avatarUrl} unoptimized width={38} /> : user.name.slice(0, 1).toUpperCase()}
          </summary>
          <div className="account-popover"><strong>{user.name}</strong><a href="/auth/logout">{t.signOut}</a></div>
        </details>
      </div>
    </header>

    <main id="top">
      {activeView === "supply" ? <section className="registry-header">
          <h1>{t.title}</h1>
          <div className="registry-stats">
            <span><strong>{catalog ? sampledVendors.length : "—"}</strong>{t.stats.vendors}</span>
            <span><strong>{catalog?.totals.batches ?? "—"}</strong>{t.stats.submissions}</span>
            <span><strong>{catalog ? logicalTaskCount : "—"}</strong>{t.stats.tasks}</span>
          </div>
        </section> : <DemandHero language={language} />}

      <div className="page-body">
        {activeView === "demand" && (localPreview || catalogState === "ready") && <DemandBoard demands={demands} language={language} localPreview={localPreview} onToggleDemand={(id) => setDemands((current) => current.map((demand) => demand.id === id ? { ...demand, checked: !demand.checked } : demand))} query={query} />}
        {activeView === "demand" && !localPreview && catalogState === "loading" && <StateCard value={marketCopy[language].loading} />}
        {activeView === "demand" && !localPreview && catalogState === "unavailable" && <StateCard value={marketCopy[language].unavailable} />}
        {activeView === "supply" && catalogState === "loading" && <StateCard value={t.loading} />}
        {activeView === "supply" && catalogState === "unavailable" && <StateCard value={{ ...t.unavailable, body: `${unavailableReason ?? t.unavailable.fallback} ${t.unavailable.tail}` }} />}
        {activeView === "supply" && catalogState === "ready" && selectedVendor && <VendorView matchingSampledVendors={matchingSampledVendors} matchingContactedVendors={matchingContactedVendors} query={query} selectedVendor={selectedVendor} expandedBatches={expandedBatches} onSelect={selectVendor} onToggleBatch={toggleBatch} t={t} language={language} />}
        {activeView === "supply" && catalogState === "ready" && !selectedVendor && <StateCard value={t.searchEmpty} />}
      </div>
    </main>
    {activeView === "supply" && uploadOpen && <UploadPanel vendors={vendors} onClose={() => setUploadOpen(false)} onUploaded={(vendorId) => { setSelectedVendorId(vendorId); setCatalogRevision((value) => value + 1); }} t={t} />}
  </div>;
}

function DemandHero({ language }: { language: Language }) {
  const t = marketCopy[language];
  return <section className="registry-header demand-hero">
    <div className="eyebrow">RESEARCH DEMAND</div>
    <h1>{t.demandTitle}</h1>
    <p>{t.demandSubtitle}</p>
  </section>;
}

function DemandBoard({ demands, language, localPreview, onToggleDemand, query }: { demands: DemandItem[]; language: Language; localPreview: boolean; onToggleDemand(id: string): void; query: string }) {
  const t = marketCopy[language];
  const normalizedQuery = query.trim().toLowerCase();
  const visible = demands.filter((demand) => !normalizedQuery || [
    ...Object.values(demand.domain),
    ...Object.values(demand.subdomain),
    ...Object.values(demand.title),
    ...Object.values(demand.note),
    ...Object.values(demand.sourceLabel),
  ].join(" ").toLowerCase().includes(normalizedQuery));
  const groups = visible.reduce<Array<{ id: string; label: string; items: DemandItem[] }>>((current, demand) => {
    const group = current.find((entry) => entry.id === demand.domain.en);
    if (group) group.items.push(demand); else current.push({ id: demand.domain.en, label: demand.domain[language], items: [demand] });
    return current;
  }, []);

  return <section className="demand-board" aria-labelledby="demand-board-title">
    {localPreview && <div className="preview-notice" role="note"><span>{t.preview}</span><p>{t.previewNote}</p><code>LOCAL ONLY</code></div>}
    <section className="demand-baseline" aria-labelledby="demand-baseline-title">
      <header><h2 id="demand-baseline-title">{t.baselineTitle}</h2><p>{t.baselineNote}</p></header>
      <div className="baseline-items">
        <div><strong>{t.baselineDifficulty}</strong><span>{t.baselineDifficultyNote}</span></div>
        <div><strong>{t.baselineReliability}</strong><span>{t.baselineReliabilityNote}</span></div>
      </div>
    </section>
    <div className="demand-checklist">
      <header><h2 id="demand-board-title">{t.boardTitle}</h2><p>{t.boardNote}</p></header>
      <div className="demand-groups">
        {groups.map((group) => <section className="demand-group" key={group.id}>
          <header><h3>{group.label}</h3><span>{group.items.length}</span></header>
          <div className="demand-list">
            {group.items.map((demand) => <article className={`demand-row${demand.checked ? " done" : ""}`} key={demand.id}>
              <input aria-label={`${demand.checked ? t.reopen : t.complete}: ${demand.title[language]}`} checked={demand.checked} onChange={() => onToggleDemand(demand.id)} type="checkbox" />
              <div className="demand-row-copy">
                <span className="demand-subdomain">{demand.subdomain[language]}</span>
                <strong>{demand.title[language]}</strong>
                {demand.note[language] && <p>{demand.note[language]}</p>}
                <small>{t.source}: <a href={demand.sourceUrl} rel="noreferrer" target="_blank">{demand.sourceLabel[language]}</a> · {formatDemandDate(demand.sourceDate, language)}</small>
              </div>
            </article>)}
          </div>
        </section>)}
      </div>
      {!visible.length && <div className="demand-empty">{t.empty}</div>}
    </div>
  </section>;
}

function formatDemandDate(value: string, language: Language): string {
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function logicalTaskCountForVendor(vendor: CatalogVendor): number {
  return new Set(vendor.batches.flatMap((batch) =>
    batch.categories.flatMap((category) =>
      category.tasks.map((task) => task.stableKey),
    ),
  )).size;
}

function VendorButton({ vendor, selected, onSelect, t }: { vendor: CatalogVendor; selected: boolean; onSelect(vendor: CatalogVendor): void; t: UiCopy }) {
  const taskCount = logicalTaskCountForVendor(vendor);
  return <button className={selected ? "active" : ""} onClick={() => onSelect(vendor)} type="button"><span><strong>{vendor.name}</strong><small>{vendor.batches.length} {vendor.batches.length === 1 ? t.submission : t.submissions} · {taskCount} {t.stats.tasks}</small></span></button>;
}

function UploadPanel({ vendors, onClose, onUploaded, t }: { vendors: CatalogVendor[]; onClose(): void; onUploaded(vendorId: string): void; t: UiCopy }) {
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "hashing" | "uploading" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const busy = status === "hashing" || status === "uploading";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vendorId || !label.trim() || !category.trim() || !file) {
      setStatus("error");
      setMessage(t.upload.required);
      return;
    }
    if (file.size > 250 * 1024 * 1024) {
      setStatus("error");
      setMessage(t.upload.chooseFile);
      return;
    }

    try {
      setStatus("hashing");
      setMessage(t.upload.hashing);
      const sha256 = await sha256File(file);
      setStatus("uploading");
      setMessage(t.upload.uploading);
      const response = await fetch("/api/uploads", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": file.type || "application/octet-stream",
          "x-case-upload-id": crypto.randomUUID(),
          "x-case-vendor-id": vendorId,
          "x-case-upload-label": encodeURIComponent(label.trim()),
          "x-case-upload-category": encodeURIComponent(category.trim()),
          ...(note.trim() ? { "x-case-upload-note": encodeURIComponent(note.trim()) } : {}),
          "x-case-file-name": encodeURIComponent(file.name),
          "x-case-file-size": String(file.size),
          "x-case-file-sha256": sha256,
        },
        body: file,
      });
      if (!response.ok) {
        const value = await response.json().catch(() => ({})) as { message?: unknown };
        throw new Error(typeof value.message === "string" ? value.message : t.upload.error);
      }
      setStatus("saved");
      setMessage(t.upload.saved);
      onUploaded(vendorId);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : t.upload.error);
    }
  }

  return <div className="upload-backdrop" role="presentation">
    <section aria-labelledby="upload-title" aria-modal="true" className="upload-dialog" role="dialog">
      <header><div><div className="eyebrow">CASE INTAKE</div><h2 id="upload-title">{t.upload.title}</h2><p>{t.upload.note}</p></div><button aria-label={t.upload.close} onClick={onClose} type="button">×</button></header>
      <form onSubmit={submit}>
        <label><span>{t.upload.vendor}</span><select disabled={busy} onChange={(event) => setVendorId(event.target.value)} required value={vendorId}>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
        <label><span>{t.upload.label}</span><input disabled={busy} maxLength={300} onChange={(event) => setLabel(event.target.value)} required value={label} /></label>
        <label><span>{t.upload.category}</span><input disabled={busy} maxLength={200} onChange={(event) => setCategory(event.target.value)} required value={category} /></label>
        <label className="upload-file"><span>{t.upload.file}</span><input disabled={busy} onChange={(event) => setFile(event.target.files?.[0] ?? null)} required type="file" /><small>{file ? `${file.name} · ${formatBytes(file.size)}` : t.upload.chooseFile}</small></label>
        <label className="upload-note"><span>{t.upload.comment}</span><textarea disabled={busy} maxLength={5000} onChange={(event) => setNote(event.target.value)} placeholder={t.upload.commentPlaceholder} rows={4} value={note} /></label>
        <footer><button disabled={busy || status === "saved" || vendors.length === 0} type="submit">{busy ? t.upload.uploading : t.upload.submit}</button>{message && <span className={status}>{message}</span>}</footer>
      </form>
    </section>
  </div>;
}

async function sha256File(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatBytes(value: number): string {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function vendorMatches(vendor: CatalogVendor, query: string): boolean {
  const haystack = [vendor.name, vendor.description, ...vendor.batches.flatMap((batch) => [batch.label, batch.source, ...batch.categories.flatMap((category) => [category.name, ...category.tasks.map((task) => task.title)])])].join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function VendorView({ matchingSampledVendors, matchingContactedVendors, query, selectedVendor, expandedBatches, onSelect, onToggleBatch, t, language }: {
  matchingSampledVendors: CatalogVendor[];
  matchingContactedVendors: CatalogVendor[];
  query: string;
  selectedVendor: CatalogVendor;
  expandedBatches: Set<string>;
  onSelect(vendor: CatalogVendor): void;
  onToggleBatch(batchId: string): void;
  t: UiCopy;
  language: Language;
}) {
  const vendorMainRef = useRef<HTMLElement>(null);
  const taskCount = logicalTaskCountForVendor(selectedVendor);

  function selectAndReveal(vendor: CatalogVendor) {
    onSelect(vendor);
    const vendorMain = vendorMainRef.current;
    if (!vendorMain) return;
    if (window.matchMedia("(max-width: 820px)").matches) {
      vendorMain.scrollIntoView({ block: "start" });
    } else {
      vendorMain.scrollTo({ top: 0 });
    }
  }

  return <div className="portal-grid">
    <aside className="vendor-sidebar" aria-label={t.vendors}>
      <div className="sidebar-head"><strong>{t.vendors}</strong><span>{matchingSampledVendors.length}</span></div>
      <div className="vendor-list">
        {matchingSampledVendors.map((vendor) => <VendorButton key={vendor.id} vendor={vendor} selected={selectedVendor.id === vendor.id} onSelect={selectAndReveal} t={t} />)}
        {matchingSampledVendors.length === 0 && matchingContactedVendors.length === 0 && <div className="sidebar-empty">{t.searchEmpty.title}</div>}
      </div>
      {matchingContactedVendors.length > 0 && <details className="contacted-vendors" open={query ? true : undefined}>
        <summary><span><strong>{t.contactedVendors}</strong><small>{t.contactedNote}</small></span><i>{matchingContactedVendors.length}</i></summary>
        <div className="vendor-list contacted-list">{matchingContactedVendors.map((vendor) => <VendorButton key={vendor.id} vendor={vendor} selected={selectedVendor.id === vendor.id} onSelect={selectAndReveal} t={t} />)}</div>
      </details>}
    </aside>

    <section className="vendor-main" aria-labelledby="vendor-name" ref={vendorMainRef}>
      <header className="vendor-profile"><div><div className="vendor-kicker">{t.vendor}</div><h2 id="vendor-name">{selectedVendor.name}</h2><p>{selectedVendor.description}</p><div className="vendor-meta"><span>{selectedVendor.batches.length} {selectedVendor.batches.length === 1 ? t.submission : t.submissions}</span><span>{taskCount} {t.stats.tasks}</span>{selectedVendor.batches.length > 0 && <span>{selectedVendor.batches.at(-1)?.date} — {selectedVendor.batches[0]?.date}</span>}</div>{selectedVendor.procurementSummary && <ProcurementSummary summary={selectedVendor.procurementSummary} t={t} language={language} />}</div></header>
      <section className="submission-history" aria-labelledby="history-title">
        <div className="section-title"><div><h3 id="history-title">{t.history}</h3><p>{t.historyNote}</p></div><span>{t.newest}</span></div>
        <div className="batch-list">{selectedVendor.batches.length ? selectedVendor.batches.map((batch, index) => <BatchCard batch={batch} isExpanded={expandedBatches.has(batch.id)} isLatest={index === 0} key={batch.id} onToggle={() => onToggleBatch(batch.id)} t={t} language={language} />) : <div className="submission-empty">{t.noSubmissions}</div>}</div>
      </section>
    </section>
  </div>;
}

function ProcurementSummary({ summary, t, language }: { summary: CatalogProcurementSummary; t: UiCopy; language: Language }) {
  const amount = summary.amountApprox
    ? `${t.procurement.approx} ${summary.amountApprox.currency} ${new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en", { maximumFractionDigits: 2 }).format(summary.amountApprox.value)}`
    : null;
  const sourceEvidence = summary.evidenceSourceCount === 0
    ? t.procurement.noLinkedSources
    : `${summary.evidenceSourceCount} ${summary.evidenceSourceCount === 1 ? t.procurement.linkedSource : t.procurement.linkedSources}`;
  return <details className="procurement-summary">
    <summary>
      <span className="procurement-stage">{t.procurement.stage[summary.stage]}</span>
      {amount && <strong>{amount}</strong>}
      <span className="procurement-commitment">{t.procurement.commitment[summary.commitment]}</span>
      <time dateTime={summary.occurredAt}>{t.procurement.updated} {formatDate(summary.occurredAt, language)}</time>
      <span className="procurement-toggle">{t.procurement.evidence}</span>
    </summary>
    <div className="procurement-evidence">
      <p>{summary.summary}</p>
      <small>{t.procurement.recordedBy} {summary.actor} · {sourceEvidence}{summary.retrospective ? ` · ${t.procurement.retrospective}` : ""}</small>
    </div>
  </details>;
}

function BatchCard({ batch, isExpanded, isLatest, onToggle, t, language, showReview = true, datasetHref, taskDownloadBase }: { batch: CatalogBatch; isExpanded: boolean; isLatest: boolean; onToggle(): void; t: UiCopy; language: Language; showReview?: boolean; datasetHref?: string; taskDownloadBase?: string }) {
  return <article className="batch-card">
    <button aria-expanded={isExpanded} className="batch-summary" onClick={onToggle} type="button">
      <span className="batch-date"><strong>{batch.date}</strong>{isLatest && <small>{t.latest}</small>}</span>
      <span className="batch-name"><strong>{batch.label}</strong><code>{batch.source}</code></span>
      <span className="batch-count"><strong>{batch.taskCount || batch.delta.changedFiles || batch.declaredTaskCount || 0}</strong><small>{batch.taskCount ? t.taskRecords : batch.delta.changedFiles ? t.sampleFiles : t.declaredTasks}</small></span>
      <StatusBadge status={batch.workflowStatus} label={t.status[batch.workflowStatus]} />
      <span aria-hidden="true" className="disclosure">{isExpanded ? "▴" : "▾"}</span>
    </button>

    {isExpanded && <div className="batch-body">
      <div className="delta-block"><div className="delta-grid">{batch.delta.retained !== undefined && <span><strong>{batch.delta.retained}</strong><small>{t.delta.retained}</small></span>}<span><strong>{batch.delta.added}</strong><small>{t.delta.added}</small></span><span><strong>{batch.delta.removed}</strong><small>{t.delta.removed}</small></span>{batch.delta.changedFiles !== undefined && <span><strong>{batch.delta.changedFiles}</strong><small>{t.delta.changedFiles}</small></span>}</div><p>{batch.delta.note}</p></div>
      <DatasetAccess batch={batch} datasetHref={datasetHref} t={t} />
      <div className="batch-section-head"><h4>{t.taskCategories}</h4><span>{batch.categories.length} {batch.categories.length === 1 ? t.category : t.categories}</span></div>
      <div className="category-table">{batch.categories.map((category) => <section key={category.id} className="category-row"><span className="category-count">{category.count}</span><span className="category-copy"><strong>{category.name}</strong><small>{category.description}</small></span><div className="task-list">{category.tasks.length ? category.tasks.map((task) => <TaskRow key={task.id} language={language} task={task} t={t} taskDownloadBase={taskDownloadBase} />) : <span className="empty-task-list">{t.noTasks}</span>}</div></section>)}</div>
      <SubmissionSources sourceEvents={batch.sourceEvents ?? []} t={t} language={language} />
      {showReview && <SubmissionReviewPanel batch={batch} t={t} language={language} />}
    </div>}
  </article>;
}

function DatasetAccess({ batch, t, datasetHref }: { batch: CatalogBatch; t: UiCopy; datasetHref?: string }) {
  const tasks = batch.categories.flatMap((category) => category.tasks);
  const packaged = tasks.filter((task) => task.artifactId);
  const withChecks = packaged.filter((task) => taskCheckCount(task) > 0).length;
  const missing = tasks.length - packaged.length;

  return <section className="dataset-access" aria-labelledby={`dataset-${batch.id}`}>
    <div className="dataset-copy">
      <span>CASE DATASET</span>
      <h4 id={`dataset-${batch.id}`}>{t.dataset.title}</h4>
      <p>{packaged.length ? t.dataset.note : t.dataset.empty}</p>
    </div>
    <div className="dataset-metrics">
      <span><strong>{packaged.length}</strong><small>{t.dataset.packages}</small></span>
      <span><strong>{withChecks}</strong><small>{t.dataset.withChecks}</small></span>
      {missing > 0 && <span className="dataset-missing"><strong>{missing}</strong><small>{t.dataset.missing}</small></span>}
    </div>
    {packaged.length
      ? <a href={datasetHref ?? `/api/submissions/${encodeURIComponent(batch.id)}/dataset-download`}>{t.dataset.download}</a>
      : <span className="dataset-disabled">{t.dataset.download}</span>}
  </section>;
}

function SubmissionReviewPanel({ batch, t, language }: { batch: CatalogBatch; t: UiCopy; language: Language }) {
  const [reviews, setReviews] = useState<SubmissionReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [signal, setSignal] = useState<SubmissionReviewSignal>("interested");
  const [scope, setScope] = useState<SubmissionReviewScope>("submission");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string }>();

  useEffect(() => {
    let active = true;
    void fetch(`/api/submissions/${encodeURIComponent(batch.id)}/reviews`, { headers: { accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return await response.json() as { reviews: SubmissionReview[] };
      })
      .then((payload) => { if (active) setReviews(payload.reviews); })
      .catch(() => { if (active) setNotice({ kind: "error", text: t.response.loadError }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [batch.id, t.response.loadError]);

  function toggleCategory(categoryId: string) {
    setCategoryIds((current) => current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId]);
  }

  async function submitReview() {
    setNotice(undefined);
    if (scope === "categories" && !categoryIds.length) {
      setNotice({ kind: "error", text: t.response.categoryRequired });
      return;
    }
    if (signal !== "interested" && !comment.trim()) {
      setNotice({ kind: "error", text: t.response.commentRequired });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/submissions/${encodeURIComponent(batch.id)}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ signal, scope, categoryIds: scope === "categories" ? categoryIds : [], comment: comment.trim() }),
      });
      const payload = await response.json() as { review?: SubmissionReview; message?: string };
      if (!response.ok || !payload.review) throw new Error(payload.message);
      setReviews((current) => [payload.review!, ...current]);
      setComment("");
      setNotice({ kind: "success", text: t.response.saved });
    } catch {
      setNotice({ kind: "error", text: t.response.submitError });
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="review-panel" aria-labelledby={`review-${batch.id}`}>
    <div className="review-heading">
      <div><h4 id={`review-${batch.id}`}>{t.response.title}</h4><p>{t.response.note}</p></div>
      <span>{loading ? "…" : `${reviews.length}`}</span>
    </div>
    <div className="review-form">
      <div className="signal-options" role="group" aria-label={t.response.title}>
        {([
          ["interested", t.response.interested],
          ["needs_revision", t.response.needsRevision],
          ["not_interested", t.response.notInterested],
          ["comment", t.response.commentOnly],
        ] as const).map(([value, label]) => <button aria-pressed={signal === value} className={signal === value ? "active" : ""} key={value} onClick={() => setSignal(value)} type="button">{label}</button>)}
      </div>
      <div className="scope-options" role="group" aria-label={t.response.scopedTo}>
        <button aria-pressed={scope === "submission"} className={scope === "submission" ? "active" : ""} onClick={() => setScope("submission")} type="button">{t.response.wholeSubmission}</button>
        <button aria-pressed={scope === "categories"} className={scope === "categories" ? "active" : ""} onClick={() => setScope("categories")} type="button">{t.response.selectedCategories}</button>
      </div>
      {scope === "categories" && <fieldset className="category-options"><legend>{t.response.chooseCategories}</legend>{batch.categories.map((category) => <label key={category.id}><input checked={categoryIds.includes(category.id)} onChange={() => toggleCategory(category.id)} type="checkbox" /><span>{category.name}</span></label>)}</fieldset>}
      <div className="review-comment"><span><strong>{t.response.commentLabel}</strong><small>{t.response.commentOptional}</small></span><textarea aria-label={t.response.commentLabel} maxLength={5000} onChange={(event) => setComment(event.target.value)} placeholder={t.response.commentPlaceholder} rows={3} value={comment} /></div>
      <div className="review-submit"><button disabled={submitting} onClick={() => void submitReview()} type="button">{submitting ? t.response.submitting : t.response.submit}</button>{notice && <span className={notice.kind}>{notice.text}</span>}</div>
    </div>
    <div className="review-history">
      <div className="review-history-head"><strong>{t.response.history}</strong></div>
      {!loading && !reviews.length && <p className="review-empty">{t.response.none}</p>}
      {reviews.map((review) => {
        const categoryNames = batch.categories.filter((category) => review.categoryIds.includes(category.id)).map((category) => category.name);
        return <article className="review-record" key={review.id}>
          <header><span className={`review-signal signal-${review.signal}`}>{t.response.signals[review.signal]}</span><strong>{review.reviewer.name}</strong><time>{formatTimestamp(review.createdAt, language)}</time></header>
          {review.scope === "categories" && <small>{t.response.scopedTo}: {categoryNames.join(", ")}</small>}
          {review.comment && <p>{review.comment}</p>}
        </article>;
      })}
    </div>
  </section>;
}

function SubmissionSources({ sourceEvents, t, language }: { sourceEvents: CatalogSourceEvent[]; t: UiCopy; language: Language }) {
  if (!sourceEvents.length) return <><div className="batch-section-head"><h4>{t.originalSources}</h4><span>{t.noSource}</span></div><div className="source-empty">{t.legacySource}</div></>;
  return <>
    <div className="batch-section-head"><h4>{t.originalSources}</h4><span>{sourceEvents.length} {sourceEvents.length === 1 ? t.sourceRecord : t.sourceRecords}</span></div>
    <p className="source-note">{t.sourceNote}</p>
    <div className="source-events">{sourceEvents.map((event) => <SourceEvent key={event.id} event={event} t={t} language={language} />)}</div>
  </>;
}

function SourceEvent({ event, t, language }: { event: CatalogSourceEvent; t: UiCopy; language: Language }) {
  const originalUrl = safeExternalUrl(event.externalRef);
  return <section className="source-event">
    <header className="source-event-head">
      <span className="source-channel">{event.role ? t.role[event.role] : event.channel.replace("_", " ")}</span>
      <span><strong>{event.sender ?? t.senderUnknown}</strong><small suppressHydrationWarning>{formatTimestamp(event.receivedAt, language)}</small>{originalUrl && <code className="source-locator" title={originalUrl}>{formatSourceLocator(originalUrl)}</code>}</span>
      <span className="source-actions">{originalUrl && <a href={originalUrl} rel="noreferrer" target="_blank">{t.openOriginal}</a>}{event.rawArtifactId && <a href={`/api/artifacts/${encodeURIComponent(event.rawArtifactId)}/download`}>{t.messageSnapshot}</a>}</span>
    </header>
    <div className="source-items">{event.items.length ? event.items.map((item) => <SourceItem key={item.id} item={item} t={t} language={language} />) : <div className="source-empty">{t.noLinks}</div>}</div>
  </section>;
}

function SourceItem({ item, t, language }: { item: CatalogSourceItem; t: UiCopy; language: Language }) {
  const originalUrl = safeExternalUrl(item.locator);
  const captured = item.capturedAt ? ` · ${t.captured} ${formatTimestamp(item.capturedAt, language)}` : "";
  return <div className="source-item">
    <span className="source-kind">{item.kind.replace("_", " ")}</span>
    <span className="source-name"><strong>{item.displayName}</strong><small suppressHydrationWarning>{t.fetch[item.fetchStatus as SourceFetchStatus]} · {t.parse[item.parseStatus as SourceParseStatus]}{item.mutable ? ` · ${t.mutable}` : ""}{captured}</small>{originalUrl && <code className="source-locator" title={originalUrl}>{formatSourceLocator(originalUrl)}</code>}</span>
    <span className="source-actions">{originalUrl && <a href={originalUrl} rel="noreferrer" target="_blank">{t.viewSource}</a>}{item.artifactId && <a href={`/api/artifacts/${encodeURIComponent(item.artifactId)}/download`}>{t.downloadSnapshot}</a>}</span>
  </div>;
}

function TaskRow({ task, t, language, taskDownloadBase }: { task: CatalogTask; t: UiCopy; language: Language; taskDownloadBase?: string }) {
  const checks = taskCheckCount(task);
  const findings = task.findings ?? [];
  const downloadHref = taskDownloadBase
    ? `${taskDownloadBase}/${encodeURIComponent(task.stableKey)}`
    : `/api/artifacts/${encodeURIComponent(task.artifactId ?? "")}/download`;
  return <div className="task-record">
    <div className="task-row"><span><strong>{task.title}</strong><small>{task.format}{task.summary ? ` · ${task.summary}` : ""}</small></span><span className="task-checks">{checks ? `${task.checks.pass} ${t.checks.pass} · ${task.checks.fail} ${t.checks.fail} · ${task.checks.blocked} ${t.checks.blocked}` : t.checks.none}</span><span className="task-actions">{task.artifactId && <a href={downloadHref}>{t.dataset.taskDownload}</a>}<StatusBadge status={task.workflowStatus} label={t.status[task.workflowStatus]} /></span></div>
    {findings.length > 0 && <details className="task-findings">
      <summary><span>{t.findings.title}</span><i>{findings.length}</i></summary>
      <div className="task-finding-list">{findings.map((finding) => <article className="task-finding" key={finding.id}>
        <header><span className={`finding-kind finding-${finding.kind}`}>{t.findings.kind[finding.kind]}</span><strong>{finding.title}</strong><time dateTime={finding.occurredAt}>{formatDate(finding.occurredAt, language)}</time></header>
        <p>{finding.summary}</p>
        {finding.resolution && <div className="finding-resolution"><strong>{t.findings.resolution}</strong><p>{finding.resolution}</p></div>}
        <footer><span>{t.findings.recordedBy} {finding.actor}</span><span>{t.findings.taskVersion} <code>{task.id}</code></span>{finding.evidenceCheckRunIds.length > 0 && <span>{finding.evidenceCheckRunIds.length} {t.findings.evidence}</span>}</footer>
      </article>)}</div>
    </details>}
  </div>;
}

function taskCheckCount(task: CatalogTask): number {
  return task.checks.pass + task.checks.fail + task.checks.blocked + task.checks.notRun;
}

function StatusBadge({ status, label }: { status: WorkflowStatus; label: string }) {
  return <span className={`status-badge status-${status}`}>{label}</span>;
}

function StateCard({ value }: { value: { eyebrow: string; title: string; body: string } }) {
  return <section className="state-card"><p className="eyebrow">{value.eyebrow}</p><h2>{value.title}</h2><p>{value.body}</p></section>;
}

export function LocalDownloadPreview() {
  const previewBatch: CatalogBatch = {
    id: "preview-submission",
    date: "2026-08-20",
    label: "August environment sample",
    source: "Captured vendor delivery",
    taskCount: 3,
    declaredTaskCount: 3,
    formats: ["harbor"],
    workflowStatus: "checking",
    catalogVisibility: "available",
    revisesBatchId: null,
    delta: { added: 3, removed: 0, note: "The original delivery and three normalized task packages are retained as separate immutable artifacts." },
    sourceEvents: [{
      id: "preview-source-event",
      role: "primary",
      channel: "upload",
      externalRef: "https://example.com/vendor-delivery",
      sender: "Vendor delivery",
      receivedAt: "2026-08-20T09:30:00.000Z",
      rawArtifactId: "artifact:preview:raw",
      items: [{
        id: "preview-source-archive",
        kind: "archive",
        displayName: "original-vendor-payload.zip",
        locator: null,
        mediaType: "application/zip",
        artifactId: "artifact:preview:archive",
        contentSha256: "4b3f4b4bf638bb0c23f9f5297f08f86b4c68f0afed4df137e0f7c77f2b7c842d",
        sizeBytes: 128400000,
        fetchStatus: "snapshotted",
        parseStatus: "parsed",
        mutable: false,
        capturedAt: "2026-08-20T09:31:00.000Z",
        metadata: {},
      }],
      relations: [],
    }],
    categories: [{
      id: "software-repair",
      name: "Software repair",
      description: "Harbor-compatible repository repair tasks.",
      count: 2,
      examples: [],
      tasks: [
        {
          id: "preview-task-version-1",
          stableKey: "repair-cache-invalidation",
          title: "Repair cache invalidation across workers",
          summary: "Exact normalized task package",
          sourcePath: "tasks/repair-cache-invalidation",
          format: "harbor",
          artifactId: "artifact:preview:task-1",
          contentSha256: "92dae5373dcfb784388bdf42f6b349b8fdd37975930d17e2b76e6abe35e447fe",
          workflowStatus: "ready_for_research",
          catalogVisibility: "available",
          checks: { pass: 6, fail: 0, blocked: 0, notRun: 0 },
          sourceItemIds: ["preview-source-archive"],
        },
        {
          id: "preview-task-version-2",
          stableKey: "audit-release-manifest",
          title: "Audit release manifest provenance",
          summary: "Exact normalized task package",
          sourcePath: "tasks/audit-release-manifest",
          format: "harbor",
          artifactId: "artifact:preview:task-2",
          contentSha256: "1dcc45e6b4a614f6b3221b388a453d3770d170829a06a18afb5f23bb94e6d6a6",
          workflowStatus: "needs_vendor_fix",
          catalogVisibility: "log_only",
          checks: { pass: 4, fail: 2, blocked: 0, notRun: 0 },
          sourceItemIds: ["preview-source-archive"],
        },
      ],
    }, {
      id: "computer-use",
      name: "Computer use",
      description: "Multi-step workflows in a simulated browser environment.",
      count: 1,
      examples: [],
      tasks: [{
        id: "preview-task-version-3",
        stableKey: "compare-quarterly-reports",
        title: "Compare quarterly reports across sources",
        summary: "Exact normalized task package",
        sourcePath: "tasks/compare-quarterly-reports",
        format: "harbor",
        artifactId: "artifact:preview:task-3",
        contentSha256: "52af82287d22f033058a35a3e22a06f32fbc9e885fe71b5e11ddc979acb98e79",
        workflowStatus: "checking",
        catalogVisibility: "available",
        checks: { pass: 3, fail: 0, blocked: 3, notRun: 0 },
        sourceItemIds: ["preview-source-archive"],
      }],
    }],
  };

  return <main className="local-preview">
    <section>
      <p className="eyebrow">LOCAL UI PREVIEW</p>
      <h1>Submission downloads</h1>
      <p>Original delivery, complete task dataset, and exact per-task packages.</p>
      <div className="batch-list"><BatchCard batch={previewBatch} datasetHref="/local-preview/dataset-download" isExpanded isLatest language="en" onToggle={() => {}} showReview={false} t={copy.en} taskDownloadBase="/local-preview/task-package" /></div>
    </section>
  </main>;
}

function safeExternalUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function formatTimestamp(value: string, language: Language) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(parsed);
}

function formatDate(value: string, language: Language) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en", { dateStyle: "medium", timeZone: "Asia/Shanghai" }).format(parsed);
}

function formatSourceLocator(value: string) {
  const url = new URL(value);
  const path = `${url.pathname}${url.search}`;
  return `${url.hostname}${path === "/" ? "" : path}`;
}
