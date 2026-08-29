import type { BenchmarkReferenceLanguage } from "./model-benchmark-data";

type LocalizedText = Record<BenchmarkReferenceLanguage, string>;

export type BenchmarkSampleTask = {
  id: string;
  sourceId: string | null;
  sourceKind: "public-task" | "format-archetype";
  title: LocalizedText;
  objective: LocalizedText;
  inputs: LocalizedText;
  expectedOutput: LocalizedText;
  evaluation: LocalizedText;
  capabilities: Record<BenchmarkReferenceLanguage, string[]>;
  sourceLabel: LocalizedText;
  sourceUrl: string;
};

export type BenchmarkSampleTaskFormat = "file-deliverable" | "agent-simulation" | "harbor" | "scientific-code" | "long-context-qa" | "open-qa" | "format-archetype";

export const modelBenchmarkSampleContext: Record<string, { format: BenchmarkSampleTaskFormat; originalLanguage: "English" }> = {
  "gdpval-aa-v2": { format: "file-deliverable", originalLanguage: "English" },
  "tau3-banking": { format: "agent-simulation", originalLanguage: "English" },
  "terminal-bench-2-1": { format: "harbor", originalLanguage: "English" },
  scicode: { format: "scientific-code", originalLanguage: "English" },
  "aa-lcr": { format: "long-context-qa", originalLanguage: "English" },
  "aa-omniscience": { format: "open-qa", originalLanguage: "English" },
  hle: { format: "format-archetype", originalLanguage: "English" },
  "gpqa-diamond": { format: "format-archetype", originalLanguage: "English" },
  critpt: { format: "scientific-code", originalLanguage: "English" },
};

