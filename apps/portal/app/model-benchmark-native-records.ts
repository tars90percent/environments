import type { BenchmarkReferenceLanguage } from "./model-benchmark-data";

type LocalizedText = Record<BenchmarkReferenceLanguage, string>;

export type NativeTaskFieldRole = "identity" | "instruction" | "input" | "template" | "reference" | "grader";

export type NativeTaskField = {
  name: string;
  role: NativeTaskFieldRole;
  summary: LocalizedText;
  payload: "cataloged-metadata" | "publisher-only";
};

export type NativeTaskStage = {
  label: LocalizedText;
  summary: LocalizedText;
};

export type NativeTaskRecord = {
  availability: "public-record" | "format-only";
  publisherFormat: LocalizedText;
  domain: LocalizedText;
  split: LocalizedText;
  sourceObject: LocalizedText;
  fields: NativeTaskField[];
  stages: NativeTaskStage[];
  outputContract: LocalizedText;
  gradingContract: LocalizedText;
};

const text = (en: string, zh: string): LocalizedText => ({ en, zh });
const field = (name: string, role: NativeTaskFieldRole, en: string, zh: string, payload: NativeTaskField["payload"] = "publisher-only"): NativeTaskField => ({
  name,
  role,
  summary: text(en, zh),
  payload,
});
const stage = (enLabel: string, zhLabel: string, en: string, zh: string): NativeTaskStage => ({
  label: text(enLabel, zhLabel),
  summary: text(en, zh),
});

function gdpvalRecord(domain: LocalizedText, sourceFile: string, deliverable: LocalizedText): NativeTaskRecord {
  return {
    availability: "public-record",
    publisherFormat: text("Parquet row + linked work files", "Parquet 数据行 + 外链工作文件"),
    domain,
    split: text("Public train · 220 tasks", "公开 train 集 · 220 个任务"),
    sourceObject: text("One GDPval task row", "一条 GDPval 任务数据行"),
    fields: [
      field("task_id", "identity", "Stable UUID for this work assignment.", "该工作任务的稳定 UUID。", "cataloged-metadata"),
      field("sector / occupation", "identity", "Industry and professional role used to frame the assignment.", "用于界定任务情境的行业与职业角色。", "cataloged-metadata"),
      field("prompt", "instruction", "The complete English workplace brief, constraints, and delivery requirements.", "完整英文工作简报、限制条件和交付要求。"),
      field("reference_files", "input", `Publisher-hosted source material; this sample names ${sourceFile}.`, `发布方托管的源材料；本样例包含 ${sourceFile}。`, "cataloged-metadata"),
      field("deliverable_files", "reference", "Human-authored reference deliverable used by the evaluator, kept upstream.", "供评测器使用的人类专家参考交付物，内容保留在上游。"),
      field("rubric_pretty / rubric_json", "grader", "Human-authored criteria in readable and structured forms, kept upstream.", "人类专家评分细则的可读与结构化版本，内容保留在上游。"),
    ],
    stages: [
      stage("Read the brief", "读取任务简报", "Resolve the professional role, requested work product, and every explicit constraint.", "明确职业角色、要求的工作成果及全部显式限制。"),
      stage("Inspect source files", "检查源文件", "Open and interpret the linked office document or workbook without changing the originals.", "打开并理解外链办公文档或工作簿，不改动原件。"),
      stage("Build the deliverable", "制作交付物", deliverable.en, deliverable.zh),
      stage("Submit the file", "提交文件", "Return the requested file type with the expected naming and internal structure.", "按规定文件类型、命名及内部结构提交结果。"),
    ],
    outputContract: deliverable,
    gradingContract: text("A judge compares the submitted file with task-specific rubric criteria and a human reference deliverable.", "评审模型依据任务专属评分细则及人类参考交付物，对提交文件进行比较。"),
  };
}

function tauRecord(kind: "card" | "limit"): NativeTaskRecord {
  const card = kind === "card";
  return {
    availability: "public-record",
    publisherFormat: text("tau² task JSON + simulator state", "tau² 任务 JSON + 模拟器状态"),
    domain: text("Banking knowledge · customer service", "银行知识 · 客户服务"),
    split: text("Official banking_knowledge task collection", "官方 banking_knowledge 任务集"),
    sourceObject: text(card ? "task_001.json · 42-line scenario record" : "task_050.json · scenario record", card ? "task_001.json · 42 行场景记录" : "task_050.json · 场景记录"),
    fields: [
      field("id / description", "identity", "Stable task key plus optional purpose, policy, and notes metadata.", "稳定任务键，以及可选的目的、政策和备注元数据。", "cataloged-metadata"),
      field("user_scenario.instructions", "instruction", card ? "Hidden customer persona, preferences, disclosure rules, and end condition." : "Hidden customer request, account facts, disclosure rules, and end condition.", card ? "隐藏的客户身份、偏好、信息披露规则与结束条件。" : "隐藏的客户请求、账户事实、披露规则与结束条件。"),
      field("initial_state", "input", "Starting simulator or database state when the task supplies one.", "任务如有提供，则为模拟器或数据库的初始状态。"),
      field("required_documents", "input", card ? "Four card-product knowledge documents required for grounded comparison." : "The policy and account documents required to decide eligibility.", card ? "用于有依据比较的四份信用卡产品知识文档。" : "用于判断资格的政策与账户文档。", "cataloged-metadata"),
      field("user_tools", "template", card ? "The customer-side credit-card application action." : "The allowed verification and account-update actions.", card ? "客户侧信用卡申请动作。" : "允许使用的验证与账户更新动作。", "cataloged-metadata"),
      field("evaluation_criteria", "grader", "Expected actions, arguments, communicated facts, and reward basis.", "预期动作、参数、需传达信息及奖励依据。"),
    ],
    stages: [
      stage("Ground in policy", "检索政策依据", "Read only the required bank documents and establish the applicable constraints.", "读取所需银行文档并确定适用约束。"),
      stage("Elicit facts", "获取必要事实", "Ask for missing information while the user simulator reveals facts incrementally.", "询问缺失信息；用户模拟器会逐步披露事实。"),
      stage(card ? "Compare products" : "Check eligibility", card ? "比较产品" : "检查资格", card ? "Match preferences to the available card products and annual-fee constraints." : "Apply identity, account-history, requested-amount, and policy conditions.", card ? "根据偏好及年费限制匹配可选信用卡产品。" : "应用身份、账户历史、申请额度及政策条件。"),
      stage("Commit the action", "执行状态变更", card ? "Invoke the application tool with the selected product and customer facts." : "Update the target account only when every prerequisite passes.", card ? "使用所选产品与客户信息调用申请工具。" : "仅在全部前置条件通过时更新目标账户。"),
    ],
    outputContract: text(card ? "A grounded recommendation plus the exact application action recorded in simulator state." : "A policy-grounded decision plus the exact permitted account-state change, when eligible.", card ? "有政策依据的推荐，以及写入模拟器状态的准确申请动作。" : "有政策依据的决定；符合资格时，还需完成准确且获准的账户状态变更。"),
    gradingContract: text("The evaluator inspects required tool calls, arguments, communicated information, and the resulting database state.", "评测器检查必需工具调用、参数、传达信息及最终数据库状态。"),
  };
}

