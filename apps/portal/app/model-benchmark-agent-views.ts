import type { BenchmarkReferenceLanguage } from "./model-benchmark-data";
import { modelBenchmarkNativeTaskRecords } from "./model-benchmark-native-records";
import { modelBenchmarkSamples } from "./model-benchmark-samples";

type LocalizedText = Record<BenchmarkReferenceLanguage, string>;

export type AgentViewSource = {
  label: string;
  path: string;
  rawUrl: string;
  sourceUrl: string;
};

export type TauAgentRuntimeView = {
  kind: "tau-runtime";
  repository: string;
  revision: string;
  verifiedAt: string;
  promptSources: {
    agentRuntime: AgentViewSource;
    policyTemplate: AgentViewSource;
    retrievalRuntime: AgentViewSource;
    components: Array<AgentViewSource & { placeholder: string }>;
  };
  taskDefinition: AgentViewSource;
  toolGroups: Array<{ label: LocalizedText; tools: string[] }>;
  runtimeInputs: LocalizedText[];
  hiddenInputs: LocalizedText[];
};

export type PublisherAgentMaterial = {
  label: LocalizedText;
  path: string;
  detail: LocalizedText;
  origin:
    | "publisher-file"
    | "publisher-record"
    | "runtime-generated"
    | "repository"
    | "environment"
    | "tool-access"
    | "open-web";
  sizeBytes?: number;
  sourceUrl: string;
  rawUrl?: string;
};

export type PublisherDatasetPromptSource = {
  kind: "dataset-row";
  identity: Record<string, string | number>;
  instructionFields: string[];
  rowIndex: number;
  rowUrl: string;
  sourceLabel: LocalizedText;
  sourceUrl: string;
};

export type PublisherFilePromptSource = {
  kind: "publisher-file";
  fileFormat: "csv" | "json" | "jsonl" | "python-task" | "text";
  identity: Record<string, string | number>;
  instructionFields: string[];
  rawUrl: string;
  sourceLabel: LocalizedText;
  sourceUrl: string;
};

export type PublisherTaskPromptSource = PublisherDatasetPromptSource | PublisherFilePromptSource;

export type PublisherContractAgentView = {
  kind: "publisher-contract";
  materials: PublisherAgentMaterial[];
  promptSource?: PublisherTaskPromptSource;
};

export type ModelBenchmarkAgentView = TauAgentRuntimeView | PublisherContractAgentView;

const tauRevision = "a2c024725189473d2d7cea3a5cfdbcc67478e41f";

function tauSource(path: string, label: string): AgentViewSource {
  const encodedPath = path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return {
    label,
    path,
    rawUrl: `https://raw.githubusercontent.com/sierra-research/tau2-bench/${tauRevision}/${encodedPath}`,
    sourceUrl: `https://github.com/sierra-research/tau2-bench/blob/${tauRevision}/${encodedPath}`,
  };
}

const tauPromptSources: TauAgentRuntimeView["promptSources"] = {
  agentRuntime: tauSource("src/tau2/agent/llm_agent.py", "Agent runtime"),
  policyTemplate: tauSource("data/tau2/domains/banking_knowledge/prompts/all_tools.md", "Default policy template"),
  retrievalRuntime: tauSource("src/tau2/domains/banking_knowledge/retrieval.py", "Retrieval prompt builder"),
  components: [
    { ...tauSource("data/tau2/domains/banking_knowledge/prompts/components/policy_header.md", "Rho-Bank policy"), placeholder: "policy_header" },
    { ...tauSource("data/tau2/domains/banking_knowledge/prompts/components/shell_instructions.md", "Shell instructions"), placeholder: "shell_instructions" },
    { ...tauSource("data/tau2/domains/banking_knowledge/prompts/components/additional_instructions.md", "Additional instructions"), placeholder: "additional_instructions" },
  ],
};

function tauAgentView(taskFile: string): TauAgentRuntimeView {
  return {
    kind: "tau-runtime",
    repository: "sierra-research/tau2-bench",
    revision: tauRevision,
    verifiedAt: "2026-08-31",
    promptSources: tauPromptSources,
    taskDefinition: tauSource(`data/tau2/domains/banking_knowledge/tasks/${taskFile}`, "Task definition"),
    toolGroups: [
      {
        label: { en: "Knowledge retrieval", zh: "知识检索" },
        tools: ["KB_search_bm25", "KB_search_dense", "shell"],
      },
      {
        label: { en: "Tool discovery", zh: "工具发现" },
        tools: ["unlock_discoverable_agent_tool", "call_discoverable_agent_tool", "give_discoverable_user_tool"],
      },
    ],
    runtimeInputs: [
      {
        en: "The composed customer-service system prompt and Rho-Bank retrieval policy.",
        zh: "组合后的客服系统提示与 Rho-Bank 检索政策。",
      },
      {
        en: "Tool schemas supplied separately with the model request.",
        zh: "随模型请求单独提供的工具 schema。",
      },
      {
        en: "User messages generated turn by turn by the simulator; there is no fixed first task utterance.",
        zh: "由用户模拟器逐轮生成的用户消息；不存在固定的首条任务话术。",
      },
    ],
    hiddenInputs: [
      {
        en: "user_scenario.instructions — private scenario used to drive the user simulator.",
        zh: "user_scenario.instructions — 用于驱动用户模拟器的隐藏场景。",
      },
      {
        en: "evaluation_criteria — expected actions, arguments, and reward basis used only by grading.",
        zh: "evaluation_criteria — 仅供评分使用的预期动作、参数与奖励依据。",
      },
      {
        en: "required_documents and user_tools — orchestration configuration, not a task prompt pasted into the agent conversation.",
        zh: "required_documents 与 user_tools — 编排配置，不会作为任务提示直接粘贴进智能体对话。",
      },
    ],
  };
}

const exploitGymRevision = "e4123d043774623b2274e6bbe0155a423d631f0a";
const exploitGymRepository = "sunblaze-ucb/exploitgym";

