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
};