function sciCodeRecord(problem: "lj" | "neutrino"): NativeTaskRecord {
  const lj = problem === "lj";
  return {
    availability: "public-record",
    publisherFormat: text("JSON scientific-programming record", "JSON 科学编程记录"),
    domain: text(lj ? "Molecular dynamics · computational physics" : "Neutrino oscillation · particle physics", lj ? "分子动力学 · 计算物理" : "中微子振荡 · 粒子物理"),
    split: text("Public test split · 65 problems", "公开 test 集 · 65 个问题"),
    sourceObject: text(lj ? "problem_id 51 · staged problem" : "problem_id 70 · staged problem", lj ? "problem_id 51 · 分阶段问题" : "problem_id 70 · 分阶段问题"),
    fields: [
      field("problem_name / problem_id", "identity", "Problem label and stable numeric identifier.", "问题名称与稳定数字标识。", "cataloged-metadata"),
      field("problem_description_main", "instruction", "The top-level scientific programming request.", "顶层科学编程要求。"),
      field("problem_background_main", "input", "Equations, scientific conventions, and domain background needed to solve it.", "求解所需的方程、科学约定与领域背景。"),
      field("problem_io / required_dependencies", "template", "Function signature, array shapes, return contract, and allowed imports.", "函数签名、数组形状、返回约定及允许导入的依赖。", "cataloged-metadata"),
      field("sub_steps", "instruction", lj ? "Staged force computation and Velocity Verlet integration prompts." : "Staged mixing-matrix, propagation, and probability prompts.", lj ? "分阶段的作用力计算与 Velocity Verlet 积分要求。" : "分阶段的混合矩阵、传播与概率计算要求。"),
      field("general_solution / general_tests", "grader", "Publisher reference implementation and executable tests, kept at source.", "发布方参考实现与可执行测试，内容保留在源站。"),
    ],
    stages: [
      stage("Read the model", "理解科学模型", lj ? "Translate the Lennard-Jones equations, parameters, and periodic assumptions into array operations." : "Resolve the three-flavor mixing conventions, parameters, and propagation equations.", lj ? "将 Lennard-Jones 方程、参数及周期性假设转化为数组运算。" : "明确三味混合约定、参数及传播方程。"),
      stage("Implement substeps", "实现子步骤", lj ? "Implement pairwise forces before composing the time integrator." : "Construct the intermediate matrices before composing transition probabilities.", lj ? "先实现成对作用力，再组合时间积分器。" : "先构造中间矩阵，再组合味转换概率。"),
      stage("Compose the solution", "组合最终解", "Match the publisher's function interfaces and numerical types exactly.", "严格匹配发布方函数接口与数值类型。"),
      stage("Run unit checks", "执行单元检查", "Exercise both substeps and the complete function against structured examples.", "用结构化样例检查各子步骤与完整函数。"),
    ],
    outputContract: text(lj ? "Python functions returning force arrays and updated positions and velocities." : "Python functions returning intermediate matrices and requested oscillation probabilities.", lj ? "返回作用力数组及更新后位置、速度的 Python 函数。" : "返回中间矩阵及所需振荡概率的 Python 函数。"),
    gradingContract: text("Executable tests check interface compliance and numerical results at both subproblem and composed-problem levels.", "可执行测试在子问题与组合问题两个层级检查接口一致性和数值结果。"),
  };
}

function lcrRecord(kind: "reports" | "revenue"): NativeTaskRecord {
  const reports = kind === "reports";
  return {
    availability: "public-record",
    publisherFormat: text("CSV row + external document bundle", "CSV 数据行 + 外部文档包"),
    domain: text(reports ? "Academia · competition and consumer regulation" : "Company documents · data-center reporting", reports ? "学术材料 · 竞争与消费者监管" : "公司文档 · 数据中心报告"),
    split: text("Public test · 100 questions", "公开 test 集 · 100 道题"),
    sourceObject: text(reports ? "ac_markets · question 1 · 94,494 input tokens" : "co_dc_ann_sup_a · question 16 · 78,978 input tokens", reports ? "ac_markets · 问题 1 · 94,494 输入 token" : "co_dc_ann_sup_a · 问题 16 · 78,978 输入 token"),
    fields: [
      field("document_category / document_set_id", "identity", "Category and stable identifier for the shared source bundle.", "共享来源文档包的类别与稳定标识。", "cataloged-metadata"),
      field("question_id", "identity", "Row-level question identifier.", "数据行级问题标识。", "cataloged-metadata"),
      field("question", "instruction", "The complete English cross-document question and its output constraints.", "完整英文跨文档问题及输出约束。"),
      field("data_source_filenames", "input", reports ? "Four text-extracted reports and papers." : "Four company earnings and supplemental reports.", reports ? "四份文本化报告与论文。" : "四份公司财报与补充报告。", "cataloged-metadata"),
      field("data_source_urls", "input", "Publisher-maintained pointers to the original public documents.", "发布方维护的原始公开文档指针。", "cataloged-metadata"),
      field("answer", "reference", "Compact reference answer used by the equality checker, kept upstream.", "供等价性评分器使用的简洁参考答案，内容保留在上游。"),
      field("input_tokens", "identity", "Recorded token count for the assembled context.", "组装后上下文的记录 token 数。", "cataloged-metadata"),
    ],
    stages: [
      stage("Load the bundle", "载入文档包", "Assemble the listed source documents into one long context.", "将列出的源文档组装为一个长上下文。"),
      stage("Locate evidence", "定位证据", reports ? "Find explicit infringement counts across the required periods and industries." : "Locate the relevant company, period, revenue category, and trigger condition.", reports ? "查找规定期间及行业的明确侵权次数。" : "定位相关公司、期间、收入类别及触发条件。"),
      stage("Reconcile sources", "跨来源核对", "Resolve entity names, reporting periods, units, and exclusions across documents.", "跨文档统一实体名称、报告期间、单位及排除条件。"),
      stage("Return compactly", "按约定简洁作答", "Emit only the ranking or conditional calculations requested by the row.", "仅输出数据行要求的排序或条件计算。"),
    ],
    outputContract: text(reports ? "A ranked industry list with counts and the specified exclusion applied." : "A trigger decision and, when triggered, labeled company-by-period percentage results.", reports ? "按次数排序的行业列表，并执行指定排除条件。" : "触发条件判断；触发时给出按公司与期间标注的百分比结果。"),
    gradingContract: text("The official equality checker compares semantic content, required entities, ordering, values, and formatting with the reference answer.", "官方等价性评分器将语义内容、必需实体、顺序、数值及格式与参考答案比较。"),
  };
}

function omniscienceRecord(kind: "citation" | "operator"): NativeTaskRecord {
  const citation = kind === "citation";
  return {
    availability: "public-record",
    publisherFormat: text("Compact CSV question row", "紧凑型 CSV 问题数据行"),
    domain: text(citation ? "Finance · accounting" : "Finance · corporate markets · risk management", citation ? "金融 · 会计" : "金融 · 公司与市场 · 风险管理"),
    split: text("Public train subset · 600 questions", "公开 train 子集 · 600 道题"),
    sourceObject: text(citation ? "question_id 1" : "question_id 49", citation ? "问题 ID 1" : "问题 ID 49"),
    fields: [
      field("domain", "identity", "Top-level professional knowledge domain.", "顶层专业知识领域。", "cataloged-metadata"),
      field("topic / subtopic", "identity", citation ? "Accounting / Accounting taxonomy labels." : "Corporate & Markets / Risk management taxonomy labels.", citation ? "Accounting / Accounting 分类标签。" : "Corporate & Markets / Risk management 分类标签。", "cataloged-metadata"),
      field("question_id", "identity", "Stable public-subset row identifier.", "公开子集数据行的稳定标识。", "cataloged-metadata"),
      field("question", "instruction", citation ? "An exact-source professional accounting query." : "A compact mathematical definition requiring a symbolic derivation.", citation ? "要求精确来源的专业会计问题。" : "需要符号推导的紧凑数学定义。"),
      field("answer", "reference", citation ? "The exact standards citation expected by the benchmark, kept upstream." : "The reference symbolic expression, kept upstream.", citation ? "基准期望的准确准则条款，内容保留在上游。" : "参考符号表达式，内容保留在上游。"),
    ],
    stages: [
      stage("Classify the query", "识别问题类型", citation ? "Recognize the applicable accounting standard and requested citation granularity." : "Resolve the value function, time increment, shock definition, and loss sign convention.", citation ? "识别适用会计准则及要求的引用粒度。" : "明确价值函数、时间增量、冲击定义及损失符号约定。"),
      stage(citation ? "Recall precisely" : "Linearize", citation ? "精确回忆" : "一阶线性化", citation ? "Retrieve the exact paragraph reference without substituting nearby guidance." : "Apply a first-order Taylor expansion in time and each risk factor.", citation ? "检索准确段落引用，避免用相邻条款替代。" : "对时间及各风险因子应用一阶 Taylor 展开。"),
      stage("Calibrate", "进行信心校准", "Answer only when sufficiently certain; otherwise use the benchmark's abstention path.", "仅在足够确定时作答，否则使用基准的拒答路径。"),
      stage("Return exactly", "按精确格式输出", citation ? "Emit only the short standards citation." : "Emit one symbolic expression with the required notation and sign.", citation ? "仅输出简短准则引用。" : "输出一个符合规定符号与正负号的表达式。"),
    ],
    outputContract: text(citation ? "One exact accounting-standard citation, or an explicit abstention." : "One first-order symbolic loss operator, or an explicit abstention.", citation ? "一个准确会计准则引用，或明确拒答。" : "一个一阶符号损失算子，或明确拒答。"),
    gradingContract: text("The benchmark scores factual correctness together with non-hallucination; abstention and an unsupported wrong answer are treated differently.", "基准共同衡量事实正确性与非幻觉率；拒答与无依据的错误答案会被区别处理。"),
  };
}