function exploitGymMaterial(
  path: string,
  sourcePath: string,
  sizeBytes: number,
  origin: PublisherAgentMaterial["origin"],
  detail: LocalizedText,
): PublisherAgentMaterial {
  const encodedPath = sourcePath.split("/").map((segment) => encodeURIComponent(segment)).join("/");
  return {
    label: { en: path, zh: path },
    path,
    detail,
    origin,
    sizeBytes,
    sourceUrl: `https://github.com/${exploitGymRepository}/blob/${exploitGymRevision}/${encodedPath}`,
    rawUrl: `https://raw.githubusercontent.com/${exploitGymRepository}/${exploitGymRevision}/${encodedPath}`,
  };
}

const exploitGymMaterials: PublisherAgentMaterial[] = [
  exploitGymMaterial(
    "README.md",
    "src/cybergym/task/workspace/templates/kernel.md.j2",
    4594,
    "runtime-generated",
    {
      en: "The workspace guide rendered for this task from the publisher's kernel-task template; runtime controller credentials are injected during evaluation.",
      zh: "由发布方内核任务模板为本任务生成的工作区指南；评测运行时会注入控制器凭据。",
    },
  ),
  exploitGymMaterial(
    "vulnerability.md",
    "data/tasks/kernel/kernelctf/CVE-2023-6111_lts/docs/vulnerability.md",
    292,
    "publisher-file",
    {
      en: "The exact vulnerability summary copied into the evaluated agent's workspace by the default kernel-task setup.",
      zh: "默认内核任务设置会将这份准确的漏洞摘要复制到受测智能体工作区。",
    },
  ),
  exploitGymMaterial(
    "run_vm.sh",
    "src/cybergym/task/workspace/templates/kernel_run_vm.sh.j2",
    3385,
    "runtime-generated",
    {
      en: "The launcher rendered from the publisher template for starting and reconnecting to the isolated vulnerable-kernel VM.",
      zh: "由发布方模板生成的启动脚本，用于启动并重新连接隔离的易受攻击内核虚拟机。",
    },
  ),
];

const samplesById = new Map(Object.values(modelBenchmarkSamples).flat().map((sample) => [sample.id, sample]));

const gdpvalRevision = "11e7900cdcac61bc4daf59e65feb238acda98fbf";
const gdpvalSourceUrl = "https://huggingface.co/datasets/openai/gdpval/viewer";

function hfInstructionSource(input: {
  config: string;
  dataset: string;
  identity?: Record<string, string | number>;
  instructionFields: string[];
  rowIndex: number;
  sourceLabel: LocalizedText;
  sourceUrl: string;
  split: string;
}): PublisherTaskPromptSource {
  const params = new URLSearchParams({
    config: input.config,
    dataset: input.dataset,
    length: "1",
    offset: String(input.rowIndex),
    split: input.split,
  });
  return {
    kind: "dataset-row",
    identity: input.identity ?? {},
    instructionFields: input.instructionFields,
    rowIndex: input.rowIndex,
    rowUrl: `https://datasets-server.huggingface.co/rows?${params.toString()}`,
    sourceLabel: input.sourceLabel,
    sourceUrl: input.sourceUrl,
  };
}

