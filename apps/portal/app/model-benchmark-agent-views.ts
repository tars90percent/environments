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

export type PublisherContractAgentView = {
  kind: "publisher-contract";
  materials: PublisherAgentMaterial[];
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
    }),
  ],
  "gdpval-retail-task-list": [
    publisherMaterial("gdpval-retail-task-list", "Daily Tasks.docx", "publisher-file", {
      en: "The source Word document supplied with this exact task; the agent turns its store instructions into the requested staff-ready PDF.",
      zh: "随这条任务提供的源 Word 文档；智能体需将其中的门店说明制作成可供员工使用的 PDF。",
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
    }),
  ],
  "toolathlon-ab-testing": [
    publisherMaterial("toolathlon-ab-testing", "tasks/finalpool/ab-testing", "publisher-record", {
      en: "The complete public task directory for the A/B-testing example.",
      zh: "该 A/B 测试示例的完整公开任务目录。",
    }),
    publisherMaterial("toolathlon-ab-testing", "configured tool servers / experiment resources", "tool-access", {
      en: "The external tool resources and typed functions enabled by this task's server configuration.",
      zh: "由该任务服务器配置启用的外部工具资源及类型化函数。",
    }),
  ],
  "ale-marketing-ab-test": [
    publisherMaterial("ale-marketing-ab-test", "tasks/business_finance/digital_marketing_ab_test_analysis_1/task_card.json", "publisher-record", {
      en: "The exact public task card that identifies the assignment and its declared input files.",
      zh: "用于标识这项任务及其声明输入文件的准确公开任务卡。",
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
    publisherMaterial("osworld-fill-down-calc", "libreoffice_calc / 01b269ae-2111-4a07-81fd-3fcd711993b0 / config + files", "environment", {
      en: "The exact starting workbook and LibreOffice Calc state loaded into the task's desktop VM.",
      zh: "载入该任务桌面虚拟机的准确起始工作簿及 LibreOffice Calc 状态。",
    }),
  ],
  "apex-florida-diminished-value": [
    publisherMaterial("apex-florida-diminished-value", "Task ID 13 / File Attachments", "publisher-file", {
      en: "The case documents linked from public APEX task 13 and supplied as the evidence base for the deliverable.",
      zh: "由公开 APEX 任务 13 链接、作为交付物证据基础的案件文档。",
    }),
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
      zh: "研究过程中定位的权威公共网页；该基准数据行不提供固定文档包。",
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
  "frontierswe-cranelift-codegen": [
    publisherMaterial("frontierswe-cranelift-codegen", "tasks/cranelift-codegen-opt", "repository", {
      en: "The public task directory containing the pinned Cranelift codebase context, task specification, and build setup supplied to the agent.",
      zh: "提供给智能体的公开任务目录，包含固定 Cranelift 代码上下文、任务规格及构建设置。",
    }),
  ],
  "programbench-zoxide": [
    publisherMaterial("programbench-zoxide", "src/programbench/data/tasks/ajeetdsouza__zoxide.67ca1bc", "repository", {
      en: "The public reconstruction task directory defining the zoxide target, starting repository state, and expected package surface.",
      zh: "用于定义 zoxide 目标、起始仓库状态及预期软件包接口的公开重建任务目录。",
    }),
  ],
  "posttrainbench-aime2025": [
    publisherMaterial("posttrainbench-aime2025", "src/eval/tasks/aime2025", "publisher-record", {
      en: "The public AIME 2025 evaluation-task configuration that defines the held-out target used during the post-training run.",
      zh: "用于定义后训练运行中保留目标的公开 AIME 2025 评测任务配置。",
    }),
    publisherMaterial("posttrainbench-aime2025", "training runtime / base model + training examples", "environment", {
      en: "The benchmark-managed base model, training examples, and compute budget exposed to the training agent.",
      zh: "向训练智能体开放的基准托管基础模型、训练样例及算力预算。",
    }),
  ],
  "spreadsheetbench-heading-of-max": [
    publisherMaterial("spreadsheetbench-heading-of-max", "data / task 59196 / source workbook", "publisher-file", {
      en: "The workbook attached to task 59196, including the target worksheet and cell in which the agent must write the formula.",
      zh: "任务 59196 随附的工作簿，其中包含智能体需要写入公式的目标工作表及单元格。",
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
  "swe-marathon-biofabric-rust": [
    publisherMaterial("swe-marathon-biofabric-rust", "tasks/biofabric-rust-rewrite", "repository", {
      en: "The complete public long-horizon task directory, including the existing implementation, fixtures, assets, and build context.",
      zh: "完整公开长时程任务目录，包含现有实现、测试夹具、资源及构建上下文。",
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
    publisherMaterial("chartography-buckling-point", "8dd96592-3151-4d3b-a3a0-ff7b839c5d01 / image", "publisher-file", {
      en: "The engineering chart attached to this exact public Chartography row.",
      zh: "随这条公开 Chartography 数据行提供的工程图表。",
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
    return [sampleId, { kind: "publisher-contract" as const, materials }];
  }),
);

export const modelBenchmarkAgentViews: Record<string, ModelBenchmarkAgentView> = {
  ...publisherContractViews,
  "tau-banking-card-selection": tauAgentView("task_001.json"),
  "tau-banking-credit-limit": tauAgentView("task_050.json"),
};