function gatedRecord(benchmark: "hle" | "gpqa", domain: LocalizedText): NativeTaskRecord {
  const hle = benchmark === "hle";
  return {
    availability: "format-only",
    publisherFormat: text(hle ? "Gated multimodal question record" : "Gated multiple-choice CSV row", hle ? "受控访问的多模态问题记录" : "受控访问的选择题 CSV 数据行"),
    domain,
    split: text(hle ? "Protected test set · 2,500 documented questions" : "Diamond subset · 198 documented questions", hle ? "受保护 test 集 · 公开说明为 2,500 道题" : "Diamond 子集 · 公开说明为 198 道题"),
    sourceObject: text("Documented schema only · no benchmark item reproduced", "仅记录公开格式 · 不复现基准题目"),
    fields: hle ? [
      field("question identifier", "identity", "A stable per-item key in the gated dataset.", "受控数据集中的稳定单题标识。", "cataloged-metadata"),
      field("question", "instruction", "Expert-authored multiple-choice or short-answer task; text is not reproduced.", "专家编写的选择题或简答题；不复现题目正文。"),
      field("image (optional)", "input", "Some items include an image alongside the text prompt.", "部分题目在文本题面之外还包含图片。"),
      field("answer / rationale", "reference", "Protected reference material used for answer checking.", "用于答案检查的受保护参考材料。"),
      field("confidence", "template", "The evaluation protocol collects a model confidence estimate.", "评测协议采集模型信心估计。", "cataloged-metadata"),
    ] : [
      field("Question", "instruction", "Expert-authored graduate-level question; dataset terms prohibit reproducing examples.", "专家编写的研究生水平题目；数据集条款禁止复现示例。"),
      field("Correct Answer", "reference", "Protected keyed answer.", "受保护的标准答案。"),
      field("Incorrect Answer 1–3", "input", "Three technically plausible distractors.", "三个技术上看似合理的干扰项。"),
      field("Subdomain / High-level domain", "identity", "Physics, chemistry, or biology taxonomy metadata.", "物理、化学或生物的分类元数据。", "cataloged-metadata"),
      field("Writer / validation metadata", "grader", "Expert authorship and validation records maintained by the publisher.", "发布方维护的专家命题与验证记录。"),
    ],
    stages: [
      stage("Read the item", "读取题目", hle ? "Interpret the protected text and any attached image in the authorized evaluation environment." : "Interpret the protected question and all four options in the authorized evaluation environment.", hle ? "在获授权的评测环境中理解受保护文本及可能附带的图片。" : "在获授权的评测环境中理解受保护问题及全部四个选项。"),
      stage("Solve", "完成推理", hle ? "Apply specialist reasoning to produce a short, determinate response." : "Apply specialist reasoning and eliminate technically plausible distractors.", hle ? "运用专业推理得出简短且明确的回答。" : "运用专业推理并排除技术上看似合理的干扰项。"),
      stage("Return", "按协议输出", hle ? "Return the answer and protocol-required confidence estimate." : "Return exactly one extractable answer choice.", hle ? "返回答案及协议要求的信心估计。" : "严格返回一个可提取的答案选项。"),
    ],
    outputContract: text(hle ? "A short answer or one multiple-choice selection, plus confidence under the official protocol." : "Exactly one answer option in an unambiguous extractable form.", hle ? "简短答案或一个选择题选项，并按官方协议提供信心值。" : "以无歧义、可提取的形式输出且仅输出一个答案选项。"),
    gradingContract: text(hle ? "Official evaluation combines answer checking with calibration metrics." : "The harness extracts the selected option and compares it with the protected keyed answer.", hle ? "官方评测结合答案检查与校准指标。" : "评测框架提取所选选项，并与受保护的标准答案比较。"),
  };
}

function critptRecord(kind: "qcd" | "rydberg"): NativeTaskRecord {
  const qcd = kind === "qcd";
  return {
    availability: "public-record",
    publisherFormat: text("Parquet challenge row + notebook provenance", "Parquet 挑战数据行 + Notebook 来源"),
    domain: text(qcd ? "Theoretical physics · perturbative QCD" : "Condensed-matter physics · quantum many-body", qcd ? "理论物理 · 微扰 QCD" : "凝聚态物理 · 量子多体"),
    split: text("Public train · 70 challenge rows", "公开 train 集 · 70 条挑战记录"),
    sourceObject: text(qcd ? "Challenge_23_main · main problem" : "Challenge_46_main · main problem", qcd ? "Challenge_23_main · 主问题" : "Challenge_46_main · 主问题"),
    fields: [
      field("problem_id / problem_type / problem_index", "identity", "Challenge key plus main/subproblem relationship metadata.", "挑战标识及主问题/子问题关系元数据。", "cataloged-metadata"),
      field("problem_description", "instruction", qcd ? "Research-level LaMET and one-loop QCD derivation brief." : "PXP-chain, blockade, target-state, and precision specification.", qcd ? "研究级 LaMET 与单圈 QCD 推导要求。" : "PXP 链、阻塞约束、目标态及精度要求。"),
      field("code_template", "template", qcd ? "An English Python/SymPy function stub with named symbolic inputs and a piecewise-expression return contract." : "A Python function stub with numerical inputs and structured return values.", qcd ? "英文 Python/SymPy 函数模板，包含具名符号输入及分段表达式返回约定。" : "包含数值输入及结构化返回值的 Python 函数模板。"),
      field("answer_code / answer_only_code", "reference", "Publisher reference implementation, kept at the upstream dataset.", "发布方参考实现，内容保留在上游数据集。"),
      field("testcases", "grader", "Controlled symbolic or numerical checks associated with the challenge.", "与挑战关联的受控符号或数值检查。"),
      field("metadata_notebook_path", "input", qcd ? "data/public_test_challenges/Challenge_23.ipynb" : "data/public_test_challenges/Challenge_46.ipynb", qcd ? "data/public_test_challenges/Challenge_23.ipynb" : "data/public_test_challenges/Challenge_46.ipynb", "cataloged-metadata"),
      field("metadata_problem_setup / metadata_tag", "input", "Notebook-derived setup text and publisher taxonomy tag.", "由 Notebook 提取的问题背景及发布方分类标签。"),
    ],
    stages: [
      stage("Parse the setup", "解析问题背景", qcd ? "Resolve the regularization symbols, momentum regions, and required one-loop contribution." : "Construct the constrained Hilbert space, Hamiltonian, reference state, and target observables.", qcd ? "明确正规化符号、动量区域及所需单圈贡献。" : "构造受限希尔伯特空间、哈密顿量、参考态及目标观测量。"),
      stage("Derive", "完成推导", qcd ? "Derive a separate symbolic branch for each specified kinematic region." : "Diagonalize or otherwise compute the requested scar-state energies and overlaps.", qcd ? "为每个指定运动学区域推导独立符号分支。" : "通过对角化或其他方式计算所需疤痕态能量与重叠。"),
      stage("Implement", "按模板实现", qcd ? "Encode the result in the supplied SymPy function without changing its signature." : "Encode the values in the supplied Python function and requested structure.", qcd ? "在不修改函数签名的前提下，用给定 SymPy 函数实现结果。" : "在给定 Python 函数中按规定结构实现数值结果。"),
      stage("Validate", "接受受控验证", qcd ? "The publisher checks symbolic equivalence and numerical substitutions." : "The publisher checks values, ordering, structure, and numerical precision.", qcd ? "发布方检查符号等价性及数值代入结果。" : "发布方检查数值、顺序、结构及数值精度。"),
    ],
    outputContract: text(qcd ? "One executable SymPy function returning the required branch-correct expression." : "One executable Python function returning the requested energies and logarithmic squared overlaps.", qcd ? "一个可执行 SymPy 函数，返回各分支正确的规定表达式。" : "一个可执行 Python 函数，返回所需能量及重叠平方的对数。"),
    gradingContract: text(qcd ? "Controlled tests evaluate function shape, symbolic equivalence, and numerical agreement across regions." : "Controlled tests compare structured values and required numerical precision with the publisher reference.", qcd ? "受控测试检查函数结构、各区域符号等价性及数值一致性。" : "受控测试将结构化数值及规定精度与发布方参考结果比较。"),
  };
}

type PublicRecordSpec = {
  publisherFormat: [string, string];
  domain: [string, string];
  split: [string, string];
  sourceObject: [string, string];
  identity: [string, string, string];
  instruction: [string, string, string];
  input: [string, string, string];
  template: [string, string, string];
  reference: [string, string, string];
  grader: [string, string, string];
  process: [string, string];
  output: [string, string];
  grading: [string, string];
};

