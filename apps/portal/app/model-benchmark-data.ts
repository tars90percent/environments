export type BenchmarkReferenceLanguage = "en" | "zh";
export type BenchmarkReferenceCategoryId =
  | "professional-work"
  | "tools-computer-use"
  | "web-research"
  | "software-engineering"
  | "model-training"
  | "science-knowledge"
  | "documents-vision"
  | "cybersecurity";
export type BenchmarkReferenceAccess = "public" | "public-subset" | "gated" | "public-tasks" | "private";

export type BenchmarkReferenceLink = {
  label: { en: string; zh: string };
  url: string;
};

export type BenchmarkVersionChange = "initial" | "maintenance" | "expansion" | "major-revision" | "replacement" | "pruning";

export type BenchmarkVersionReference = {
  id: string;
  label: string;
  releasedAt?: string;
  change: BenchmarkVersionChange;
  questionCount: { en: string; zh: string };
  note: { en: string; zh: string };
  comparableToPrevious?: boolean;
  sourceUrl: string;
};

export type BenchmarkLeaderboardSnapshot = {
  benchmarkVersion?: string;
  imagePath: string;
  sourceUrl: string;
  capturedAt: string;
  alt: { en: string; zh: string };
  caption: { en: string; zh: string };
};

export type ModelBenchmarkReference = {
  id: string;
  legacyIds?: string[];
  name: string;
  aliases?: string[];
  creators: { en: string; zh: string };
  publisher: string;
  categoryId: BenchmarkReferenceCategoryId;
  version?: string;
  versionNote?: { en: string; zh: string };
  currentVersionId?: string;
  versions?: BenchmarkVersionReference[];
  summary: { en: string; zh: string };
  questionCount: { en: string; zh: string };
  repeats?: number;
  responseType?: { en: string; zh: string };
  scoring?: { en: string; zh: string };
  toolUse?: boolean;
  access?: BenchmarkReferenceAccess;
  leaderboardSnapshots?: BenchmarkLeaderboardSnapshot[];
  links: BenchmarkReferenceLink[];
};

export type BenchmarkReferenceCategory = {
  id: BenchmarkReferenceCategoryId;
  label: { en: string; zh: string };
  description: { en: string; zh: string };
};

export type AggregateBenchmarkReference = {
  id: string;
  name: string;
  publisher: string;
  version: string;
  releasedAt: string;
  verifiedAt: string;
  summary: { en: string; zh: string };
  links: BenchmarkReferenceLink[];
  components: Array<{
    benchmarkId: string;
    benchmarkVersion?: string;
    evaluationName: string;
    weight: number;
  }>;
};

export const benchmarkReferenceVerifiedAt = "2026-09-03";

export const benchmarkReferenceCategories = [
  {
    id: "professional-work",
    label: { en: "Professional work", zh: "专业工作" },
    description: { en: "Work products for finance, law, consulting, operations, and other professional settings.", zh: "面向金融、法律、咨询、运营及其他专业场景的工作成果。" },
  },
  {
    id: "tools-computer-use",
    label: { en: "Tools & computer use", zh: "工具与计算机操作" },
    description: { en: "Tasks completed through applications, APIs, terminals, or interactive environments.", zh: "通过应用、API、终端或交互式环境完成的任务。" },
  },
  {
    id: "web-research",
    label: { en: "Web research", zh: "网页研究" },
    description: { en: "Open-web investigation that requires finding and synthesizing dispersed evidence.", zh: "在开放网页中查找并综合分散证据的研究任务。" },
  },
  {
    id: "software-engineering",
    label: { en: "Software engineering", zh: "软件工程" },
    description: { en: "Repository-level implementation, repair, reconstruction, and code-quality work.", zh: "代码库级实现、修复、重建及代码质量工作。" },
  },
  {
    id: "model-training",
    label: { en: "Model training", zh: "模型训练" },
    description: { en: "Tasks where the primary deliverable is an improved or adapted model.", zh: "以改进或适配后的模型为主要交付物的任务。" },
  },
  {
    id: "science-knowledge",
    label: { en: "Science & knowledge", zh: "科学与知识" },
    description: { en: "Scientific problem solving, specialist knowledge, and factual reliability.", zh: "科学问题求解、专业知识与事实可靠性评测。" },
  },
  {
    id: "documents-vision",
    label: { en: "Documents & vision", zh: "文档与视觉" },
    description: { en: "Reasoning over documents, long contexts, charts, images, and page layouts.", zh: "针对文档、长上下文、图表、图像及页面布局的理解与推理。" },
  },
  {
    id: "cybersecurity",
    label: { en: "Cybersecurity", zh: "网络安全" },
    description: { en: "Vulnerability reproduction and exploit-development environments.", zh: "漏洞复现与漏洞利用开发环境。" },
  },
] satisfies BenchmarkReferenceCategory[];

export const artificialAnalysisIndex: AggregateBenchmarkReference = {
  id: "artificial-analysis-intelligence-index",
  name: "Artificial Analysis Intelligence Index",
  publisher: "Artificial Analysis",
  version: "4.1.1",
  releasedAt: "2026-08-06",
  verifiedAt: "2026-08-29",
  summary: {
    en: "A weighted aggregate of nine agentic, coding, general-knowledge, and scientific-reasoning evaluations.",
    zh: "由九项智能体、编程、通用知识与科学推理评测加权构成的综合指数。",
  },
  links: [
    { label: { en: "Methodology", zh: "方法说明" }, url: "https://artificialanalysis.ai/methodology/intelligence-benchmarking" },
    { label: { en: "Leaderboard", zh: "排行榜" }, url: "https://artificialanalysis.ai/evaluations/artificial-analysis-intelligence-index" },
    { label: { en: "Changelog", zh: "更新记录" }, url: "https://artificialanalysis.ai/changelog" },
  ],
  components: [
    { benchmarkId: "gdpval-aa-v2", evaluationName: "GDPval-AA v2", weight: 20 },
    { benchmarkId: "tau3-banking", evaluationName: "𝜏³-Banking", weight: 14 },
    { benchmarkId: "terminal-bench", benchmarkVersion: "v2.1", evaluationName: "Terminal-Bench v2.1", weight: 16 },
    { benchmarkId: "scicode", evaluationName: "SciCode", weight: 8 },
    { benchmarkId: "aa-lcr", evaluationName: "AA-LCR", weight: 6 },
    { benchmarkId: "aa-omniscience", evaluationName: "AA-Omniscience", weight: 12 },
    { benchmarkId: "hle", evaluationName: "Humanity's Last Exam · May 2025 text-only subset", weight: 12 },
    { benchmarkId: "gpqa-diamond", evaluationName: "GPQA Diamond", weight: 6 },
    { benchmarkId: "critpt", evaluationName: "CritPt · 70-test subset", weight: 6 },
  ],
};

export const aggregateBenchmarks = [artificialAnalysisIndex] satisfies AggregateBenchmarkReference[];

