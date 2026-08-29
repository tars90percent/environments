export type BenchmarkReferenceLanguage = "en" | "zh";
export type BenchmarkReferenceCategoryId = "agents" | "coding" | "general" | "scientific-reasoning";
export type BenchmarkReferenceAccess = "public" | "public-subset" | "gated" | "public-tasks";

export type BenchmarkReferenceLink = {
  label: { en: string; zh: string };
  url: string;
};

export type ModelBenchmarkReference = {
  id: string;
  name: string;
  publisher: string;
  categoryId: BenchmarkReferenceCategoryId;
  weight: number;
  version: string;
  versionNote: { en: string; zh: string };
  summary: { en: string; zh: string };
  questionCount: { en: string; zh: string };
  repeats: number;
  responseType: { en: string; zh: string };
  scoring: { en: string; zh: string };
  toolUse: boolean;
  access: BenchmarkReferenceAccess;
  links: BenchmarkReferenceLink[];
};

export type BenchmarkReferenceCategory = {
  id: BenchmarkReferenceCategoryId;
  label: { en: string; zh: string };
  description: { en: string; zh: string };
  weight: number;
};

export const artificialAnalysisIndex = {
  id: "artificial-analysis-intelligence-index",
  name: "Artificial Analysis Intelligence Index",
  version: "4.1.1",
  releasedAt: "2026-08-06",
  verifiedAt: "2026-08-29",
  methodologyUrl: "https://artificialanalysis.ai/methodology/intelligence-benchmarking",
  evaluationUrl: "https://artificialanalysis.ai/evaluations/artificial-analysis-intelligence-index",
  changelogUrl: "https://artificialanalysis.ai/changelog",
  categories: [
    {
      id: "agents",
      label: { en: "Agents", zh: "智能体" },
      description: { en: "Long-horizon professional work and tool-mediated customer workflows.", zh: "长时程专业工作与工具驱动的客户工作流。" },
      weight: 34,
    },
    {
      id: "coding",
      label: { en: "Coding", zh: "编程" },
      description: { en: "Terminal execution and scientific program synthesis.", zh: "终端执行与科学程序合成。" },
      weight: 24,
    },
    {
      id: "general",
      label: { en: "General", zh: "通用能力" },
      description: { en: "Long-context reasoning, factual recall, and calibrated abstention.", zh: "长上下文推理、事实回忆与可靠拒答。" },
      weight: 18,
    },
    {
      id: "scientific-reasoning",
      label: { en: "Scientific reasoning", zh: "科学推理" },
      description: { en: "Expert academic knowledge and research-level scientific reasoning.", zh: "专家级学术知识与研究级科学推理。" },
      weight: 24,
    },
  ] satisfies BenchmarkReferenceCategory[],
  benchmarks: [
    {
      id: "gdpval-aa-v2",
      name: "GDPval-AA v2",
      publisher: "Artificial Analysis · OpenAI",
      categoryId: "agents",
      weight: 20,
      version: "GDPval-AA v2 · GDPval public release v2",
      versionNote: {
        en: "Artificial Analysis' v2 evaluation uses OpenAI's current 220-task public gold set, with an updated sandbox and Elo anchored to human experts.",
        zh: "Artificial Analysis 的 v2 评测使用 OpenAI 当前公开的 220 项黄金任务，并更新沙箱及以人类专家为锚点的 Elo。",
      },
      summary: {
        en: "Economically valuable, multi-file knowledge work across 44 occupations and nine industries.",
        zh: "覆盖 44 个职业和 9 个行业、需要多文件交付的高经济价值知识工作。",
      },
      questionCount: { en: "220 tasks", zh: "220 项任务" },
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
      publisher: "Sierra Research",
      categoryId: "agents",
      weight: 14,
      version: "tau2-bench v1.0.1",
      versionNote: {
        en: "Index v4.1.1 moved this evaluation to the upstream v1.0.1 dataset and grader; the project retains the tau2-bench repository name.",
        zh: "指数 v4.1.1 已切换到上游 v1.0.1 数据集和评分器；项目仓库仍沿用 tau2-bench 名称。",
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
      id: "terminal-bench-2-1",
      name: "Terminal-Bench v2.1",
      publisher: "Terminal-Bench community",
      categoryId: "coding",
      weight: 16,
      version: "v2.1 · 2026-05-06",
      versionNote: {
        en: "The current 89-task verified refresh of Terminal-Bench 2.0; it corrected environment, resource, and task-specification issues.",
        zh: "当前包含 89 项任务的验证版更新，修复了 Terminal-Bench 2.0 的环境、资源及任务规范问题。",
      },
      summary: {
        en: "Agents complete realistic software, systems, data, training, and security work in terminal environments.",
        zh: "智能体在终端环境中完成真实的软件、系统、数据、训练及安全工作。",
      },
      questionCount: { en: "89 tasks", zh: "89 项任务" },
      repeats: 3,
      responseType: { en: "Terminal task execution", zh: "终端任务执行" },
      scoring: { en: "Full verification suite, pass@1", zh: "完整验证套件，pass@1" },
      toolUse: false,
      access: "public",
      links: [
        { label: { en: "Release notes", zh: "发布说明" }, url: "https://www.tbench.ai/news/terminal-bench-2-1" },
        { label: { en: "Dataset repository", zh: "数据集仓库" }, url: "https://github.com/harbor-framework/terminal-bench-2-1" },
        { label: { en: "Harbor Hub", zh: "Harbor Hub" }, url: "https://hub.harborframework.com/datasets/terminal-bench/terminal-bench-2-1/latest" },
      ],
    },
    {
      id: "scicode",
      name: "SciCode",
      publisher: "SciCode research team",
      categoryId: "coding",
      weight: 8,
      version: "Current public test set · unversioned",
      versionNote: {
        en: "No semantic dataset release is published. Artificial Analysis uses the 288 test subproblems with scientist-authored background in the prompt.",
        zh: "发布方未提供语义化版本号。Artificial Analysis 使用 288 个测试子问题，并在提示中加入科学家编写的背景。",
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
      publisher: "Artificial Analysis",
      categoryId: "general",
      weight: 6,
      version: "Current public dataset · unversioned",
      versionNote: {
        en: "The source publishes a maintained 100-question dataset without a semantic version; index v4.1.1 uses GPT-5.6 Luna (medium) as its equality checker.",
        zh: "发布方维护一套未设语义版本号的 100 题数据集；指数 v4.1.1 使用 GPT-5.6 Luna（medium）作等价性评分器。",
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
      publisher: "Artificial Analysis",
      categoryId: "general",
      weight: 12,
      version: "Current production set · unversioned",
      versionNote: {
        en: "The index uses 6,000 production questions. A representative 600-question public subset is available; the full evaluation set is not released.",
        zh: "指数使用 6,000 道生产题目；公开提供具有代表性的 600 题子集，完整评测集未发布。",
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
      publisher: "Center for AI Safety",
      categoryId: "scientific-reasoning",
      weight: 12,
      version: "May 2025 revision · text-only subset",
      versionNote: {
        en: "Artificial Analysis pins 2,158 text-only questions from the May 2025, 2,500-question revision for cross-model comparability; upstream also maintains HLE-Rolling.",
        zh: "为保证模型间可比性，Artificial Analysis 固定使用 2025 年 5 月 2,500 题修订版中的 2,158 道纯文本题；上游另维护 HLE-Rolling。",
      },
      summary: {
        en: "Expert-vetted frontier academic questions across mathematics, sciences, and humanities.",
        zh: "经专家审核，覆盖数学、科学与人文学科的前沿学术问题。",
      },
      questionCount: { en: "2,158 text-only questions", zh: "2,158 道纯文本题" },
      repeats: 1,
      responseType: { en: "Open answer", zh: "开放式回答" },
      scoring: { en: "LLM equality checker, pass@1", zh: "LLM 等价性评分，pass@1" },
      toolUse: false,
      access: "gated",
      links: [
        { label: { en: "Gated dataset", zh: "受控数据集" }, url: "https://huggingface.co/datasets/cais/hle" },
        { label: { en: "Repository", zh: "代码仓库" }, url: "https://github.com/centerforaisafety/hle" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2501.14249" },
      ],
    },
    {
      id: "gpqa-diamond",
      name: "GPQA Diamond",
      publisher: "GPQA authors",
      categoryId: "scientific-reasoning",
      weight: 6,
      version: "Diamond subset · 198 questions",
      versionNote: {
        en: "The original authors' highest-quality 198-question subset. It has no separate semantic release version and remains access-gated to reduce contamination.",
        zh: "原作者定义的最高质量 198 题子集，无独立语义版本号，并保持受控访问以降低污染。",
      },
      summary: {
        en: "Graduate-level biology, physics, and chemistry questions designed to resist web search by non-experts.",
        zh: "面向研究生水平的生物、物理和化学问题，旨在让非专家难以通过网络检索作答。",
      },
      questionCount: { en: "198 questions", zh: "198 道题" },
      repeats: 5,
      responseType: { en: "Four-option multiple choice", zh: "四选一" },
      scoring: { en: "Regex extraction, pass@1", zh: "正则提取，pass@1" },
      toolUse: false,
      access: "gated",
      links: [
        { label: { en: "Gated dataset", zh: "受控数据集" }, url: "https://huggingface.co/datasets/Idavidrein/gpqa" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2311.12022" },
        { label: { en: "AA evaluation code", zh: "AA 评测代码" }, url: "https://github.com/openai/simple-evals/blob/main/gpqa_eval.py" },
      ],
    },
    {
      id: "critpt",
      name: "CritPt",
      publisher: "CritPt research team",
      categoryId: "scientific-reasoning",
      weight: 6,
      version: "2025 public release · 70-test subset",
      versionNote: {
        en: "The project is unversioned. Artificial Analysis evaluates all 70 held-out test challenges and excludes the public example; the official grading API is access-controlled.",
        zh: "项目未设置版本号。Artificial Analysis 评测全部 70 道测试挑战并排除公开示例；官方评分 API 需申请访问。",
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
      links: [
        { label: { en: "Dataset", zh: "数据集" }, url: "https://huggingface.co/datasets/CritPt-Benchmark/CritPt" },
        { label: { en: "Evaluation code", zh: "评测代码" }, url: "https://github.com/CritPt-Benchmark/CritPt" },
        { label: { en: "Paper", zh: "论文" }, url: "https://arxiv.org/abs/2509.26574" },
      ],
    },
  ] satisfies ModelBenchmarkReference[],
};

export function modelBenchmarkSearchText(benchmark: ModelBenchmarkReference): string {
  return [
    benchmark.id,
    benchmark.name,
    benchmark.publisher,
    benchmark.version,
    benchmark.versionNote.en,
    benchmark.versionNote.zh,
    benchmark.summary.en,
    benchmark.summary.zh,
    benchmark.questionCount.en,
    benchmark.questionCount.zh,
    benchmark.responseType.en,
    benchmark.responseType.zh,
    benchmark.scoring.en,
    benchmark.scoring.zh,
  ].join(" ").toLowerCase();
}