function publicRecord(spec: PublicRecordSpec): NativeTaskRecord {
  return {
    availability: "public-record",
    publisherFormat: text(...spec.publisherFormat),
    domain: text(...spec.domain),
    split: text(...spec.split),
    sourceObject: text(...spec.sourceObject),
    fields: [
      field(spec.identity[0], "identity", spec.identity[1], spec.identity[2], "cataloged-metadata"),
      field(spec.instruction[0], "instruction", spec.instruction[1], spec.instruction[2]),
      field(spec.input[0], "input", spec.input[1], spec.input[2]),
      field(spec.template[0], "template", spec.template[1], spec.template[2], "cataloged-metadata"),
      field(spec.reference[0], "reference", spec.reference[1], spec.reference[2]),
      field(spec.grader[0], "grader", spec.grader[1], spec.grader[2]),
    ],
    stages: [
      stage("Resolve the task", "明确任务", "Read the publisher record, identify the permitted inputs, and establish the completion condition.", "读取发布方记录，识别允许使用的输入，并确定完成条件。"),
      stage("Execute", "执行", spec.process[0], spec.process[1]),
      stage("Return the result", "提交结果", spec.output[0], spec.output[1]),
    ],
    outputContract: text(...spec.output),
    gradingContract: text(...spec.grading),
  };
}