const publisherInstructionSources: Record<string, PublisherTaskPromptSource> = {
  "gdpval-afc-audit-sample": {
    kind: "dataset-row",
    identity: { task_id: "83d10b06-26d1-4636-a32c-23f92c57f30b" },
    instructionFields: ["prompt"],
    rowIndex: 0,
    rowUrl: "https://datasets-server.huggingface.co/rows?dataset=openai%2Fgdpval&config=default&split=train&length=1&offset=0",
    sourceLabel: { en: "OpenAI GDPval · task row", zh: "OpenAI GDPval · 任务数据行" },
    sourceUrl: gdpvalSourceUrl,
  },
  "gdpval-retail-task-list": {
    kind: "dataset-row",
    identity: { task_id: "211d0093-2c64-4bd0-828c-0201f18924e7" },
    instructionFields: ["prompt"],
    rowIndex: 91,
    rowUrl: "https://datasets-server.huggingface.co/rows?dataset=openai%2Fgdpval&config=default&split=train&length=1&offset=91",
    sourceLabel: { en: "OpenAI GDPval · task row", zh: "OpenAI GDPval · 任务数据行" },
    sourceUrl: gdpvalSourceUrl,
  },
  "automationbench-sales-routing": {
    kind: "publisher-file",
    fileFormat: "python-task",
    identity: { example_id: 501 },
    instructionFields: ["user"],
    rawUrl: "https://raw.githubusercontent.com/zapier/AutomationBench/main/automationbench/domains/sales/tasks.py",
    sourceLabel: { en: "AutomationBench · public task 501", zh: "AutomationBench · 公开任务 501" },
    sourceUrl: "https://github.com/zapier/AutomationBench/blob/main/automationbench/domains/sales/tasks.py",
  },
  "toolathlon-ab-testing": {
    kind: "publisher-file",
    fileFormat: "text",
    identity: {},
    instructionFields: ["task.md"],
    rawUrl: "https://raw.githubusercontent.com/hkust-nlp/Toolathlon/main/tasks/finalpool/ab-testing/docs/task.md",
    sourceLabel: { en: "Toolathlon · ab-testing task", zh: "Toolathlon · ab-testing 任务" },
    sourceUrl: "https://github.com/hkust-nlp/Toolathlon/blob/main/tasks/finalpool/ab-testing/docs/task.md",
  },
  "scicode-lennard-jones": hfInstructionSource({
    dataset: "SciCode1/SciCode", config: "default", split: "validation", rowIndex: 13,
    identity: { problem_id: "51" },
    instructionFields: ["problem_description_main", "problem_background_main", "problem_io", "required_dependencies", "sub_steps"],
    sourceLabel: { en: "SciCode · problem 51", zh: "SciCode · 问题 51" },
    sourceUrl: "https://huggingface.co/datasets/SciCode1/SciCode/viewer/default/validation",
  }),
  "scicode-neutrino-oscillation": hfInstructionSource({
    dataset: "SciCode1/SciCode", config: "default", split: "validation", rowIndex: 14,
    identity: { problem_id: "70" },
    instructionFields: ["problem_description_main", "problem_background_main", "problem_io", "required_dependencies", "sub_steps"],
    sourceLabel: { en: "SciCode · problem 70", zh: "SciCode · 问题 70" },
    sourceUrl: "https://huggingface.co/datasets/SciCode1/SciCode/viewer/default/validation",
  }),
  "aa-lcr-consumer-infringements": hfInstructionSource({
    dataset: "ArtificialAnalysis/AA-LCR", config: "default", split: "test", rowIndex: 0,
    identity: { document_set_id: "ac_markets", question_id: 1 }, instructionFields: ["question"],
    sourceLabel: { en: "AA-LCR · ac_markets question 1", zh: "AA-LCR · ac_markets 问题 1" },
    sourceUrl: "https://huggingface.co/datasets/ArtificialAnalysis/AA-LCR/viewer/default/test",
  }),
  "aa-lcr-data-center-revenue": hfInstructionSource({
    dataset: "ArtificialAnalysis/AA-LCR", config: "default", split: "test", rowIndex: 15,
    identity: { document_set_id: "co_dc_ann_sup_a", question_id: 16 }, instructionFields: ["question"],
    sourceLabel: { en: "AA-LCR · co_dc_ann_sup_a question 16", zh: "AA-LCR · co_dc_ann_sup_a 问题 16" },
    sourceUrl: "https://huggingface.co/datasets/ArtificialAnalysis/AA-LCR/viewer/default/test",
  }),
  "omniscience-asc-606": hfInstructionSource({
    dataset: "ArtificialAnalysis/AA-Omniscience-Public", config: "default", split: "train", rowIndex: 0,
    identity: { question_id: 1 }, instructionFields: ["question"],
    sourceLabel: { en: "AA-Omniscience · question 1", zh: "AA-Omniscience · 问题 1" },
    sourceUrl: "https://huggingface.co/datasets/ArtificialAnalysis/AA-Omniscience-Public/viewer/default/train",
  }),
  "omniscience-risk-operator": hfInstructionSource({
    dataset: "ArtificialAnalysis/AA-Omniscience-Public", config: "default", split: "train", rowIndex: 48,
    identity: { question_id: 49 }, instructionFields: ["question"],
    sourceLabel: { en: "AA-Omniscience · question 49", zh: "AA-Omniscience · 问题 49" },
    sourceUrl: "https://huggingface.co/datasets/ArtificialAnalysis/AA-Omniscience-Public/viewer/default/train",
  }),
  "critpt-qcd-matching": hfInstructionSource({
    dataset: "CritPt-Benchmark/CritPt", config: "default", split: "train", rowIndex: 15,
    identity: { problem_id: "Challenge_23_main" }, instructionFields: ["problem_description", "code_template"],
    sourceLabel: { en: "CritPt · Challenge 23", zh: "CritPt · 挑战 23" },
    sourceUrl: "https://huggingface.co/datasets/CritPt-Benchmark/CritPt/viewer/default/train",
  }),
  "critpt-rydberg-scar": hfInstructionSource({
    dataset: "CritPt-Benchmark/CritPt", config: "default", split: "train", rowIndex: 40,
    identity: { problem_id: "Challenge_46_main" }, instructionFields: ["problem_description", "code_template"],
    sourceLabel: { en: "CritPt · Challenge 46", zh: "CritPt · 挑战 46" },
    sourceUrl: "https://huggingface.co/datasets/CritPt-Benchmark/CritPt/viewer/default/train",
  }),
  "deepsearchqa-oecd-criminality": hfInstructionSource({
    dataset: "google/deepsearchqa", config: "deepsearchqa", split: "eval", rowIndex: 0,
    instructionFields: ["problem"],
    sourceLabel: { en: "DeepSearchQA · evaluation row 0", zh: "DeepSearchQA · evaluation 数据行 0" },
    sourceUrl: "https://huggingface.co/datasets/google/deepsearchqa/viewer/deepsearchqa/eval",
  }),
  "mcp-atlas-assaultcube-dates": hfInstructionSource({
    dataset: "ScaleAI/MCP-Atlas", config: "default", split: "train", rowIndex: 0,
    identity: { TASK: "689f4d693e212e8ef3390731" }, instructionFields: ["PROMPT"],
    sourceLabel: { en: "MCP-Atlas · task 689f4d693e212e8ef3390731", zh: "MCP-Atlas · 任务 689f4d693e212e8ef3390731" },
    sourceUrl: "https://huggingface.co/datasets/ScaleAI/MCP-Atlas/viewer/default/train",
  }),
  "zerobench-loyalty-bottles": hfInstructionSource({
    dataset: "jonathan-roberts1/zerobench_no_answers", config: "default", split: "zerobench", rowIndex: 0,
    identity: { question_id: "1" }, instructionFields: ["question_text"],
    sourceLabel: { en: "ZeroBench · question 1", zh: "ZeroBench · 问题 1" },
    sourceUrl: "https://huggingface.co/datasets/jonathan-roberts1/zerobench_no_answers/viewer/default/zerobench",
  }),
  "apex-florida-diminished-value": {
    kind: "publisher-file",
    fileFormat: "csv",
    identity: { "Task ID": "13" }, instructionFields: ["Prompt"],
    rawUrl: "https://huggingface.co/datasets/mercor/APEX-v1-extended/resolve/main/data/train.csv",
    sourceLabel: { en: "APEX · task 13", zh: "APEX · 任务 13" },
    sourceUrl: "https://huggingface.co/datasets/mercor/APEX-v1-extended/viewer/default/train",
  },
  "swe-bench-pro-nodebb-email-validation": hfInstructionSource({
    dataset: "ScaleAI/SWE-bench_Pro", config: "default", split: "test", rowIndex: 0,
    identity: { instance_id: "instance_NodeBB__NodeBB-04998908ba6721d64eba79ae3b65a351dcfbc5b5-vnan" },
    instructionFields: ["problem_statement"],
    sourceLabel: { en: "SWE-Bench Pro · NodeBB instance", zh: "SWE-Bench Pro · NodeBB 实例" },
    sourceUrl: "https://huggingface.co/datasets/ScaleAI/SWE-bench_Pro/viewer/default/test",
  }),
  "ale-marketing-ab-test": {
    kind: "publisher-file",
    fileFormat: "json",
    identity: { taskId: "business_finance/digital_marketing_ab_test_analysis_1" },
    instructionFields: ["taskPrompt"],
    rawUrl: "https://raw.githubusercontent.com/rdi-berkeley/agents-last-exam/main/tasks/business_finance/digital_marketing_ab_test_analysis_1/task_card.json",
    sourceLabel: { en: "Agents' Last Exam · task card", zh: "Agents' Last Exam · 任务卡" },
    sourceUrl: "https://github.com/rdi-berkeley/agents-last-exam/blob/main/tasks/business_finance/digital_marketing_ab_test_analysis_1/task_card.json",
  },
  "osworld-fill-down-calc": {
    kind: "publisher-file",
    fileFormat: "json",
    identity: { id: "01b269ae-2111-4a07-81fd-3fcd711993b0" },
    instructionFields: ["instruction"],
    rawUrl: "https://raw.githubusercontent.com/xlang-ai/OSWorld/main/evaluation_examples/examples/libreoffice_calc/01b269ae-2111-4a07-81fd-3fcd711993b0.json",
    sourceLabel: { en: "OSWorld · task definition", zh: "OSWorld · 任务定义" },
    sourceUrl: "https://github.com/xlang-ai/OSWorld/blob/main/evaluation_examples/examples/libreoffice_calc/01b269ae-2111-4a07-81fd-3fcd711993b0.json",
  },
  "nl2repo-aiofiles": {
    kind: "publisher-file",
    fileFormat: "text",
    identity: {},
    instructionFields: ["start.md"],
    rawUrl: "https://raw.githubusercontent.com/multimodal-art-projection/NL2RepoBench/781a1da1ee41fb8edb0bed22f586d69111610edf/test_files/aiofiles/start.md",
    sourceLabel: { en: "NL2Repo-Bench · aiofiles specification", zh: "NL2Repo-Bench · aiofiles 规格" },
    sourceUrl: "https://github.com/multimodal-art-projection/NL2RepoBench/blob/781a1da1ee41fb8edb0bed22f586d69111610edf/test_files/aiofiles/start.md",
  },
  "mmmu-pro-clinical-emergency": {
    kind: "publisher-file",
    fileFormat: "jsonl",
    identity: { image_1: "images/test_Clinical_Medicine_69_1.png" },
    instructionFields: ["question", "options"],
    rawUrl: "https://raw.githubusercontent.com/MMMU-Benchmark/MMMU/268471d0d488258990025331c7528359c324aa25/mmmu-pro/tool/data.jsonl",
    sourceLabel: { en: "MMMU-Pro · clinical medicine record", zh: "MMMU-Pro · 临床医学记录" },
    sourceUrl: "https://github.com/MMMU-Benchmark/MMMU/blob/268471d0d488258990025331c7528359c324aa25/mmmu-pro/tool/data.jsonl",
  },
  "babyvision-tiger-grid": {
    kind: "publisher-file",
    fileFormat: "json",
    identity: { Id: 445 },
    instructionFields: ["Question"],
    rawUrl: "https://raw.githubusercontent.com/UniPat-AI/BabyVision/main/babyvision_eval/results/model_results_run_1.json",
    sourceLabel: { en: "BabyVision · record 445", zh: "BabyVision · 记录 445" },
    sourceUrl: "https://github.com/UniPat-AI/BabyVision/blob/main/babyvision_eval/results/model_results_run_1.json",
  },
  "charxiv-session-accuracy-decline": {
    kind: "publisher-file",
    fileFormat: "json",
    identity: { figure_id: 0 },
    instructionFields: ["query"],
    rawUrl: "https://raw.githubusercontent.com/princeton-nlp/CharXiv/main/data/reasoning_val.json",
    sourceLabel: { en: "CharXiv · reasoning figure 0", zh: "CharXiv · 推理图表 0" },
    sourceUrl: "https://github.com/princeton-nlp/CharXiv/blob/main/data/reasoning_val.json",
  },
};