export const modelBenchmarks = [
    {
      id: "gdpval-aa-v2",
      name: "GDPval",
      aliases: ["GDPval-AA", "GDPval-Rubrics"],
      creators: { en: "Tejal Patwardhan, Rachel Dias, Elizabeth Proehl et al. at OpenAI, with experienced industry professionals", zh: "OpenAI 的 Tejal Patwardhan、Rachel Dias、Elizabeth Proehl 等人与资深行业专家" },
      publisher: "OpenAI",
      categoryId: "professional-work",
      version: "Public release v2",
      versionNote: {
        en: "GDPval-AA and GDPval-Rubrics are evaluation variants of this task family.",
        zh: "GDPval-AA 与 GDPval-Rubrics 是该任务家族的评测变体。",
      },
      summary: {
        en: "Economically valuable, multi-file knowledge work across 44 occupations and nine industries.",
        zh: "覆盖 44 个职业和 9 个行业、需要多文件交付的高经济价值知识工作。",
      },
      questionCount: { en: "1,320 tasks · 220 public gold tasks", zh: "1,320 项任务 · 220 项公开黄金任务" },
      repeats: 1,
      responseType: { en: "Agent-produced files", zh: "智能体生成文件" },
      scoring: { en: "Judge-panel pairwise Elo", zh: "评审模型组两两比较 Elo" },
      toolUse: true,
      access: "public",
      links: [
        { label: { en: "Public dataset", zh: "公开数据集" }, url: "https://huggingface.co/datasets/openai/gdpval" },
        { label: { en: "Agent harness", zh: "智能体框架" }, url: "https://github.com/ArtificialAnalysis/Stirrup" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2510.04374" },
      ],
    },
    {
      id: "tau3-banking",
      name: "𝜏³-Banking",
      aliases: ["tau3-banking", "tau2-bench banking"],
      creators: { en: "Sierra Research", zh: "Sierra Research" },
      publisher: "Sierra Research",
      categoryId: "tools-computer-use",
      version: "tau2-bench v1.0.1",
      versionNote: {
        en: "The banking evaluation uses the upstream v1.0.1 dataset and grader; the project retains the tau2-bench repository name.",
        zh: "银行评测使用上游 v1.0.1 数据集与评分器；项目仓库仍沿用 tau2-bench 名称。",
      },
      summary: {
        en: "Banking support agents retrieve from a large policy corpus and make multi-step account changes.",
        zh: "银行客服智能体从大型政策语料中检索信息，并执行多步骤账户操作。",
      },
      questionCount: { en: "97 tasks", zh: "97 项任务" },
      repeats: 5,
      responseType: { en: "Dual-control agent simulation", zh: "双控制智能体模拟" },
      scoring: { en: "Backend state, pass@1", zh: "后端状态，pass@1" },
      toolUse: true,
      access: "public",
      links: [
        { label: { en: "Dataset & code", zh: "数据集与代码" }, url: "https://github.com/sierra-research/tau2-bench" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2603.04370" },
      ],
    },
    {
      id: "terminal-bench",
      legacyIds: ["terminal-bench-2-1", "terminal-bench-3", "terminal-bench-4"],
      name: "Terminal-Bench",
      aliases: ["Terminal-Bench 1.0", "Terminal-Bench 2.0", "Terminal-Bench 2.1", "Terminal-Bench 3", "Terminal-Bench 4", "Frontier-Bench", "FrontierBench", "TB1", "TB2", "TB3", "TB4"],
      creators: { en: "Ryan Marten, Alex Shaw, Andy Konwinski, Ludwig Schmidt et al., with domain contributors and reviewers", zh: "Ryan Marten、Alex Shaw、Andy Konwinski、Ludwig Schmidt 等人与各领域贡献者及评审者" },
      publisher: "Harbor Framework · Laude Institute",
      categoryId: "software-engineering",
      version: "4.0.0",
      currentVersionId: "v4.0.0",
      versionNote: {
        en: "A curated 66-task revision of the TB3 set: all 66 tasks carry forward from 3.0.0, while eight TB3 tasks were removed. Every agent run has an eight-hour limit; three tasks require a GPU.",
        zh: "这是 TB3 任务集的 66 题精编版：66 题均沿用自 3.0.0，并移除了 8 道 TB3 任务。所有智能体运行时限均为 8 小时，其中 3 题需要 GPU。",
      },
      versions: [
        {
          id: "v4.0.0",
          label: "4.0.0",
          change: "pruning",
          questionCount: { en: "66 tasks", zh: "66 项任务" },
          note: { en: "Carries forward all 66 surviving TB3 tasks, removes eight, repairs 19, and standardizes eight-hour runs.", zh: "沿用 TB3 中保留的全部 66 项任务，移除 8 项、修复 19 项，并统一采用 8 小时运行时限。" },
          comparableToPrevious: false,
          sourceUrl: "https://www.tbench.ai/news/terminal-bench-4-0",
        },
        {
          id: "v3.0.0",
          label: "3.0.0",
          change: "replacement",
          questionCount: { en: "74 tasks", zh: "74 项任务" },
          note: { en: "A near-wholesale new generation first released as Frontier-Bench; only one public task ID overlaps with 2.1.", zh: "几乎全新的任务世代，最初以 Frontier-Bench 发布；公开任务 ID 中仅 1 项与 2.1 重合。" },
          comparableToPrevious: false,
          sourceUrl: "https://github.com/harbor-framework/terminal-bench/releases/tag/v3.0.0",
        },
        {
          id: "v2.1",
          label: "2.1",
          change: "maintenance",
          questionCount: { en: "89 tasks", zh: "89 项任务" },
          note: { en: "Keeps the 2.0 task set while repairing 28 environment, resource, and specification issues.", zh: "保留 2.0 的任务集，同时修复 28 项环境、资源与任务规范问题。" },
          comparableToPrevious: false,
          sourceUrl: "https://www.tbench.ai/news/terminal-bench-2-1",
        },
        {
          id: "v2.0",
          label: "2.0",
          change: "major-revision",
          questionCount: { en: "89 tasks", zh: "89 项任务" },
          note: { en: "A harder, reverified major refresh of the original benchmark.", zh: "相较原始基准更困难、并经过重新验证的重大更新。" },
          comparableToPrevious: false,
          sourceUrl: "https://www.tbench.ai/news/announcement-2-0",
        },
        {
          id: "v1.0",
          label: "1.0",
          change: "initial",
          questionCount: { en: "80 tasks", zh: "80 项任务" },
          note: { en: "The original Terminal-Bench task set for terminal-operating agents.", zh: "面向终端操作智能体的首代 Terminal-Bench 任务集。" },
          sourceUrl: "https://www.tbench.ai/benchmarks",
        },
      ],
      summary: {
        en: "The current continuous Terminal-Bench release preserves TB3's seven-domain mix while tightening the task set and standardizing long agent budgets.",
        zh: "当前持续演进的 Terminal-Bench 版本保留 TB3 的七领域构成，同时收紧任务集并统一长时程智能体预算。",
      },
      questionCount: { en: "66 tasks · Software 18, Science 14, ML 11, Operations 9, Security 5, Hardware 5, Media 4", zh: "66 项任务 · 软件 18、科学 14、机器学习 11、运营 9、安全 5、硬件 5、媒体 4" },
      repeats: 5,
      responseType: { en: "Terminal task execution and file artifacts", zh: "终端任务执行与文件产物" },
      scoring: { en: "Task-specific executable verifiers, mean reward", zh: "任务专属可执行验证器，平均奖励" },
      toolUse: false,
      access: "public",
      leaderboardSnapshots: [{
        benchmarkVersion: "v2.1",
        imagePath: "/benchmark-leaderboards/terminal-bench-2-1.jpg",
        sourceUrl: "https://www.tbench.ai/?version=2.1",
        capturedAt: "2026-08-31",
        alt: { en: "Official Terminal-Bench 2.1 leaderboard with ranked agent resolution rates", zh: "Terminal-Bench 2.1 官方排行榜，展示智能体排名与任务解决率" },
        caption: { en: "A version-specific historical snapshot; the catalog card otherwise presents current Terminal-Bench 4 information.", zh: "这是特定版本的历史截图；目录卡片中的其他信息以当前 Terminal-Bench 4 为准。" },
      }],
      links: [
        { label: { en: "4.0.0 release", zh: "4.0.0 版本" }, url: "https://github.com/harbor-framework/terminal-bench/releases/tag/v4.0.0" },
        { label: { en: "Tagged task set", zh: "固定版本任务集" }, url: "https://github.com/harbor-framework/terminal-bench/tree/v4.0.0/tasks" },
        { label: { en: "Harbor Hub", zh: "Harbor Hub" }, url: "https://hub.harborframework.com/datasets/terminal-bench/terminal-bench/latest" },
      ],
    },
    {
      id: "terminal-bench-science",
      name: "Terminal-Bench-Science",
      aliases: ["TB-Science", "Terminal Bench Science"],
      creators: { en: "Steven Dillmann, Sanmi Koyejo, Ludwig Schmidt et al., with scientific contributors and reviewers", zh: "Steven Dillmann、Sanmi Koyejo、Ludwig Schmidt 等人与科学任务贡献者及评审者" },
      publisher: "Stanford University · Laude Institute · Harbor Framework",
      categoryId: "science-knowledge",
      version: "0.1.0",
      versionNote: {
        en: "The first tagged release contains 70 expert-curated research workflows. The median expert estimate is 12 hours, and every agent run has an eight-hour limit.",
        zh: "首个固定版本包含 70 项专家策划的科研工作流。专家工时估计中位数为 12 小时，每次智能体运行时限为 8 小时。",
      },
      summary: {
        en: "Objectively verified terminal workflows drawn from real scientific research across life, physical, earth, mathematical, and engineering sciences.",
        zh: "来自真实科研工作的可客观验证终端任务，覆盖生命、物理、地球、数学与工程科学。",
      },
      questionCount: { en: "70 tasks · Life 19, Physical 17, Mathematical 17, Engineering 9, Earth 8", zh: "70 项任务 · 生命科学 19、物理科学 17、数学科学 17、工程科学 9、地球科学 8" },
      repeats: 5,
      responseType: { en: "Scientific code, analyses, models, and data artifacts", zh: "科学代码、分析、模型与数据产物" },
      scoring: { en: "Task-specific executable verifiers, mean reward", zh: "任务专属可执行验证器，平均奖励" },
      toolUse: false,
      access: "public",
      links: [
        { label: { en: "Benchmark site", zh: "Benchmark 官网" }, url: "https://terminal-bench-science.ai/" },
        { label: { en: "0.1.0 release", zh: "0.1.0 版本" }, url: "https://github.com/harbor-framework/terminal-bench-science/releases/tag/v0.1.0" },
        { label: { en: "Tagged task set", zh: "固定版本任务集" }, url: "https://github.com/harbor-framework/terminal-bench-science/tree/v0.1.0/tasks" },
        { label: { en: "Harbor Hub", zh: "Harbor Hub" }, url: "https://hub.harborframework.com/datasets/terminal-bench-science/terminal-bench-science/latest" },
      ],
    },
    {
      id: "scicode",
      name: "SciCode",
      creators: { en: "SciCode research team", zh: "SciCode 研究团队" },
      publisher: "SciCode research team",
      categoryId: "science-knowledge",
      version: "Current public test set · unversioned",
      versionNote: {
        en: "No semantic dataset release is published; the test set includes scientist-authored background.",
        zh: "发布方未提供语义化版本号；测试集包含科学家编写的背景材料。",
      },
      summary: {
        en: "Python program synthesis for realistic scientific problems across 16 disciplines.",
        zh: "覆盖 16 个学科的真实科学问题 Python 程序合成。",
      },
      questionCount: { en: "288 test subproblems", zh: "288 个测试子问题" },
      repeats: 3,
      responseType: { en: "Python code", zh: "Python 代码" },
      scoring: { en: "Unit-test execution, pass@1", zh: "单元测试执行，pass@1" },
      toolUse: false,
      access: "public",
      links: [
        { label: { en: "Dataset", zh: "数据集" }, url: "https://huggingface.co/datasets/SciCode1/SciCode" },
        { label: { en: "Evaluation code", zh: "评测代码" }, url: "https://github.com/scicode-bench/SciCode" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2407.13168" },
      ],
    },
    {
      id: "aa-lcr",
      name: "AA-LCR",
      creators: { en: "Artificial Analysis", zh: "Artificial Analysis" },
      publisher: "Artificial Analysis",
      categoryId: "documents-vision",
      version: "Current public dataset · unversioned",
      versionNote: {
        en: "The dataset has no semantic version; index v4.1.1 uses GPT-5.6 Luna (medium) as its equality checker.",
        zh: "该数据集未设语义版本号；指数 v4.1.1 使用 GPT-5.6 Luna（medium）作等价性评分器。",
      },
      summary: {
        en: "Reasoning across sets of long documents totaling roughly 100k tokens per question.",
        zh: "对每题约 10 万 token 的多份长文档进行综合推理。",
      },
      questionCount: { en: "100 questions", zh: "100 道题" },
      repeats: 3,
      responseType: { en: "Open answer", zh: "开放式回答" },
      scoring: { en: "LLM equality checker, pass@1", zh: "LLM 等价性评分，pass@1" },
      toolUse: false,
      access: "public",
      links: [
        { label: { en: "Dataset", zh: "数据集" }, url: "https://huggingface.co/datasets/ArtificialAnalysis/AA-LCR" },
        { label: { en: "Release article", zh: "发布文章" }, url: "https://artificialanalysis.ai/articles/announcing-aa-lcr" },
      ],
    },
    {
      id: "aa-omniscience",
      name: "AA-Omniscience",
      creators: { en: "Artificial Analysis", zh: "Artificial Analysis" },
      publisher: "Artificial Analysis",
      categoryId: "science-knowledge",
      version: "Current production set · unversioned",
      versionNote: {
        en: "A representative public subset is available; the full evaluation set is not released.",
        zh: "发布方提供具有代表性的公开子集；完整评测集未发布。",
      },
      summary: {
        en: "Cross-domain factual reliability that rewards correct knowledge and penalizes hallucinated guesses.",
        zh: "跨领域事实可靠性评测：奖励正确知识，惩罚幻觉式猜测。",
      },
      questionCount: { en: "6,000 questions", zh: "6,000 道题" },
      repeats: 1,
      responseType: { en: "Open answer or abstention", zh: "开放式回答或拒答" },
      scoring: { en: "Accuracy + non-hallucination", zh: "准确率 + 非幻觉率" },
      toolUse: false,
      access: "public-subset",
      links: [
        { label: { en: "Public 10% subset", zh: "公开 10% 子集" }, url: "https://huggingface.co/datasets/ArtificialAnalysis/AA-Omniscience-Public" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2511.13029" },
      ],
    },
    {
      id: "hle",
      name: "Humanity's Last Exam",
      creators: { en: "Center for AI Safety, Scale AI, and global subject experts", zh: "Center for AI Safety、Scale AI 与全球学科专家" },
      publisher: "Center for AI Safety",
      categoryId: "science-knowledge",
      version: "May 2025 revision",
      versionNote: {
        en: "The revision spans text and multimodal formats; upstream also maintains HLE-Rolling.",
        zh: "该修订版涵盖纯文本及多模态问题；上游另维护 HLE-Rolling。",
      },
      summary: {
        en: "Expert-vetted frontier academic questions across mathematics, sciences, and humanities.",
        zh: "经专家审核，覆盖数学、科学与人文学科的前沿学术问题。",
      },
      questionCount: { en: "2,500 multimodal questions", zh: "2,500 道多模态问题" },
      repeats: 1,
      responseType: { en: "Open answer", zh: "开放式回答" },
      scoring: { en: "LLM equality checker, pass@1", zh: "LLM 等价性评分，pass@1" },
      toolUse: false,
      access: "gated",
      leaderboardSnapshots: [{
        imagePath: "/benchmark-leaderboards/humanitys-last-exam.jpg",
        sourceUrl: "https://labs.scale.com/leaderboard/humanitys_last_exam",
        capturedAt: "2026-08-31",
        alt: { en: "Official Humanity's Last Exam leaderboard with horizontal model score bars", zh: "Humanity's Last Exam 官方排行榜，使用横向条形图比较模型得分" },
        caption: { en: "Scale Labs' official full-benchmark comparison. The image reflects the live leaderboard at capture time, rather than a frozen May 2025 result set.", zh: "Scale Labs 的官方完整基准对比；图片反映截图时的实时排行榜，而非固定在 2025 年 5 月的结果集。" },
      }],
      links: [
        { label: { en: "Gated dataset", zh: "受控数据集" }, url: "https://huggingface.co/datasets/cais/hle" },
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/centerforaisafety/hle" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2501.14249" },
      ],
    },
    {
      id: "gpqa-diamond",
      name: "GPQA",
      aliases: ["GPQA Main", "GPQA Diamond"],
      creators: { en: "David Rein, Betty Li Hou, Asa Cooper Stickland, Jackson Petty et al.", zh: "David Rein、Betty Li Hou、Asa Cooper Stickland、Jackson Petty 等人" },
      publisher: "David Rein · GPQA authors",
      categoryId: "science-knowledge",
      version: "Main and Diamond splits",
      versionNote: {
        en: "The Diamond split is the original authors' highest-quality subset. It has no separate semantic version and remains access-gated.",
        zh: "Diamond 是原作者定义的最高质量子集，无独立语义版本号，并保持受控访问。",
      },
      summary: {
        en: "Graduate-level biology, physics, and chemistry questions designed to resist web search by non-experts.",
        zh: "面向研究生水平的生物、物理和化学问题，旨在让非专家难以通过网络检索作答。",
      },
      questionCount: { en: "448 questions · 198 in Diamond", zh: "448 道题 · Diamond 子集 198 道" },
      repeats: 5,
      responseType: { en: "Four-option multiple choice", zh: "四选一" },
      scoring: { en: "Regex extraction, pass@1", zh: "正则提取，pass@1" },
      toolUse: false,
      access: "gated",
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/idavidrein/gpqa" },
        { label: { en: "Gated dataset", zh: "受控数据集" }, url: "https://huggingface.co/datasets/Idavidrein/gpqa" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2311.12022" },
        { label: { en: "AA evaluation code", zh: "AA 评测代码" }, url: "https://github.com/openai/simple-evals/blob/main/gpqa_eval.py" },
      ],
    },
    {
      id: "critpt",
      name: "CritPt",
      creators: { en: "CritPt research team", zh: "CritPt 研究团队" },
      publisher: "CritPt research team",
      categoryId: "science-knowledge",
      version: "2025 public release",
      versionNote: {
        en: "The project is unversioned, and the official grading API is access-controlled.",
        zh: "项目未设置版本号；官方评分 API 需申请访问。",
      },
      summary: {
        en: "Research-level physics challenges spanning symbolic, numerical, and executable answers.",
        zh: "覆盖符号、数值及可执行答案的研究级物理挑战。",
      },
      questionCount: { en: "70 test challenges", zh: "70 项测试挑战" },
      repeats: 5,
      responseType: { en: "Functions, expressions, numbers", zh: "函数、表达式与数值" },
      scoring: { en: "Controlled official grader, pass@1", zh: "受控官方评分器，pass@1" },
      toolUse: false,
      access: "public-tasks",
      leaderboardSnapshots: [{
        imagePath: "/benchmark-leaderboards/critpt.jpg",
        sourceUrl: "https://artificialanalysis.ai/evaluations/critpt",
        capturedAt: "2026-08-31",
        alt: { en: "Official CritPt leaderboard score chart comparing evaluated models", zh: "CritPt 官方排行榜得分图，比较已评测模型" },
        caption: { en: "Artificial Analysis' official score distribution makes the benchmark's low absolute accuracy and model spread immediately visible.", zh: "Artificial Analysis 的官方得分分布图直观呈现了该基准的低绝对准确率及模型间差距。" },
      }],
      links: [
        { label: { en: "Dataset", zh: "数据集" }, url: "https://huggingface.co/datasets/CritPt-Benchmark/CritPt" },
        { label: { en: "Evaluation code", zh: "评测代码" }, url: "https://github.com/CritPt-Benchmark/CritPt" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2509.26574" },
      ],
    },
    {
      id: "automationbench",
      name: "AutomationBench",
      creators: { en: "Daniel Shepard and Robin Salimans at Zapier", zh: "Zapier 的 Daniel Shepard 与 Robin Salimans" },
      publisher: "Zapier",
      categoryId: "tools-computer-use",
      summary: { en: "Cross-application workflows executed across simulated SaaS tools.", zh: "跨模拟 SaaS 工具执行的跨应用工作流。" },
      questionCount: { en: "600 scored workflows", zh: "600 项计分工作流" },
      access: "public",
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/zapier/AutomationBench" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2604.18934" },
      ],
    },
    {
      id: "toolathlon",
      name: "Toolathlon",
      creators: { en: "Junlong Li, Wenshuo Zhao, Jian Zhao et al., led by HKUST NLP", zh: "Junlong Li、Wenshuo Zhao、Jian Zhao 等人，HKUST NLP 牵头" },
      publisher: "HKUST NLP",
      categoryId: "tools-computer-use",
      summary: { en: "Manually sourced or crafted workflows spanning many applications and tools.", zh: "人工收集或设计、覆盖多种应用与工具的工作流。" },
      questionCount: { en: "108 workflows · 32 applications · 604 tools", zh: "108 项工作流 · 32 个应用 · 604 个工具" },
      access: "public",
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/hkust-nlp/Toolathlon" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2510.25726" },
      ],
    },
    {
      id: "agents-last-exam",
      name: "Agents' Last Exam",
      creators: { en: "Yiyou Sun et al., UC Berkeley RDI, and 250+ professional experts", zh: "Yiyou Sun 等人、UC Berkeley RDI 与 250 多位专业专家" },
      publisher: "UC Berkeley RDI",
      categoryId: "tools-computer-use",
      summary: { en: "A growing collection of verifiable professional workflows.", zh: "持续扩充的可验证专业工作流集合。" },
      questionCount: { en: "1,000+ workflows", zh: "1,000 多项工作流" },
      access: "public-tasks",
      leaderboardSnapshots: [{
        imagePath: "/benchmark-leaderboards/agents-last-exam.jpg",
        sourceUrl: "https://agents-last-exam.org/leaderboard",
        capturedAt: "2026-08-31",
        alt: { en: "Official Agents' Last Exam overall pass-rate leaderboard", zh: "Agents' Last Exam 官方总体通过率排行榜" },
        caption: { en: "The official ALE-V1 overall view separates perfect-score pass rate from partial-credit score and exposes several task splits.", zh: "官方 ALE-V1 总体视图区分满分通过率与部分得分，并提供多个任务分组。" },
      }],
      links: [
        { label: { en: "Contributors", zh: "贡献者" }, url: "https://agents-last-exam.org/contributors" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2606.05405" },
      ],
    },
    {
      id: "browsecomp",
      name: "BrowseComp",
      creators: { en: "Jason Wei, Zhiqing Sun, Spencer Papay et al. at OpenAI", zh: "OpenAI 的 Jason Wei、Zhiqing Sun、Spencer Papay 等人" },
      publisher: "OpenAI",
      categoryId: "web-research",
      summary: { en: "Purpose-built web-research questions whose answers are difficult to locate.", zh: "专门设计、答案难以检索的网页研究问题。" },
      questionCount: { en: "1,266 questions", zh: "1,266 道问题" },
      access: "public",
      links: [
        { label: { en: "Evaluation code", zh: "评测代码" }, url: "https://github.com/openai/simple-evals" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2504.12516" },
      ],
    },
    {
      id: "officeqa-pro",
      name: "OfficeQA Pro",
      creators: { en: "Krista Opsahl-Ong, Arnav Singhvi, Jasmine Collins et al. at Databricks AI Research", zh: "Databricks AI Research 的 Krista Opsahl-Ong、Arnav Singhvi、Jasmine Collins 等人" },
      publisher: "Databricks",
      categoryId: "documents-vision",
      summary: { en: "Multi-document reasoning questions grounded in U.S. Treasury material.", zh: "基于美国财政部材料的多文档推理问题。" },
      questionCount: { en: "133 questions", zh: "133 道问题" },
      access: "gated",
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/databricks/officeqa" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2603.08655" },
      ],
    },
    {
      id: "osworld",
      name: "OSWorld",
      aliases: ["OSWorld 1.0", "OSWorld Verified", "OSWorld 2.0"],
      creators: { en: "Tianbao Xie, Danyang Zhang, Jixuan Chen et al.; OSWorld 2.0 by Mengqi Yuan, Zilong Zhou, Xinzhuang Xiong et al.", zh: "Tianbao Xie、Danyang Zhang、Jixuan Chen 等人；OSWorld 2.0 由 Mengqi Yuan、Zilong Zhou、Xinzhuang Xiong 等人创建" },
      publisher: "XLANG",
      categoryId: "tools-computer-use",
      version: "2.0",
      currentVersionId: "v2.0",
      versionNote: { en: "The current release is a newly constructed set of 108 long-horizon workflows rather than an append-only extension of v1. Official task classes and complete assets require accepting the publisher's gated datasets.", zh: "当前版本由 108 项全新构建的长时程工作流组成，并非仅在 v1 上追加任务。官方任务类与完整资源需接受发布方的受控数据集条款后获取。" },
      versions: [
        {
          id: "v2.0",
          label: "2.0",
          change: "replacement",
          questionCount: { en: "108 tasks", zh: "108 项任务" },
          note: { en: "A new long-horizon task set with a separately released environment, task repository, and evaluation protocol.", zh: "全新的长时程任务集，配套独立发布的环境、任务仓库与评测协议。" },
          comparableToPrevious: false,
          sourceUrl: "https://github.com/xlang-ai/OSWorld-V2",
        },
        {
          id: "verified",
          label: "Verified",
          change: "maintenance",
          questionCount: { en: "Reviewed v1 task set", zh: "经审核的 v1 任务集" },
          note: { en: "A human-reviewed correction of the original task collection.", zh: "对原始任务集进行人工审核与修正的版本。" },
          comparableToPrevious: false,
          sourceUrl: "https://os-world.github.io/",
        },
        {
          id: "v1.0",
          label: "1.0",
          change: "initial",
          questionCount: { en: "369 tasks", zh: "369 项任务" },
          note: { en: "The original cross-application desktop computer-use benchmark.", zh: "最初的跨应用桌面计算机操作基准。" },
          sourceUrl: "https://arxiv.org/abs/2404.07972",
        },
      ],
      summary: { en: "Long-horizon computer-use workflows in realistic desktop environments.", zh: "在真实桌面环境中执行的长时程计算机操作工作流。" },
      questionCount: { en: "108 tasks", zh: "108 项任务" },
      access: "gated",
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/xlang-ai/OSWorld-V2" },
        { label: { en: "Gated task classes", zh: "受控任务类" }, url: "https://huggingface.co/datasets/xlangai/osworld_v2_tasks" },
        { label: { en: "Original paper", zh: "原版论文" }, url: "https://arxiv.org/abs/2404.07972" },
        { label: { en: "2.0 paper", zh: "2.0 论文" }, url: "https://arxiv.org/abs/2606.29537" },
      ],
    },
    {
      id: "apex-agents",
      name: "APEX-Agents",
      creators: { en: "Bertie Vidgen, Austin Mann, Abby Fennelly et al. at Mercor, with professional task authors", zh: "Mercor 的 Bertie Vidgen、Austin Mann、Abby Fennelly 等人与专业任务作者" },
      publisher: "Mercor",
      categoryId: "professional-work",
      summary: { en: "Professional-services tasks authored by bankers, consultants, and lawyers in application environments.", zh: "由银行家、咨询顾问和律师编写、在应用环境中完成的专业服务任务。" },
      questionCount: { en: "480 tasks", zh: "480 项任务" },
      access: "public",
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/Mercor-Intelligence/apex-evals" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2601.14242" },
      ],
    },
    {
      id: "arc-agi-3",
      name: "ARC-AGI-3",
      creators: { en: "ARC Prize Foundation with human game and environment designers", zh: "ARC Prize Foundation 与人类游戏及环境设计师" },
      publisher: "ARC Prize Foundation",
      categoryId: "tools-computer-use",
      summary: { en: "Interactive environments testing exploration and the inference of unstated goals.", zh: "测试探索能力与隐含目标推断的交互式环境。" },
      questionCount: { en: "New interactive environments", zh: "全新交互式环境" },
      access: "public",
      links: [
        { label: { en: "Project", zh: "项目主页" }, url: "https://arcprize.org/arc-agi/3" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2603.24621" },
      ],
    },
    {
      id: "cursorbench",
      name: "CursorBench",
      aliases: ["CursorBench 3.0", "CursorBench 3.1", "CursorBench 3.2"],
      creators: { en: "Cursor's internal evaluation team", zh: "Cursor 内部评测团队" },
      publisher: "Cursor · Anysphere",
      categoryId: "software-engineering",
      version: "3.2",
      currentVersionId: "v3.2",
      versionNote: { en: "The current private suite adds instruction-following and advanced tool-use problems to the earlier edit, review, planning, and codebase-understanding mix.", zh: "当前私有任务集在早期编辑、审查、规划与代码库理解任务基础上，新增指令遵循和高级工具使用问题。" },
      versions: [
        {
          id: "v3.2",
          label: "3.2",
          change: "expansion",
          questionCount: { en: "Private task suite", zh: "私有任务集" },
          note: { en: "Adds instruction-following and advanced tool-use problems; exact task retention is not disclosed.", zh: "新增指令遵循与高级工具使用问题；未披露具体任务沿用情况。" },
          comparableToPrevious: false,
          sourceUrl: "https://cursor.com/cursorbench",
        },
        {
          id: "v3.1",
          label: "3.1",
          change: "expansion",
          questionCount: { en: "Private task suite", zh: "私有任务集" },
          note: { en: "Introduces codebase-understanding, bug-finding, planning, and code-review problems and improves some edit-task graders.", zh: "引入代码库理解、缺陷发现、规划与代码审查问题，并改进部分编辑任务的评分器。" },
          comparableToPrevious: false,
          sourceUrl: "https://cursor.com/cursorbench",
        },
        {
          id: "v3.0",
          label: "3.0",
          change: "initial",
          questionCount: { en: "Private task suite", zh: "私有任务集" },
          note: { en: "The initial documented suite of editing, refactoring, and bug-fix tasks.", zh: "首个有公开说明的编辑、重构与缺陷修复任务集。" },
          sourceUrl: "https://cursor.com/cursorbench",
        },
      ],
      summary: { en: "Ambiguous, multi-file coding tasks derived from real Cursor engineering sessions.", zh: "源自真实 Cursor 工程会话、具有歧义且涉及多文件的编程任务。" },
      questionCount: { en: "Private task suite", zh: "私有任务集" },
      access: "private",
      links: [
        { label: { en: "Benchmark", zh: "基准说明" }, url: "https://cursor.com/cursorbench" },
        { label: { en: "Methodology", zh: "方法说明" }, url: "https://cursor.com/blog/cursorbench" },
      ],
    },
    {
      id: "deepsearchqa",
      name: "DeepSearchQA",
      creators: { en: "Nikita Gupta, Riju Chatterjee, Lukas Haas et al. at Google", zh: "Google 的 Nikita Gupta、Riju Chatterjee、Lukas Haas 等人" },
      publisher: "Google",
      categoryId: "web-research",
      summary: { en: "Handcrafted questions requiring exhaustive, multi-step web research.", zh: "需要穷尽式多步骤网页研究的人工编写问题。" },
      questionCount: { en: "900 questions", zh: "900 道问题" },
      access: "public",
      links: [
        { label: { en: "Dataset", zh: "数据集" }, url: "https://huggingface.co/datasets/google/deepsearchqa" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2601.20975" },
      ],
    },
    {
      id: "mcp-atlas",
      name: "MCP-Atlas",
      creators: { en: "Chaithanya Bandi, Ben Hertzberg, Geobio Boo et al. at Scale AI", zh: "Scale AI 的 Chaithanya Bandi、Ben Hertzberg、Geobio Boo 等人" },
      publisher: "Scale AI",
      categoryId: "tools-computer-use",
      summary: { en: "Human-authored tool-use tasks running over real MCP servers.", zh: "在真实 MCP 服务器上运行的人类编写工具使用任务。" },
      questionCount: { en: "1,000 tasks · 500 public", zh: "1,000 项任务 · 500 项公开" },
      access: "public-subset",
      leaderboardSnapshots: [{
        imagePath: "/benchmark-leaderboards/mcp-atlas.jpg",
        sourceUrl: "https://labs.scale.com/leaderboard/mcp_atlas",
        capturedAt: "2026-08-31",
        alt: { en: "Official MCP-Atlas performance comparison with ranked horizontal score bars", zh: "MCP-Atlas 官方性能对比，使用横向得分条展示排名" },
        caption: { en: "Scale Labs' official comparison places model pass rates and confidence intervals beside the benchmark methodology.", zh: "Scale Labs 的官方对比将模型通过率与置信区间同基准方法说明并列展示。" },
      }],
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/scaleapi/mcp-atlas" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2602.00933" },
      ],
    },
    {
      id: "deepswe",
      name: "DeepSWE",
      aliases: ["DeepSWE v1", "DeepSWE v1.1"],
      creators: { en: "Wenqi Huang, Charley Lee, Leonard Tng, and Serena Ge at Datacurve", zh: "Datacurve 的 Wenqi Huang、Charley Lee、Leonard Tng 与 Serena Ge" },
      publisher: "Datacurve",
      categoryId: "software-engineering",
      version: "v1.1",
      currentVersionId: "v1.1",
      versionNote: { en: "The current release keeps the same 113 tasks while isolating verification, repairing dependency drift, and removing flaky tests.", zh: "当前版本保留相同的 113 项任务，同时隔离验证环境、修复依赖漂移并移除不稳定测试。" },
      versions: [
        {
          id: "v1.1",
          label: "v1.1",
          change: "maintenance",
          questionCount: { en: "113 tasks · 91 repositories", zh: "113 项任务 · 91 个代码库" },
          note: { en: "The same task set with updated execution and grading, including an isolated verifier environment.", zh: "保留相同任务集，更新执行与评分方式，包括独立的验证环境。" },
          comparableToPrevious: false,
          sourceUrl: "https://deepswe.datacurve.ai/blog/deepswe-v1-1",
        },
        {
          id: "v1",
          label: "v1",
          change: "initial",
          questionCount: { en: "113 tasks · 91 repositories", zh: "113 项任务 · 91 个代码库" },
          note: { en: "The original long-horizon software-engineering task release.", zh: "最初的长时程软件工程任务版本。" },
          sourceUrl: "https://deepswe.datacurve.ai/",
        },
      ],
      summary: { en: "Original software-engineering tasks written across active repositories.", zh: "围绕活跃代码库从零编写的软件工程任务。" },
      questionCount: { en: "113 tasks · 91 repositories", zh: "113 项任务 · 91 个代码库" },
      access: "public",
      leaderboardSnapshots: [{
        benchmarkVersion: "v1.1",
        imagePath: "/benchmark-leaderboards/deepswe.jpg",
        sourceUrl: "https://deepswe.datacurve.ai/",
        capturedAt: "2026-08-31",
        alt: { en: "Official DeepSWE v1.1 leaderboard chart comparing benchmark score and average cost", zh: "DeepSWE v1.1 官方排行榜图表，比较基准得分与平均成本" },
        caption: { en: "Datacurve's official v1.1 view plots DeepSWE score against average cost and lets readers switch to output-token or agent-step comparisons.", zh: "Datacurve 的官方 v1.1 视图将 DeepSWE 得分与平均成本放在同一图中，并可切换到输出 Token 或智能体步数对比。" },
      }],
      links: [
        { label: { en: "Leaderboard", zh: "排行榜" }, url: "https://deepswe.datacurve.ai/" },
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/datacurve-ai/deep-swe" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2607.07946" },
      ],
    },
    {
      id: "nl2repo-bench",
      name: "NL2Repo-Bench",
      creators: { en: "Jingzhe Ding, Shengda Long, Changxin Pu et al., led by ByteDance Seed and M-A-P", zh: "Jingzhe Ding、Shengda Long、Changxin Pu 等人，ByteDance Seed 与 M-A-P 牵头" },
      publisher: "M-A-P",
      categoryId: "software-engineering",
      summary: { en: "Repository-generation specifications paired with purpose-built evaluation harnesses.", zh: "配套专用评测框架的代码库生成规范。" },
      questionCount: { en: "104 specifications", zh: "104 项规范" },
      access: "public",
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/multimodal-art-projection/NL2RepoBench" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2512.12730" },
      ],
    },
    {
      id: "frontierswe",
      legacyIds: ["frontierswe-v2"],
      name: "FrontierSWE",
      aliases: ["Frontier SWE", "FrontierSWE v1", "Frontier SWE v2", "FrontierSWE v2"],
      creators: { en: "Rishyanth Kondra, Sanket Mhatre, Akshit Kumar, Evan Chu, Bilal Bakht Ahmad et al.", zh: "Rishyanth Kondra、Sanket Mhatre、Akshit Kumar、Evan Chu、Bilal Bakht Ahmad 等人" },
      publisher: "Proximal",
      categoryId: "software-engineering",
      version: "v2",
      currentVersionId: "v2",
      versionNote: {
        en: "The current release retains 13 v1 task concepts, adds 21 challenges, and retires four, expanding the benchmark to 34 tasks with 20-hour agent budgets.",
        zh: "当前版本沿用 13 项 v1 任务概念，新增 21 项挑战并移除 4 项，将基准扩展至 34 项任务，每次智能体运行时限为 20 小时。",
      },
      versions: [
        {
          id: "v2",
          label: "v2",
          change: "expansion",
          questionCount: { en: "34 tasks", zh: "34 项任务" },
          note: { en: "Retains 13 v1 task concepts, adds 21 new challenges, retires four, and changes the execution and scoring methodology.", zh: "沿用 13 项 v1 任务概念，新增 21 项挑战、移除 4 项，并调整执行与评分方法。" },
          comparableToPrevious: false,
          sourceUrl: "https://www.frontierswe.com/blog/v2",
        },
        {
          id: "v1",
          label: "v1",
          change: "initial",
          questionCount: { en: "17 tasks", zh: "17 项任务" },
          note: { en: "The original implementation, performance-engineering, and ML-research task collection.", zh: "最初的系统实现、性能工程与机器学习研究任务集。" },
          sourceUrl: "https://github.com/Proximal-Labs/frontier-swe",
        },
      ],
      summary: { en: "Ultra-long-horizon system implementation, scientific computing, performance-optimization, visual-reasoning, and AI-research tasks.", zh: "覆盖系统实现、科学计算、性能优化、视觉推理与 AI 研究的超长时程任务。" },
      questionCount: { en: "34 tasks", zh: "34 项任务" },
      responseType: { en: "Repository changes and technical artifacts", zh: "代码库修改与技术产物" },
      scoring: { en: "Continuous 0–1 task scores with aggregate normalized reporting", zh: "任务连续得分范围为 0–1，并汇总为归一化结果" },
      access: "public",
      leaderboardSnapshots: [{
        benchmarkVersion: "v1",
        imagePath: "/benchmark-leaderboards/frontierswe.jpg",
        sourceUrl: "https://www.frontierswe.com/",
        capturedAt: "2026-08-31",
        alt: { en: "Official FrontierSWE leaderboard ranking models across implementation, performance, and research tasks", zh: "FrontierSWE 官方排行榜，按实现、性能与研究任务对模型进行排名" },
        caption: { en: "A pre-v2 official leaderboard snapshot retained as historical provenance; live links lead to the current release.", zh: "作为历史来源保留的 v2 前官方排行榜截图；实时链接指向当前版本。" },
      }],
      links: [
        { label: { en: "V2 blog post", zh: "V2 博客" }, url: "https://www.frontierswe.com/blog/v2" },
        { label: { en: "Task catalog", zh: "任务目录" }, url: "https://www.frontierswe.com/tasks" },
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/Proximal-Labs/frontier-swe-v2" },
      ],
    },
    {
      id: "programbench",
      name: "ProgramBench",
      creators: { en: "John Yang, Kilian Lieret, Jeffrey Ma et al. from Meta, Stanford, and Harvard", zh: "Meta、Stanford 与 Harvard 的 John Yang、Kilian Lieret、Jeffrey Ma 等人" },
      publisher: "Meta",
      categoryId: "software-engineering",
      summary: { en: "Program-reconstruction tasks synthesized from open-source programs, binaries, and documentation.", zh: "由开源程序、二进制文件与文档合成的程序重建任务。" },
      questionCount: { en: "200 tasks", zh: "200 项任务" },
      access: "public",
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/facebookresearch/ProgramBench" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2605.03546" },
      ],
    },
    {
      id: "posttrainbench",
      name: "PostTrainBench",
      aliases: ["PostTrainBench v1", "PostTrainBench v1.1"],
      creators: { en: "Ben Rank, Hardik Bhatnagar, Ameya Prabhu, Shira Eisenberg et al.", zh: "Ben Rank、Hardik Bhatnagar、Ameya Prabhu、Shira Eisenberg 等人" },
      publisher: "AISA Group · author team",
      categoryId: "model-training",
      version: "v1.1",
      currentVersionId: "v1.1",
      versionNote: { en: "The current release keeps the same 28 model-target configurations while strengthening contamination, API-use, benchmark-lookup, and model-identity checks.", zh: "当前版本保留相同的 28 种模型—目标配置，同时加强污染、API 使用、基准查找及模型身份检查。" },
      versions: [
        {
          id: "v1.1",
          label: "v1.1",
          change: "maintenance",
          questionCount: { en: "28 model-target configurations", zh: "28 种模型—目标配置" },
          note: { en: "Keeps the original evaluation matrix but adds independent integrity judges and reruns or omits affected results.", zh: "保留原评测矩阵，但新增独立完整性评审，并重跑或移除受影响结果。" },
          comparableToPrevious: false,
          sourceUrl: "https://posttrainbench.com/",
        },
        {
          id: "v1",
          label: "v1",
          change: "initial",
          questionCount: { en: "28 model-target configurations", zh: "28 种模型—目标配置" },
          note: { en: "The original four-base-model by seven-target-benchmark evaluation matrix.", zh: "最初由 4 个基础模型与 7 个目标基准组成的评测矩阵。" },
          sourceUrl: "https://posttrainbench.com/?version=v1",
        },
      ],
      summary: { en: "Autonomous model post-training assignments under a ten-hour, one-H100 budget.", zh: "在十小时、单张 H100 预算内完成的自主模型后训练任务。" },
      questionCount: { en: "28 model-target configurations", zh: "28 种模型—目标配置" },
      access: "public",
      leaderboardSnapshots: [{
        benchmarkVersion: "v1",
        imagePath: "/benchmark-leaderboards/posttrainbench.jpg",
        sourceUrl: "https://posttrainbench.com/?version=v1",
        capturedAt: "2026-08-31",
        alt: { en: "Official PostTrainBench v1 bar chart comparing average benchmark performance", zh: "PostTrainBench v1 官方条形图，比较平均基准表现" },
        caption: { en: "The official v1 chart compares the average performance of CLI agents' post-trained models, with uncertainty where reported.", zh: "官方 v1 图表比较 CLI 智能体后训练模型的平均表现，并在有报告时显示不确定区间。" },
      }],
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/aisa-group/PostTrainBench" },
        { label: { en: "Leaderboard", zh: "排行榜" }, url: "https://posttrainbench.com/" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2603.08640" },
      ],
    },
    {
      id: "spreadsheetbench",
      name: "SpreadsheetBench",
      aliases: ["SpreadsheetBench v1", "SpreadsheetBench v2"],
      creators: { en: "V1 by Zeyao Ma, Bohan Zhang, Jing Zhang et al.; V2 by Jian Zhu, Yuzheng Zhang, Zeyao Ma et al.", zh: "V1 由 Zeyao Ma、Bohan Zhang、Jing Zhang 等人创建；V2 由 Jian Zhu、Yuzheng Zhang、Zeyao Ma 等人创建" },
      publisher: "SpreadsheetBench · RUCKBReasoning",
      categoryId: "professional-work",
      version: "v2",
      currentVersionId: "v2",
      versionNote: { en: "The current release replaces v1's isolated, forum-derived edits with 321 expert-curated, end-to-end business workflows.", zh: "当前版本以 321 项专家整理的端到端商业工作流，取代 v1 中来自论坛的孤立编辑问题。" },
      versions: [
        {
          id: "v2",
          label: "v2",
          change: "replacement",
          questionCount: { en: "321 workflows", zh: "321 项工作流" },
          note: { en: "A new task set covering debugging, financial modeling, templates, and visualization across complex workbooks.", zh: "全新任务集，覆盖复杂工作簿中的调试、财务建模、模板与可视化工作流。" },
          comparableToPrevious: false,
          sourceUrl: "https://github.com/RUCKBReasoning/SpreadsheetBench-2",
        },
        {
          id: "v1",
          label: "v1",
          change: "initial",
          questionCount: { en: "912 problems", zh: "912 道问题" },
          note: { en: "Forum-derived spreadsheet manipulation problems focused on individual edits.", zh: "源自论坛、聚焦单项编辑的电子表格操作问题。" },
          sourceUrl: "https://arxiv.org/abs/2406.14991",
        },
      ],
      summary: { en: "Expert-curated, end-to-end business workflows across complex multi-sheet workbooks.", zh: "围绕复杂多工作表工作簿、由专家整理的端到端商业工作流。" },
      questionCount: { en: "321 workflows", zh: "321 项工作流" },
      access: "public",
      leaderboardSnapshots: [{
        benchmarkVersion: "v2",
        imagePath: "/benchmark-leaderboards/spreadsheetbench.jpg",
        sourceUrl: "https://spreadsheetbench.github.io/",
        capturedAt: "2026-08-31",
        alt: { en: "Official SpreadsheetBench leaderboard with version tabs and ranked scores", zh: "SpreadsheetBench 官方排行榜，展示版本标签与分数排名" },
        caption: { en: "The official leaderboard lets readers switch between V2 and the full or verified V1 sets, while identifying model scaffolds and result status.", zh: "官方排行榜可在 V2、V1 完整集与 V1 验证集之间切换，并标明模型框架与结果状态。" },
      }],
      links: [
        { label: { en: "Project", zh: "项目主页" }, url: "https://spreadsheetbench.github.io/" },
        { label: { en: "V1 paper", zh: "V1 论文" }, url: "https://arxiv.org/abs/2406.14991" },
        { label: { en: "V2 paper", zh: "V2 论文" }, url: "https://arxiv.org/abs/2606.29955" },
      ],
    },
    {
      id: "swe-bench-pro",
      name: "SWE-Bench Pro",
      creators: { en: "Xiang Deng, Jeff Da, Edwin Pan et al. at Scale AI", zh: "Scale AI 的 Xiang Deng、Jeff Da、Edwin Pan 等人" },
      publisher: "Scale AI",
      categoryId: "software-engineering",
      summary: { en: "Human-verified, long-horizon software issues from production repositories.", zh: "来自生产代码库、经人工验证的长时程软件问题。" },
      questionCount: { en: "1,865 issues · 41 repositories", zh: "1,865 个问题 · 41 个代码库" },
      access: "public",
      leaderboardSnapshots: [{
        imagePath: "/benchmark-leaderboards/swe-bench-pro.jpg",
        sourceUrl: "https://labs.scale.com/leaderboard/swe_bench_pro_public",
        capturedAt: "2026-08-31",
        alt: { en: "Official SWE-Bench Pro public-dataset performance comparison", zh: "SWE-Bench Pro 公开数据集官方性能对比" },
        caption: { en: "Scale Labs' public-dataset view ranks coding systems by issue resolve rate and shows confidence intervals.", zh: "Scale Labs 的公开数据集视图按问题解决率排列编程系统，并展示置信区间。" },
      }],
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/scaleapi/SWE-bench_Pro-os" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2509.16941" },
      ],
    },
    {
      id: "swe-marathon",
      name: "SWE-Marathon",
      creators: { en: "Rishi Desai, Jesse Hu, Joan Cabezas et al., led by Abundant AI", zh: "Rishi Desai、Jesse Hu、Joan Cabezas 等人，Abundant AI 牵头" },
      publisher: "Abundant AI",
      categoryId: "software-engineering",
      summary: { en: "Human-designed, project-scale software-engineering tasks.", zh: "人工设计的项目级软件工程任务。" },
      questionCount: { en: "20 tasks", zh: "20 项任务" },
      access: "public",
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/abundant-ai/swe-marathon" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2606.07682" },
      ],
    },
    {
      id: "frontiercode",
      name: "FrontierCode",
      aliases: ["FrontierCode 1.0", "FrontierCode 1.1"],
      creators: { en: "Eric Lu, Ben Pan, Deniz Birlikci, Sam Lee et al. at Cognition, with open-source maintainers", zh: "Cognition 的 Eric Lu、Ben Pan、Deniz Birlikci、Sam Lee 等人与开源维护者" },
      publisher: "Cognition",
      categoryId: "software-engineering",
      version: "1.1",
      currentVersionId: "v1.1",
      versionNote: { en: "The current release keeps the 150-task collection while refining internet-use policy, relaxing 75 overly strict blocker criteria, and replacing Diamond reporting with Main and Extended subsets.", zh: "当前版本保留 150 项任务，同时完善联网政策、放宽 75 项过严的阻断标准，并以 Main 与 Extended 子集取代 Diamond 报告。" },
      versions: [
        {
          id: "v1.1",
          label: "1.1",
          change: "maintenance",
          questionCount: { en: "150 tasks · 36 repositories", zh: "150 项任务 · 36 个代码库" },
          note: { en: "Keeps the task collection while revising grading criteria, internet-use methodology, and reported subsets.", zh: "保留任务集，同时修订评分标准、联网方法与报告子集。" },
          comparableToPrevious: false,
          sourceUrl: "https://cognition.ai/blog/frontier-code-1.1",
        },
        {
          id: "v1.0",
          label: "1.0",
          change: "initial",
          questionCount: { en: "150 tasks · 36 repositories", zh: "150 项任务 · 36 个代码库" },
          note: { en: "The original private, maintainer-authored coding-task release.", zh: "最初的私有维护者编写编程任务版本。" },
          sourceUrl: "https://cognition.ai/blog/frontier-code",
        },
      ],
      summary: { en: "Private, maintainer-authored coding tasks with repository-specific quality rubrics.", zh: "由维护者编写、带代码库特定质量细则的私有编程任务。" },
      questionCount: { en: "150 tasks · 36 repositories", zh: "150 项任务 · 36 个代码库" },
      access: "private",
      leaderboardSnapshots: [{
        benchmarkVersion: "v1.1",
        imagePath: "/benchmark-leaderboards/frontiercode.jpg",
        sourceUrl: "https://cognition.ai/frontiercode",
        capturedAt: "2026-08-31",
        alt: { en: "Official FrontierCode 1.1 leaderboard plotting model score against rollout cost", zh: "FrontierCode 1.1 官方排行榜，绘制模型得分与单次运行成本的关系" },
        caption: { en: "Cognition's official 1.1 dashboard plots quality score against rollout cost across models, reasoning efforts, and agent harnesses.", zh: "Cognition 的官方 1.1 仪表板比较不同模型、推理强度与智能体框架下的质量得分和单次运行成本。" },
      }],
      links: [
        { label: { en: "Leaderboard", zh: "排行榜" }, url: "https://cognition.ai/frontiercode" },
        { label: { en: "Methodology", zh: "方法说明" }, url: "https://cognition.ai/blog/frontier-code" },
      ],
    },
    {
      id: "mmmu-pro",
      name: "MMMU-Pro",
      creators: { en: "Xiang Yue, Tianyu Zheng, Yuansheng Ni et al.", zh: "Xiang Yue、Tianyu Zheng、Yuansheng Ni 等人" },
      publisher: "MMMU Benchmark organization",
      categoryId: "documents-vision",
      summary: { en: "A transformed MMMU task set with filtered questions, expanded choices, and vision-only variants.", zh: "通过筛题、扩展选项并构建纯视觉版本而形成的 MMMU 衍生任务集。" },
      questionCount: { en: "Filtered and transformed MMMU task set", zh: "筛选并改造后的 MMMU 任务集" },
      access: "public",
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/MMMU-Benchmark/MMMU" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2409.02813" },
      ],
    },
    {
      id: "babyvision",
      name: "BabyVision",
      creators: { en: "Liang Chen, Weichu Xie, Yiyan Liang et al., led by UniPat AI and xbench", zh: "Liang Chen、Weichu Xie、Yiyan Liang 等人，UniPat AI 与 xbench 牵头" },
      publisher: "UniPat AI",
      categoryId: "documents-vision",
      summary: { en: "Purpose-built visual-reasoning items spanning diverse subclasses.", zh: "专门构建、覆盖多种子类别的视觉推理题目。" },
      questionCount: { en: "388 items · 22 subclasses", zh: "388 道题 · 22 个子类别" },
      access: "public",
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/UniPat-AI/BabyVision" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2601.06521" },
      ],
    },
    {
      id: "charxiv",
      name: "CharXiv",
      creators: { en: "Zirui Wang, Mengzhou Xia, Luxi He et al., led by Princeton NLP", zh: "Zirui Wang、Mengzhou Xia、Luxi He 等人，Princeton NLP 牵头" },
      publisher: "Princeton NLP",
      categoryId: "documents-vision",
      summary: { en: "Human-curated and verified questions grounded in scientific charts.", zh: "围绕科学图表、经人工整理与验证的问题。" },
      questionCount: { en: "Questions over 2,323 charts", zh: "覆盖 2,323 张图表的问题" },
      access: "public",
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/princeton-nlp/CharXiv" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2406.18521" },
      ],
    },
    {
      id: "chartography",
      name: "Chartography",
      creators: { en: "Suhaas Garre, Chris Mutty, Sushant Mehta, and Edwin Chen at Surge AI", zh: "Surge AI 的 Suhaas Garre、Chris Mutty、Sushant Mehta 与 Edwin Chen" },
      publisher: "Surge AI",
      categoryId: "documents-vision",
      summary: { en: "Professional chart-understanding tasks written and independently reviewed by domain experts.", zh: "由领域专家编写并独立审核的专业图表理解任务。" },
      questionCount: { en: "100 tasks", zh: "100 项任务" },
      access: "public",
      links: [
        { label: { en: "Benchmark article", zh: "基准文章" }, url: "https://surgehq.ai/blog/chartography" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2608.10677" },
      ],
    },
    {
      id: "omnidocbench",
      name: "OmniDocBench",
      creators: { en: "Linke Ouyang, Yuan Qu, Hongbin Zhou et al., led by OpenDataLab and Shanghai AI Laboratory", zh: "Linke Ouyang、Yuan Qu、Hongbin Zhou 等人，OpenDataLab 与上海人工智能实验室牵头" },
      publisher: "OpenDataLab",
      categoryId: "documents-vision",
      version: "v1.7",
      currentVersionId: "v1.7",
      versionNote: { en: "The current main branch keeps the 1,651-page v1.6 dataset and adds the Qianfan-OCR leaderboard plus skills-based evaluation support.", zh: "当前主分支保留 v1.6 的 1,651 页数据集，并新增 Qianfan-OCR 排行榜与 skills 评测支持。" },
      versions: [
        {
          id: "v1.7",
          label: "1.7",
          releasedAt: "2026-04-30",
          change: "maintenance",
          questionCount: { en: "1,651 PDF pages", zh: "1,651 页 PDF" },
          note: { en: "Keeps the dataset while adding a leaderboard and skills-based evaluation support.", zh: "保留数据集，并新增排行榜与 skills 评测支持。" },
          comparableToPrevious: true,
          sourceUrl: "https://github.com/opendatalab/OmniDocBench#updates",
        },
        {
          id: "v1.6",
          label: "1.6",
          releasedAt: "2026-04-10",
          change: "expansion",
          questionCount: { en: "1,651 PDF pages", zh: "1,651 页 PDF" },
          note: { en: "Adds 296 difficult pages, fixes annotations, and introduces adaptive matching with faster formula evaluation.", zh: "新增 296 页困难样本、修正标注，并引入自适应匹配与更快的公式评测。" },
          comparableToPrevious: false,
          sourceUrl: "https://github.com/opendatalab/OmniDocBench#updates",
        },
        {
          id: "v1.5",
          label: "1.5",
          releasedAt: "2025-09-25",
          change: "expansion",
          questionCount: { en: "1,355 PDF pages", zh: "1,355 页 PDF" },
          note: { en: "Adds 374 pages, balances Chinese and English, increases formula coverage, and revises matching and the overall metric.", zh: "新增 374 页，平衡中英文、增加公式覆盖，并修订匹配方法和总指标。" },
          comparableToPrevious: false,
          sourceUrl: "https://github.com/opendatalab/OmniDocBench#updates",
        },
        {
          id: "v1.0",
          label: "1.0",
          change: "initial",
          questionCount: { en: "981 PDF pages", zh: "981 页 PDF" },
          note: { en: "The original nine-document-type release described in the CVPR paper.", zh: "CVPR 论文所述、覆盖九类文档的原始版本。" },
          sourceUrl: "https://arxiv.org/abs/2412.07626",
        },
      ],
      summary: { en: "Curated, richly annotated PDF pages for document parsing evaluation.", zh: "用于文档解析评测、经整理并具有丰富标注的 PDF 页面。" },
      questionCount: { en: "1,651 PDF pages", zh: "1,651 页 PDF" },
      access: "public",
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/opendatalab/OmniDocBench" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2412.07626" },
      ],
    },
    {
      id: "zerobench",
      name: "ZeroBench",
      creators: { en: "Jonathan Roberts, Mohammad Reza Taesiri, Ansh Sharma et al.", zh: "Jonathan Roberts、Mohammad Reza Taesiri、Ansh Sharma 等人" },
      publisher: "ZeroBench team",
      categoryId: "documents-vision",
      summary: { en: "Manually curated visual-reasoning questions with diagnostic subquestions.", zh: "人工整理、带诊断子问题的视觉推理题目。" },
      questionCount: { en: "100 main questions plus diagnostics", zh: "100 道主问题及诊断子问题" },
      access: "public-subset",
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/jonathan-roberts1/zerobench" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2502.09696" },
      ],
    },
    {
      id: "cybergym",
      name: "CyberGym",
      creators: { en: "Zhun Wang, Tianneng Shi, Jingxuan He, Matthew Cai, Jialin Zhang, and Dawn Song at UC Berkeley", zh: "UC Berkeley 的 Zhun Wang、Tianneng Shi、Jingxuan He、Matthew Cai、Jialin Zhang 与 Dawn Song" },
      publisher: "UC Berkeley Sunblaze",
      categoryId: "cybersecurity",
      summary: { en: "Packaged vulnerability-reproduction instances drawn from real projects.", zh: "来自真实项目、已打包的漏洞复现实例。" },
      questionCount: { en: "1,507 instances · 188 projects", zh: "1,507 个实例 · 188 个项目" },
      access: "public",
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/sunblaze-ucb/cybergym" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2506.02548" },
      ],
    },
    {
      id: "exploitbench",
      name: "ExploitBench",
      creators: { en: "Seunghyun Lee and David Brumley", zh: "Seunghyun Lee 与 David Brumley" },
      publisher: "ExploitBench project",
      categoryId: "cybersecurity",
      summary: { en: "V8 exploitation tasks graded through a 16-level capability ladder.", zh: "通过 16 级能力阶梯评分的 V8 漏洞利用任务。" },
      questionCount: { en: "41 tasks", zh: "41 项任务" },
      access: "public",
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/exploitbench/exploitbench" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2605.14153" },
      ],
    },
    {
      id: "exploitgym",
      name: "ExploitGym",
      creators: { en: "Zhun Wang, Nico Schiller, Hongwei Li et al., led by UC Berkeley", zh: "Zhun Wang、Nico Schiller、Hongwei Li 等人，UC Berkeley 牵头" },
      publisher: "UC Berkeley Sunblaze",
      categoryId: "cybersecurity",
      summary: { en: "Reproducible exploit-development instances built from real userspace, V8, and Linux-kernel vulnerabilities.", zh: "基于真实用户空间、V8 与 Linux 内核漏洞构建的可复现漏洞利用开发实例。" },
      questionCount: { en: "Userspace, V8, and Linux-kernel instances", zh: "用户空间、V8 与 Linux 内核实例" },
      access: "public",
      links: [
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/sunblaze-ucb/exploitgym" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2605.11086" },
      ],
    },
  ] satisfies ModelBenchmarkReference[];

export function modelBenchmarkSearchText(benchmark: ModelBenchmarkReference): string {
  return [
    benchmark.id,
    ...(benchmark.legacyIds ?? []),
    benchmark.name,
    ...(benchmark.aliases ?? []),
    benchmark.creators.en,
    benchmark.creators.zh,
    benchmark.publisher,
    benchmark.version ?? "",
    benchmark.versionNote?.en ?? "",
    benchmark.versionNote?.zh ?? "",
    benchmark.summary.en,
    benchmark.summary.zh,
    benchmark.questionCount.en,
    benchmark.questionCount.zh,
    benchmark.responseType?.en ?? "",
    benchmark.responseType?.zh ?? "",
    benchmark.scoring?.en ?? "",
    benchmark.scoring?.zh ?? "",
    ...(benchmark.versions ?? []).flatMap((version) => [
      version.id,
      version.label,
      version.questionCount.en,
      version.questionCount.zh,
      version.note.en,
      version.note.zh,
    ]),
  ].join(" ").toLowerCase();
}

export function findModelBenchmark(benchmarkId: string): ModelBenchmarkReference | undefined {
  return modelBenchmarks.find((benchmark) => benchmark.id === benchmarkId || benchmark.legacyIds?.includes(benchmarkId));
}