export const modelBenchmarkNativeTaskRecords: Record<string, NativeTaskRecord> = {
  "gdpval-afc-audit-sample": gdpvalRecord(text("Professional services · accountants and auditors", "专业服务 · 会计师与审计师"), "Population v2.xlsx", text("An Excel workbook with a Sample Size Calculation sheet and the selected audit sample.", "一份包含“Sample Size Calculation”工作表及所选审计样本的 Excel 工作簿。")),
  "gdpval-retail-task-list": gdpvalRecord(text("Retail trade · first-line supervisors", "零售业 · 一线主管"), "Daily Tasks.docx", text("A staff-ready PDF with one task per row and assignment, initials, and completion fields.", "一份员工可直接使用的 PDF，每行一个任务，并含分配、姓名缩写及完成栏。")),
  "tau-banking-card-selection": tauRecord("card"),
  "tau-banking-credit-limit": tauRecord("limit"),
  "scicode-lennard-jones": sciCodeRecord("lj"),
  "scicode-neutrino-oscillation": sciCodeRecord("neutrino"),
  "aa-lcr-consumer-infringements": lcrRecord("reports"),
  "aa-lcr-data-center-revenue": lcrRecord("revenue"),
  "omniscience-asc-606": omniscienceRecord("citation"),
  "omniscience-risk-operator": omniscienceRecord("operator"),
  "hle-math-format": gatedRecord("hle", text("Expert mathematics", "专家级数学")),
  "hle-science-format": gatedRecord("hle", text("Expert natural science", "专家级自然科学")),
  "gpqa-biology-format": gatedRecord("gpqa", text("Graduate-level biology", "研究生水平生物学")),
  "gpqa-physical-science-format": gatedRecord("gpqa", text("Graduate-level physics and chemistry", "研究生水平物理与化学")),
  "critpt-qcd-matching": critptRecord("qcd"),
  "critpt-rydberg-scar": critptRecord("rydberg"),
  "automationbench-sales-routing": publicRecord({
    publisherFormat: ["Python task definition + CRM simulator", "Python 任务定义 + CRM 模拟器"], domain: ["Sales operations · lead routing", "销售运营 · 线索路由"], split: ["Official open task collection", "官方开放任务集"], sourceObject: ["Task 501 in sales/tasks.py", "sales/tasks.py 中的任务 501"],
    identity: ["task id / domain", "Numeric task identity and sales-domain registration.", "数字任务标识及销售领域注册信息。"], instruction: ["instruction", "The requested multi-application automation and business conditions.", "所需的跨应用自动化及业务条件。"], input: ["initial_state / app data", "Seeded CRM, spreadsheet, and messaging records available to the agent.", "智能体可用的初始 CRM、电子表格及消息记录。"], template: ["available tools", "The application actions exposed by the benchmark environment.", "基准环境开放的应用操作。"], reference: ["expected state", "Publisher-defined successful records and cross-application updates.", "发布方定义的成功记录及跨应用更新。"], grader: ["validators", "Deterministic checks over the final simulated application state.", "针对最终模拟应用状态的确定性检查。"],
    process: ["Find the qualifying sales records, apply the routing rules, and make the required coordinated updates through the available tools.", "查找符合条件的销售记录，应用路由规则，并通过可用工具完成所需的协同更新。"], output: ["The required CRM, spreadsheet, and messaging state changes, with no separate prose deliverable.", "完成规定的 CRM、电子表格及消息状态变更，无需另交文字说明。"], grading: ["State validators compare the affected records and required actions with the task's expected end state.", "状态验证器将受影响记录及必需动作与任务预期最终状态比较。"],
  }),
  "toolathlon-ab-testing": publicRecord({
    publisherFormat: ["Task directory + tool-server configuration", "任务目录 + 工具服务器配置"], domain: ["Product analytics · A/B testing", "产品分析 · A/B 测试"], split: ["Official final task pool", "官方 final 任务池"], sourceObject: ["tasks/finalpool/ab-testing", "tasks/finalpool/ab-testing"],
    identity: ["task directory", "Stable task path in the official final pool.", "官方 final 任务池中的稳定任务路径。"], instruction: ["query / task description", "The analysis request and completion requirements.", "分析请求及完成要求。"], input: ["tool data / resources", "Data exposed through the task's configured external tools.", "通过任务所配置外部工具开放的数据。"], template: ["tool schema", "Allowed tool names, arguments, and response structures.", "允许的工具名称、参数及响应结构。"], reference: ["reference answer", "Publisher solution facts retained in the upstream task package.", "保留在上游任务包中的发布方参考事实。"], grader: ["evaluation configuration", "Task-specific checks over the final answer and tool-grounded facts.", "针对最终答案及工具依据事实的任务专属检查。"],
    process: ["Use the configured tools to retrieve experiment evidence, calculate the comparison, and synthesize the requested decision support.", "使用配置的工具检索实验依据、计算对比并综合形成所需决策支持。"], output: ["A concise, evidence-grounded A/B-test analysis in the task's requested form.", "一份简洁且有证据依据的 A/B 测试分析，并符合任务规定形式。"], grading: ["The official evaluator checks required answer facts against the publisher reference and task configuration.", "官方评测器依据发布方参考及任务配置检查答案中的必需事实。"],
  }),
  "ale-marketing-ab-test": publicRecord({
    publisherFormat: ["YAML task card + linked office files", "YAML 任务卡 + 外链办公文件"], domain: ["Business and finance · digital marketing", "商业与金融 · 数字营销"], split: ["Official open task cards", "官方开放任务卡"], sourceObject: ["digital_marketing_ab_test_analysis_1", "digital_marketing_ab_test_analysis_1"],
    identity: ["task_id / category", "Stable card identity and professional category.", "稳定任务卡标识及专业类别。"], instruction: ["description", "The complete professional assignment and deliverable constraints.", "完整专业任务及交付物限制。"], input: ["input_files", "Publisher-linked campaign data and supporting office files.", "发布方外链的营销活动数据及配套办公文件。"], template: ["output_file / format", "Required file type and submission location.", "规定的文件类型及提交位置。"], reference: ["reference_files", "Human-authored comparison material retained upstream.", "保留在上游的人类专家对照材料。"], grader: ["rubric", "Task-specific criteria for analytical correctness and deliverable quality.", "关于分析正确性及交付物质量的任务专属标准。"],
    process: ["Inspect the campaign materials, calculate the experiment comparison, and create the requested professional analysis artifact.", "检查营销活动材料，计算实验对比，并制作所需的专业分析成果。"], output: ["The requested office-file analysis with findings and supporting calculations.", "包含结论及支撑计算的规定办公文件分析成果。"], grading: ["A rubric-based evaluator compares the submitted artifact with the task criteria and reference material.", "基于细则的评测器将提交成果与任务标准及参考材料比较。"],
  }),
  "browsecomp-publisher-example-1": publicRecord({
    publisherFormat: ["Encrypted CSV question row + equality grader", "加密 CSV 问题行 + 等价性评分器"], domain: ["Open-web research", "开放网络研究"], split: ["Official public encrypted test release", "官方公开加密 test 版本"], sourceObject: ["Publisher example 1", "发布方示例 1"],
    identity: ["id", "Stable row identifier in the public release.", "公开版本中的稳定行标识。"], instruction: ["problem", "A deliberately difficult web-research question.", "一道刻意设计为高难度的网络研究问题。"], input: ["open web", "Public webpages located by the model during research.", "模型在研究过程中定位的公开网页。"], template: ["answer string", "A compact direct-answer response contract.", "简洁直接的答案输出约定。"], reference: ["answer", "Encrypted benchmark reference retained in the official release.", "保留在官方版本中的加密基准答案。"], grader: ["browsecomp evaluator", "The official semantic equality prompt compares response and reference.", "官方语义等价性提示将回答与参考答案比较。"],
    process: ["Search iteratively, follow cross-source clues, reconcile entities and dates, and retain enough evidence to support one answer.", "迭代搜索，追踪跨来源线索，核对实体与日期，并保留足以支持单一答案的依据。"], output: ["One concise answer to the publisher's example question.", "对发布方示例问题给出一个简洁答案。"], grading: ["The official evaluator judges whether the response is semantically equivalent to the encrypted reference answer.", "官方评测器判断回答是否与加密参考答案在语义上等价。"],
  }),
  "osworld-fill-down-calc": publicRecord({
    publisherFormat: ["JSON task record + desktop VM state", "JSON 任务记录 + 桌面虚拟机状态"], domain: ["Desktop productivity · LibreOffice Calc", "桌面生产力 · LibreOffice Calc"], split: ["Official examples", "官方 examples 集"], sourceObject: ["01b269ae-2111-4a07-81fd-3fcd711993b0", "01b269ae-2111-4a07-81fd-3fcd711993b0"],
    identity: ["id / snapshot", "Task UUID and starting desktop snapshot.", "任务 UUID 及起始桌面快照。"], instruction: ["instruction", "The spreadsheet edit to perform through the graphical interface.", "需通过图形界面完成的电子表格编辑。"], input: ["config / files", "The starting workbook and application state loaded into the VM.", "载入虚拟机的起始工作簿及应用状态。"], template: ["application / trajectory", "Permitted desktop application and interaction environment.", "允许使用的桌面应用及交互环境。"], reference: ["reference state", "Publisher-specified target workbook state retained upstream.", "保留在上游的发布方目标工作簿状态。"], grader: ["evaluator", "A task-specific state extractor and comparison rule.", "任务专属的状态提取器及比较规则。"],
    process: ["Open the specified workbook in Calc, use the graphical interface to extend the intended content, and save the resulting state.", "在 Calc 中打开指定工作簿，通过图形界面扩展规定内容，并保存结果状态。"], output: ["A saved workbook whose target cells contain the required filled-down values or formulas.", "一份已保存的工作簿，其目标单元格包含规定的向下填充值或公式。"], grading: ["The OSWorld evaluator extracts the relevant workbook state and compares it with the task target.", "OSWorld 评测器提取相关工作簿状态并与任务目标比较。"],
  }),
  "apex-florida-diminished-value": publicRecord({
    publisherFormat: ["Dataset row + linked file attachments", "数据行 + 外链附件"], domain: ["Legal and insurance operations", "法律与保险运营"], split: ["APEX-v1-extended public rows", "APEX-v1-extended 公开数据行"], sourceObject: ["Task ID 13", "任务 ID 13"],
    identity: ["Task ID / Domain", "Stable task number and professional domain.", "稳定任务编号及专业领域。"], instruction: ["Prompt", "The complete professional work request.", "完整专业工作要求。"], input: ["File Attachments", "Source documents linked to the task row.", "与任务数据行关联的源文档。"], template: ["deliverable format", "The file type and organization requested by the prompt.", "题面要求的文件类型及组织方式。"], reference: ["reference deliverable", "Publisher comparison artifact retained upstream when supplied.", "发布方如有提供，则参考交付物保留在上游。"], grader: ["Rubric JSON", "Structured criteria used to assess the completed deliverable.", "用于评估完成交付物的结构化标准。"],
    process: ["Review the supplied case materials, apply the documented diminished-value method, and assemble the requested professional artifact.", "审阅所提供案件材料，应用规定的贬值计算方法，并制作所需专业成果。"], output: ["A task-compliant diminished-value analysis file with traceable calculations and conclusions.", "一份符合任务要求的贬值分析文件，包含可追溯的计算与结论。"], grading: ["The submitted file is scored against the task's structured rubric and required evidence.", "提交文件依据任务结构化评分细则及必需证据进行评分。"],
  }),
  "arc-agi-3-ls20": publicRecord({
    publisherFormat: ["Interactive game environment + action API", "交互式游戏环境 + 动作 API"], domain: ["Abstract visual reasoning", "抽象视觉推理"], split: ["Official public preview environments", "官方公开预览环境"], sourceObject: ["Environment ls20", "环境 ls20"],
    identity: ["game_id / level", "Public environment identifier and current level state.", "公开环境标识及当前关卡状态。"], instruction: ["implicit objective", "The goal must be inferred from state transitions rather than a written solution brief.", "目标需从状态变化中推断，而非由文字解题说明直接给出。"], input: ["frame / state", "The current visual grid and interaction history.", "当前视觉网格及交互历史。"], template: ["action_space", "The discrete actions accepted by the environment API.", "环境 API 接受的离散动作。"], reference: ["hidden transition target", "Publisher-held success state and game dynamics.", "由发布方保留的成功状态及游戏动态。"], grader: ["environment score", "Online progress and completion signals returned by the game.", "游戏返回的在线进度及完成信号。"],
    process: ["Probe the environment, infer the action semantics and latent rule, then plan interactions that advance and complete the level.", "探索环境，推断动作语义及潜在规则，再规划推进并完成关卡的交互。"], output: ["A sequence of valid environment actions that reaches the game's success condition.", "一组到达游戏成功条件的有效环境动作序列。"], grading: ["The live environment reports progress and completion according to its hidden game rules.", "实时环境依据其隐藏游戏规则返回进度与完成结果。"],
  }),
  "deepsearchqa-oecd-criminality": publicRecord({
    publisherFormat: ["Dataset row + open-web research", "数据行 + 开放网络研究"], domain: ["Politics and government · cross-source facts", "政治与政府 · 跨来源事实"], split: ["Official evaluation set", "官方 evaluation 集"], sourceObject: ["Evaluation row 0", "evaluation 数据行 0"],
    identity: ["problem_category / answer_type", "Topic category and expected answer shape.", "主题类别及预期答案形态。"], instruction: ["problem", "A multi-constraint research question requiring several public sources.", "一道需要多个公开来源的多条件研究问题。"], input: ["open web", "Publisher and institutional webpages discovered during research.", "研究过程中发现的发布方及机构网页。"], template: ["answer_type", "The required scalar, list, or structured response category.", "规定的标量、列表或结构化回答类别。"], reference: ["answer", "Publisher reference answer retained in the source dataset.", "保留在源数据集中的发布方参考答案。"], grader: ["official evaluation", "Answer correctness is compared with the task reference under the benchmark protocol.", "按基准协议将答案正确性与任务参考进行比较。"],
    process: ["Decompose the constraints, locate authoritative statistics for each entity and period, and reconcile the results across sources.", "拆解限制条件，定位各实体及期间的权威统计，并跨来源核对结果。"], output: ["A compact answer in the row's declared answer type, covering every requested entity and condition.", "按数据行声明的答案类型给出简洁回答，覆盖所有要求的实体与条件。"], grading: ["The benchmark compares the response with the publisher reference for factual and structural correctness.", "基准将回答与发布方参考比较，以检查事实及结构正确性。"],
  }),
  "mcp-atlas-assaultcube-dates": publicRecord({
    publisherFormat: ["JSONL task + MCP tool registry", "JSONL 任务 + MCP 工具注册表"], domain: ["Tool orchestration · software metadata", "工具编排 · 软件元数据"], split: ["Official public benchmark tasks", "官方公开基准任务"], sourceObject: ["Task 689f4d693e212e8ef3390731", "任务 689f4d693e212e8ef3390731"],
    identity: ["_id", "Stable benchmark task identifier.", "稳定基准任务标识。"], instruction: ["PROMPT", "The multi-source information request given to the agent.", "交给智能体的多来源信息请求。"], input: ["ENABLED_TOOLS", "The MCP servers and functions enabled for this task.", "本任务启用的 MCP 服务器及函数。"], template: ["tool schemas / response", "Typed tool arguments plus a final natural-language response.", "类型化工具参数及最终自然语言回答。"], reference: ["GTFA_CLAIMS", "Atomic ground-truth claims retained in the publisher record.", "保留在发布方记录中的原子事实主张。"], grader: ["TRAJECTORY / claim scorer", "Tool-use trajectory context and claim-level answer checks.", "工具使用轨迹上下文及主张级答案检查。"],
    process: ["Select the enabled MCP tools, retrieve the relevant software facts, reconcile dates across sources, and compose the answer.", "选择启用的 MCP 工具，检索相关软件事实，跨来源核对日期并形成回答。"], output: ["A concise final response containing the requested AssaultCube date facts.", "一份包含所需 AssaultCube 日期事实的简洁最终回答。"], grading: ["The evaluator checks whether the response entails the task's required ground-truth claims.", "评测器检查回答是否涵盖任务要求的标准事实主张。"],
  }),
  "nl2repo-aiofiles": publicRecord({
    publisherFormat: ["Natural-language specification + empty repository target", "自然语言规格 + 空仓库目标"], domain: ["Repository generation · asynchronous file I/O", "代码仓库生成 · 异步文件 I/O"], split: ["Official public repositories", "官方公开仓库任务"], sourceObject: ["aiofiles", "aiofiles"],
    identity: ["repo_name / language", "Target package identity and implementation language.", "目标软件包标识及实现语言。"], instruction: ["specification", "A natural-language description of the repository to reconstruct.", "需重建代码仓库的自然语言说明。"], input: ["package requirements", "Documented APIs, behaviors, packaging expectations, and dependency constraints.", "记录的 API、行为、打包要求及依赖限制。"], template: ["repository tree", "A complete source repository rather than a single function response.", "完整源代码仓库，而非单一函数回答。"], reference: ["upstream repository", "The held-out publisher repository snapshot used as behavioral context.", "作为行为上下文的发布方保留代码仓库快照。"], grader: ["generated tests / execution", "Functional checks run against the reconstructed repository.", "针对重建仓库运行的功能检查。"],
    process: ["Design the package structure, implement the described asynchronous file interfaces, and make the generated repository installable and testable.", "设计软件包结构，实现所描述的异步文件接口，并使生成仓库可安装、可测试。"], output: ["A complete aiofiles-style repository satisfying the natural-language specification.", "一个满足自然语言规格的完整 aiofiles 风格代码仓库。"], grading: ["The benchmark installs the generated repository and checks its externally observable behavior with tests.", "基准安装生成的代码仓库，并通过测试检查其外部可观察行为。"],
  }),
  "frontierswe-cranelift-codegen": publicRecord({
    publisherFormat: ["Pinned repository task + containerized tests", "固定仓库任务 + 容器化测试"], domain: ["Systems software · compiler optimization", "系统软件 · 编译器优化"], split: ["Official public task set", "官方公开任务集"], sourceObject: ["cranelift-codegen-opt", "cranelift-codegen-opt"],
    identity: ["task id / commit", "Task slug and pinned repository revision.", "任务标识及固定仓库版本。"], instruction: ["task statement", "The compiler-code change requested by the benchmark.", "基准要求的编译器代码变更。"], input: ["repository / environment", "The Cranelift source snapshot and build environment.", "Cranelift 源代码快照及构建环境。"], template: ["git patch", "A code change applied to the pinned repository.", "应用到固定仓库的代码变更。"], reference: ["reference patch", "Publisher solution retained in the benchmark source.", "保留在基准源中的发布方解法。"], grader: ["test commands", "Task-specific and repository tests defined by the harness.", "评测框架定义的任务专属及仓库测试。"],
    process: ["Analyze the code-generation path, implement the requested optimization, and validate the change against compiler behavior.", "分析代码生成路径，实现所需优化，并根据编译器行为验证变更。"], output: ["A minimal repository patch implementing the requested Cranelift optimization.", "一份实现所需 Cranelift 优化的最小代码仓库补丁。"], grading: ["The official container applies the patch and runs the declared functional and regression tests.", "官方容器应用补丁并运行声明的功能及回归测试。"],
  }),
  "programbench-zoxide": publicRecord({
    publisherFormat: ["Repository manifest + reconstruction harness", "代码仓库清单 + 重建评测框架"], domain: ["Program reconstruction · Rust CLI", "程序重建 · Rust 命令行工具"], split: ["Official public benchmark cases", "官方公开基准案例"], sourceObject: ["ajeetdsouza__zoxide.67ca1bc", "ajeetdsouza__zoxide.67ca1bc"],
    identity: ["project id / commit", "Repository identity and pinned historical revision.", "代码仓库标识及固定历史版本。"], instruction: ["reconstruction objective", "Recreate the target program's externally observable behavior.", "重建目标程序的外部可观察行为。"], input: ["manifest / interface observations", "Repository metadata and allowed behavioral evidence exposed by the harness.", "评测框架开放的仓库元数据及允许使用的行为证据。"], template: ["implementation repository", "A buildable replacement project in the declared language.", "使用规定语言实现的可构建替代项目。"], reference: ["target program", "Pinned original program used as the behavioral reference.", "作为行为参考的固定版本原程序。"], grader: ["behavioral tests", "Commands compare outputs and side effects of the reconstruction and target.", "通过命令比较重建程序与目标程序的输出及副作用。"],
    process: ["Infer the CLI contract from the available evidence, implement the Rust project, and iterate until its observable behavior matches the target.", "根据可用证据推断命令行接口约定，实现 Rust 项目，并迭代至其可观察行为与目标一致。"], output: ["A buildable replacement repository for the pinned zoxide program.", "一个针对固定版本 zoxide 程序的可构建替代代码仓库。"], grading: ["Behavioral tests compare the reconstructed executable with the pinned reference program.", "行为测试将重建的可执行程序与固定参考程序比较。"],
  }),
  "posttrainbench-aime2025": publicRecord({
    publisherFormat: ["Training recipe + target evaluation", "训练方案 + 目标评测"], domain: ["Post-training · mathematical reasoning", "后训练 · 数学推理"], split: ["Official AIME2025 target configuration", "官方 AIME2025 目标配置"], sourceObject: ["AIME2025 task configuration", "AIME2025 任务配置"],
    identity: ["task / base model", "Target benchmark configuration and starting model identity.", "目标基准配置及起始模型标识。"], instruction: ["training objective", "Improve the model on the declared target under the benchmark budget.", "在基准预算内提升模型在声明目标上的表现。"], input: ["training data / compute budget", "Permitted datasets, base checkpoint, and resource constraints.", "允许使用的数据集、基础检查点及资源限制。"], template: ["training entrypoint", "Required recipe interface and final checkpoint location.", "规定的训练方案接口及最终检查点位置。"], reference: ["target answers", "Held-out evaluation references retained by the benchmark.", "由基准保留的测试评测参考答案。"], grader: ["evaluation harness", "The trained checkpoint is evaluated on the target math set.", "使用目标数学题集评估训练后的检查点。"],
    process: ["Select and run a compliant post-training recipe, monitor the constrained run, and produce the final model checkpoint.", "选择并运行符合约束的后训练方案，监控受限训练过程并生成最终模型检查点。"], output: ["A trained model checkpoint and the benchmark-required run artifacts.", "一个训练后的模型检查点及基准要求的运行产物。"], grading: ["The official harness evaluates the submitted checkpoint on the held-out AIME2025 target under the declared protocol.", "官方评测框架按声明协议在保留的 AIME2025 目标上评估提交的检查点。"],
  }),
  "spreadsheetbench-heading-of-max": publicRecord({
    publisherFormat: ["JSON task row + linked workbook", "JSON 任务行 + 外链工作簿"], domain: ["Spreadsheet formula editing", "电子表格公式编辑"], split: ["Official public sample archive", "官方公开样例压缩包"], sourceObject: ["Task 59196", "任务 59196"],
    identity: ["id / instruction_type", "Stable task number and spreadsheet-operation category.", "稳定任务编号及电子表格操作类别。"], instruction: ["instruction", "The formula-editing request for the target range.", "针对目标区域的公式编辑要求。"], input: ["spreadsheet_path", "The publisher workbook that supplies headings and row values.", "提供表头及行数据的发布方工作簿。"], template: ["answer_position", "The exact target cell range H3:H5.", "准确的目标单元格区域 H3:H5。"], reference: ["reference workbook state", "Expected formulas and calculated values retained upstream.", "保留在上游的预期公式及计算值。"], grader: ["spreadsheet checker", "The harness compares the target range's formulas or resulting cell values.", "评测框架比较目标区域的公式或计算结果。"],
    process: ["Inspect the heading row and each source-data row, enter a formula that returns the heading associated with that row's maximum, and fill it through the target range.", "检查标题行及各源数据行，输入返回每行最大值对应标题的公式，并填充至整个目标区域。"], output: ["An edited workbook with the required formulas populated in H3:H5.", "一份已编辑工作簿，在 H3:H5 中填入规定公式。"], grading: ["The benchmark opens the result and checks the designated answer cells against the expected workbook state.", "基准打开结果文件，并将指定答案单元格与预期工作簿状态比较。"],
  }),
  "swe-bench-pro-nodebb-email-validation": publicRecord({
    publisherFormat: ["Instance JSON + pinned repository + tests", "实例 JSON + 固定仓库 + 测试"], domain: ["Web software · account validation", "Web 软件 · 账户验证"], split: ["Official public SWE-Bench Pro instances", "官方公开 SWE-Bench Pro 实例"], sourceObject: ["instance_NodeBB__NodeBB-04998908ba6721d64eba79ae3b65a351dcfbc5b5-vnan", "instance_NodeBB__NodeBB-04998908ba6721d64eba79ae3b65a351dcfbc5b5-vnan"],
    identity: ["instance_id / base_commit", "Stable instance key and pinned NodeBB revision.", "稳定实例标识及固定 NodeBB 版本。"], instruction: ["problem_statement", "The requested email-validation behavior and issue context.", "所需邮件验证行为及问题上下文。"], input: ["repo / environment", "The target repository checkout and dependency environment.", "目标代码仓库检出及依赖环境。"], template: ["patch", "A source diff applied to the pinned checkout.", "应用至固定版本代码的源代码差异。"], reference: ["patch", "Publisher reference patch retained upstream.", "保留在上游的发布方参考补丁。"], grader: ["FAIL_TO_PASS / PASS_TO_PASS", "Issue tests plus regression tests used by the benchmark.", "基准使用的问题修复测试及回归测试。"],
    process: ["Trace NodeBB's email-validation path, implement the requested behavior, and preserve established account flows.", "追踪 NodeBB 的邮件验证路径，实现所需行为，并保持既有账户流程。"], output: ["A repository patch that satisfies the email-validation issue.", "一份满足邮件验证问题要求的代码仓库补丁。"], grading: ["The harness applies the patch and runs the declared fail-to-pass and pass-to-pass tests.", "评测框架应用补丁并运行声明的失败转通过及持续通过测试。"],
  }),
  "swe-marathon-biofabric-rust": publicRecord({
    publisherFormat: ["Long-horizon repository task + container", "长时程代码仓库任务 + 容器"], domain: ["Software engineering · Rust rewrite", "软件工程 · Rust 重写"], split: ["Official public benchmark tasks", "官方公开基准任务"], sourceObject: ["biofabric-rust-rewrite", "biofabric-rust-rewrite"],
    identity: ["task id / repository", "Stable task slug and source repository.", "稳定任务标识及源代码仓库。"], instruction: ["task description", "The multi-stage rewrite objective and required compatibility.", "多阶段重写目标及所需兼容性。"], input: ["repository / assets", "The existing implementation, fixtures, and build context.", "现有实现、测试夹具及构建上下文。"], template: ["repository patch", "A large code change within the supplied project.", "在所提供项目内完成的大型代码变更。"], reference: ["reference implementation", "Publisher target implementation retained upstream.", "保留在上游的发布方目标实现。"], grader: ["test suite", "Functional, compatibility, and build checks for the rewritten system.", "针对重写系统的功能、兼容性及构建检查。"],
    process: ["Understand the existing system, plan the Rust rewrite across components, implement it in stages, and keep the project buildable throughout.", "理解现有系统，规划跨组件 Rust 重写，分阶段实现，并持续保持项目可构建。"], output: ["A complete repository patch delivering the required Rust rewrite.", "一份完成规定 Rust 重写的完整代码仓库补丁。"], grading: ["The official environment builds the result and runs task-specific and regression checks.", "官方环境构建结果，并运行任务专属及回归检查。"],
  }),
  "mmmu-pro-clinical-emergency": publicRecord({
    publisherFormat: ["JSONL multimodal question record", "JSONL 多模态问题记录"], domain: ["Clinical medicine", "临床医学"], split: ["Official public test records", "官方公开 test 记录"], sourceObject: ["test_Clinical_Medicine_69", "test_Clinical_Medicine_69"],
    identity: ["id / subject", "Stable item key and academic subject.", "稳定题目标识及学科。"], instruction: ["question", "The clinical reasoning question associated with the visual material.", "与视觉材料关联的临床推理问题。"], input: ["image / options", "The publisher image and candidate answer options.", "发布方图片及候选答案选项。"], template: ["answer option", "One unambiguous multiple-choice selection.", "一个无歧义的选择题选项。"], reference: ["answer", "Publisher keyed option retained in the dataset.", "保留在数据集中的发布方标准选项。"], grader: ["answer extractor", "The evaluator extracts the selected option and compares it with the key.", "评测器提取所选选项并与标准答案比较。"],
    process: ["Inspect the clinical visual, combine it with the case facts, eliminate distractors, and select the supported option.", "检查临床图像，结合病例事实排除干扰项，并选择有依据的选项。"], output: ["Exactly one extractable answer choice.", "严格输出一个可提取的答案选项。"], grading: ["The official evaluator compares the extracted choice with the publisher's keyed answer.", "官方评测器将提取的选项与发布方标准答案比较。"],
  }),
  "babyvision-tiger-grid": publicRecord({
    publisherFormat: ["Visual puzzle record + image", "视觉谜题记录 + 图片"], domain: ["Elementary visual reasoning", "基础视觉推理"], split: ["Official public result-linked records", "官方公开结果关联记录"], sourceObject: ["Record Id 445", "记录 ID 445"],
    identity: ["Id / task type", "Stable published record number and puzzle family.", "稳定公开记录编号及谜题类别。"], instruction: ["Question", "The visual relation or counting question.", "视觉关系或计数问题。"], input: ["Image", "The associated grid illustration retained at the publisher source.", "保留在发布方源站的关联网格插图。"], template: ["short answer", "A compact literal response.", "简洁的字面回答。"], reference: ["Answer", "Publisher reference response retained upstream.", "保留在上游的发布方参考回答。"], grader: ["exact / normalized match", "The benchmark compares the normalized response with its key.", "基准将规范化回答与标准答案比较。"],
    process: ["Parse the grid, identify the relevant tiger objects and spatial relation, and compute the requested result.", "解析网格，识别相关老虎对象及空间关系，并计算所需结果。"], output: ["A short answer in the form requested by the visual question.", "按视觉问题要求给出简短答案。"], grading: ["The normalized final response is compared with the publisher reference answer.", "将规范化的最终回答与发布方参考答案比较。"],
  }),
  "charxiv-session-accuracy-decline": publicRecord({
    publisherFormat: ["JSONL chart-question row + figure", "JSONL 图表问题行 + 图像"], domain: ["Scientific chart reasoning", "科学图表推理"], split: ["Public reasoning_val split", "公开 reasoning_val 数据集"], sourceObject: ["figure_id 0", "图像 ID 0"],
    identity: ["figure_id / question_id", "Stable figure and question identifiers.", "稳定图像及问题标识。"], instruction: ["question", "A quantitative reasoning request grounded in the chart.", "基于图表的定量推理要求。"], input: ["figure / metadata", "The publisher chart image and associated paper metadata.", "发布方图表图片及关联论文元数据。"], template: ["short numeric response", "The requested quantity with its relevant unit or comparison.", "带相关单位或比较关系的规定数值回答。"], reference: ["answer", "Publisher reference answer retained in the dataset.", "保留在数据集中的发布方参考答案。"], grader: ["reasoning evaluator", "The benchmark checks the extracted quantitative conclusion.", "基准检查提取出的定量结论。"],
    process: ["Read the axes and series, identify the requested sessions and values, then calculate the decline using the chart evidence.", "读取坐标轴及数据系列，定位所需会话与数值，再依据图表计算下降幅度。"], output: ["A concise quantitative answer describing the requested accuracy decline.", "一份描述所需准确率下降幅度的简洁定量答案。"], grading: ["The final value and interpretation are compared with the publisher reference under the benchmark protocol.", "按基准协议将最终数值及解释与发布方参考比较。"],
  }),
  "chartography-buckling-point": publicRecord({
    publisherFormat: ["Parquet chart-question row + image", "Parquet 图表问题行 + 图片"], domain: ["Chart question answering · engineering", "图表问答 · 工程"], split: ["Official public benchmark dataset", "官方公开基准数据集"], sourceObject: ["Task 8dd96592-3151-4d3b-a3a0-ff7b839c5d01", "任务 8dd96592-3151-4d3b-a3a0-ff7b839c5d01"],
    identity: ["id / chart type", "Stable row identifier and visualization metadata.", "稳定数据行标识及可视化元数据。"], instruction: ["question", "The engineering quantity to infer from the chart.", "需从图表推断的工程量。"], input: ["image / chart metadata", "The publisher figure and structural chart annotations.", "发布方图像及结构化图表注释。"], template: ["answer format", "A concise value or description in the requested units.", "使用规定单位的简洁数值或描述。"], reference: ["answer", "Publisher reference response retained upstream.", "保留在上游的发布方参考回答。"], grader: ["answer evaluator", "The benchmark compares the response with the chart-grounded reference.", "基准将回答与基于图表的参考答案比较。"],
    process: ["Inspect the plotted response curve, locate the buckling transition, read the corresponding coordinate, and express it in the requested form.", "检查绘制的响应曲线，定位屈曲转折点，读取对应坐标，并按规定形式表达。"], output: ["A concise chart-grounded buckling-point answer.", "一份基于图表的简洁屈曲点答案。"], grading: ["The evaluator checks the returned value and unit against the publisher reference.", "评测器将返回数值及单位与发布方参考比较。"],
  }),
  "omnidocbench-newspaper-page": publicRecord({
    publisherFormat: ["Document page image + structured annotations", "文档页面图片 + 结构化标注"], domain: ["Document parsing · newspaper layout", "文档解析 · 报纸版面"], split: ["Official public demo cases", "官方公开演示案例"], sourceObject: ["newspaper_5e266dfd9c498cab274e12a7b4a75755_4", "newspaper_5e266dfd9c498cab274e12a7b4a75755_4"],
    identity: ["page id / document type", "Stable demo-page identity and document category.", "稳定演示页面标识及文档类别。"], instruction: ["parsing task", "Recover the page's readable and structural document content.", "恢复页面中可读且具有结构的文档内容。"], input: ["page image", "The upstream scanned or rendered newspaper page.", "上游扫描或渲染的报纸页面。"], template: ["structured output", "Ordered text, regions, tables, formulas, and reading relationships as applicable.", "按需输出有序文本、区域、表格、公式及阅读关系。"], reference: ["page annotations", "Publisher ground-truth regions and content retained upstream.", "保留在上游的发布方页面区域及内容标注。"], grader: ["OmniDocBench metrics", "Task-specific OCR, layout, table, formula, and reading-order metrics.", "任务专属的 OCR、版面、表格、公式及阅读顺序指标。"],
    process: ["Detect page regions, recognize their content, reconstruct reading order, and serialize the result in the benchmark schema.", "检测页面区域，识别其内容，重建阅读顺序，并按基准结构序列化结果。"], output: ["A structured reconstruction of the newspaper page under the official output schema.", "按官方输出结构形成的报纸页面结构化重建结果。"], grading: ["The benchmark evaluates recognized content and document structure with its component-specific metrics.", "基准使用各组件专属指标评估识别内容及文档结构。"],
  }),
  "zerobench-loyalty-bottles": publicRecord({
    publisherFormat: ["No-answer JSON record + image", "无答案 JSON 记录 + 图片"], domain: ["Extreme visual reasoning", "极高难度视觉推理"], split: ["Official zerobench_no_answers public subset", "官方 zerobench_no_answers 公开子集"], sourceObject: ["question_id 1", "问题 ID 1"],
    identity: ["question_id", "Stable public-subset question identifier.", "公开子集中的稳定问题标识。"], instruction: ["question", "The publisher's visual logic question, retained upstream.", "保留在上游的发布方视觉逻辑问题。"], input: ["image", "The associated puzzle image in the official no-answer release.", "官方无答案版本中的关联谜题图片。"], template: ["answer convention", "A compact response using the benchmark's declared answer notation.", "使用基准规定答案记法的简洁回答。"], reference: ["answer", "Gated reference answer not present in the public no-answer subset.", "受控参考答案不包含在公开无答案子集中。"], grader: ["official evaluation", "Publisher answer checking is available only under the official evaluation arrangement.", "发布方答案检查仅在官方评测安排下提供。"],
    process: ["Inspect the loyalty-bottle visual system, infer the governing transformation, and apply it to the requested configuration.", "检查忠诚度瓶子视觉系统，推断其变换规则，并将规则应用于所问配置。"], output: ["One compact answer in the benchmark's required notation.", "一个使用基准规定记法的简洁答案。"], grading: ["The official evaluator compares the submitted response with the protected reference answer.", "官方评测器将提交回答与受保护参考答案比较。"],
  }),
  "cybergym-arvo-10400": publicRecord({
    publisherFormat: ["Vulnerability task + source repository + tests", "漏洞任务 + 源代码仓库 + 测试"], domain: ["Cybersecurity · vulnerability repair", "网络安全 · 漏洞修复"], split: ["Official public arvo subset", "官方公开 arvo 子集"], sourceObject: ["arvo:10400", "arvo:10400"],
    identity: ["task id / project / revision", "Vulnerability case identity and pinned source revision.", "漏洞案例标识及固定源代码版本。"], instruction: ["vulnerability description", "The defect context and requested repair objective.", "缺陷上下文及所需修复目标。"], input: ["repository / build environment", "The vulnerable source checkout and reproducible build context.", "存在漏洞的源代码检出及可复现构建环境。"], template: ["security patch", "A source change applied to the pinned project.", "应用至固定项目的安全补丁。"], reference: ["upstream fix", "Publisher or project fix retained upstream.", "保留在上游的发布方或项目修复。"], grader: ["proof / regression tests", "Checks for vulnerability elimination and preserved behavior.", "检查漏洞消除及原有行为保持情况。"],
    process: ["Reproduce the vulnerable path, locate the root cause, implement a scoped repair, and verify both security and regression behavior.", "复现漏洞路径，定位根因，实施范围受控的修复，并验证安全性及回归行为。"], output: ["A source patch that removes the arvo:10400 vulnerability while preserving expected functionality.", "一份消除 arvo:10400 漏洞并保持预期功能的源代码补丁。"], grading: ["The benchmark builds the patched project and runs vulnerability-specific and regression checks.", "基准构建修复后的项目，并运行漏洞专属及回归检查。"],
  }),
  "exploitbench-v8-cve-2024-1939": publicRecord({
    publisherFormat: ["Exploit task directory + vulnerable build", "漏洞利用任务目录 + 易受攻击构建"], domain: ["Cybersecurity · V8 exploitation", "网络安全 · V8 漏洞利用"], split: ["Official public CVE tasks", "官方公开 CVE 任务"], sourceObject: ["v8-cve-2024-1939", "v8-cve-2024-1939"],
    identity: ["task id / CVE", "Stable task slug and vulnerability identifier.", "稳定任务标识及漏洞编号。"], instruction: ["challenge description", "The exploit objective and success constraints.", "漏洞利用目标及成功限制。"], input: ["vulnerable source / binary", "The pinned V8 target and execution environment.", "固定 V8 目标及执行环境。"], template: ["exploit artifact", "A script or input accepted by the challenge harness.", "挑战评测框架接受的脚本或输入。"], reference: ["reference exploit", "Publisher solution material retained upstream.", "保留在上游的发布方漏洞利用材料。"], grader: ["exploit verifier", "The harness observes whether the required exploitation condition is reached.", "评测框架观察是否达到规定漏洞利用条件。"],
    process: ["Analyze the vulnerable V8 behavior, develop a reliable trigger and exploitation chain, and package it for the supplied environment.", "分析易受攻击的 V8 行为，开发可靠触发方式及利用链，并针对所提供环境打包。"], output: ["An exploit artifact that reaches the benchmark's declared success condition on the pinned target.", "一个能在固定目标上达到基准声明成功条件的漏洞利用产物。"], grading: ["The official verifier runs the artifact in the vulnerable environment and checks the required exploit outcome.", "官方验证器在易受攻击环境中运行产物，并检查规定的漏洞利用结果。"],
  }),
  "exploitgym-kernel-cve-2023-6111": publicRecord({
    publisherFormat: ["Kernel exploit challenge + VM harness", "内核漏洞利用挑战 + 虚拟机评测框架"], domain: ["Cybersecurity · Linux kernel exploitation", "网络安全 · Linux 内核漏洞利用"], split: ["Official public kernelctf tasks", "官方公开 kernelctf 任务"], sourceObject: ["kernel:kernelctf/CVE-2023-6111_lts", "kernel:kernelctf/CVE-2023-6111_lts"],
    identity: ["task key / kernel build", "CVE case identity and pinned long-term-support kernel target.", "CVE 案例标识及固定长期支持内核目标。"], instruction: ["challenge objective", "The exploitation goal and environment constraints.", "漏洞利用目标及环境限制。"], input: ["kernel image / filesystem / symbols", "Publisher-provided VM materials for the vulnerable target.", "发布方为易受攻击目标提供的虚拟机材料。"], template: ["exploit source / binary", "An artifact compiled and run by the challenge harness.", "由挑战评测框架编译并运行的产物。"], reference: ["reference exploit", "Publisher solution retained at the upstream source.", "保留在上游源站的发布方解法。"], grader: ["VM success checker", "The isolated VM checks whether the required privilege or proof condition is achieved.", "隔离虚拟机检查是否达到规定权限或证明条件。"],
    process: ["Study the kernel vulnerability and target build, construct a compatible exploitation chain, and test it within the supplied VM contract.", "研究内核漏洞及目标构建，构造兼容的利用链，并在所提供虚拟机约定中测试。"], output: ["A buildable exploit artifact that reaches the declared success condition in the target VM.", "一个可构建的漏洞利用产物，能在目标虚拟机中达到声明的成功条件。"], grading: ["The official VM harness executes the exploit and verifies the benchmark's privilege or proof-of-exploitation condition.", "官方虚拟机评测框架执行漏洞利用程序，并验证基准规定的权限或利用证明条件。"],
  }),
};