function publisherMaterial(
  sampleId: string,
  path: string,
  origin: PublisherAgentMaterial["origin"],
  detail: LocalizedText,
  options: { label?: LocalizedText; rawUrl?: string; sourceUrl?: string; sizeBytes?: number } = {},
): PublisherAgentMaterial {
  const sample = samplesById.get(sampleId);
  if (!sample && !options.sourceUrl) throw new Error(`Missing benchmark sample for agent material: ${sampleId}`);
  return {
    label: options.label ?? { en: path, zh: path },
    path,
    detail,
    origin,
    sourceUrl: options.sourceUrl ?? sample!.sourceUrl,
    ...(options.rawUrl ? { rawUrl: options.rawUrl } : {}),
    ...(options.sizeBytes === undefined ? {} : { sizeBytes: options.sizeBytes }),
  };
}

const publisherMaterialManifests: Record<string, PublisherAgentMaterial[]> = {
  "gdpval-afc-audit-sample": [
    publisherMaterial("gdpval-afc-audit-sample", "Population v2.xlsx", "publisher-file", {
      en: "The source workbook supplied with this exact GDPval assignment; it contains the population-level metrics the agent must sample.",
      zh: "随这条 GDPval 任务提供的源工作簿；其中包含智能体需要抽样的总体指标。",
    }, {
      rawUrl: `https://huggingface.co/datasets/openai/gdpval/resolve/${gdpvalRevision}/reference_files/cc781e4dc0985c8eb327a53ec03b5900/Population%20v2.xlsx`,
      sizeBytes: 61470,
      sourceUrl: `https://huggingface.co/datasets/openai/gdpval/blob/${gdpvalRevision}/reference_files/cc781e4dc0985c8eb327a53ec03b5900/Population%20v2.xlsx`,
    }),
  ],
  "gdpval-retail-task-list": [
    publisherMaterial("gdpval-retail-task-list", "Daily Tasks.docx", "publisher-file", {
      en: "The source Word document supplied with this exact task; the agent turns its store instructions into the requested staff-ready PDF.",
      zh: "随这条任务提供的源 Word 文档；智能体需将其中的门店说明制作成可供员工使用的 PDF。",
    }, {
      rawUrl: `https://huggingface.co/datasets/openai/gdpval/resolve/${gdpvalRevision}/reference_files/a19ff917a5f84ec4b136400cec4a5e1f/Daily%20Tasks.docx`,
      sizeBytes: 7492,
      sourceUrl: `https://huggingface.co/datasets/openai/gdpval/blob/${gdpvalRevision}/reference_files/a19ff917a5f84ec4b136400cec4a5e1f/Daily%20Tasks.docx`,
    }),
  ],
  "scicode-lennard-jones": [
    publisherMaterial("scicode-lennard-jones", "problem_id 51 / problem_background_main", "publisher-record", {
      en: "The equations, conventions, and scientific background attached to problem 51.",
      zh: "问题 51 随附的方程、约定及科学背景。",
    }),
    publisherMaterial("scicode-lennard-jones", "problem_id 51 / problem_io + required_dependencies", "publisher-record", {
      en: "The exact function interfaces, array shapes, return contract, and allowed imports for the staged solution.",
      zh: "分阶段解答所需的准确函数接口、数组形状、返回约定及允许导入项。",
    }),
  ],
  "scicode-neutrino-oscillation": [
    publisherMaterial("scicode-neutrino-oscillation", "problem_id 70 / problem_background_main", "publisher-record", {
      en: "The three-flavor mixing conventions, parameters, and propagation equations attached to problem 70.",
      zh: "问题 70 随附的三味混合约定、参数及传播方程。",
    }),
    publisherMaterial("scicode-neutrino-oscillation", "problem_id 70 / problem_io + required_dependencies", "publisher-record", {
      en: "The exact function interfaces, return contract, and allowed dependencies for the staged solution.",
      zh: "分阶段解答所需的准确函数接口、返回约定及允许依赖。",
    }),
  ],
  "aa-lcr-consumer-infringements": [
    publisherMaterial("aa-lcr-consumer-infringements", "ac_markets / data_source_filenames[4]", "publisher-file", {
      en: "The four text-extracted reports and papers assembled into the 94,494-token context for this exact question.",
      zh: "为这道具体问题组装为 94,494 token 上下文的四份文本化报告与论文。",
    }),
  ],
  "aa-lcr-data-center-revenue": [
    publisherMaterial("aa-lcr-data-center-revenue", "co_dc_ann_sup_a / data_source_filenames[4]", "publisher-file", {
      en: "The four company earnings and supplemental reports assembled into the 78,978-token context for this exact question.",
      zh: "为这道具体问题组装为 78,978 token 上下文的四份公司财报与补充报告。",
    }),
  ],
  "omniscience-asc-606": [
    publisherMaterial("omniscience-asc-606", "question_id 1 / question", "publisher-record", {
      en: "The complete public-subset accounting question supplied to the model; this item has no separate attachment bundle.",
      zh: "交给模型的完整公开子集会计问题；本题没有单独的附件包。",
    }),
  ],
  "omniscience-risk-operator": [
    publisherMaterial("omniscience-risk-operator", "question_id 49 / question", "publisher-record", {
      en: "The complete public-subset symbolic risk question supplied to the model; this item has no separate attachment bundle.",
      zh: "交给模型的完整公开子集符号风险问题；本题没有单独的附件包。",
    }),
  ],
  "critpt-qcd-matching": [
    publisherMaterial("critpt-qcd-matching", "data/public_test_challenges/Challenge_23.ipynb", "publisher-file", {
      en: "The research notebook identified by the publisher as the provenance and setup material for Challenge 23.",
      zh: "发布方标明为 Challenge 23 来源及问题背景材料的研究 Notebook。",
    }),
    publisherMaterial("critpt-qcd-matching", "Challenge_23_main / code_template", "publisher-record", {
      en: "The exact Python and SymPy function stub into which the agent implements the branch-correct result.",
      zh: "智能体用于实现各分支正确结果的准确 Python 与 SymPy 函数模板。",
    }),
  ],
  "critpt-rydberg-scar": [
    publisherMaterial("critpt-rydberg-scar", "data/public_test_challenges/Challenge_46.ipynb", "publisher-file", {
      en: "The research notebook identified by the publisher as the provenance and setup material for Challenge 46.",
      zh: "发布方标明为 Challenge 46 来源及问题背景材料的研究 Notebook。",
    }),
    publisherMaterial("critpt-rydberg-scar", "Challenge_46_main / code_template", "publisher-record", {
      en: "The exact Python function stub and structured return contract supplied for this challenge.",
      zh: "为这项挑战提供的准确 Python 函数模板及结构化返回约定。",
    }),
  ],
  "automationbench-sales-routing": [
    publisherMaterial("automationbench-sales-routing", "sales simulator / task 501 / seeded app state", "environment", {
      en: "The live CRM, spreadsheet, and messaging records seeded for task 501 and exposed through application tools.",
      zh: "为任务 501 预置并通过应用工具开放的 CRM、电子表格及消息记录。",
    }),
    publisherMaterial("automationbench-sales-routing", "automationbench/domains/sales/tasks.py / task 501", "publisher-record", {
      en: "The exact task definition that selects the starting records and declares the permitted cross-application actions.",
      zh: "用于选择起始记录并声明允许跨应用操作的准确任务定义。",
    }, {
      sourceUrl: "https://github.com/zapier/AutomationBench/blob/main/automationbench/domains/sales/tasks.py",
      rawUrl: "https://raw.githubusercontent.com/zapier/AutomationBench/main/automationbench/domains/sales/tasks.py",
    }),
  ],
  "toolathlon-ab-testing": [
    publisherMaterial("toolathlon-ab-testing", "task_config.json", "publisher-record", {
      en: "The exact server and local-tool configuration for this task.",
      zh: "该任务准确的服务器及本地工具配置。",
    }, {
      sourceUrl: "https://github.com/hkust-nlp/Toolathlon/blob/main/tasks/finalpool/ab-testing/task_config.json",
      rawUrl: "https://raw.githubusercontent.com/hkust-nlp/Toolathlon/main/tasks/finalpool/ab-testing/task_config.json",
    }),
    publisherMaterial("toolathlon-ab-testing", "record.csv", "publisher-file", {
      en: "The actual CSV template placed in the task's initial workspace.",
      zh: "放入任务初始工作区的实际 CSV 模板。",
    }, {
      sourceUrl: "https://github.com/hkust-nlp/Toolathlon/blob/main/tasks/finalpool/ab-testing/initial_workspace/record.csv",
      rawUrl: "https://raw.githubusercontent.com/hkust-nlp/Toolathlon/main/tasks/finalpool/ab-testing/initial_workspace/record.csv",
    }),
  ],
  "ale-marketing-ab-test": [
    publisherMaterial("ale-marketing-ab-test", "tasks/business_finance/digital_marketing_ab_test_analysis_1/task_card.json", "publisher-record", {
      en: "The exact public task card that identifies the assignment and its declared input files.",
      zh: "用于标识这项任务及其声明输入文件的准确公开任务卡。",
    }, {
      sourceUrl: "https://github.com/rdi-berkeley/agents-last-exam/blob/main/tasks/business_finance/digital_marketing_ab_test_analysis_1/task_card.json",
      rawUrl: "https://raw.githubusercontent.com/rdi-berkeley/agents-last-exam/main/tasks/business_finance/digital_marketing_ab_test_analysis_1/task_card.json",
    }),
    publisherMaterial("ale-marketing-ab-test", "digital_marketing_ab_test_analysis_1 / input_files[]", "publisher-file", {
      en: "The campaign data and supporting office files linked from this task card and provided to the agent's workspace.",
      zh: "由该任务卡链接并提供到智能体工作区的营销活动数据及配套办公文件。",
    }),
  ],
  "browsecomp-publisher-example-1": [
    publisherMaterial("browsecomp-publisher-example-1", "public web", "open-web", {
      en: "Unrestricted public webpages discovered by the agent during research; no fixed attachment bundle is supplied.",
      zh: "智能体在研究过程中自行发现的开放公共网页；任务不提供固定附件包。",
    }),
  ],
  "osworld-fill-down-calc": [
    publisherMaterial("osworld-fill-down-calc", "Student_Level_Fill_Blank.xlsx", "publisher-file", {
      en: "The actual workbook opened in LibreOffice Calc at the start of this task.",
      zh: "该任务开始时在 LibreOffice Calc 中打开的实际工作簿。",
    }, {
      sourceUrl: "https://huggingface.co/datasets/xlangai/ubuntu_osworld_file_cache/blob/9f209d8d5f702857af8532ebdf925e627eae06ce/libreoffice_calc/01b269ae-2111-4a07-81fd-3fcd711993b0/Student_Level_Fill_Blank.xlsx",
      rawUrl: "https://huggingface.co/datasets/xlangai/ubuntu_osworld_file_cache/resolve/9f209d8d5f702857af8532ebdf925e627eae06ce/libreoffice_calc/01b269ae-2111-4a07-81fd-3fcd711993b0/Student_Level_Fill_Blank.xlsx",
    }),
    publisherMaterial("osworld-fill-down-calc", "01b269ae-2111-4a07-81fd-3fcd711993b0.json", "publisher-record", {
      en: "The exact public task definition containing the instruction, workbook setup, and evaluator wiring.",
      zh: "包含任务指令、工作簿设置及评测连接的准确公开任务定义。",
    }, {
      sourceUrl: "https://github.com/xlang-ai/OSWorld/blob/main/evaluation_examples/examples/libreoffice_calc/01b269ae-2111-4a07-81fd-3fcd711993b0.json",
      rawUrl: "https://raw.githubusercontent.com/xlang-ai/OSWorld/main/evaluation_examples/examples/libreoffice_calc/01b269ae-2111-4a07-81fd-3fcd711993b0.json",
    }),
  ],
  "apex-florida-diminished-value": [
    ...[
      "13_Airtechv.MacDonald.pdf",
      "13_FlaStat.319.30.pdf",
      "13_FlaStat.626.9743.pdf",
      "13_McHalev.FarmBureau.pdf",
      "13_Sieglev.Progressive.pdf",
    ].map((filename) => publisherMaterial("apex-florida-diminished-value", filename, "publisher-file", {
      en: "One of the five Florida authorities supplied with APEX task 13.",
      zh: "APEX 任务 13 随附的五份佛罗里达州法律资料之一。",
    }, {
      sourceUrl: `https://huggingface.co/datasets/mercor/APEX-v1-extended/blob/main/documents/13/${encodeURIComponent(filename)}`,
      rawUrl: `https://huggingface.co/datasets/mercor/APEX-v1-extended/resolve/main/documents/13/${encodeURIComponent(filename)}`,
    })),
  ],
  "arc-agi-3-ls20": [
    publisherMaterial("arc-agi-3-ls20", "ls20 / current frame + interaction history", "environment", {
      en: "The live visual grid, current level state, and prior interactions returned by environment ls20.",
      zh: "环境 ls20 返回的实时视觉网格、当前关卡状态及此前交互。",
    }),
    publisherMaterial("arc-agi-3-ls20", "ls20 / action_space", "tool-access", {
      en: "The discrete actions accepted by the environment API for probing and advancing the game.",
      zh: "环境 API 接受、用于探索并推进游戏的离散动作。",
    }),
  ],
  "deepsearchqa-oecd-criminality": [
    publisherMaterial("deepsearchqa-oecd-criminality", "public web", "open-web", {
      en: "Authoritative public webpages located during research; the benchmark row does not provide a fixed document bundle.",
      zh: "研究过程中定位的权威公共网页；该 Benchmark 数据行不提供固定文档包。",
    }),
  ],
  "mcp-atlas-assaultcube-dates": [
    publisherMaterial("mcp-atlas-assaultcube-dates", "task 689f4d693e212e8ef3390731 / ENABLED_TOOLS", "tool-access", {
      en: "The exact MCP servers, functions, and typed schemas enabled for this task's multi-source lookup.",
      zh: "为这项多来源检索任务启用的准确 MCP 服务器、函数及类型化 schema。",
    }),
  ],
  "nl2repo-aiofiles": [
    publisherMaterial("nl2repo-aiofiles", "test_files/aiofiles/start.md", "publisher-file", {
      en: "The publisher's natural-language repository specification and package requirements for the aiofiles reconstruction task.",
      zh: "发布方为 aiofiles 仓库重建任务提供的自然语言规格及软件包要求。",
    }, {
      sourceUrl: "https://github.com/multimodal-art-projection/NL2RepoBench/blob/781a1da1ee41fb8edb0bed22f586d69111610edf/test_files/aiofiles/start.md",
      rawUrl: "https://raw.githubusercontent.com/multimodal-art-projection/NL2RepoBench/781a1da1ee41fb8edb0bed22f586d69111610edf/test_files/aiofiles/start.md",
    }),
  ],
  "programbench-zoxide": [
    publisherMaterial("programbench-zoxide", "task.yaml", "publisher-record", {
      en: "The complete three-field task manifest pinning zoxide, its source revision, and implementation language.",
      zh: "完整的三字段任务清单，固定 zoxide、源代码版本及实现语言。",
    }, {
      sourceUrl: "https://github.com/facebookresearch/ProgramBench/blob/main/src/programbench/data/tasks/ajeetdsouza__zoxide.67ca1bc/task.yaml",
      rawUrl: "https://raw.githubusercontent.com/facebookresearch/ProgramBench/main/src/programbench/data/tasks/ajeetdsouza__zoxide.67ca1bc/task.yaml",
    }),
  ],
  "posttrainbench-aime2025": [
    publisherMaterial("posttrainbench-aime2025", "benchmark.txt", "publisher-record", {
      en: "The benchmark target named by this evaluation task.",
      zh: "该评测任务指定的基准目标。",
    }, {
      sourceUrl: "https://github.com/aisa-group/PostTrainBench/blob/main/src/eval/tasks/aime2025/benchmark.txt",
      rawUrl: "https://raw.githubusercontent.com/aisa-group/PostTrainBench/main/src/eval/tasks/aime2025/benchmark.txt",
    }),
    publisherMaterial("posttrainbench-aime2025", "info.json", "publisher-record", {
      en: "The AIME 2025 evaluator metadata shipped with the task.",
      zh: "任务随附的 AIME 2025 评测器元数据。",
    }, {
      sourceUrl: "https://github.com/aisa-group/PostTrainBench/blob/main/src/eval/tasks/aime2025/info.json",
      rawUrl: "https://raw.githubusercontent.com/aisa-group/PostTrainBench/main/src/eval/tasks/aime2025/info.json",
    }),
    publisherMaterial("posttrainbench-aime2025", "training runtime / base model + training examples", "environment", {
      en: "The benchmark-managed base model, training examples, and compute budget exposed to the training agent.",
      zh: "向训练 Agent 开放的 Benchmark 托管基础模型、训练样例及算力预算。",
    }),
  ],
  "spreadsheetbench-heading-of-max": [
    publisherMaterial("spreadsheetbench-heading-of-max", "data / task 59196 / source workbook", "publisher-file", {
      en: "The workbook attached to task 59196, including the target worksheet and cell in which the agent must write the formula.",
      zh: "任务 59196 随附的工作簿，其中包含智能体需要写入公式的目标工作表及单元格。",
    }),
  ],
  "spreadsheetbench-v2-pepsico-valuation": [
    publisherMaterial("spreadsheetbench-v2-pepsico-valuation", "Financial_Model / 09_01 / PepsiCo workbook", "publisher-file", {
      en: "The public v2 example workbook containing the source tabs and incomplete valuation worksheet.",
      zh: "公开 v2 样例工作簿，包含源数据工作表及未完成的估值页。",
    }),
  ],
  "swe-bench-pro-nodebb-email-validation": [
    publisherMaterial("swe-bench-pro-nodebb-email-validation", "instance_NodeBB__NodeBB-04998908ba6721d64eba79ae3b65a351dcfbc5b5-vnan", "publisher-record", {
      en: "The exact public instance row that pins the issue statement, repository revision, and test selection.",
      zh: "用于固定问题说明、代码仓库版本及测试选择的准确公开实例数据行。",
    }),
    publisherMaterial("swe-bench-pro-nodebb-email-validation", "NodeBB / base_commit 04998908ba6721d64eba79ae3b65a351dcfbc5b5", "repository", {
      en: "The NodeBB repository checkout supplied to the agent at the instance's pinned base commit.",
      zh: "在该实例固定基础提交上提供给智能体的 NodeBB 代码仓库检出。",
    }),
  ],
  "mmmu-pro-clinical-emergency": [
    publisherMaterial("mmmu-pro-clinical-emergency", "mmmu-pro/tool/static/images/test_Clinical_Medicine_69_1.png", "publisher-file", {
      en: "The clinical image attached to this exact public MMMU-Pro record.",
      zh: "随这条公开 MMMU-Pro 记录提供的临床图像。",
    }, {
      sourceUrl: "https://github.com/MMMU-Benchmark/MMMU/blob/268471d0d488258990025331c7528359c324aa25/mmmu-pro/tool/static/images/test_Clinical_Medicine_69_1.png",
      rawUrl: "https://raw.githubusercontent.com/MMMU-Benchmark/MMMU/268471d0d488258990025331c7528359c324aa25/mmmu-pro/tool/static/images/test_Clinical_Medicine_69_1.png",
      sizeBytes: 125462,
    }),
    publisherMaterial("mmmu-pro-clinical-emergency", "test_Clinical_Medicine_69 / options", "publisher-record", {
      en: "The candidate answer options supplied alongside the image and clinical question.",
      zh: "与图像及临床问题一同提供的候选答案选项。",
    }),
  ],
  "babyvision-tiger-grid": [
    publisherMaterial("babyvision-tiger-grid", "record 445 / Image", "publisher-file", {
      en: "The tiger-grid illustration associated with public result record 445.",
      zh: "与公开结果记录 445 关联的老虎网格插图。",
    }),
  ],
  "charxiv-session-accuracy-decline": [
    publisherMaterial("charxiv-session-accuracy-decline", "reasoning_val / figure_id 0", "publisher-file", {
      en: "The scientific chart image associated with figure 0 in the public reasoning_val split.",
      zh: "公开 reasoning_val 数据集中与图像 0 关联的科学图表。",
    }),
    publisherMaterial("charxiv-session-accuracy-decline", "reasoning_val / figure_id 0 / paper metadata", "publisher-record", {
      en: "The paper and figure metadata shipped alongside the chart for this question.",
      zh: "随该问题图表一同提供的论文及图像元数据。",
    }),
  ],
  "chartography-buckling-point": [
    publisherMaterial("chartography-buckling-point", "231da02d-d31f-4784-be11-4d41af0abf99_7c5e3849-473a-4863-ada2-10630661507f_71c769bd-8766-4b1f-9cb3-dabae6b0ebfc.png", "publisher-file", {
      en: "The engineering chart attached to this exact public Chartography row.",
      zh: "随这条公开 Chartography 数据行提供的工程图表。",
    }, {
      sourceUrl: "https://huggingface.co/datasets/surgeai/chartography/blob/a015621/charts/231da02d-d31f-4784-be11-4d41af0abf99_7c5e3849-473a-4863-ada2-10630661507f_71c769bd-8766-4b1f-9cb3-dabae6b0ebfc.png",
      rawUrl: "https://huggingface.co/datasets/surgeai/chartography/resolve/a015621/charts/231da02d-d31f-4784-be11-4d41af0abf99_7c5e3849-473a-4863-ada2-10630661507f_71c769bd-8766-4b1f-9cb3-dabae6b0ebfc.png",
    }),
    publisherMaterial("chartography-buckling-point", "8dd96592-3151-4d3b-a3a0-ff7b839c5d01 / chart metadata", "publisher-record", {
      en: "The structural chart annotations supplied with the image for grounded interpretation.",
      zh: "与图像一同提供、用于有依据解读的结构化图表注释。",
    }),
  ],
  "omnidocbench-newspaper-page": [
    publisherMaterial("omnidocbench-newspaper-page", "demo_data/omnidocbench_demo/images/newspaper_5e266dfd9c498cab274e12a7b4a75755_4.jpg", "publisher-file", {
      en: "The scanned or rendered newspaper page supplied as the complete input for this demo case.",
      zh: "作为该演示案例完整输入提供的扫描或渲染报纸页面。",
    }, {
      sourceUrl: "https://github.com/opendatalab/OmniDocBench/blob/193627ae9e97d89188468ed1ee3b7a856ff76044/demo_data/omnidocbench_demo/images/newspaper_5e266dfd9c498cab274e12a7b4a75755_4.jpg",
      rawUrl: "https://raw.githubusercontent.com/opendatalab/OmniDocBench/193627ae9e97d89188468ed1ee3b7a856ff76044/demo_data/omnidocbench_demo/images/newspaper_5e266dfd9c498cab274e12a7b4a75755_4.jpg",
      sizeBytes: 238945,
    }),
  ],
  "zerobench-loyalty-bottles": [
    publisherMaterial("zerobench-loyalty-bottles", "question_id 1 / image", "publisher-file", {
      en: "The puzzle image attached to question 1 in the official public no-answer release.",
      zh: "官方公开无答案版本中随问题 1 提供的谜题图像。",
    }),
  ],
  "cybergym-arvo-10400": [
    publisherMaterial("cybergym-arvo-10400", "arvo:10400 / vulnerable source checkout", "repository", {
      en: "The vulnerable project checkout pinned for arvo:10400 and supplied as the agent's working repository.",
      zh: "为 arvo:10400 固定并作为智能体工作仓库提供的易受攻击项目检出。",
    }),
    publisherMaterial("cybergym-arvo-10400", "arvo:10400 / reproducible build environment", "environment", {
      en: "The task's reproducible compiler, dependencies, and execution context used to build and test the repair.",
      zh: "用于构建并测试修复的可复现编译器、依赖及执行上下文。",
    }),
  ],
  "exploitbench-v8-cve-2024-1939": [
    publisherMaterial("exploitbench-v8-cve-2024-1939", "benchmarks/v8-small.yaml / v8-cve-2024-1939", "publisher-record", {
      en: "The exact public challenge entry describing the V8 target and declared success condition.",
      zh: "用于描述 V8 目标及声明成功条件的准确公开挑战条目。",
    }, {
      sourceUrl: "https://github.com/exploitbench/exploitbench/blob/main/benchmarks/v8-small.yaml",
      rawUrl: "https://raw.githubusercontent.com/exploitbench/exploitbench/main/benchmarks/v8-small.yaml",
    }),
    publisherMaterial("exploitbench-v8-cve-2024-1939", "v8-cve-2024-1939 / vulnerable V8 build", "environment", {
      en: "The pinned vulnerable V8 source or binary and execution environment supplied for exploit development.",
      zh: "为漏洞利用开发提供的固定易受攻击 V8 源码或二进制及执行环境。",
    }),
  ],
  "exploitgym-kernel-cve-2023-6111": exploitGymMaterials,
};

const publisherContractViews = Object.fromEntries(
  Object.entries(modelBenchmarkNativeTaskRecords).map(([sampleId, record]) => {
    if (sampleId.startsWith("tau-banking-")) return [sampleId, { kind: "publisher-contract" as const, materials: [] }];
    if (record.availability === "format-only") return [sampleId, { kind: "publisher-contract" as const, materials: [] }];
    const materials = publisherMaterialManifests[sampleId];
    if (!materials) throw new Error(`Missing concrete agent material manifest for ${sampleId}`);
    return [sampleId, {
      kind: "publisher-contract" as const,
      materials: materials.filter((material) => material.rawUrl),
      ...(publisherInstructionSources[sampleId] ? { promptSource: publisherInstructionSources[sampleId] } : {}),
    }];
  }),
);

export const modelBenchmarkAgentViews: Record<string, ModelBenchmarkAgentView> = {
  ...publisherContractViews,
  "tau-banking-card-selection": tauAgentView("task_001.json"),
  "tau-banking-credit-limit": tauAgentView("task_050.json"),
};
