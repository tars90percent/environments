import type { BenchmarkReferenceLanguage } from "./model-benchmark-data";

type LocalizedText = Record<BenchmarkReferenceLanguage, string>;

export type ModelBenchmarkExplanation = {
  paragraphs: LocalizedText[];
  sourceUrls: string[];
  verifiedAt?: string;
};

export const modelBenchmarkExplanationVerifiedAt = "2026-09-03";

export const modelBenchmarkExplanations: Record<string, ModelBenchmarkExplanation> = {
  "gdpval-aa-v2": {
    "paragraphs": [
      {
        "en": "GDPval evaluates the production of professional work products under realistic task specifications. Developed by OpenAI, its 1,320 assignments span 44 occupations across nine U.S. industry sectors; 220 gold tasks are publicly available. The unit of evaluation is a completed artifact, such as a financial model, presentation, or audit report, assembled from a brief and supporting materials. Experts estimated approximately seven hours of human effort per task on average. This construction brings domain judgment, quantitative analysis, instruction following, and document quality into the same evaluation: success depends on whether those capabilities combine into a usable deliverable.",
        "zh": "GDPval 以贴近实际工作的任务规范，评估智能体产出专业成果的能力。该基准由 OpenAI 构建，包含美国九大行业、44 个职业中的 1,320 项任务，其中 220 项黄金任务公开。评测对象是依据需求说明和参考材料完成的交付物，例如财务模型、演示文稿或审计报告。专家估计，每项任务平均约需七小时人工投入。这种设计将领域判断、定量分析、指令遵循和文档质量纳入同一评测，考察这些能力能否共同支撑可实际使用的专业成果。"
      },
      {
        "en": "Its methodological significance lies in evaluating the work as a whole. Correct calculations can coexist with omitted requirements, unsupported conclusions, or an unusable file; presentation quality can likewise conceal substantive errors. GDPval-AA uses panel-based pairwise judgments of finished deliverables, whereas other GDPval variants apply different grading procedures. The resulting scores should therefore be interpreted within the specified evaluation variant and judge configuration. They provide evidence of professional task execution under a supplied brief, but do not independently establish occupational productivity or competence in sustained collaboration, where requirements evolve through discussion and review.",
        "zh": "这一设计的方法论价值，在于将交付成果作为整体评价。计算正确的文件仍可能遗漏要求、缺乏结论依据或无法正常使用，良好的视觉呈现也可能掩盖实质错误。GDPval-AA 由评审模型组对完整成果进行两两比较，其他 GDPval 变体则采用不同的评分程序，因此成绩需要结合具体评测变体与评审配置解读。它们能够反映智能体在给定需求下执行专业任务的能力，但不能据此直接推算职业生产率，也不能充分说明其在需求经讨论与审阅而持续变化的协作环境中的表现。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2510.04374",
      "https://huggingface.co/datasets/openai/gdpval",
      "https://artificialanalysis.ai/methodology/intelligence-benchmarking"
    ]
  },
  "tau3-banking": {
    "paragraphs": [
      {
        "en": "τ³-Banking examines policy-governed decision making in a simulated banking service environment. Its 97 tasks span 21 categories and draw on 698 policy documents, approximately 195,000 tokens in total. An agent must interpret a customer's request, retrieve the applicable rules, establish eligibility, and execute authorized account operations. The difficulty arises from dependencies among policies and actions: identifying a relevant clause is insufficient when an exception, prerequisite, or subsequent obligation changes the permissible course of action.",
        "zh": "τ³-Banking 在模拟银行服务环境中考察受政策约束的决策与执行能力。其 97 项任务分属 21 类场景，依托 698 份政策文档，合计约 19.5 万 token。智能体需要理解客户诉求、检索适用规则、核实资格条件，并执行获得授权的账户操作。难点主要来自政策条款和操作步骤之间的依赖：即便找到相关规定，例外、前置条件或后续义务也可能改变可采取的行动。"
      },
      {
        "en": "Evaluation emphasizes the resulting account state and policy outcome. A coherent conversation cannot compensate for an ineligible transaction or an incomplete sequence of dependent changes. Premature commitment to a hypothesis, reliance on an unverified customer assertion, and incorrect operation ordering are therefore consequential failure modes. The paper characterizes effort through interactions and tool use rather than a standard human completion time, and reports substantial latency differences between comparable-performing configurations. Scores and efficiency should be compared with the simulator, policy corpus, tool interface, and repetition protocol held constant.",
        "zh": "评测重点是最终账户状态与政策执行结果。对话表达连贯，并不能弥补不符合资格的交易或未完整执行的关联变更。因此，过早锁定解释、采信未经核实的客户陈述以及操作顺序错误，都会实质影响成绩。论文主要通过交互和工具使用描述工作量，没有给出统一的人工完成时间；表现相近的配置也可能存在显著延迟差异。比较准确率与效率时，应保持模拟器、政策语料、工具接口和重复运行协议一致。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2603.04370",
      "https://github.com/sierra-research/tau2-bench"
    ]
  },
  "terminal-bench": {
    "paragraphs": [
      {
        "en": "Terminal-Bench evaluates agents through executable work in terminal environments. Version 4.0 comprises 66 tasks retained from Terminal-Bench 3, covering software, science, machine learning, operations, security, hardware, and media; three tasks require a GPU. Assignments couple concise instructions with environments that must be investigated and modified. The agent may need to understand unfamiliar repositories, operate specialist software, manage long-running processes, and produce a final state accepted by a task-specific verifier. The benchmark consequently measures the coordination of reasoning and execution across an extended sequence of actions.",
        "zh": "Terminal-Bench 通过真实终端环境中的可执行任务评估智能体。4.0 版包含从 Terminal-Bench 3 保留的 66 项任务，覆盖软件、科学、机器学习、运营、安全、硬件和媒体，其中三项需要 GPU。任务通常以简洁说明配合有待检查和修改的环境，要求智能体理解陌生代码库、操作专业软件、管理长时间运行的进程，并生成任务专属验证器认可的最终状态。因此，该基准考察的是推理与执行在较长行动序列中的协同能力。"
      },
      {
        "en": "The eight-hour execution limit defines the available budget, rather than a representative human completion time. Failures can result from an incorrect implementation, loss of relevant context, premature submission, or a refusal that prevents completion; visible command activity is not itself evidence of progress toward the verified objective. Version 4 also removed eight tasks, repaired nineteen, standardized time allowances, and strengthened isolation. These changes preserve the benchmark's lineage while altering the conditions of measurement. Comparisons should identify the exact task release, agent harness, and evaluation protocol rather than treating successive releases as a continuous score series.",
        "zh": "八小时运行上限规定的是可用预算，而非代表性的人工完成时间。失败可能来自实现错误、相关上下文丢失、提前提交或阻碍任务完成的拒答；终端中持续出现操作，并不必然意味着接近可验证的目标。4.0 版还移除八项任务、修复十九项任务、统一时限并加强隔离。这些调整保留了基准的演进关系，却改变了测量条件。比较成绩时，应注明任务版本、智能体框架和评测协议，不能将不同版本视为连续可比的分数序列。"
      }
    ],
    "sourceUrls": [
      "https://www.tbench.ai/news/terminal-bench-4-0",
      "https://github.com/harbor-framework/terminal-bench/releases/tag/v4.0.0"
    ]
  },
  "terminal-bench-science": {
    "paragraphs": [
      {
        "en": "Terminal-Bench-Science evaluates the execution of complete scientific workflows in computational environments. Its initial release contains 70 expert-curated tasks spanning life, physical, Earth, mathematical, and engineering sciences, including genomics, imaging, climate analysis, inverse problems, and formal mathematics. The agent must translate a scientific objective into a computational procedure and produce evidence that a task-specific verifier can assess. Domain experts estimated a median of approximately twelve hours for manual completion, while agent runs receive an eight-hour budget.",
        "zh": "Terminal-Bench-Science 在计算环境中评估完整科研流程的执行能力。首个版本包含 70 项专家策划任务，覆盖生命、物理、地球、数学和工程科学，涉及基因组学、成像、气候分析、逆问题及形式数学。智能体需要将科学目标转化为计算程序，并产出可由任务专属验证器核验的证据。领域专家估计人工完成一项任务的中位时间约为十二小时，智能体则获得八小时运行预算。"
      },
      {
        "en": "Scientific validity and computational correctness are interdependent in this setting. A pipeline can execute successfully while relying on an inappropriate model, inconsistent units, or an unjustified approximation; an otherwise defensible analysis can fail if its required artifacts are absent. The benchmark therefore tests method selection, implementation, and verification together. A successful run demonstrates completion of the specified scientific workflow under the supplied conditions. It does not establish the novelty of the result or replace scientific peer review, and its specialist task distribution should remain distinct from general Terminal-Bench results.",
        "zh": "在这一场景中，科学有效性与计算正确性相互依赖。流程可能顺利执行，却采用了不适当的模型、不一致的单位或缺乏依据的近似；分析本身即使合理，也可能因缺少要求的成果文件而失败。该基准因此同时考察方法选择、实现和验证。成功运行说明智能体在给定条件下完成了指定科研流程，并不意味着结果具有创新性，也不能替代科学同行评审。其专业任务分布应与通用 Terminal-Bench 成绩分别解读。"
      }
    ],
    "sourceUrls": [
      "https://terminal-bench-science.ai/",
      "https://github.com/harbor-framework/terminal-bench-science/releases/tag/v0.1.0"
    ]
  },
  "scicode": {
    "paragraphs": [
      {
        "en": "SciCode evaluates the translation of scientific specifications into numerically correct Python programs. It comprises 80 main problems and 338 subproblems across 16 scientific subfields; the test split contains 65 main problems and 288 subproblems. A main problem typically depends on a sequence of intermediate implementations, with a median of three stages and a maximum of fifteen. This structure makes scientific understanding operationally consequential: an incorrect convention, boundary condition, or numerical approximation can propagate through an otherwise syntactically valid solution.",
        "zh": "SciCode 评估模型将科学问题规范转化为数值正确的 Python 程序的能力。它包含 16 个科学子领域的 80 道主问题与 338 道子问题，其中测试集有 65 道主问题和 288 道子问题。主问题通常依赖一系列中间实现，中位为三步，最多十五步。这种结构使科学理解直接影响程序结果：约定、边界条件或数值近似中的错误，可能贯穿一个语法完全正确的解答。"
      },
      {
        "en": "The distinction between subproblem accuracy and complete-problem success is essential. Strong local performance can coexist with a low rate of complete solutions when successive stages depend on one another. Results also depend on whether scientist-authored background material is supplied and on the execution conditions used for grading. Artificial Analysis's grader revision v1.0.1 extends script execution to 300 seconds and isolates execution, changing the treatment of slow but correct programs. No representative human completion time is established in the release; dependency depth, execution budget, and background availability provide more specific context for interpreting difficulty.",
        "zh": "子问题准确率与主问题完整通过率之间的区别尤为重要。连续阶段彼此依赖时，较强的局部表现仍可能对应较低的完整求解率。成绩还取决于是否提供科学家编写的背景材料，以及评分所用的执行条件。Artificial Analysis 的 v1.0.1 评分器将脚本时限延长至 300 秒并隔离执行，从而改变了对运行较慢但结果正确的程序的处理方式。发布材料没有确立代表性的人工完成时间；依赖深度、执行预算和背景材料的可用性，更有助于解释任务难度。"
      }
    ],
    "sourceUrls": [
      "https://artificialanalysis.ai/methodology/intelligence-benchmarking",
      "https://arxiv.org/abs/2407.13168",
      "https://github.com/scicode-bench/SciCode"
    ],
    "verifiedAt": "2026-09-13"
  },
  "aa-lcr": {
    "paragraphs": [
      {
        "en": "AA-LCR measures reasoning over a supplied collection of long documents. Its 100 human-authored questions average approximately 100,000 tokens of context and draw on corporate, government, academic, legal, and other documentary sources. The central task is to identify relevant evidence and reconcile information distributed across passages. Accurate retrieval is necessary but insufficient: the model must preserve reporting periods, units, exceptions, and document versions while deriving an answer that the complete evidence supports.",
        "zh": "AA-LCR 衡量模型围绕给定长文档集合进行推理的能力。100 道人工编写的问题平均包含约 10 万 token 上下文，资料来自企业、政府、学术、法律等文档。任务核心是识别相关证据，并综合分散于不同段落的信息。准确检索只是必要条件；模型还必须保留报告期、单位、例外条款和文档版本等限定，推导出得到完整证据支持的答案。"
      },
      {
        "en": "This design distinguishes access to a large context window from effective use of its contents. Selecting a passage from the wrong reporting period, overlooking a second necessary source, or losing a qualification during synthesis can invalidate an otherwise plausible answer. Version 1.1 corrects sixteen answer keys and clarifies grading instructions, so its scores are not directly comparable with v1.0. The reviewed sources provide no standard human time per question. Interpretation should instead account for the exact evaluation version, context preparation, truncation policy, and output budget; the benchmark does not directly measure open-web research.",
        "zh": "这一设计区分了拥有较大上下文窗口与有效利用其中内容的能力。选错报告期、遗漏另一处必要证据，或在综合时丢失限定条件，都可能使看似合理的答案失效。1.1 版修正十六个参考答案并明确评分指令，其成绩不能与 v1.0 直接比较。已核验来源未提供统一的单题人工耗时。解读结果时，应关注评测版本、上下文准备、截断策略和输出预算；该基准并不直接衡量开放网页研究能力。"
      }
    ],
    "sourceUrls": [
      "https://artificialanalysis.ai/articles/announcing-aa-lcr",
      "https://huggingface.co/datasets/ArtificialAnalysis/AA-LCR",
      "https://artificialanalysis.ai/methodology/intelligence-benchmarking"
    ],
    "verifiedAt": "2026-09-13"
  },
  "aa-omniscience": {
    "paragraphs": [
      {
        "en": "AA-Omniscience evaluates factual knowledge together with the ability to abstain when an answer is not reliably known. Its 6,000 short-answer questions cover 42 topics across six broad domains, without external tools or a supplied reference corpus. The public release contains a representative ten-percent subset. The distinction between knowledge and answer selection is central: a model may possess substantial factual knowledge yet perform poorly if it answers uncertain questions with plausible but unsupported completions.",
        "zh": "AA-Omniscience 将事实知识与不确定时选择弃答的能力一并评估。其 6,000 道简答题覆盖六大领域、42 个主题，作答时不提供外部工具或参考语料；公开版本包含具有代表性的 10% 子集。知识储备与是否作答之间的区别是这一设计的核心：模型即使掌握大量事实，也可能因对不确定问题给出看似合理却缺乏依据的补全而表现不佳。"
      },
      {
        "en": "The standalone Omniscience Index penalizes incorrect answers and can take negative values. Artificial Analysis Intelligence Index v4.3 instead assigns separate contributions to accuracy and non-hallucination, weighted at 10% and 5% respectively. These measures should not be conflated: correctness, coverage, and abstention describe related but distinct behavior. No meaningful human-time baseline is supplied for these short, tool-free items. Topic-level conclusions also require care, since the small public subset offers less statistical support than the full distribution. The most informative interpretation concerns the reliability of the model's decision to answer, not fluency or expressed confidence.",
        "zh": "独立的 Omniscience Index 会惩罚错误答案，因此可能出现负分；Artificial Analysis Intelligence Index v4.3 则将准确率与非幻觉率分别纳入计算，权重为 10% 和 5%。这些指标不应混同：正确性、覆盖范围与弃答行为相互关联，却描述不同的能力。对于这类无工具短问题，发布方没有提供有意义的人工耗时基线。公开子集的统计支持也弱于完整分布，不宜据此作细致的主题级结论。更有价值的解释在于模型决定作答时是否可靠，而非表达是否流畅或自信。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2511.13029",
      "https://huggingface.co/datasets/ArtificialAnalysis/AA-Omniscience-Public",
      "https://artificialanalysis.ai/methodology/intelligence-benchmarking"
    ]
  },
  "hle": {
    "paragraphs": [
      {
        "en": "Humanity's Last Exam evaluates breadth and precision at the frontier of specialist academic knowledge. The released set contains approximately 2,500 questions across more than 100 subjects, including multiple-choice, short-answer, and multimodal items. Specialists contributed questions that were subsequently filtered against strong models. The resulting distribution deliberately concentrates on material that existing systems found difficult, making it a demanding test of domain knowledge and multi-step inference rather than a representative sample of routine academic work.",
        "zh": "Humanity's Last Exam 在专业学术知识前沿考察模型的知识广度与作答精确性。公开集合约有 2,500 道题，覆盖 100 多个学科，包括选择题、简答题和多模态题。问题由专业人士贡献，再依据强模型的表现筛选。因此，最终分布刻意集中于已有系统难以解决的内容，是对领域知识与多步推断的高难度检验，而非日常学术工作的代表性抽样。"
      },
      {
        "en": "The original evaluation reported low accuracy alongside substantial overconfidence, illustrating the importance of distinguishing a well-formed answer from a warranted one. Errors may arise from insufficient specialist knowledge, a missed qualification, or a mistaken inference concealed by fluent explanation. There is no single human-time baseline, and the benchmark does not assess the execution of a research project. Comparisons must identify the dataset revision, modality, tool policy, and grading procedure. In particular, Artificial Analysis's text-only evaluation is a subset of the broader benchmark and should not be treated as interchangeable with full multimodal results.",
        "zh": "初始评测同时观察到较低准确率与明显的过度自信，说明形式完整的答案与有充分依据的答案必须区分。错误可能来自专业知识不足、遗漏限定条件，或被流畅解释掩盖的推断失误。该基准没有统一的人工耗时基线，也不评估完整科研项目的执行能力。比较结果时，必须注明数据修订版、模态、工具规则与评分程序。尤其是 Artificial Analysis 的纯文本评测仅覆盖整体基准的一个子集，不能与完整多模态成绩互换。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2501.14249",
      "https://github.com/centerforaisafety/hle"
    ]
  },
  "gpqa-diamond": {
    "paragraphs": [
      {
        "en": "GPQA Diamond is a 198-question subset of GPQA, selected from its 448-question main set of graduate-level biology, chemistry, and physics problems. Domain experts authored and validated the multiple-choice items, with non-expert testing used to assess their resistance to superficial search. The design emphasizes specialist reasoning: credible distractors require the respondent to distinguish closely related explanations, apply the appropriate scientific assumptions, and perform calculations without losing units or signs.",
        "zh": "GPQA Diamond 是 GPQA 的 198 题子集，选自包含 448 道研究生级生物、化学和物理问题的主集合。选择题由领域专家编写和验证，并通过非专家测试评估其对浅层搜索的抵抗力。其设计重点是专业推理：可信的干扰项要求作答者区分相近解释、采用恰当的科学假设，并在计算中正确处理单位与符号。"
      },
      {
        "en": "The reported human comparison is informative about expertise rather than speed alone. Skilled non-experts with unrestricted internet access spent approximately 37 minutes per question and achieved about 22% on Diamond, compared with roughly 81% for experts. Familiarity with terminology therefore does not substitute for the reasoning needed to resolve competing options. With only 198 items and three scientific domains, small score differences and broad claims require caution. The benchmark measures constrained scientific question answering; it does not directly evaluate experimental design, scientific programming, or the conduct of research.",
        "zh": "已报告的人工对照主要反映专业知识的作用，而不只是速度差异。可自由使用互联网的高技能非专家平均每题约花 37 分钟，在 Diamond 上取得约 22% 的成绩，专家则约为 81%。因此，熟悉术语并不能替代辨析备选答案所需的推理。由于集合仅有 198 道题且覆盖三门科学，小幅分差与广泛能力结论都需谨慎处理。它衡量的是受限形式下的科学问答，不直接评估实验设计、科学编程或科研实施能力。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2311.12022",
      "https://github.com/idavidrein/gpqa"
    ]
  },
  "critpt": {
    "paragraphs": [
      {
        "en": "CritPt evaluates scientific problem solving through 70 previously unpublished, research-level physics challenges. More than fifty physicists contributed to their construction and review. Each challenge includes two to four checkpoint questions, allowing intermediate understanding to be assessed while complete solutions remain controlled. The tasks require selecting an appropriate physical model and carrying its implications through analytical or numerical work. Errors in the initial approximation, geometry, or physical regime can invalidate an otherwise sophisticated derivation.",
        "zh": "CritPt 通过 70 道此前未公开的研究级物理挑战题评估科学问题求解能力，五十多位物理学家参与了题目的构建与审核。每项挑战包含两到四个检查点问题，使中间理解过程能够得到评估，同时保持完整解答受控。任务要求选择恰当的物理模型，并通过解析或数值工作推导其结果。初始近似、几何设定或物理适用区间中的错误，可能使形式复杂的推导整体失效。"
      },
      {
        "en": "Checkpoint and final-answer performance offer complementary evidence. Intermediate success can reveal a valid physical insight without establishing that the complete problem has been solved, while a final expression should remain consistent with those intermediate constraints. The publication provides no canonical human completion time and evaluates multiple independent runs. Early gains from code or web access were limited, suggesting that additional tools did not by themselves resolve the underlying conceptual difficulties. Results should identify the tool policy and grading configuration; tool-free reasoning and tool-assisted problem solving are distinct experimental conditions.",
        "zh": "检查点与最终答案表现提供互补证据。中间步骤成功能够反映有效的物理理解，却不足以证明完整问题已经解决；最终表达式也应与这些中间约束保持一致。论文没有给出统一的人工完成时间，并采用多次独立运行进行评测。早期系统从代码或网页工具中获得的提升有限，说明增加工具本身并未解决核心概念困难。报告成绩时应注明工具规则和评分配置，无工具推理与工具辅助求解属于不同的实验条件。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2509.26574",
      "https://github.com/CritPt-Benchmark/CritPt"
    ]
  },
  "automationbench": {
    "paragraphs": [
      {
        "en": "AutomationBench evaluates the reliable execution of business processes across simulated application APIs. The public distribution contains 600 scored workflows, divided equally among sales, marketing, operations, support, finance, and human resources. Agents must discover relevant endpoints, identify the correct records, and coordinate changes across systems while respecting explicit constraints. Deterministic evaluation of the resulting application state makes incomplete updates, incorrect recipients, and prohibited side effects material failures, even when the agent's description of its actions is convincing.",
        "zh": "AutomationBench 评估智能体通过模拟应用 API 可靠执行业务流程的能力。公开分布包含 600 项计分工作流，平均分布于销售、营销、运营、支持、财务和人力资源六个领域。智能体必须发现相关接口、识别正确记录，并在遵守明确约束的前提下协调跨系统变更。评分器确定性地核验最终应用状态，因此更新不完整、接收对象错误或产生被禁止的副作用，都会构成实质失败，无论智能体对执行过程的描述多么可信。"
      },
      {
        "en": "The public task-completion protocol and the AutomationBench-AA variant measure different outcomes. AA evaluates 657 held-out tasks from v1.0.6, awarding objective-level partial credit while assigning zero to any task with a guardrail violation; its separate Tasks Completed metric requires complete success. Partial progress cannot therefore be interpreted as an equivalent rate of fully automated workflows. The original study reports approximately 13–22 reasoning steps and 30–44 tool calls per task, rather than a standard human-time baseline. Comparisons should specify the task split, scoring rule, tool interface, and execution budget.",
        "zh": "公开基准的完整任务通过协议与 AutomationBench-AA 变体衡量不同的结果。AA 使用 v1.0.6 的 657 项留出任务，按完成的目标给予部分得分，但任何约束违规都会使该任务得零分；单独报告的 Tasks Completed 指标则要求完整成功。因此，局部进度得分不能被解释为等量的流程完全自动化比例。原始研究报告每项任务约需 13–22 个推理步骤和 30–44 次工具调用，没有确立统一的人工耗时基线。比较时应明确任务划分、评分规则、工具接口及执行预算。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2604.18934",
      "https://github.com/zapier/AutomationBench",
      "https://artificialanalysis.ai/articles/artificial-analysis-intelligence-index-v4-3"
    ],
    "verifiedAt": "2026-09-13"
  },
  "toolathlon": {
    "paragraphs": [
      {
        "en": "Toolathlon examines the composition of tools into complete workflows across application boundaries. Its 108 tasks span 32 applications and more than 600 tools, requiring agents to select a small relevant sequence from a broad action space. Correct execution depends on preserving the meaning of identifiers, dates, files, and constraints as information moves between services. The benchmark thus evaluates tool discovery and state coordination together, extending beyond the correctness of an isolated API invocation.",
        "zh": "Toolathlon 考察智能体将工具组合为跨应用完整工作流的能力。108 项任务覆盖 32 个应用和 600 多个工具，要求智能体从广泛的行动空间中选择相关的操作序列。正确执行依赖于信息跨服务传递时，标识符、日期、文件及约束含义的准确保留。因此，该基准同时评估工具发现与状态协调，超出了单次 API 调用是否正确的范围。"
      },
      {
        "en": "A malformed tool call, an incorrectly transferred resource identifier, or loss of the original objective can compromise the entire workflow. The reported analysis associates longer trajectories with lower success, but distinguishes recoverable execution errors from more fundamental errors in tool selection. Effort is characterized through interaction depth and tool calls; no universal human completion time is established. Since live services, tool schemas, and the agent's execution framework all influence outcomes, a score describes the integrated system. Attributing differences to the underlying model requires comparable tooling and operating conditions.",
        "zh": "工具调用格式错误、资源标识符传递有误或原始目标丢失，都可能破坏整个工作流。已报告分析指出，较长轨迹与较低成功率相关，同时区分了可恢复的执行错误与更根本的工具选择错误。工作量主要以交互深度和工具调用描述，尚未确立统一的人工完成时间。由于实时服务、工具定义和智能体执行框架均会影响结果，成绩描述的是集成系统；只有在工具与运行条件可比时，才适合将差异归因于底层模型。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2510.25726",
      "https://github.com/hkust-nlp/Toolathlon"
    ]
  },
  "agents-last-exam": {
    "paragraphs": [
      {
        "en": "Agents' Last Exam evaluates professional task execution across a broad occupational distribution. More than a thousand practitioner-authored assignments cover 55 subfields within 13 industry clusters, with outputs assessed against task-specific criteria. Tasks can combine research, domain software, analysis, and multiple deliverable files. Practitioners estimate human effort from hours to weeks, positioning the benchmark around sustained professional work in which interpreting an underspecified objective is part of the task itself.",
        "zh": "Agents' Last Exam 在广泛的职业分布中评估专业任务执行能力。逾千项由从业者编写的任务涵盖 13 个行业群组、55 个子领域，产出依据任务专属标准评估。单项任务可能结合研究、专业软件操作、分析及多文件交付。从业者估计人工投入从数小时到数周不等，因此基准关注的是持续性专业工作，而理解未被完全明确的目标本身就是任务的一部分。"
      },
      {
        "en": "The study identifies errors in understanding and approach as major limitations. A technically valid artifact may still miss the professional objective, an essential criterion, or the workflow required by specialist software. Aggregate performance should therefore be read alongside occupational breakdowns and evidence of artifact verification. Runtime also depends on parallel execution, application latency, and timeouts; total evaluation duration is not a direct measure of individual task difficulty. The benchmark provides evidence about capabilities under specified working conditions, but does not independently support forecasts of occupational replacement or economy-wide productivity.",
        "zh": "研究将理解偏差与方法选择错误识别为主要限制。技术上有效的文件，仍可能偏离专业目标、遗漏关键评分标准，或未按专业软件要求的流程完成。因此，总体成绩应结合职业分项结果与成果核验证据解读。运行时间也受到并行执行、应用延迟和超时设置影响，完整评测耗时不能直接代表单项任务难度。该基准能够反映特定工作条件下的能力，却不足以独立支持职业替代或宏观生产率预测。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2606.05405",
      "https://agents-last-exam.org/contributors"
    ]
  },
  "browsecomp": {
    "paragraphs": [
      {
        "en": "BrowseComp evaluates persistent information retrieval on the open web using 1,266 human-authored questions with concise, verifiable answers. Questions are constructed around facts that are difficult to locate because the necessary clues are dispersed across sources and constrained by multiple conditions. This creates an asymmetry between discovery and verification: establishing that a candidate satisfies every condition may be straightforward once it is found, while finding that candidate requires sustained search and revision of hypotheses.",
        "zh": "BrowseComp 通过 1,266 道人工编写、答案简洁且可核验的问题，评估开放网页上的持续信息检索能力。题目围绕难以定位的事实构建，所需线索分散于不同来源，并受到多个条件约束。这形成了发现与验证之间的不对称：找到候选答案后，核实其是否满足所有条件可能较为直接，但找到候选本身需要持续搜索和修正假设。"
      },
      {
        "en": "The reported human searchers solved 29.2% of attempted questions and could abandon a search after about two hours. Model results likewise depend substantially on browsing budget and repeated attempts. Failure can arise from pursuing nearly identical queries, accepting a partial match, or expressing confidence unsupported by the collected evidence. These properties make BrowseComp useful for studying search persistence and constraint satisfaction, while limiting its applicability to broader judgments of research quality. Comparisons should state search access, compute allocation, and sampling protocol; success at finding an obscure fact does not establish the quality of a long-form analytical report.",
        "zh": "已报告的人工搜索者解决了所尝试问题的 29.2%，并可在约两小时后放弃搜索。模型成绩同样明显依赖浏览预算与重复尝试。失败可能来自反复使用近似查询、接受仅满足部分条件的答案，或表达超出已收集证据支持程度的信心。这些特征使 BrowseComp 适合研究搜索坚持性与约束满足能力，但限制了其对广义研究质量的解释范围。比较时应说明搜索权限、计算投入和采样协议；找到隐蔽事实，并不足以证明能够撰写高质量的长篇分析报告。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2504.12516",
      "https://github.com/openai/simple-evals"
    ]
  },
  "officeqa-pro": {
    "paragraphs": [
      {
        "en": "OfficeQA Pro evaluates evidence retrieval and quantitative reasoning over historical U.S. Treasury bulletins. Its 133-question hard set, accompanied by 113 easier questions, draws on approximately 89,000 pages containing more than 26 million numerical values. The corpus spans scanned and digitally produced documents with changing layouts, nested tables, footnotes, and revised statistical series. Answering correctly requires locating the relevant edition and interpreting the relationship among period, unit, table structure, and calculation.",
        "zh": "OfficeQA Pro 围绕历史美国财政部公报，评估证据检索与定量推理能力。其困难集包含 133 道题，另有 113 道较易问题，资料覆盖约 8.9 万页、逾 2,600 万个数值。语料横跨扫描件与数字文档，包含不断变化的版式、嵌套表格、脚注和修订后的统计序列。正确作答要求定位相关版本，并理解报告期、单位、表格结构与计算之间的关系。"
      },
      {
        "en": "Document representation is a substantive part of the evaluation. In the study, agents processing full PDFs averaged approximately 13–31 minutes and 57–82 tool calls per question; parsed representations reduced latency to roughly 3–5 minutes. These are configuration-specific observations, not interchangeable estimates of task difficulty. OCR errors, lost footnotes, incorrect series selection, and premature rounding can each invalidate an answer. Performance consequently reflects the combined retrieval, parsing, and reasoning pipeline. Comparisons should distinguish full-PDF from parsed-text inputs and disclose any external evidence or tools available to the agent.",
        "zh": "文档表示方式是评测的重要组成部分。研究中，处理完整 PDF 的智能体每题平均约需 13–31 分钟和 57–82 次工具调用，采用解析后的表示则将延迟降至约 3–5 分钟。这些数值反映特定配置，不能作为可互换的任务难度估计。OCR 错误、脚注丢失、统计序列选错或过早舍入，都可能使答案失效。因此，成绩体现的是检索、解析和推理流程的共同表现。比较时应区分完整 PDF 与解析文本输入，并说明智能体可用的外部证据和工具。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2603.08655",
      "https://github.com/databricks/officeqa"
    ]
  },
  "osworld": {
    "paragraphs": [
      {
        "en": "OSWorld evaluates agents that operate desktop applications through visual observation and computer interaction. Version 2 contains 108 professional workflows across seven domains and 21 subcategories, replacing the shorter task distribution of the original release. Assignments can span applications, files, messages, and changing interface states. Skilled humans require a median of approximately 1.6 hours, while reported agent trajectories exceed 250–300 steps on average. The central challenge is maintaining a coherent representation of the task as both information and interface state evolve.",
        "zh": "OSWorld 评估智能体通过视觉观察与计算机交互操作桌面应用的能力。2.0 版包含七个领域、21 个子类别中的 108 项专业工作流，替代了初版中较短的任务分布。任务可跨越应用、文件、消息以及变化中的界面状态。熟练人工完成任务的中位时间约为 1.6 小时，已报告的智能体轨迹平均超过 250–300 步。核心挑战是在信息与界面状态不断变化时，维持对任务的一致理解。"
      },
      {
        "en": "Errors accumulate when actions are based on stale visual observations, late-stage constraints are forgotten, or saved state is not verified. Appropriate requests for clarification may also be necessary when the workflow depends on information from the user. A score therefore reflects visual grounding, planning, interaction policy, and environment reliability together. Application versions and the available computer-use interface are material experimental conditions. Results from the earlier, shorter distribution do not establish competence on v2 workflows, and an action limit should not be confused with a measure of elapsed human work.",
        "zh": "依据过时视觉信息采取操作、遗忘后期约束或未核验保存状态，都可能导致错误累积。当流程依赖用户补充信息时，适时澄清也可能成为完成任务的必要条件。因此，成绩共同反映视觉定位、规划、交互策略与环境可靠性。应用版本和可用的计算机操作接口属于重要实验条件。早期较短任务上的成绩不能证明具备完成 v2 工作流的能力，行动步数限制也不应与人工实际工时混为一谈。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2606.29537",
      "https://github.com/xlang-ai/OSWorld-V2"
    ]
  },
  "apex-agents": {
    "paragraphs": [
      {
        "en": "APEX-Agents evaluates entry-level professional work in investment banking, management consulting, and corporate law. The open release contains 480 tasks designed around realistic files, applications, and deliverables, with reference artifacts and grading rubrics. Task completion requires both substantive analysis and adherence to professional conventions, including document structure, citation, formatting, and consistency across files. The benchmark thereby places software operation within the context of a professional objective rather than evaluating individual office-application functions in isolation.",
        "zh": "APEX-Agents 评估投资银行、管理咨询与公司法律领域的初级专业工作能力。公开版本包含 480 项任务，围绕真实风格的文件、应用和交付成果设计，并配有参考成果及评分细则。完成任务既需要实质分析，也需要遵循文档结构、引用、排版和跨文件一致性等专业规范。因此，该基准将软件操作置于专业目标的语境中，而非孤立考察办公应用的单项功能。"
      },
      {
        "en": "A plausible analysis can fail when it is not reflected accurately in the final deliverables or violates a decisive rubric requirement. The initial study reported that even the strongest evaluated agent completed only about a quarter of tasks, indicating substantial difficulty under that configuration. No universal human task duration is published. Runtime and success should be interpreted with the application stack, retry budget, and verification procedure in view. Profession-specific results are especially informative: a single aggregate can conceal material differences among financial analysis, consulting work, and legal reasoning.",
        "zh": "分析即使看似合理，若未准确体现在最终成果中，或违反关键评分要求，仍可能失败。初始研究中，表现最强的被测智能体也仅完成约四分之一任务，说明该配置下的挑战仍然显著。发布方没有提供统一的人工任务耗时。解释运行效率与成功率时，应考虑应用环境、重试预算和验证程序。职业分项结果尤其重要，因为单一总体分数可能掩盖金融分析、咨询工作和法律推理之间的实质差异。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2601.14242",
      "https://github.com/Mercor-Intelligence/apex-evals"
    ]
  },
  "arc-agi-3": {
    "paragraphs": [
      {
        "en": "ARC-AGI-3 studies adaptation through unfamiliar, turn-based visual environments. Agents must explore an environment, infer its mechanics and objective, and apply what they learn to subsequent levels. The abstract setting reduces reliance on factual knowledge and familiar software conventions. Its difficulty comes from the relationship between exploration and execution: observations must support an evolving model of the environment, and that model must guide actions efficiently enough to complete the task within the available budget.",
        "zh": "ARC-AGI-3 通过陌生的回合制视觉环境研究适应能力。智能体必须探索环境、推断运行机制与目标，并将所得理解应用于后续关卡。抽象场景降低了对事实知识和熟悉软件操作惯例的依赖。难点在于探索与执行之间的关系：观察需要支持逐步完善的环境模型，而该模型又必须指导足够高效的行动，使任务能够在可用预算内完成。"
      },
      {
        "en": "The evaluation uses human-relative action efficiency rather than wall-clock speed. The published protocol compares agent trajectories with a human reference and limits each level to five times the human median action count. Premature assumptions about the goal, repeated rediscovery of previously observed rules, and failure to generalize across levels all reduce performance. Completion alone does not reproduce the official score, which also accounts for action cost and later-level performance. The benchmark is consequently evidence about interactive learning and adaptation under a particular protocol, rather than a direct measure of general visual recognition or acquired knowledge.",
        "zh": "评测采用相对于人类的行动效率，而非实际运行速度。已发布协议将智能体轨迹与人工参照比较，并将每关行动数限制为人工中位数的五倍。过早假定目标、反复重新发现已观察到的规则，以及无法跨关卡概括机制，都会降低表现。仅统计完成数量不能复现官方分数，因为评分还考虑行动成本和后期关卡表现。因此，该基准提供的是特定协议下交互学习与适应能力的证据，而非对通用视觉识别或已有知识的直接测量。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2603.24621",
      "https://arcprize.org/arc-agi/3"
    ]
  },
  "cursorbench": {
    "paragraphs": [
      {
        "en": "CursorBench evaluates coding agents on engineering requests drawn from Cursor's internal development work. The private task distribution is refreshed periodically and includes ambiguous specifications, multi-file changes, large repositories, production logs, and extended experiments. Reference changes originate in work that engineers actually committed. The benchmark's relevance derives from this proximity to development practice: the agent must infer intent from repository context and produce an appropriately scoped implementation when several solutions may be defensible.",
        "zh": "CursorBench 使用 Cursor 内部研发工作中的工程需求评估编程智能体。私有任务分布定期更新，包含模糊规范、多文件修改、大型代码库、生产日志及持续时间较长的实验，参考变更来源于工程师实际提交的工作。该基准的现实相关性来自其与开发实践的紧密联系：当多个方案都可能合理时，智能体必须结合代码库语境理解意图，并生成范围适当的实现。"
      },
      {
        "en": "Functional acceptance and developer usefulness are related but incomplete substitutes for one another. A patch can satisfy a grader while imposing excessive scope, unnecessary latency, or additional review work. The publisher therefore considers completion-token use and latency alongside task quality, without defining a universal human-time baseline. Because both tasks and evaluation conditions change, scores should be compared within the same CursorBench version and harness. The private distribution reduces exposure to public reference solutions but limits independent reproduction; its strongest interpretation concerns performance within the represented engineering setting.",
        "zh": "功能验收与对开发者的实际价值相互关联，却不能完全替代。补丁可能通过评分器，同时带来过大的修改范围、不必要的延迟或额外审阅负担。因此，发布方在任务质量之外，也关注生成 token 用量和延迟，但没有定义统一的人工耗时基线。由于任务与评测条件均会变化，成绩应在相同 CursorBench 版本和框架下比较。私有分布降低了公开参考解暴露的影响，却限制了独立复现；其最可靠的解释范围，是所代表工程场景中的表现。"
      }
    ],
    "sourceUrls": [
      "https://cursor.com/cursorbench",
      "https://cursor.com/blog/cursorbench"
    ]
  },
  "deepsearchqa": {
    "paragraphs": [
      {
        "en": "DeepSearchQA evaluates the completeness of evidence-based answers assembled through open-web research. Its 900 expert-curated prompts span 17 fields and often require a sequence of searches in which one finding determines the next selection criterion. Questions are anchored in time and may require an entire set of entities rather than a single fact. The agent must therefore resolve duplicates, apply all inclusion conditions, and distinguish a substantially correct list from an exhaustive and uncontaminated one.",
        "zh": "DeepSearchQA 评估通过开放网页研究形成的答案是否完整且有证据依据。900 道专家策划问题覆盖 17 个领域，常要求连续搜索，前一步发现决定下一步筛选条件。题目设置时间范围，也可能要求完整实体集合而非单个事实。因此，智能体必须消除重复、应用全部纳入条件，并区分大体正确的列表与完整且不含误收项的答案。"
      },
      {
        "en": "This makes precision and recall jointly important. Missing less visible members reduces completeness, while adding related but ineligible entities creates false positives. F1 should be considered alongside the strict fully-correct rate, since partial set overlap can conceal operationally important omissions. The publication establishes no representative human time per task and reports substantial effects from additional inference-time sampling. Comparisons should disclose search access, sampling and aggregation methods, and compute budget. Time anchors improve interpretability, but changes to the live web remain a source of variation across evaluations.",
        "zh": "这一设计使精确率与召回率同样重要。遗漏不易检索的成员会损害完整性，加入相关但不符合条件的实体则会产生误报。F1 应与严格的完全正确率结合考察，因为答案集合的部分重合可能掩盖实际使用中重要的遗漏。论文没有确立代表性的单题人工耗时，并报告了增加推理阶段采样的显著影响。比较时应披露搜索权限、采样与汇总方法及计算预算。时间限定有助于解释结果，但实时网页变化仍会造成跨次评测差异。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2601.20975",
      "https://huggingface.co/datasets/google/deepsearchqa"
    ]
  },
  "mcp-atlas": {
    "paragraphs": [
      {
        "en": "MCP Atlas evaluates the ability to translate an ordinary request into a coordinated sequence of tool operations. Its 1,000 expert-authored tasks span five domains, 36 MCP servers, and 220 tools; 98.6% require more than one server. Each task exposes between six and 37 tools, while a successful solution typically uses two to eight. Since prompts generally do not identify the required tools, agents must infer which capabilities are relevant, interpret their schemas, and preserve the meaning of evidence as it moves across services.",
        "zh": "MCP Atlas 评估将日常请求转化为协调一致的工具操作序列的能力。其 1,000 项专家编写任务覆盖五个领域、36 个 MCP 服务器及 220 个工具，其中 98.6% 需要使用多个服务器。每项任务提供 6–37 个工具，成功方案通常使用其中 2–8 个。由于提示通常不指明所需工具，智能体必须推断相关能力、理解接口定义，并在信息跨服务传递时准确保留证据含义。"
      },
      {
        "en": "The evaluation follows the chain from tool selection to evidence synthesis, assessing the support for individual claims in the final response. A plausible answer may therefore remain deficient because a required source was never consulted, a tool call was malformed, or the retrieved evidence does not justify the conclusion. The publication characterizes effort through interaction depth rather than a standardized human completion time. Results describe an integrated model-and-tool system: meaningful comparisons require consistent server versions, schemas, and execution conditions, as well as attention to the distinction between retrieving information and using it correctly.",
        "zh": "评测覆盖从工具选择到证据综合的完整链条，核验最终回答中各项论断是否获得支持。因此，看似合理的答案仍可能因未查阅必要来源、调用格式错误，或检索证据不足以支持结论而失分。研究以交互深度描述工作量，没有建立标准化的人工完成时间。结果反映的是模型与工具组成的集成系统；有效比较需要一致的服务器版本、接口定义和执行条件，并区分检索到信息与正确运用信息这两种能力。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2602.00933",
      "https://github.com/scaleapi/mcp-atlas"
    ]
  },
  "deepswe": {
    "paragraphs": [
      {
        "en": "DeepSWE evaluates software engineering through newly commissioned development tasks, rather than reconstructing historical pull requests. Version 1.1 contains 113 tasks across 91 repositories, pairing concise requests with isolated verifiers. This design asks whether an agent can infer the intended change from repository context, integrate it with existing abstractions, and preserve surrounding behavior. Original task construction also reduces dependence on solutions that may already appear in public development histories.",
        "zh": "DeepSWE 通过新委托编写的开发任务评估软件工程能力，而非重建历史拉取请求。1.1 版包含来自 91 个代码库的 113 项任务，以简洁需求配合隔离运行的验证器。该设计考察智能体能否结合代码库语境理解预期变更、将实现融入现有抽象，并保留周边行为。原创任务也降低了评测对公开开发历史中既有解答的依赖。"
      },
      {
        "en": "The reported evaluations allow two and a half hours per run, yet relatively few attempts exhaust that allowance. The principal limitation is consequently not reducible to elapsed time: local fixes can overlook integration requirements, and narrow interpretations can leave important behavior unimplemented or untested. A score should be associated with the exact task release, verifier isolation, execution framework, and resource budget. The benchmark offers evidence about substantive implementation under these conditions; resistance to public-solution exposure does not by itself establish that its task distribution represents routine issue resolution.",
        "zh": "已报告评测为每次运行提供两个半小时，但耗尽时限的尝试相对较少。因此，主要限制不能简单归结为时间不足：局部修复可能忽视集成要求，狭窄的需求理解也可能导致重要行为未被实现或测试。成绩应注明确切任务版本、验证器隔离方式、执行框架及资源预算。该基准提供了这些条件下实质性实现能力的证据；对公开解答暴露的抵抗力，本身并不意味着任务分布能够代表日常问题修复。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2607.07946",
      "https://github.com/datacurve-ai/deep-swe"
    ]
  },
  "nl2repo-bench": {
    "paragraphs": [
      {
        "en": "NL2Repo-Bench examines whether an agent can construct a complete Python repository from a natural-language specification without starter code. Its 104 tasks cover nine library categories, with specifications averaging approximately 18,800 tokens. Tasks are classified by the size of the original implementation into 26 easy, 46 medium, and 32 hard cases. The challenge lies in maintaining consistency across architecture, public interfaces, dependencies, packaging, and behavior when no existing codebase supplies those decisions.",
        "zh": "NL2Repo-Bench 考察智能体能否在没有初始代码的条件下，依据自然语言规范构建完整 Python 代码库。104 项任务覆盖九类库，规范平均约 18,800 token；按照原始实现规模，分为 26 项简单、46 项中等和 32 项困难任务。难点在于，当既有代码库无法提供设计参照时，如何在架构、公共接口、依赖、打包及行为之间保持一致。"
      },
      {
        "en": "In the initial study, the strongest system fully passed five repositories in a single run. Common failures included incompatible imports or signatures, incomplete repository structure, premature termination, and prolonged navigation without implementation. The study imposed effectively no fixed interaction-round limit, with average tool use ranging from 30 to 126 calls across systems; it did not establish a human-time baseline. Average test pass rate measures partial implementation, whereas repository-level pass@1 requires complete success. Both are informative, but they answer different questions, and the agent's stopping policy materially affects their interpretation.",
        "zh": "初始研究中，最强系统在单次运行中完整通过了五个代码库。常见失败包括导入或函数签名不兼容、目录结构不完整、过早结束，以及长时间浏览却未推进实现。研究实际上未设置固定交互轮次上限，各系统平均工具调用量为 30–126 次，也未建立人工耗时基线。平均测试通过率衡量局部实现进度，代码库级 pass@1 则要求完整成功。两者均有价值，但回答不同问题，智能体的停止策略也会实质影响结果解释。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2512.12730",
      "https://github.com/multimodal-art-projection/NL2RepoBench"
    ]
  },
  "frontierswe": {
    "paragraphs": [
      {
        "en": "FrontierSWE investigates engineering and research tasks whose scope extends beyond a conventional code patch. Version 2 contains 34 tasks: 13 concepts retained from the first release and 21 additions, with four earlier tasks retired. The distribution includes implementation, performance optimization, scientific computation, visual systems, and AI research. Task-specific objectives admit partial credit for properties such as fidelity, robustness, or scientific validity, allowing evaluation to distinguish a preliminary prototype from a substantially developed solution.",
        "zh": "FrontierSWE 研究范围超出常规代码补丁的工程与科研任务。第二版包含 34 项任务，其中 13 项概念沿用首版、21 项为新增，另有四项旧任务退役。任务分布涵盖实现、性能优化、科学计算、视觉系统及 AI 研究。各任务依据保真度、稳健性或科学有效性等专属目标给予部分得分，使评测能够区分初步原型与经过充分开发的方案。"
      },
      {
        "en": "Runs can last twenty hours, and the Proximus harness explicitly informs agents of the available budget and encourages continued work. This makes sustained iteration a central object of study: an agent must recognize weaknesses, design useful experiments, and allocate time beyond obtaining its first plausible result. Premature submission and optimization of an imperfect proxy can both limit performance. Because tasks and scoring functions are heterogeneous, aggregate results should be accompanied by task-level outcomes and the exact release. The score is not directly comparable to the resolved rate of a short, binary-graded patch benchmark.",
        "zh": "单次运行可持续二十小时，Proximus 框架会明确告知智能体可用预算并鼓励继续工作。因此，持续迭代成为核心研究对象：智能体需要识别不足、设计有效实验，并在得到第一个看似可行的结果后继续合理分配时间。过早提交和优化不充分的代理指标都可能限制表现。由于任务与评分函数具有异质性，总体成绩应结合任务级结果及确切版本解读，不能直接与短时、二元评分的补丁基准通过率比较。"
      }
    ],
    "sourceUrls": [
      "https://www.frontierswe.com/blog/v2",
      "https://github.com/Proximal-Labs/frontier-swe-v2"
    ]
  },
  "programbench": {
    "paragraphs": [
      {
        "en": "ProgramBench evaluates behavioral reconstruction: agents receive documentation and access to a reference executable, but not its source code, and must build a compatible implementation. Its 200 tasks range from small utilities to systems such as FFmpeg, SQLite, interpreters, and compression software. The median reference project contains approximately 8,600 lines of code, 50 files, ten dependencies, and 770 tests. This scale makes the benchmark a study of specification discovery and implementation breadth, rather than isolated algorithmic synthesis.",
        "zh": "ProgramBench 评估行为重建能力：智能体获得文档并可访问参考可执行程序，但无法查看源码，需要构建兼容实现。200 项任务从小型工具延伸到 FFmpeg、SQLite、解释器及压缩软件等系统。参考项目的中位规模约为 8,600 行代码、50 个文件、十项依赖和 770 项测试。这一规模使基准关注规范发现与实现覆盖面，而非孤立的算法生成。"
      },
      {
        "en": "None of the nine initially evaluated models fully solved a task. Reference-program queries reveal particular behaviors, yet do not supply a complete design; narrow probing and simplified implementations can leave extensive interface requirements uncovered. Runs allow six hours and 1,000 turns, but 98.1% ended through voluntary submission and only 1.9% through timeout. Full resolution and per-test progress should therefore be reported separately. Test-level results also depend on the coverage and assertion quality of the generated evaluation suite, which defines how much behavioral equivalence the measured score can establish.",
        "zh": "最初评估的九个模型均未完整解决任何任务。查询参考程序能够揭示特定行为，却不会提供完整设计；狭窄的探测范围和简化实现可能遗漏大量接口要求。运行预算为六小时、1,000 轮，但 98.1% 的尝试主动提交，仅 1.9% 因超时结束。因此，应分别报告完整解决率与逐项测试进度。测试级结果还依赖生成评测套件的覆盖面与断言质量，后者决定了分数能够证明何种程度的行为等价。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2605.03546",
      "https://github.com/facebookresearch/ProgramBench"
    ]
  },
  "posttrainbench": {
    "paragraphs": [
      {
        "en": "PostTrainBench evaluates an agent's ability to improve a language model through post-training, taking the resulting model weights as the deliverable. Its 28 configurations combine four base models with seven evaluation targets, under a budget of one H100 GPU and ten hours. The agent must select or prepare data, configure training, monitor experiments, evaluate progress, and leave a valid checkpoint. Success therefore requires experimental judgment and reliable execution across an entire training workflow.",
        "zh": "PostTrainBench 以产出的模型权重为交付物，评估智能体通过后训练改进语言模型的能力。28 种配置由四个基础模型与七个评测目标组合而成，每次提供一张 H100 GPU 和十小时预算。智能体需要选择或准备数据、配置训练、监控实验、评估进展，并留下有效检查点。因此，成功有赖于贯穿完整训练流程的实验判断与可靠执行。"
      },
      {
        "en": "The observed trajectories differ substantially: some agents stop after two or three hours, others continue improving throughout the allowance, and some plateau around five hours. Early termination, invalid weights, and violations of training constraints can negate otherwise promising experiments. Version 1.1 strengthens anti-contamination requirements, making the permitted use of evaluation information part of the protocol. Comparisons should hold the base model, target, hardware, time budget, and data policy constant. Improvement on a specified target demonstrates an effective recipe within that setting; it does not alone establish broadly transferable expertise in model development.",
        "zh": "观察到的实验轨迹差异显著：有些智能体在两三小时后停止，有些持续改进至预算结束，也有些约五小时后进入平台期。过早结束、权重无效或违反训练约束，都可能使原本有希望的实验失去意义。1.1 版强化了防污染要求，因此评测信息的允许使用范围也是协议的一部分。比较时应固定基础模型、目标、硬件、时间预算及数据政策。特定目标上的提升表明方案在该设置中有效，却不足以独立证明可广泛迁移的模型研发能力。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2603.08640",
      "https://github.com/aisa-group/PostTrainBench"
    ]
  },
  "spreadsheetbench": {
    "paragraphs": [
      {
        "en": "SpreadsheetBench v2 evaluates spreadsheet work as the modification of a structured, executable document. Its 321 workflows cover financial models and templates, formula debugging across ten error types, and chart creation. Workbooks average 11.8 sheets and approximately 594 targeted edits, with some requiring more than a thousand. An agent must understand relationships among cells and sheets, preserve the intended logic of formulas, and make changes without damaging unrelated content.",
        "zh": "SpreadsheetBench v2 将电子表格工作视为对结构化、可执行文档的修改。321 项工作流涵盖财务模型与模板、十类错误的公式调试，以及图表创建。工作簿平均包含 11.8 个工作表、约 594 处目标修改，部分任务超过一千处。智能体必须理解单元格与工作表之间的关系、保留公式的预期逻辑，并在修改过程中避免破坏无关内容。"
      },
      {
        "en": "The evaluation distinguishes computational correctness from visual presentation. Cell-based checks require the specified edits to be correct and protected regions to remain intact, while chart tasks use visual assessment. A workbook that appears convincing can still fail because of an incorrect dependency, and a numerically correct result may not satisfy the requested visualization. The publication provides no uniform human completion-time baseline; native spreadsheet tooling and graphical interaction also incur different costs. Version 2's workflow distribution should be kept distinct from the earlier forum-derived editing benchmark when interpreting scores or comparing systems.",
        "zh": "评测区分计算正确性与视觉呈现。单元格核验要求指定修改正确完成、受保护区域保持完整，图表任务则采用视觉评估。看似可信的工作簿仍可能因依赖关系错误而失败，数值正确的结果也未必满足可视化要求。研究未提供统一的人工完成时间基线，原生表格工具与图形界面操作的成本也不同。在解释分数或比较系统时，应将第二版的工作流分布与早期源自论坛的编辑任务基准明确区分。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2606.29955",
      "https://spreadsheetbench.github.io/"
    ]
  },
  "swe-bench-pro": {
    "paragraphs": [
      {
        "en": "SWE-bench Pro evaluates repository-level software maintenance using 1,865 problems drawn from 41 repositories. The tasks emphasize substantive changes that can span multiple files and require hours or days of human engineering work. Solving an issue involves reconstructing the relevant behavior, locating its causes, implementing a coherent change, and checking for regressions. The unit of evaluation is consequently a working repository modification, rather than a plausible code fragment or an explanation of the intended fix.",
        "zh": "SWE-bench Pro 使用来自 41 个代码库的 1,865 个问题评估代码库级软件维护。任务强调实质性变更，可能涉及多个文件，并需要数小时至数天的人工工程工作。解决问题需要重建相关行为、定位原因、实现一致的修改，并检查回归。因此，评测单位是能够工作的代码库变更，而非看似合理的代码片段或修复思路说明。"
      },
      {
        "en": "Failure can arise before or after the central implementation: incomplete reproduction, inappropriate tool use, build errors, and excessive irrelevant context can all prevent a valid repair. The benchmark does not impose a universal interpretation of agent runtime, so reported results should include the harness and execution budget. Passing the verifier establishes conformity with the tested requirements; it does not guarantee maintainer acceptance or comprehensive code quality. Exact dataset revisions and subsequent audits matter because changes to tasks or verification can alter what the resolved rate measures.",
        "zh": "失败既可能发生在核心实现之前，也可能发生在之后：问题复现不完整、工具使用不当、构建错误，以及过多无关上下文，都可能妨碍有效修复。该基准没有对智能体运行时间提供统一解释，因此报告结果时应注明执行框架与预算。通过验证器表明符合被测试的要求，却不保证维护者接受或全面的代码质量。确切数据版本及后续审计十分关键，因为任务或验证方式的变更会改变解决率所衡量的内容。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2509.16941",
      "https://github.com/scaleapi/SWE-bench_Pro-os"
    ]
  },
  "swe-marathon": {
    "paragraphs": [
      {
        "en": "SWE-Marathon examines the construction of substantial software systems over extended working periods. Its 20 tasks comprise eight library reconstructions, five product reconstructions, five machine-learning projects, and two algorithmic projects. Estimated human effort ranges from 40 to 400 hours, while agent allowances vary by task from two to ten hours. The central demand is to coordinate architecture, feature coverage, implementation, and verification when no single local edit can satisfy the objective.",
        "zh": "SWE-Marathon 考察在较长工作周期内构建大型软件系统的能力。20 项任务包括八项库重建、五项产品重建、五项机器学习项目及两项算法项目。估计人工投入为 40–400 小时，智能体预算则按任务设为两至十小时。核心要求是在单次局部修改无法满足目标时，协调架构、功能覆盖、实现与验证。"
      },
      {
        "en": "Longer execution creates opportunities for iteration, but also exposes weaknesses in prioritization and self-assessment. Repeated work, insufficient testing, shortcuts that exploit the evaluator, and failure to finish within the allowance can each reduce substantive progress. Partial scores may identify useful capabilities without establishing that a complete system was delivered. Because the benchmark is small and deliberately heterogeneous, task-level outcomes and resource budgets are essential complements to an aggregate result. Its human-effort estimates describe the scale of the assignments, rather than a direct conversion between agent runtime and displaced engineering labor.",
        "zh": "较长运行时间带来迭代机会，也暴露优先级安排与自我评估的不足。重复劳动、测试不充分、利用评分器漏洞的捷径，以及无法在预算内完成，都可能削弱实质进展。部分得分可以揭示有用能力，却不能证明完整系统已经交付。由于基准规模较小且刻意包含异质任务，任务级结果与资源预算是总体成绩的重要补充。人工投入估计描述任务规模，而非将智能体运行时间直接换算为被替代的工程劳动。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2606.07682",
      "https://github.com/abundant-ai/swe-marathon"
    ]
  },
  "frontiercode": {
    "paragraphs": [
      {
        "en": "FrontierCode evaluates whether coding agents can produce changes that meet a maintainer's standard for merging. Its 150 private, maintainer-authored tasks span 36 repositories; version 1.1 organizes the evaluation into Main and Extended tracks. Functional behavior is assessed together with scope, tests, safety, and consistency with repository conventions. Blocking criteria must all be satisfied before weighted quality scoring applies, making a working implementation necessary but insufficient for a strong result.",
        "zh": "FrontierCode 评估编程智能体能否产出达到维护者合并标准的变更。150 项由维护者编写的私有任务覆盖 36 个代码库，1.1 版分为 Main 与 Extended 两个评测轨道。功能行为与修改范围、测试、安全性及代码库惯例的一致性共同接受评估。只有全部阻断性条件通过后，才适用加权质量评分，因此实现能够运行是必要条件，却不足以获得高分。"
      },
      {
        "en": "The design draws attention to defects that conventional test acceptance can miss: weak tests may also pass against an unfixed baseline, an unsuitable abstraction may burden future maintenance, and an unnecessarily broad patch may exceed the request. The reported investment of more than 40 hours per task concerns authoring and calibration, not human solving time. Results should distinguish pass rate from weighted quality and disclose repetitions, token use, cost, and execution limits. Private tasks reduce public-reference exposure while restricting independent inspection, so conclusions remain bounded by the represented repositories and review criteria.",
        "zh": "该设计关注常规测试验收可能遗漏的缺陷：薄弱测试可能在未修复的基线上也通过，不合适的抽象可能增加后续维护负担，过宽的补丁则可能超出需求。每项任务超过 40 小时的投入指编写与校准时间，并非人工解题时间。结果应区分通过率与加权质量，并披露重复次数、token 用量、成本及执行限制。私有任务降低了公开参考解暴露的影响，也限制了独立检查，因此结论仍受所覆盖代码库与审阅标准的边界约束。"
      }
    ],
    "sourceUrls": [
      "https://cognition.ai/blog/frontier-code-1.1",
      "https://cognition.ai/blog/frontier-code"
    ]
  },
  "mmmu-pro": {
    "paragraphs": [
      {
        "en": "MMMU-Pro evaluates multimodal reasoning across 30 academic subjects, with an emphasis on questions whose visual information is indispensable. Its 1,730 underlying questions appear in standard and vision-only forms, producing 3,460 evaluation instances. The construction filters questions that can be answered from text alone and increases the number of answer choices from four to as many as ten. These choices reduce opportunities to succeed through linguistic priors or elimination without interpreting the image.",
        "zh": "MMMU-Pro 在 30 个学科领域评估多模态推理，重点关注视觉信息不可或缺的问题。1,730 道基础题分别以标准形式和纯视觉形式呈现，共形成 3,460 个评测实例。构建过程筛除了仅凭文本即可回答的题目，并将选项从四个增加至最多十个。这些设计降低了模型依靠语言先验或排除法、绕过图像理解而答对的机会。"
      },
      {
        "en": "The resulting score concerns the integration of visual evidence with disciplinary knowledge. Errors may reflect a failure to read the representation, connect it to the relevant concept, or sustain the reasoning that follows. The headline metric averages performance on the standard ten-option and vision-only settings, so it should not be treated as interchangeable with original MMMU accuracy. The human reference is approximated from the original benchmark rather than a comprehensive new timing study. Results are most informative when the presentation setting and subject-level variation accompany the aggregate score.",
        "zh": "由此得到的分数关注视觉证据与学科知识的整合。错误可能源于未能读懂图示、未将其联系到相关概念，或无法完成后续推理。总体指标平均标准十选项设置与纯视觉设置的表现，不能视为与原始 MMMU 正确率等价。人工参照近似沿用原始基准，而非来自新的全面计时研究。结合呈现设置和学科分项差异，总体分数才更具有解释力。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2409.02813",
      "https://github.com/MMMU-Benchmark/MMMU"
    ]
  },
  "babyvision": {
    "paragraphs": [
      {
        "en": "BabyVision isolates elementary visual reasoning that is often effortless for people yet difficult for multimodal models. Its 388 questions cover visual discrimination, tracking, spatial reasoning, and pattern recognition across 22 subtypes. A separate 20-item Mini subset supports comparisons with children aged three to twelve. By limiting dependence on specialist factual knowledge, the benchmark examines whether a system can preserve and manipulate the visual relationships required by the task.",
        "zh": "BabyVision 聚焦人类往往能够轻松完成、但多模态模型仍感困难的基础视觉推理。388 道题覆盖视觉辨别、追踪、空间推理和模式识别四大类、22 个子类型。另设 20 题 Mini 子集，用于与三至十二岁儿童比较。通过降低对专业事实知识的依赖，该基准考察系统能否准确保留并操作任务所需的视觉关系。"
      },
      {
        "en": "Characteristic errors include losing geometric information when translating an image into words, confusing intersecting paths, inventing unsupported three-dimensional structure, and matching surface appearance instead of the governing rule. These failures distinguish perceptual and relational limitations from missing knowledge. Children's Mini evaluations took place within a 45-minute class, whereas adults completed the full set; neither constitutes a general agent-runtime baseline. Comparisons should identify the subset, image presentation, and output language. A strong result supports competence on these visual operations, without establishing equivalence to the broader cognitive development of the human comparison group.",
        "zh": "典型错误包括将图像转述为语言时丢失几何信息、混淆交叉路径、臆造没有依据的三维结构，以及匹配表面相似性而非支配规则。这些失败有助于将感知与关系推理的局限同知识不足区分。儿童 Mini 评测在一节 45 分钟课程内进行，成人则完成全套题目；两者都不构成通用的智能体运行时间基线。比较时应注明子集、图像呈现方式与输出语言。高分支持模型具备这些视觉操作能力，却不能证明其与参照人群的整体认知发展相当。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2601.06521",
      "https://github.com/UniPat-AI/BabyVision"
    ]
  },
  "charxiv": {
    "paragraphs": [
      {
        "en": "CharXiv evaluates the interpretation of scientific charts taken from arXiv papers across eight subject areas. Its 2,323 charts each support four descriptive questions and one reasoning question, yielding more than 11,000 questions. Dense labels, multiple panels, and varied graphical encodings require a model to locate evidence before drawing a conclusion. The separation between description and reasoning helps distinguish failures of visual extraction from failures to combine correctly read information.",
        "zh": "CharXiv 使用来自 arXiv 论文、覆盖八个学科领域的科学图表评估理解能力。2,323 张图表各配四道描述题和一道推理题，总计超过 11,000 道。密集标签、多面板布局及多样的图形编码，要求模型先定位证据再得出结论。描述与推理的区分，有助于识别错误究竟来自视觉提取，还是来自对已正确读取信息的综合。"
      },
      {
        "en": "Reported human accuracy is approximately 92% on descriptive questions and 81% on reasoning questions, providing a performance reference rather than a completion-time estimate. Test answers are private, while a public validation set supports development. Aggregate accuracy should be considered alongside the two question types because similar totals can conceal different limitations. Successful chart interpretation requires accurate grounding in the displayed evidence, but does not by itself demonstrate expertise in the full scientific argument, experimental design, or causal claims of the source paper.",
        "zh": "已报告人工正确率约为描述题 92%、推理题 81%，提供的是表现参照，而非完成时间估计。测试答案不公开，公开验证集则支持开发。总体正确率应结合两类问题分别考察，因为相近总分可能掩盖不同局限。成功解读图表需要准确依据图中证据，却不单独证明模型理解来源论文的完整科学论证、实验设计或因果主张。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2406.18521",
      "https://github.com/princeton-nlp/CharXiv"
    ]
  },
  "chartography": {
    "paragraphs": [
      {
        "en": "Chartography tests precise reading of professional charts, where conventions, scales, and acceptable numerical ranges can determine whether an answer is useful. Its 100 tasks were independently verified three times and selected to include cases on which at least one frontier model failed. Questions may require identifying the relevant marks, interpreting axes, applying a formula, or interpolating within the displayed data. The distribution deliberately concentrates on difficult chart-reading operations rather than representative everyday chart use.",
        "zh": "Chartography 检验专业图表的精确读取，其中约定、刻度及可接受数值范围可能决定答案是否有用。100 项任务均经过三次独立核验，并筛选纳入至少一个前沿模型曾失败的案例。问题可能要求识别相关图形标记、解释坐标轴、应用公式，或在展示的数据内插值。该分布刻意集中于困难的图表读取操作，而非代表日常图表使用的平均情况。"
      },
      {
        "en": "Rounding beyond tolerance, extrapolating where interpolation is required, or overlooking a chart-specific convention can invalidate an otherwise plausible response. Scoring requires all requested parts to be correct, making the strict task success rate different from a measure of approximate visual comprehension. The headline evaluation excludes tools and establishes no standardized human or agent completion time. Tool-assisted results should be reported separately, and comparisons with other chart benchmarks should account for both the adversarial selection process and the all-parts-correct scoring rule.",
        "zh": "舍入超出容差、在应当插值时进行外推，或忽略图表特有约定，都可能使看似合理的回答失效。评分要求所有指定部分均正确，因此严格任务成功率不同于粗略视觉理解程度。主要评测不使用工具，也未建立标准化的人工或智能体完成时间。工具辅助结果应单独报告，与其他图表基准比较时则应同时考虑挑战性筛选过程和全部部分正确的评分要求。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2608.10677",
      "https://surgehq.ai/blog/chartography"
    ]
  },
  "omnidocbench": {
    "paragraphs": [
      {
        "en": "OmniDocBench evaluates document parsing as the recovery of both content and structure. Version 1.7 contains 1,651 pages spanning ten document types, five layout categories, and five language categories, with annotations for 28 block types and four span types. The tasks include reading order, mathematical expressions, and tables with merged cells. These elements make document understanding more demanding than character recognition: correctly transcribed words can still form an unusable output when their relationships are lost.",
        "zh": "OmniDocBench 将文档解析视为内容与结构的共同恢复。1.7 版包含 1,651 页，覆盖十类文档、五类布局和五类语言，标注涉及 28 种块类型及四种行内片段类型。任务包含阅读顺序、数学表达式和带合并单元格的表格。这些要素使文档理解超出字符识别：即使文字转录正确，关系丢失仍可能使输出无法使用。"
      },
      {
        "en": "Evaluation should separate content errors from structural errors and inspect performance by document and element type. The metrics do not all share the same direction: lower edit distance indicates improvement, while higher structural-quality scores may be preferable. Nor does the benchmark establish a common human-time baseline; throughput depends on the parsing architecture and processing pipeline. Because the dataset has expanded substantially from its initial 981 pages, comparisons require the same release and metric definitions. A single aggregate number otherwise risks concealing important differences in tables, formulas, or complex layouts.",
        "zh": "评估应区分内容错误与结构错误，并按文档及元素类型检查表现。各指标的优劣方向并不一致：编辑距离越低越好，而结构质量指标可能越高越好。基准也没有建立统一人工耗时参照，吞吐量取决于解析架构与处理流程。由于数据集已从最初的 981 页显著扩展，比较必须使用相同版本与指标定义，否则单一总分可能掩盖表格、公式或复杂布局上的重要差异。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2412.07626",
      "https://github.com/opendatalab/OmniDocBench"
    ]
  },
  "zerobench": {
    "paragraphs": [
      {
        "en": "ZeroBench studies difficult visual reasoning through a deliberately selected set of frontier-model failures. Version 2 contains 100 main questions and 334 supporting subquestions, using 70 natural and 30 synthetic images; seven main questions involve multiple images. Success can require carrying small visual details through extended spatial, numerical, or relational inference. The subquestions help locate intermediate weaknesses without replacing the requirement to solve the complete problem.",
        "zh": "ZeroBench 通过刻意筛选的前沿模型失败案例研究困难视觉推理。第二版包含 100 道主问题、334 道辅助子问题，使用 70 张自然图像与 30 张合成图像，其中七道主问题涉及多图。成功可能要求在较长的空间、数量或关系推理中始终保留细微视觉信息。子问题有助于定位中间环节的不足，却不替代完整解决主问题的要求。"
      },
      {
        "en": "The initial selection criterion was failure by the models considered at release, rather than a representative sample of visual questions. Subsequent answerability corrections affected 23% of the set, making version identification particularly important. Reported performance must also distinguish single-attempt accuracy, best-of-many success, and reliability across repeated samples. No standardized human-time baseline is established. The small, selected distribution is useful for diagnosing unresolved visual-reasoning problems, but does not support a direct estimate of performance across ordinary image understanding tasks.",
        "zh": "初始筛选标准是发布时所考察模型无法回答，而非对视觉问题进行代表性抽样。后续关于可解答性的修正涉及题集的 23%，因此版本标识尤为重要。报告表现还必须区分单次正确率、多次尝试择优成功率，以及重复采样的可靠性。研究未建立标准化的人工耗时基线。这一规模较小、经过筛选的分布适合诊断尚未解决的视觉推理问题，却不能直接估计日常图像理解任务中的表现。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2502.09696",
      "https://github.com/jonathan-roberts1/zerobench"
    ]
  },
  "cybergym": {
    "paragraphs": [
      {
        "en": "CyberGym evaluates vulnerability reproduction in real software using 1,507 historical memory-safety vulnerabilities from 188 C and C++ repositories associated with OSS-Fuzz. Given a vulnerability description and repository, an agent must produce an input that reaches the relevant defect, with sanitizer feedback serving as the verification mechanism. The task connects code comprehension to executable evidence: identifying a suspicious operation is insufficient unless the agent can establish the path and conditions that trigger it.",
        "zh": "CyberGym 使用与 OSS-Fuzz 相关的 188 个 C/C++ 代码库中的 1,507 个历史内存安全漏洞，评估真实软件中的漏洞复现。智能体获得漏洞描述与代码库后，需要生成能够触发相关缺陷的输入，由检测器反馈进行验证。任务将代码理解与可执行证据相连接：仅识别可疑操作还不够，必须找到能够触发它的执行路径与条件。"
      },
      {
        "en": "The initial strongest result was approximately 20%, with longer inputs and deeper execution requirements associated with lower success. Repetitive input generation, excessive context, and failure to verify a suspected trigger can impede progress. There is no universal completion-time baseline; the tool environment and execution framework are integral to the result. A verified reproduction demonstrates reachability of the target vulnerability, not necessarily exploitability or arbitrary code execution. The benchmark therefore measures a specific security capability and should not be interpreted as a general measure of model quality or system safety.",
        "zh": "最初最强结果约为 20%，较长输入和更深执行路径与较低成功率相关。重复生成输入、上下文过载，以及未核验疑似触发条件，都可能妨碍进展。基准没有统一完成时间参照，工具环境与执行框架也是结果的一部分。经验证的复现证明目标漏洞可被触达，却不必然证明其可利用性或任意代码执行能力。因此，该基准衡量特定安全能力，不宜解释为模型整体质量或系统安全性的通用指标。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2506.02548",
      "https://github.com/sunblaze-ucb/cybergym"
    ]
  },
  "exploitbench": {
    "paragraphs": [
      {
        "en": "ExploitBench evaluates exploit development against 41 known V8 JavaScript and WebAssembly vulnerabilities, with the corresponding patch available to the agent. Its deterministic, 16-level capability ladder distinguishes coverage and vulnerability triggering from stronger outcomes such as exploitation primitives, sandbox escape, program-counter control, and code execution. This graduated evaluation captures meaningful intermediate progress while preserving the distinction between causing a crash and obtaining an operational exploit.",
        "zh": "ExploitBench 针对 41 个已知 V8 JavaScript 与 WebAssembly 漏洞评估利用开发，并向智能体提供相应补丁。确定性的 16 级能力阶梯，将覆盖目标代码、触发漏洞，与利用原语、沙箱逃逸、程序计数器控制及代码执行等更强结果区分。分级评测能够记录有意义的中间进展，同时保留引发崩溃与获得可运行利用之间的差别。"
      },
      {
        "en": "Runs allow 300 turns and use repeated seeds. Some attempts fail early despite unused budget, while others encounter the more fundamental challenge of turning an engine-level primitive into a capability that survives its defenses. JIT miscompilation can also produce incorrect behavior without a crash, making the full ladder more informative than a single trigger rate. Results depend on the runner, available coaching, command-line configuration, seeds, and defenses. They should be reported as a security-capability profile under those conditions, rather than collapsed into an undifferentiated measure of model improvement.",
        "zh": "每次运行允许 300 轮，并采用重复随机种子。有些尝试在预算尚未耗尽时便早早失败，另一些则面临更根本的挑战：将引擎内部原语转化为能够突破防护的能力。JIT 误编译也可能产生错误行为而不崩溃，因此完整阶梯比单一触发率更有解释力。结果受运行器、可用指导、命令行配置、随机种子及防护措施影响，应作为这些条件下的安全能力分布报告，而非压缩为不加区分的模型进步指标。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2605.14153",
      "https://github.com/exploitbench/exploitbench"
    ]
  },
  "exploitgym": {
    "paragraphs": [
      {
        "en": "ExploitGym evaluates security agents across 898 exploitation instances: 520 userspace cases drawn from 161 repositories, 185 V8 cases, and 193 kernel cases. The environments expose different constraints, including address randomization, sandboxes, heap behavior, and race conditions. Success requires using the designated vulnerability to obtain the specified execution capability and retrieve a flag. The evaluation separately audits flags obtained through unintended flaws, since reaching an endpoint through another route does not establish mastery of the target vulnerability.",
        "zh": "ExploitGym 通过 898 个漏洞利用实例评估安全智能体，包括来自 161 个代码库的 520 个用户态案例、185 个 V8 案例及 193 个内核案例。环境包含地址随机化、沙箱、堆行为和竞争条件等不同约束。成功要求利用指定漏洞取得规定执行能力并获取标志。通过非预期缺陷得到的标志会另行审计，因为经由其他路径达到终点，不能证明掌握了目标漏洞。"
      },
      {
        "en": "The default allowance is two hours, with longer six-hour studies revealing both continued improvement and early plateaus; some systems show little further progress after roughly 30 minutes. Comparisons should distinguish target-aligned success from flag retrieval alone and separate userspace, browser, and kernel results by enabled defenses. As a dual-use capability benchmark, ExploitGym can inform both defensive evaluation and assessment of offensive potential. Its score is evidence about exploit development in specified environments, rather than a comprehensive judgment of real-world security risk or the effectiveness of deployment safeguards.",
        "zh": "默认预算为两小时，延长至六小时的研究同时观察到持续提升和早期平台期；部分系统约 30 分钟后便鲜有进一步进展。比较时应区分符合目标路径的成功与单纯获取标志，并按防护设置分别考察用户态、浏览器和内核结果。作为具有双重用途的能力基准，ExploitGym 可用于防御性评估，也可辅助判断攻击潜力。其分数反映指定环境中的利用开发能力，而非对现实安全风险或部署防护有效性的全面判断。"
      }
    ],
    "sourceUrls": [
      "https://arxiv.org/abs/2605.11086",
      "https://github.com/sunblaze-ucb/exploitgym"
    ]
  },
  "aa-briefcase": {
    "paragraphs": [
      {
        "en": "AA-Briefcase evaluates professional work from fragmented organizational context. Its 91 private tasks are organized into four scenarios representing several weeks of activity, with agents expected to assemble relevant company materials into analytical and presentational deliverables. Each task is evaluated independently: an agent does not inherit its own output from a previous assignment in the scenario. The multiweek framing therefore supplies business context, rather than measuring uninterrupted autonomous work over that duration. A separate public Lite release provides examples outside the scored distribution.",
        "zh": "AA-Briefcase 评估基于零散组织信息完成专业工作的能力。91 项私有任务分布于四个模拟数周业务活动的场景，要求智能体汇集相关公司材料，形成分析与展示成果。每项任务独立评估，智能体不会继承自己在同一场景前序任务中的产出。因此，多周设定提供的是业务语境，而非衡量持续数周不间断自主工作的能力。另有公开 Lite 版本提供计分分布之外的示例。"
      },
      {
        "en": "Evaluation combines rubric-based task correctness with pairwise judgments of analytical and presentation quality, summarized through Elo. This distinguishes satisfying explicit requirements from producing a persuasive, useful artifact, while also making the combined rating different from a task-completion percentage. Missing source material, incomplete analysis, overlooked requirements, and poor file quality can affect different parts of the assessment. No standardized human-time baseline is established, and model runtime varies. Results are best understood as comparative evidence of deliverable quality under the specified information, tooling, and judging conditions.",
        "zh": "评测结合基于评分标准的任务正确性，以及对分析与呈现质量的两两比较，并通过 Elo 汇总。这一区分同时考察是否满足明确要求，以及成果是否有说服力和实用价值，也意味着综合等级分不等于任务完成百分比。遗漏来源材料、分析不完整、忽视要求及文件质量欠佳，可能影响不同评分维度。基准未建立标准化的人工耗时参照，模型运行时间也各不相同。结果最适合被理解为：在规定的信息、工具与评审条件下，交付质量的相对证据。"
      }
    ],
    "sourceUrls": [
      "https://artificialanalysis.ai/articles/aa-briefcase",
      "https://huggingface.co/datasets/ArtificialAnalysis/AA-Briefcase-Lite"
    ],
    "verifiedAt": "2026-09-13"
  },
  "gdp-pdf": {
    "paragraphs": [
      {
        "en": "GDP.pdf evaluates source-grounded analysis of professional PDF documents across ten domains. Its 100 tasks require written answers that integrate text with information carried by tables, figures, and page layout. The challenge is to preserve the document's evidential structure: a value may depend on a column heading, a conclusion on a footnote, or a comparison on a chart's scale. Accurate extraction is therefore a prerequisite for analysis, rather than a sufficient endpoint.",
        "zh": "GDP.pdf 在十个领域评估依据专业 PDF 文档开展分析的能力。100 项任务要求生成书面回答，将文本与表格、图形及页面布局承载的信息相结合。难点在于保留文档的证据结构：数值可能依赖列标题，结论可能受脚注限定，比较可能取决于图表刻度。因此，准确提取是分析的前提，而非充分的终点。"
      },
      {
        "en": "Rubric-level mean performance records partial success, whereas the all-pass measure requires every criterion for a task to be satisfied. Losing a qualification or misreading a table relationship can consequently separate an apparently sound answer from a fully correct one. Artificial Analysis evaluates the benchmark in a single-turn setting with five repetitions; no common human completion time is established. PDF rendering, tool access, and grading conditions should remain comparable across results. Despite the similar name, GDP.pdf is a separate benchmark family from OpenAI's GDPval and should not inherit its occupational distribution or interpretation.",
        "zh": "评分标准的平均通过情况记录局部成功，全部通过指标则要求任务的每项标准均满足。因此，遗漏限定条件或误读表格关系，可能使表面合理的回答无法达到完全正确。Artificial Analysis 在单轮设置下进行五次重复评测，尚未建立统一的人工完成时间。比较结果时应保持 PDF 渲染、工具访问和评分条件可比。尽管名称相近，GDP.pdf 与 OpenAI 的 GDPval 属于不同基准家族，不应沿用后者的职业分布或解释。"
      }
    ],
    "sourceUrls": [
      "https://surgehq.ai/benchmarks/gdp-pdf",
      "https://github.com/surge-ai/gdp-pdf",
      "https://artificialanalysis.ai/methodology/intelligence-benchmarking"
    ],
    "verifiedAt": "2026-09-13"
  }
};