export const modelBenchmarkSamples: Record<string, BenchmarkSampleTask[]> = {
  "gdpval-aa-v2": [
    {
      id: "gdpval-afc-audit-sample",
      sourceId: "83d10b06-26d1-4636-a32c-23f92c57f30b",
      sourceKind: "public-task",
      title: { en: "Anti-financial-crime audit sample", zh: "反金融犯罪审计抽样" },
      objective: {
        en: "Turn two quarters of operational metrics into a defensible audit sample for an anti-financial-crime review.",
        zh: "将两个季度的运营指标转化为可用于反金融犯罪审查、且依据清晰的审计样本。",
      },
      inputs: {
        en: "A spreadsheet of population-level metrics, plus requirements for statistical confidence and sample construction.",
        zh: "一份总体指标电子表格，以及统计置信度和样本构建要求。",
      },
      expectedOutput: {
        en: "A completed spreadsheet deliverable with the sample-size calculation and selected records organized for review.",
        zh: "一份完成的电子表格交付物，包含样本量计算及便于复核的抽样记录。",
      },
      evaluation: {
        en: "A judge panel compares the produced workbook against the task rubric and a human-authored reference deliverable.",
        zh: "评审模型组依据任务细则和人类专家参考交付物，对生成的工作簿进行比较。",
      },
      capabilities: {
        en: ["Spreadsheet reasoning", "Statistical sampling", "Professional deliverable"],
        zh: ["电子表格推理", "统计抽样", "专业交付物"],
      },
      sourceLabel: { en: "OpenAI GDPval viewer", zh: "OpenAI GDPval 数据查看器" },
      sourceUrl: "https://huggingface.co/datasets/openai/gdpval/viewer",
    },
    {
      id: "gdpval-retail-task-list",
      sourceId: "211d0093-2c64-4bd0-828c-0201f18924e7",
      sourceKind: "public-task",
      title: { en: "Retail daily task sheet", zh: "零售门店每日任务表" },
      objective: {
        en: "Convert a store's operating instructions into a practical daily assignment and sign-off sheet.",
        zh: "将门店运营说明转化为可实际使用的每日任务分配与签核表。",
      },
      inputs: {
        en: "A Word document containing the source task list and presentation requirements for store staff.",
        zh: "一份包含原始任务列表及门店员工使用要求的 Word 文档。",
      },
      expectedOutput: {
        en: "A clear PDF with one task per row and dedicated spaces for employee assignment, initials, and completion sign-off.",
        zh: "一份清晰的 PDF，每行一个任务，并设有员工分配、姓名缩写及完成签核栏。",
      },
      evaluation: {
        en: "The PDF is judged against task-specific content, structure, and usability criteria, with a reference file available to the panel.",
        zh: "评审模型组依据任务特定的内容、结构与可用性标准评估 PDF，并参考专家制作的文件。",
      },
      capabilities: {
        en: ["Document transformation", "Instruction following", "Operational design"],
        zh: ["文档转换", "指令遵循", "运营表单设计"],
      },
      sourceLabel: { en: "OpenAI GDPval viewer", zh: "OpenAI GDPval 数据查看器" },
      sourceUrl: "https://huggingface.co/datasets/openai/gdpval/viewer",
    },
  ],
  "tau3-banking": [
    {
      id: "tau-banking-card-selection",
      sourceId: "task_001",
      sourceKind: "public-task",
      title: { en: "Select and apply for a rewards card", zh: "选择并申请返现信用卡" },
      objective: {
        en: "Help a customer choose a personal card with no annual fee and the strongest cashback fit, then complete the application.",
        zh: "帮助客户选择无年费且返现最合适的个人信用卡，并完成申请。",
      },
      inputs: {
        en: "A simulated conversation, a large bank-policy knowledge base, hidden customer preferences revealed through dialogue, and account tools.",
        zh: "模拟对话、大型银行政策知识库、通过对话逐步披露的客户偏好，以及账户操作工具。",
      },
      expectedOutput: {
        en: "A policy-grounded recommendation and the correct application recorded in the simulated banking backend.",
        zh: "基于政策的推荐，以及正确写入模拟银行后端的申请记录。",
      },
      evaluation: {
        en: "The evaluator checks the resulting database state and task reward after the agent and user simulator finish the workflow.",
        zh: "智能体与用户模拟器完成流程后，评测器检查最终数据库状态和任务奖励。",
      },
      capabilities: {
        en: ["Policy retrieval", "Preference elicitation", "State-changing tools"],
        zh: ["政策检索", "偏好识别", "状态变更工具"],
      },
      sourceLabel: { en: "Upstream task JSON", zh: "上游任务 JSON" },
      sourceUrl: "https://github.com/sierra-research/tau2-bench/blob/main/data/tau2/domains/banking_knowledge/tasks/task_001.json",
    },
    {
      id: "tau-banking-credit-limit",
      sourceId: "task_050",
      sourceKind: "public-task",
      title: { en: "Credit-limit increase workflow", zh: "信用额度提升流程" },
      objective: {
        en: "Process a requested credit-limit increase only after all identity, account-history, and policy conditions are satisfied.",
        zh: "只有在身份、账户历史及政策条件全部满足后，才处理信用额度提升请求。",
      },
      inputs: {
        en: "Customer dialogue, banking policy documents, account history, card state, and a sequence of verification and update tools.",
        zh: "客户对话、银行政策文件、账户历史、信用卡状态，以及一组验证和更新工具。",
      },
      expectedOutput: {
        en: "A correctly explained decision and, when eligible, the exact new limit persisted to the target card account.",
        zh: "解释清楚且符合政策的决定；若客户符合资格，则将准确的新额度写入目标信用卡账户。",
      },
      evaluation: {
        en: "Success is determined from the final backend state, including whether the right card changed by the permitted amount.",
        zh: "根据最终后端状态判定成功，包括是否对正确的卡片进行了政策允许范围内的额度变更。",
      },
      capabilities: {
        en: ["Conditional policy", "Multi-step verification", "Tool sequencing"],
        zh: ["条件政策", "多步骤验证", "工具编排"],
      },
      sourceLabel: { en: "Upstream task JSON", zh: "上游任务 JSON" },
      sourceUrl: "https://github.com/sierra-research/tau2-bench/blob/main/data/tau2/domains/banking_knowledge/tasks/task_050.json",
    },
  ],
  "terminal-bench-2-1": [
    {
      id: "terminal-financial-documents",
      sourceId: "financial-document-processor",
      sourceKind: "public-task",
      title: { en: "Financial document processor", zh: "财务文档处理器" },
      objective: {
        en: "Build and run a terminal workflow that classifies mixed business documents, extracts invoice totals, and produces a reconciliation summary.",
        zh: "在终端中构建并运行工作流，对混合业务文档分类、提取发票金额并生成汇总核对表。",
      },
      inputs: {
        en: "A directory containing PDF and image documents with OCR and file-management work left to the agent.",
        zh: "一个包含 PDF 和图片文档的目录，智能体需要自行完成 OCR 与文件管理。",
      },
      expectedOutput: {
        en: "Documents moved into the required classes plus a CSV containing extracted totals, VAT values, and a final aggregate row.",
        zh: "按要求分类移动后的文档，以及包含总额、增值税数值和最终汇总行的 CSV。",
      },
      evaluation: {
        en: "Automated tests verify directory structure, document classification, complete file coverage, CSV schema, and amount-level accuracy.",
        zh: "自动化测试验证目录结构、文档分类、文件覆盖完整性、CSV 结构及金额准确性。",
      },
      capabilities: {
        en: ["Terminal autonomy", "OCR pipeline", "File and data handling"],
        zh: ["终端自主执行", "OCR 流程", "文件与数据处理"],
      },
      sourceLabel: { en: "Official task package", zh: "官方任务包" },
      sourceUrl: "https://github.com/harbor-framework/terminal-bench-2-1/tree/main/tasks/financial-document-processor",
    },
    {
      id: "terminal-wal-recovery",
      sourceId: "db-wal-recovery",
      sourceKind: "public-task",
      title: { en: "Recover a database from an encrypted WAL", zh: "从加密 WAL 恢复数据库" },
      objective: {
        en: "Diagnose and recover newer SQLite records whose write-ahead log has been transformed with a known byte-level cipher.",
        zh: "诊断并恢复 SQLite 的较新记录，其预写日志经过已知的字节级加密处理。",
      },
      inputs: {
        en: "A base SQLite database, an encrypted WAL artifact, a supplied cipher key, and a terminal environment for investigation.",
        zh: "一个基础 SQLite 数据库、加密 WAL 文件、给定的密钥，以及用于调查的终端环境。",
      },
      expectedOutput: {
        en: "A JSON file containing the complete recovered record set with the required fields, ordering, and uniqueness.",
        zh: "一份包含完整恢复记录集的 JSON 文件，并符合字段、排序及唯一性要求。",
      },
      evaluation: {
        en: "Tests compare the recovered structure, record count, identifiers, updates, values, and deterministic ordering against the expected state.",
        zh: "测试将恢复结果的结构、记录数、标识符、更新、数值及确定性排序与预期状态逐项比较。",
      },
      capabilities: {
        en: ["Binary forensics", "SQLite internals", "Recovery scripting"],
        zh: ["二进制取证", "SQLite 内部机制", "恢复脚本"],
      },
      sourceLabel: { en: "Official task package", zh: "官方任务包" },
      sourceUrl: "https://github.com/harbor-framework/terminal-bench-2-1/tree/main/tasks/db-wal-recovery",
    },
  ],
  scicode: [
    {
      id: "scicode-lennard-jones",
      sourceId: "problem_id 51",
      sourceKind: "public-task",
      title: { en: "Lennard-Jones molecular dynamics", zh: "Lennard-Jones 分子动力学" },
      objective: {
        en: "Implement the force calculation and time integration needed to evolve a small Lennard-Jones particle system.",
        zh: "实现力的计算与时间积分，使一个小型 Lennard-Jones 粒子系统随时间演化。",
      },
      inputs: {
        en: "Scientific background, equations, initial positions and velocities, material parameters, mass, and time-step settings.",
        zh: "科学背景、方程、初始位置与速度、材料参数、质量及时间步设置。",
      },
      expectedOutput: {
        en: "Python functions for pairwise forces and Velocity Verlet updates with the required numerical array behavior.",
        zh: "用于成对作用力和 Velocity Verlet 更新的 Python 函数，并符合规定的数值数组行为。",
      },
      evaluation: {
        en: "Subproblem-level unit tests execute the generated functions and compare their numerical outputs with reference behavior.",
        zh: "子问题级单元测试执行生成的函数，并将数值输出与参考行为比较。",
      },
      capabilities: {
        en: ["Equation-to-code translation", "Numerical integration", "Array programming"],
        zh: ["方程转代码", "数值积分", "数组编程"],
      },
      sourceLabel: { en: "SciCode dataset viewer", zh: "SciCode 数据查看器" },
      sourceUrl: "https://huggingface.co/datasets/SciCode1/SciCode/viewer",
    },
    {
      id: "scicode-neutrino-oscillation",
      sourceId: "problem_id 70",
      sourceKind: "public-task",
      title: { en: "Three-flavor neutrino oscillation", zh: "三味中微子振荡" },
      objective: {
        en: "Translate the three-neutrino mixing formalism into code that computes flavor-transition probabilities.",
        zh: "将三中微子混合形式体系转化为计算味转换概率的代码。",
      },
      inputs: {
        en: "A multi-step physics specification with mixing parameters, propagation terms, and intermediate PMNS-matrix requirements.",
        zh: "包含混合参数、传播项及中间 PMNS 矩阵要求的多步骤物理规范。",
      },
      expectedOutput: {
        en: "Python functions that construct the intermediate matrices and return the requested oscillation-probability values.",
        zh: "构造中间矩阵并返回所需振荡概率数值的 Python 函数。",
      },
      evaluation: {
        en: "Executable unit tests check each scientific substep and the composed result, rather than grading explanatory prose.",
        zh: "可执行单元测试检查每个科学子步骤及组合结果，而非对解释性文字评分。",
      },
      capabilities: {
        en: ["Complex linear algebra", "Physics conventions", "Multi-step synthesis"],
        zh: ["复数线性代数", "物理约定", "多步骤合成"],
      },
      sourceLabel: { en: "SciCode dataset viewer", zh: "SciCode 数据查看器" },
      sourceUrl: "https://huggingface.co/datasets/SciCode1/SciCode/viewer",
    },
  ],
  "aa-lcr": [
    {
      id: "aa-lcr-consumer-infringements",
      sourceId: "ac_markets · question 1",
      sourceKind: "public-task",
      title: { en: "Consumer-infringement frequency across reports", zh: "跨报告统计消费者侵权频次" },
      objective: {
        en: "Rank industries by how often a specific regulator explicitly reported consumer infringements across three decades, while honoring an exclusion rule.",
        zh: "跨三十年监管材料，按某监管机构明确报告消费者侵权的频次对行业排序，同时遵守排除条件。",
      },
      inputs: {
        en: "A long bundle of regulator reports and papers totaling roughly 94,000 tokens, plus the ranking and exclusion criteria.",
        zh: "一组总计约 9.4 万 token 的监管报告与论文，以及排序和排除标准。",
      },
      expectedOutput: {
        en: "A concise ranked list of the qualifying industries with a count for each one.",
        zh: "一份简洁的合格行业排序列表，并附各行业出现次数。",
      },
      evaluation: {
        en: "An equality checker compares the answer's entities, order, counts, and compliance with the exclusion against the reference answer.",
        zh: "等价性评分器将答案中的实体、排序、计数及排除条件执行情况与参考答案比较。",
      },
      capabilities: {
        en: ["Long-context retrieval", "Cross-document aggregation", "Constraint handling"],
        zh: ["长上下文检索", "跨文档聚合", "约束处理"],
      },
      sourceLabel: { en: "Official AA-LCR dataset row", zh: "官方 AA-LCR 数据行" },
      sourceUrl: "https://huggingface.co/datasets/ArtificialAnalysis/AA-LCR/blob/main/AA-LCR_Dataset.csv",
    },
    {
      id: "aa-lcr-data-center-revenue",
      sourceId: "co_dc_ann_sup_a · question 16",
      sourceKind: "public-task",
      title: { en: "Conditional data-center revenue analysis", zh: "条件式数据中心收入分析" },
      objective: {
        en: "Determine whether a growth trigger is met and, only if it is, calculate a revenue-category share for two companies across reporting periods.",
        zh: "判断增长触发条件是否满足；仅在满足时，计算两家公司在多个报告期的收入类别占比。",
      },
      inputs: {
        en: "Four company reports totaling roughly 79,000 tokens, with period definitions, company-specific metrics, and a conditional instruction.",
        zh: "四份总计约 7.9 万 token 的公司报告，其中包含期间定义、公司特定指标及条件指令。",
      },
      expectedOutput: {
        en: "A trigger decision followed, when applicable, by clearly labeled percentage calculations for each requested company and quarter.",
        zh: "先给出触发条件判断；若适用，再按公司和季度清晰列出百分比计算结果。",
      },
      evaluation: {
        en: "The equality checker assesses the conditional branch, selected source metrics, period mapping, arithmetic, and final values.",
        zh: "等价性评分器检查条件分支、所选源指标、期间映射、计算过程及最终数值。",
      },
      capabilities: {
        en: ["Conditional reasoning", "Financial metric alignment", "Multi-period arithmetic"],
        zh: ["条件推理", "财务指标对齐", "多期计算"],
      },
      sourceLabel: { en: "Official AA-LCR dataset row", zh: "官方 AA-LCR 数据行" },
      sourceUrl: "https://huggingface.co/datasets/ArtificialAnalysis/AA-LCR/blob/main/AA-LCR_Dataset.csv",
    },
  ],
  "aa-omniscience": [
    {
      id: "omniscience-asc-606",
      sourceId: "question_id 1",
      sourceKind: "public-task",
      title: { en: "Locate an exact revenue-recognition reference", zh: "定位收入确认准则条款" },
      objective: {
        en: "Identify the exact accounting-standard reference that defines two criteria for treating recurring goods or services as a single series.",
        zh: "识别会计准则中规定两项条件的确切条款，用于判断重复提供的商品或服务是否构成单一系列。",
      },
      inputs: {
        en: "A standalone specialist accounting question with no attached source documents or retrieval tools.",
        zh: "一道独立的专业会计问题，不提供附加源文档或检索工具。",
      },
      expectedOutput: {
        en: "A short, exact standards citation, or an abstention if the model cannot answer reliably.",
        zh: "简短而准确的准则引用；若无法可靠作答，则选择拒答。",
      },
      evaluation: {
        en: "The benchmark separately rewards correct answers and reliable abstention while penalizing unsupported incorrect claims.",
        zh: "基准分别奖励正确答案与可靠拒答，并惩罚缺乏依据的错误断言。",
      },
      capabilities: {
        en: ["Precise factual recall", "Professional standards", "Calibrated abstention"],
        zh: ["精确事实回忆", "专业准则知识", "可靠拒答"],
      },
      sourceLabel: { en: "Official public-subset row", zh: "官方公开子集数据行" },
      sourceUrl: "https://huggingface.co/datasets/ArtificialAnalysis/AA-Omniscience-Public/blob/main/AA-Omniscience_dataset_public.csv",
    },
    {
      id: "omniscience-risk-operator",
      sourceId: "question_id 49",
      sourceKind: "public-task",
      title: { en: "Derive a first-order portfolio-loss operator", zh: "推导一阶投资组合损失算子" },
      objective: {
        en: "Derive the first-order linear loss operator implied by a differentiable portfolio-value function and a defined market-risk shock.",
        zh: "根据可微的投资组合价值函数和给定市场风险冲击，推导一阶线性损失算子。",
      },
      inputs: {
        en: "A compact mathematical risk definition covering value, time evolution, and the sign convention for the shock.",
        zh: "一段紧凑的数学风险定义，涵盖价值、时间演化及冲击的符号约定。",
      },
      expectedOutput: {
        en: "A symbolic expression with the correct derivatives, time term, risk-factor term, and sign convention, or a declared abstention.",
        zh: "包含正确导数、时间项、风险因子项及符号约定的符号表达式，或明确拒答。",
      },
      evaluation: {
        en: "Correctness and non-hallucination are scored jointly; a confident but wrong expression is treated differently from abstention.",
        zh: "正确性与非幻觉率共同计分；自信但错误的表达式与拒答会被区别处理。",
      },
      capabilities: {
        en: ["Technical derivation", "Notation discipline", "Confidence calibration"],
        zh: ["技术推导", "符号规范", "信心校准"],
      },
      sourceLabel: { en: "Official public-subset row", zh: "官方公开子集数据行" },
      sourceUrl: "https://huggingface.co/datasets/ArtificialAnalysis/AA-Omniscience-Public/blob/main/AA-Omniscience_dataset_public.csv",
    },
  ],
  hle: [
    {
      id: "hle-math-format",
      sourceId: null,
      sourceKind: "format-archetype",
      title: { en: "Expert mathematical short answer", zh: "专家级数学简答题" },
      objective: {
        en: "Resolve a self-contained, research-level mathematical problem with an unambiguous expert-verifiable answer.",
        zh: "解决一个自包含的研究级数学问题，并给出可由专家明确验证的答案。",
      },
      inputs: {
        en: "A text-only formal problem drawn from the benchmark's documented expert-question format; no gated item is reproduced here.",
        zh: "依据基准公开说明的专家命题格式构成的纯文本形式问题；此处不复现任何受控题目。",
      },
      expectedOutput: {
        en: "A concise open answer, accompanied in the evaluation protocol by the model's confidence estimate.",
        zh: "简洁的开放式答案；评测协议同时采集模型的信心估计。",
      },
      evaluation: {
        en: "Documented benchmark scoring checks answer correctness and calibration. This profile describes the format, not a released task.",
        zh: "公开的评分方法检查答案正确性与校准度。本条仅描述任务格式，并非已发布题目。",
      },
      capabilities: {
        en: ["Expert reasoning", "Open-answer precision", "Calibration"],
        zh: ["专家推理", "开放答案精度", "校准能力"],
      },
      sourceLabel: { en: "Official paper · format only", zh: "官方论文 · 仅格式说明" },
      sourceUrl: "https://arxiv.org/abs/2501.14249",
    },
    {
      id: "hle-science-format",
      sourceId: null,
      sourceKind: "format-archetype",
      title: { en: "Expert natural-science question", zh: "专家级自然科学题" },
      objective: {
        en: "Resolve a specialist science problem whose answer is intended to be short, determinate, and independently verifiable by experts.",
        zh: "解决一个专业科学问题，其答案应简短、明确，并可由专家独立验证。",
      },
      inputs: {
        en: "A text-only question consistent with the documented biology, chemistry, or physics coverage; no gated item is reproduced here.",
        zh: "符合公开说明的生物、化学或物理覆盖范围的纯文本问题；此处不复现任何受控题目。",
      },
      expectedOutput: {
        en: "An exact open response in the required scientific form, plus confidence under the benchmark protocol.",
        zh: "按要求科学形式给出的准确开放式回答，以及评测协议要求的信心值。",
      },
      evaluation: {
        en: "The official methodology uses answer checking and calibration measures. The underlying benchmark item remains gated.",
        zh: "官方方法使用答案检查与校准指标；底层基准题目仍受控访问。",
      },
      capabilities: {
        en: ["Specialist knowledge", "Scientific reasoning", "Calibration"],
        zh: ["专业知识", "科学推理", "校准能力"],
      },
      sourceLabel: { en: "Official repository · format only", zh: "官方代码仓库 · 仅格式说明" },
      sourceUrl: "https://github.com/centerforaisafety/hle",
    },
  ],
  "gpqa-diamond": [
    {
      id: "gpqa-biology-format",
      sourceId: null,
      sourceKind: "format-archetype",
      title: { en: "Mechanistic biology multiple choice", zh: "机制生物学选择题" },
      objective: {
        en: "Integrate specialist biological mechanisms and eliminate plausible distractors to select one defensible answer.",
        zh: "整合专业生物学机制，并排除看似合理的干扰项，选出一个可论证的答案。",
      },
      inputs: {
        en: "An expert-authored question and four answer options in GPQA's documented format; the gated question text is not reproduced.",
        zh: "一道人类专家编写的问题和四个选项，符合 GPQA 公开格式；受控题目正文不在此复现。",
      },
      expectedOutput: {
        en: "Exactly one selected answer option, in the compact form expected by the evaluation harness.",
        zh: "严格选择一个答案选项，并采用评测框架要求的简洁格式。",
      },
      evaluation: {
        en: "A regular-expression extractor maps the response to an option and scores exact choice accuracy. This is a format profile only.",
        zh: "正则提取器将回答映射到选项，并按选择准确率评分。本条仅为格式画像。",
      },
      capabilities: {
        en: ["Mechanistic reasoning", "Distractor elimination", "Answer-format control"],
        zh: ["机制推理", "干扰项排除", "答案格式控制"],
      },
      sourceLabel: { en: "Official paper · format only", zh: "官方论文 · 仅格式说明" },
      sourceUrl: "https://arxiv.org/abs/2311.12022",
    },
    {
      id: "gpqa-physical-science-format",
      sourceId: null,
      sourceKind: "format-archetype",
      title: { en: "Quantitative physical-science multiple choice", zh: "定量物理科学选择题" },
      objective: {
        en: "Carry out a specialist physics or chemistry derivation and distinguish the correct result from three technical distractors.",
        zh: "完成专业物理或化学推导，并从三个技术性干扰项中区分出正确结果。",
      },
      inputs: {
        en: "A graduate-level question and four options in the documented Diamond-subset format; no restricted example is exposed.",
        zh: "一道研究生水平问题及四个选项，符合 Diamond 子集公开格式；不暴露任何受限示例。",
      },
      expectedOutput: {
        en: "One answer choice that can be extracted unambiguously by the evaluation script.",
        zh: "一个可被评测脚本无歧义提取的答案选项。",
      },
      evaluation: {
        en: "The selected option is extracted and compared with the keyed answer. Dataset access terms prohibit reproducing the actual examples here.",
        zh: "提取所选选项并与标准答案比较。数据集访问条款禁止在此复现真实示例。",
      },
      capabilities: {
        en: ["Quantitative derivation", "Specialist knowledge", "Distractor analysis"],
        zh: ["定量推导", "专业知识", "干扰项分析"],
      },
      sourceLabel: { en: "Gated dataset card · format only", zh: "受控数据集说明 · 仅格式说明" },
      sourceUrl: "https://huggingface.co/datasets/Idavidrein/gpqa",
    },
  ],
  critpt: [
    {
      id: "critpt-qcd-matching",
      sourceId: "Challenge_23_main",
      sourceKind: "public-task",
      title: { en: "One-loop QCD matching expression", zh: "单圈 QCD 匹配表达式" },
      objective: {
        en: "Derive a piecewise symbolic contribution to a one-loop matching calculation in large-momentum effective theory.",
        zh: "在大动量有效理论中，推导单圈匹配计算的一项分段符号贡献。",
      },
      inputs: {
        en: "A research-level perturbative-QCD specification, momentum-fraction regions, symbolic parameters, and a required function template.",
        zh: "研究级微扰 QCD 规范、动量分数区域、符号参数及规定的函数模板。",
      },
      expectedOutput: {
        en: "Executable symbolic code returning the correct SymPy expression in each specified kinematic region.",
        zh: "可执行的符号代码，在每个指定运动学区域返回正确的 SymPy 表达式。",
      },
      evaluation: {
        en: "The access-controlled official grader evaluates the submitted function against hidden symbolic and numerical checks.",
        zh: "受控的官方评分器使用隐藏的符号及数值检查来评估所提交函数。",
      },
      capabilities: {
        en: ["Field-theory derivation", "Piecewise algebra", "Symbolic programming"],
        zh: ["场论推导", "分段代数", "符号编程"],
      },
      sourceLabel: { en: "Official CritPt dataset row", zh: "官方 CritPt 数据行" },
      sourceUrl: "https://huggingface.co/datasets/CritPt-Benchmark/CritPt/viewer",
    },
    {
      id: "critpt-rydberg-scar",
      sourceId: "Challenge_46_main",
      sourceKind: "public-task",
      title: { en: "Rydberg-chain scar states", zh: "Rydberg 链疤痕态" },
      objective: {
        en: "Compute selected many-body scar-state energies and their overlaps with a staggered reference state in a constrained spin chain.",
        zh: "计算受限自旋链中选定多体疤痕态的能量，以及它们与交错参考态的重叠。",
      },
      inputs: {
        en: "The PXP Hamiltonian definition, Rydberg-blockade constraint, system parameters, target states, and numerical precision requirements.",
        zh: "PXP 哈密顿量定义、Rydberg 阻塞约束、系统参数、目标态及数值精度要求。",
      },
      expectedOutput: {
        en: "Python-computed energy values and logarithmic squared overlaps in the exact structured form requested by the task.",
        zh: "用 Python 计算的能量数值与重叠平方的对数，并采用任务要求的精确结构。",
      },
      evaluation: {
        en: "The controlled grader checks the returned values and required precision against its reference computation.",
        zh: "受控评分器将返回数值及精度与参考计算结果进行比较。",
      },
      capabilities: {
        en: ["Constrained Hilbert spaces", "Many-body numerics", "Precision control"],
        zh: ["受限希尔伯特空间", "多体数值计算", "精度控制"],
      },
      sourceLabel: { en: "Official CritPt dataset row", zh: "官方 CritPt 数据行" },
      sourceUrl: "https://huggingface.co/datasets/CritPt-Benchmark/CritPt/viewer",
    },
  ],
};

export function modelBenchmarkSampleSearchText(benchmarkId: string): string {
  return (modelBenchmarkSamples[benchmarkId] ?? []).flatMap((sample) => [
    sample.sourceId ?? "",
    sample.title.en,
    sample.title.zh,
    sample.objective.en,
    sample.objective.zh,
    sample.inputs.en,
    sample.inputs.zh,
    sample.expectedOutput.en,
    sample.expectedOutput.zh,
    sample.evaluation.en,
    sample.evaluation.zh,
    ...sample.capabilities.en,
    ...sample.capabilities.zh,
  ]).join(" ").toLowerCase();
}
