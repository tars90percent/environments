import type { BenchmarkReferenceLanguage } from "./model-benchmark-data";

type LocalizedText = Record<BenchmarkReferenceLanguage, string>;

export type ModelBenchmarkExplanation = {
  orientation: LocalizedText;
  distribution: LocalizedText;
  difficulty: LocalizedText;
  time: LocalizedText;
  failureModes: Record<BenchmarkReferenceLanguage, string[]>;
  interpretation: LocalizedText;
  sourceUrls: string[];
};

export const modelBenchmarkExplanationVerifiedAt = "2026-09-03";

export const modelBenchmarkExplanations: Record<string, ModelBenchmarkExplanation> = {
  "gdpval-aa-v2": {
    orientation: {
      en: "GDPval asks an agent to produce the kind of digital work product a professional might hand to a colleague: a spreadsheet, slide deck, report, diagram, or other file—not merely an answer in chat.",
      zh: "GDPval 要求智能体产出专业人士会交给同事的数字工作成果，例如表格、演示文稿、报告或图示，而不只是聊天中的答案。",
    },
    distribution: {
      en: "The full set has 1,320 tasks across 44 occupations in nine major U.S. industry sectors; 220 gold tasks are public. A task can include many reference files and several output formats, so the mix is much closer to a work inbox than a conventional question bank.",
      zh: "完整集合有 1,320 项任务，覆盖美国九大行业的 44 个职业，其中 220 项黄金任务公开。单项任务可能带有多份参考文件并要求多种输出格式，整体更像真实工作收件箱，而非传统题库。",
    },
    difficulty: {
      en: "The hard part is turning a precise brief and messy source material into a polished, usable artifact. Subject-matter judgment, calculation, instruction following, and visual quality all matter, and the primary evaluation compares complete deliverables rather than isolated facts.",
      zh: "难点在于把精确需求和杂乱素材转化为完整、可用且专业的成果。领域判断、计算、指令遵循和视觉质量都会影响结果，核心评测比较的是完整交付物，而非零散事实。",
    },
    time: {
      en: "Experts estimated about seven hours of work per task on average, with the longest tasks reaching multiple weeks. That human-effort estimate is part of the benchmark’s meaning; agent wall-clock time depends heavily on the harness and document tools used.",
      zh: "专家估计每项任务平均约需七小时，最长任务可达数周。这个人工工时本身就是基准含义的一部分；智能体实际耗时则高度取决于所用框架和文档工具。",
    },
    failureModes: {
      en: ["Ignoring a reference file, unit, or requested output format", "Claiming a deliverable was created when the actual file is missing or unusable", "Producing correct-looking work with calculation, rendering, or formatting defects"],
      zh: ["忽略参考文件、单位或指定输出格式", "声称已完成交付，但文件缺失或不可用", "成果看似正确，却存在计算、渲染或排版缺陷"],
    },
    interpretation: {
      en: "Treat a strong score as evidence of end-to-end professional artifact production under this one-shot brief format. It does not directly measure interactive collaboration, and scores depend on the exact GDPval evaluation variant and judge setup.",
      zh: "高分说明系统能在一次性任务简报下完成端到端专业成果生产，但不直接代表其互动协作能力；解读时还应注明具体 GDPval 评测变体和评审配置。",
    },
    sourceUrls: ["https://arxiv.org/abs/2510.04374", "https://huggingface.co/datasets/openai/gdpval"],
  },
  "tau3-banking": {
    orientation: {
      en: "τ³-Banking is a customer-support simulation in which an agent must answer policy questions and safely change account state while interacting with a simulated user.",
      zh: "τ³-Banking 是银行客服模拟：智能体既要回答政策问题，也要在与模拟用户互动时安全地修改账户状态。",
    },
    distribution: {
      en: "Its 97 tasks draw on 698 policy documents (about 195,000 tokens), 21 task categories, and a large tool surface. A typical task needs evidence from many documents and roughly ten tool calls; the hardest require more than thirty.",
      zh: "97 项任务建立在 698 份政策文档（约 19.5 万 token）、21 类场景和大规模工具面之上。典型任务需综合多份文档并调用工具约十次，最复杂的超过三十次。",
    },
    difficulty: {
      en: "Policy clauses depend on one another, the correct order of operations is often implicit, and the user may confidently assert something false. The agent must search, verify prerequisites, explain constraints, and mutate the backend only when authorized.",
      zh: "政策条款相互依赖，正确操作顺序常常是隐含的，用户还可能自信地提供错误信息。智能体必须检索并核验前置条件，解释限制，并只在获得授权时修改后端状态。",
    },
    time: {
      en: "The paper reports interaction effort rather than a single human completion time. Similar-performing systems can have very different latency: one terminal-style setup used more tokens and commands and took about nine times longer than its comparison system.",
      zh: "论文主要报告交互工作量，而非统一的人工完成时间。性能相近的系统延迟也可能差异很大：一种终端式配置使用更多 token 和命令，耗时约为对照系统的九倍。",
    },
    failureModes: {
      en: ["Locking onto an early hypothesis and searching only for confirming policy", "Trusting the user’s premise instead of checking account state and eligibility", "Executing dependent actions in the wrong order or stopping before all consequences are handled"],
      zh: ["过早锁定假设，只检索支持该假设的政策", "相信用户前提，而未核验账户状态和资格", "按错误顺序执行依赖操作，或尚未处理完所有后果就停止"],
    },
    interpretation: {
      en: "Pass@1 is strict: conversational fluency is not enough if the final account state or policy outcome is wrong. Compare systems under the same simulator, knowledge corpus, tool exposure, and repeat protocol.",
      zh: "pass@1 很严格：即使对话流畅，只要最终账户状态或政策结果错误仍会失败。比较系统时应保持模拟器、知识库、工具暴露和重复协议一致。",
    },
    sourceUrls: ["https://arxiv.org/abs/2603.04370", "https://github.com/sierra-research/tau2-bench"],
  },
  "terminal-bench": {
    orientation: {
      en: "Terminal-Bench measures whether an agent can finish consequential, multi-step work inside a real terminal environment and leave behind an artifact that an executable verifier accepts.",
      zh: "Terminal-Bench 衡量智能体能否在真实终端环境中完成有实质结果的多步骤工作，并留下可通过可执行验证器的成果。",
    },
    distribution: {
      en: "The current 4.0 set contains 66 tasks carried forward from Terminal-Bench 3 across seven broad domains, including code, databases, machine learning, formal proof, CAD, media, science, and business workflows. Three tasks require a GPU.",
      zh: "当前 4.0 集合包含从 Terminal-Bench 3 保留下来的 66 项任务，覆盖代码、数据库、机器学习、形式化证明、CAD、媒体、科学和商业流程等七大领域，其中三项需要 GPU。",
    },
    difficulty: {
      en: "Prompts are often compact while the environment is not. Agents must inspect unfamiliar files, install or use specialist tooling, survive long command output, and verify a final state that may be quite different from producing plausible terminal text.",
      zh: "提示通常很短，但环境并不简单。智能体要检查陌生文件、安装或使用专业工具、处理长命令输出，并验证最终状态，而不是只生成看似合理的终端文本。",
    },
    time: {
      en: "Every 4.0 run has an eight-hour wall-clock limit. Frontier runs now rarely consume the entire window, so remaining failures are more often refusals, output/context limits, bad plans, or incorrect artifacts than the nominal timeout itself.",
      zh: "4.0 的每次运行统一限制为八小时。前沿系统如今很少耗尽全部时间，因此剩余失败通常来自拒答、输出或上下文限制、规划失误或成果错误，而非名义超时。",
    },
    failureModes: {
      en: ["Mistaking visible progress for a verifier-ready final state", "Losing context in noisy logs or abandoning a long-running workflow", "Refusing a benign task or hitting an output limit before validation"],
      zh: ["把表面进展误当成可通过验证器的最终状态", "在嘈杂日志中丢失上下文，或放弃长流程", "拒绝良性任务，或在验证前触及输出限制"],
    },
    interpretation: {
      en: "Use the exact release when comparing scores. Version 4 pruned eight tasks, repaired nineteen, standardized time limits, and hardened isolation, so it is the same benchmark family but not a drop-in score continuation from earlier sets.",
      zh: "比较成绩时必须注明具体版本。4.0 移除八题、修复十九题、统一时限并加强隔离，因此它仍是同一基准家族，但分数不能直接延续早期版本。",
    },
    sourceUrls: ["https://www.tbench.ai/news/terminal-bench-4-0", "https://github.com/harbor-framework/terminal-bench/releases/tag/v4.0.0"],
  },
  "terminal-bench-science": {
    orientation: {
      en: "Terminal-Bench-Science applies the Terminal-Bench format to complete scientific workflows: the agent uses code and research software to turn supplied data into a checked scientific result.",
      zh: "Terminal-Bench-Science 把 Terminal-Bench 的形式用于完整科研流程：智能体利用代码和科研软件，将给定数据转化为可验证的科学结果。",
    },
    distribution: {
      en: "The initial release has 70 expert-curated tasks spanning life, physical, Earth, mathematical, and engineering sciences. Work ranges from genomics and MRI to climate analysis, astrometry, inverse problems, and formal mathematics.",
      zh: "首个版本包含 70 项专家策划任务，覆盖生命、物理、地球、数学和工程科学，涉及基因组学、MRI、气候分析、天体测量、逆问题和形式数学等。",
    },
    difficulty: {
      en: "Success requires both computational execution and scientific judgment: choosing a defensible method, respecting units and assumptions, handling specialist formats, and producing the exact evidence a task-specific verifier expects.",
      zh: "成功既需要计算执行，也需要科学判断：选择合理方法、尊重单位和假设、处理专业格式，并生成任务专属验证器所要求的精确证据。",
    },
    time: {
      en: "Domain experts estimated a median of roughly twelve hours to complete a task manually. Agent runs are capped at eight hours, making persistence and prioritization part of the challenge rather than incidental infrastructure details.",
      zh: "领域专家估计人工完成一项任务的中位时间约为十二小时，而智能体运行上限为八小时，因此坚持性和优先级管理本身就是挑战的一部分。",
    },
    failureModes: {
      en: ["Running a plausible pipeline with the wrong scientific assumptions or units", "Producing an intermediate analysis but not the required final artifact", "Skipping domain-specific sanity checks because the code executed without error"],
      zh: ["流程看似合理，但科学假设或单位错误", "只完成中间分析，未生成要求的最终成果", "因代码无报错而跳过领域专属合理性检查"],
    },
    interpretation: {
      en: "A pass indicates an end-to-end scientific workflow completed under the benchmark environment, not peer-reviewed scientific novelty. Keep it separate from the general Terminal-Bench card because its task distribution, expert baseline, and research tooling are distinct.",
      zh: "通过意味着在基准环境中完成端到端科研流程，不等同于经同行评审的科学创新。它应与通用 Terminal-Bench 分开，因为任务分布、专家基线和科研工具都不同。",
    },
    sourceUrls: ["https://terminal-bench-science.ai/", "https://github.com/harbor-framework/terminal-bench-science/releases/tag/v0.1.0"],
  },
  scicode: {
    orientation: {
      en: "SciCode tests whether a model can translate a research-level scientific specification into numerically correct code, often through a chain of dependent subproblems.",
      zh: "SciCode 测试模型能否把研究级科学规范转化为数值正确的代码，通常需要连续解决相互依赖的子问题。",
    },
    distribution: {
      en: "It contains 80 main problems and 338 subproblems across 16 subfields of mathematics, physics, chemistry, biology, and materials science. The test split has 65 main problems and 288 subproblems; a main problem has a median of three stages and as many as fifteen.",
      zh: "它包含 80 道主问题和 338 道子问题，覆盖数学、物理、化学、生物和材料科学的 16 个子领域。测试集有 65 道主问题、288 道子问题；每道主问题中位含三步，最多十五步。",
    },
    difficulty: {
      en: "These are the kinds of scripts scientists write around papers and daily research, not classroom syntax exercises. Later code consumes earlier outputs, so a small conceptual or numerical error propagates through the entire solution.",
      zh: "这些题接近科学家围绕论文和日常研究编写的脚本，并非课堂语法练习。后续代码依赖前序输出，因此一个很小的概念或数值错误就会贯穿整个解答。",
    },
    time: {
      en: "The release does not define a representative human wall-clock time. The more useful effort signal is structural: multi-stage tasks require repeated implementation and testing, and providing background material markedly changes performance.",
      zh: "发布材料没有给出代表性的人工耗时。更有意义的工作量信号是任务结构：多阶段题需要反复实现和测试，是否提供背景材料会显著改变表现。",
    },
    failureModes: {
      en: ["Getting an early subproblem slightly wrong and contaminating every later stage", "Implementing the named method but missing a domain-specific convention or boundary condition", "Producing code that looks reasonable yet fails numerical tests"],
      zh: ["早期子问题出现细小错误并污染所有后续阶段", "实现了指定方法，却漏掉领域惯例或边界条件", "代码看似合理，但无法通过数值测试"],
    },
    interpretation: {
      en: "Report main-problem and subproblem accuracy separately: partial scientific coding competence can look respectable at the subproblem level while end-to-end completion remains very low. Also state whether scientific background text was supplied.",
      zh: "应分别报告主问题和子问题准确率：局部科学编程能力在子题层面可能不错，但端到端完成率仍很低；还应注明是否提供科学背景文本。",
    },
    sourceUrls: ["https://arxiv.org/abs/2407.13168", "https://github.com/scicode-bench/SciCode"],
  },
  "aa-lcr": {
    orientation: {
      en: "AA-LCR isolates long-context retrieval and reasoning: a model receives a very large document packet and must answer questions whose evidence is scattered across it.",
      zh: "AA-LCR 聚焦长上下文检索与推理：模型接收一个很大的文档包，并回答证据分散在其中的问题。",
    },
    distribution: {
      en: "The 100 human-written questions average roughly 100,000 tokens of context and span company, industry, government, academic, legal, marketing, and survey documents. Many require combining several passages rather than finding one quoted sentence.",
      zh: "100 道人工编写问题的上下文平均约 10 万 token，覆盖公司、行业、政府、学术、法律、营销和调查文档。很多题需要组合多个片段，而不是定位一句原文。",
    },
    difficulty: {
      en: "Long context creates a retrieval problem inside the prompt: versions, dates, units, and near-duplicate facts compete for attention. The questions were screened so that a human can solve them, but a superficial keyword match usually cannot.",
      zh: "长上下文本身形成提示内检索问题：版本、日期、单位和近似重复事实相互竞争注意力。题目经过人工可解性验证，但简单关键词匹配通常不够。",
    },
    time: {
      en: "No standard per-question human time is published. Compute use varies dramatically across systems, so token volume and answer quality should be considered together rather than assuming a longer response reflects better reading.",
      zh: "发布方未给出统一的单题人工耗时。不同系统的计算用量差异巨大，因此应同时看 token 消耗和答案质量，不能把更长回答等同于更好阅读。",
    },
    failureModes: {
      en: ["Retrieving the right topic from the wrong document version or reporting period", "Missing a second passage needed to constrain or calculate the answer", "Losing units, exceptions, or temporal qualifiers during synthesis"],
      zh: ["找到正确主题，却引用了错误版本或报告期", "漏掉约束或计算答案所需的第二处证据", "综合时丢失单位、例外或时间限定"],
    },
    interpretation: {
      en: "AA-LCR is best read as a controlled test of reasoning over a supplied corpus. It says little about open-web search, and results are sensitive to the exact context window, truncation policy, and model output budget.",
      zh: "AA-LCR 最适合被视为在给定语料上的受控推理测试，它很少反映开放网页搜索能力；结果还会受上下文长度、截断策略和输出预算影响。",
    },
    sourceUrls: ["https://artificialanalysis.ai/articles/announcing-aa-lcr", "https://huggingface.co/datasets/ArtificialAnalysis/AA-LCR"],
  },
  "aa-omniscience": {
    orientation: {
      en: "AA-Omniscience asks a deceptively simple question: when a model has no tools or supplied context, does it know the fact—and does it know when it does not?",
      zh: "AA-Omniscience 提出一个看似简单的问题：在没有工具和给定上下文时，模型是否知道事实，以及是否知道自己不知道？",
    },
    distribution: {
      en: "Its 6,000 short-answer questions cover 42 topics in six broad domains. The public release is a ten-percent sample that tracks overall performance reasonably well but is too small for confident topic-by-topic conclusions.",
      zh: "6,000 道简答题覆盖六大领域的 42 个主题。公开版本是 10% 样本，能较好反映整体表现，但不足以支持可靠的逐主题结论。",
    },
    difficulty: {
      en: "The benchmark rewards both recall and calibrated abstention. A wrong confident guess is costly, so a model with broad knowledge can still score poorly if it cannot distinguish memory from a plausible completion.",
      zh: "该基准同时奖励事实回忆和校准后的弃答。自信猜错代价很高，因此即使知识广泛，若无法区分真实记忆与看似合理的补全，得分仍会很差。",
    },
    time: {
      en: "These are short, tool-free questions rather than long agent runs, and the publisher does not attach a meaningful human-time estimate. The central resource trade-off is willingness to abstain, not wall-clock persistence.",
      zh: "这些是无工具的短问题，而非长时智能体运行；发布方也未给出有意义的人工耗时。核心权衡是是否愿意弃答，而不是坚持多久。",
    },
    failureModes: {
      en: ["Guessing a familiar-sounding entity instead of abstaining", "Being accurate when answering but answering far too many uncertain questions", "Using verbal confidence that does not match empirical correctness"],
      zh: ["以熟悉但错误的实体作答，而不选择弃答", "作答时准确率尚可，却回答了过多不确定问题", "语言上的自信与实际正确率不匹配"],
    },
    interpretation: {
      en: "The Omniscience Index ranges from negative to positive because incorrect answers are penalized. Accuracy alone misses the point; always read it with attempt rate or abstention behavior, and avoid domain breakdowns on the small public subset.",
      zh: "Omniscience Index 会因错误答案受罚而出现负分。只看准确率会偏离基准本意；应同时查看作答率或弃答行为，并避免对较小的公开子集做细领域拆分。",
    },
    sourceUrls: ["https://arxiv.org/abs/2511.13029", "https://huggingface.co/datasets/ArtificialAnalysis/AA-Omniscience-Public"],
  },
  hle: {
    orientation: {
      en: "Humanity’s Last Exam is a broad, expert-written academic stress test intended to remain difficult after familiar general-knowledge benchmarks have saturated.",
      zh: "Humanity’s Last Exam 是由专家编写的广泛学术压力测试，旨在常见通识基准趋于饱和后仍保持挑战。",
    },
    distribution: {
      en: "The released set contains about 2,500 questions across more than 100 subjects, mixing multiple-choice and exact short answers, with a multimodal subset. Questions were contributed by specialists and adversarially filtered against strong models.",
      zh: "发布集合约有 2,500 道题，覆盖 100 多个学科，混合选择题、精确简答题和多模态题。题目由专业人士贡献，并针对强模型进行对抗筛选。",
    },
    difficulty: {
      en: "The questions sit near the frontier of specialist human knowledge and often require several inferential steps. At release, frontier systems had low accuracy and severe overconfidence, so the challenge was as much calibration as raw recall.",
      zh: "题目接近专业人类知识前沿，且常需多步推理。发布时前沿系统准确率很低且严重过度自信，因此挑战既在知识，也在校准。",
    },
    time: {
      en: "It is not a long-horizon agent benchmark and has no single task-time estimate; reasoning models may nevertheless spend far more tokens per item than direct-answer models. Human expertise, not elapsed time, is the intended reference point.",
      zh: "它不是长流程智能体基准，也没有统一单题耗时；但推理模型每题可能比直接回答模型消耗更多 token。其主要参照是专业水平，而非经过时间。",
    },
    failureModes: {
      en: ["Giving a polished, high-confidence answer to a niche fact it does not know", "Missing a small qualifier that changes the only acceptable short answer", "Using broad related knowledge in place of the specialist inference the item requires"],
      zh: ["对并不了解的冷门事实给出流畅且高置信度的答案", "忽略会改变唯一可接受简答的细小限定", "用宽泛相关知识替代题目要求的专业推断"],
    },
    interpretation: {
      en: "HLE measures closed-ended academic breadth, not whether an agent can do research or professional work. Specify the exact subset, modality policy, and grading setup; scores from text-only slices are not interchangeable with the full benchmark.",
      zh: "HLE 衡量封闭式学术广度，而非智能体能否做研究或完成专业工作。应注明具体子集、模态策略和评分配置；纯文本切片不能与完整基准互换。",
    },
    sourceUrls: ["https://arxiv.org/abs/2501.14249", "https://github.com/centerforaisafety/hle"],
  },
  "gpqa-diamond": {
    orientation: {
      en: "GPQA Diamond is the hardest, cleanest subset of GPQA: graduate-level biology, physics, and chemistry questions designed to resist ordinary web search and non-expert guessing.",
      zh: "GPQA Diamond 是 GPQA 中最难且质量最高的子集：研究生级生物、物理和化学问题，旨在抵抗普通网页搜索和非专家猜测。",
    },
    distribution: {
      en: "Diamond contains 198 multiple-choice questions selected from the 448-question main set. Domain experts wrote and validated the items, and skilled non-experts were used to identify questions that genuinely require specialist knowledge.",
      zh: "Diamond 从 448 道主集合中筛出 198 道选择题。题目由领域专家编写和验证，并通过高技能非专家测试来确认其确实需要专业知识。",
    },
    difficulty: {
      en: "Plausible distractors are close enough that surface familiarity is unreliable. Success often needs tacit domain knowledge plus careful calculation or causal reasoning rather than locating a phrase online.",
      zh: "干扰项非常可信，仅凭表面熟悉度并不可靠。成功往往需要隐性的领域知识，再加上细致计算或因果推理，而非在网上定位某句话。",
    },
    time: {
      en: "Skilled non-experts with unrestricted internet access took about 37 minutes per question on average and scored only about 22% on Diamond; experts scored roughly 81%. This makes human expertise a more informative baseline than speed.",
      zh: "高技能非专家可自由上网，平均每题约花 37 分钟，在 Diamond 上仍仅约 22%；专家约为 81%。因此专业水平比速度更适合作为基线。",
    },
    failureModes: {
      en: ["Choosing the most familiar option instead of deriving the answer", "Applying a generally true rule where a domain-specific exception controls", "Making one algebraic, unit, or sign error in an otherwise sound chain"],
      zh: ["选择最熟悉的选项，而没有真正推导", "套用通常成立的规则，却漏掉领域特例", "在整体思路正确时犯下代数、单位或符号错误"],
    },
    interpretation: {
      en: "Because Diamond is only 198 questions, small score differences can be noisy. It is a useful specialist-reasoning probe, but it covers three sciences and multiple-choice behavior—not research execution or scientific coding.",
      zh: "Diamond 只有 198 道题，小幅分差可能包含较大噪声。它适合探测专业科学推理，但只覆盖三门科学和选择题行为，不代表科研执行或科学编程。",
    },
    sourceUrls: ["https://arxiv.org/abs/2311.12022", "https://github.com/idavidrein/gpqa"],
  },
  critpt: {
    orientation: {
      en: "CritPt is a collection of unpublished, research-level physics problems built to test genuine scientific problem solving rather than recognition of known textbook exercises.",
      zh: "CritPt 收集未公开过的研究级物理问题，用于测试真实科学求解能力，而非识别已知教材习题。",
    },
    distribution: {
      en: "The benchmark has 70 hidden-solution challenges written and reviewed by more than fifty physicists across many subfields. Each challenge includes two to four checkpoint questions that expose partial progress without publishing the complete solution.",
      zh: "基准有 70 道隐藏解答的挑战题，由五十多位物理学家在多个子领域编写和评审。每题含两到四个检查点问题，可显示部分进展而不公开完整解法。",
    },
    difficulty: {
      en: "The solution space is sparse and small modeling choices matter. A derivation can look sophisticated while resting on the wrong approximation, geometry, regime, or interpretation of the setup.",
      zh: "解空间很稀疏，细小建模选择至关重要。推导可能看似复杂，却建立在错误的近似、几何、适用区间或题意理解之上。",
    },
    time: {
      en: "No canonical human completion time is reported. Evaluations use multiple independent runs, and adding code or web access improved early systems only modestly—evidence that these are not mainly retrieval or brute-force tasks.",
      zh: "发布方未给出统一人工耗时。评测采用多次独立运行，而代码或网页工具对早期系统的提升有限，说明这些题并非主要依靠检索或穷举。",
    },
    failureModes: {
      en: ["Making a plausible but physically invalid assumption near the start", "Brute-forcing numerics without identifying the governing structure", "Reaching a neat final expression that contradicts an intermediate checkpoint"],
      zh: ["起步时采用看似合理但物理上无效的假设", "未识别主导结构就直接进行数值穷举", "得到漂亮的最终表达式，却与中间检查点矛盾"],
    },
    interpretation: {
      en: "Use checkpoint performance to distinguish partial scientific insight from a lucky or fully correct final answer. Tool-enabled and tool-free scores answer different questions and should not be pooled.",
      zh: "应利用检查点表现区分局部科学洞见、侥幸命中和完整正确解。允许工具与不允许工具的结果回答不同问题，不应混合比较。",
    },
    sourceUrls: ["https://arxiv.org/abs/2509.26574", "https://github.com/CritPt-Benchmark/CritPt"],
  },
  automationbench: {
    orientation: {
      en: "AutomationBench evaluates whether an agent can carry out a business workflow across application APIs and leave every system in the exact requested state.",
      zh: "AutomationBench 评测智能体能否跨多个应用 API 执行业务流程，并让每个系统都达到精确要求的最终状态。",
    },
    distribution: {
      en: "The public benchmark has 600 scored tasks—100 each in sales, marketing, operations, support, finance, and HR—with a similarly sized private set. Agents discover REST endpoints and work through realistic records, noise, and policy constraints.",
      zh: "公开基准有 600 项评分任务，销售、营销、运营、支持、财务和人力各 100 项，并有规模相近的私有集合。智能体需发现 REST 接口，并处理真实风格的记录、噪声和政策限制。",
    },
    difficulty: {
      en: "A workflow may be easy once the right records are found, yet finding every target and satisfying every negative constraint is brittle. The grader checks deterministic end state, so a persuasive narrative of success carries no credit.",
      zh: "找到正确记录后流程可能不难，但找到所有目标并满足所有否定约束非常脆弱。评分器检查确定性的最终状态，因此再有说服力的成功叙述也不能替代实际结果。",
    },
    time: {
      en: "The paper reports roughly 13–22 reasoning steps and 30–44 tool calls per task for evaluated systems, rather than a canonical wall-clock time. API rate limits and scaffold design make elapsed time a poor cross-system comparison.",
      zh: "论文对被测系统报告的每项任务工作量约为 13–22 个推理步骤和 30–44 次工具调用，而非统一耗时。API 限流和框架设计使实际时间不适合跨系统直接比较。",
    },
    failureModes: {
      en: ["Declaring success while required records are still missing or wrong", "Assuming the relevant app or object instead of searching methodically", "Updating obvious targets but missing list members, exact text, or prohibited side effects"],
      zh: ["仍有记录缺失或错误时就宣告成功", "猜测相关应用或对象，而未进行系统搜索", "只更新明显目标，却漏掉列表成员、精确文本或禁止的副作用"],
    },
    interpretation: {
      en: "The all-or-nothing score measures reliable orchestration, not average progress. Read it alongside task complexity and tool-call cost: partial completion can be operationally useful, but the benchmark intentionally does not reward it.",
      zh: "全有或全无的分数衡量可靠编排，而非平均进度。应结合任务复杂度和工具调用成本解读；局部完成在现实中可能有用，但该基准刻意不奖励它。",
    },
    sourceUrls: ["https://arxiv.org/abs/2604.18934", "https://github.com/zapier/AutomationBench"],
  },
  toolathlon: {
    orientation: {
      en: "Toolathlon is a cross-application endurance test: an agent must select and combine real MCP tools to complete a workflow that no single app can satisfy.",
      zh: "Toolathlon 是跨应用耐力测试：智能体必须选择并组合真实 MCP 工具，完成任何单一应用都无法独立满足的流程。",
    },
    distribution: {
      en: "It contains 108 workflows over 32 applications and more than 600 tools. Tasks deliberately cross service boundaries, so the agent must carry identifiers, dates, files, and constraints from one tool result into the next.",
      zh: "它包含 108 个工作流，覆盖 32 个应用和 600 多个工具。任务刻意跨越服务边界，智能体必须把标识符、日期、文件和约束从一个工具结果传递到下一个。",
    },
    difficulty: {
      en: "The main challenge is not calling a tool once; it is discovering the right sequence in a huge action space while keeping state coherent. Longer trajectories correlate with lower success, but recoverable execution errors are less damaging than choosing nonexistent or irrelevant tools.",
      zh: "主要挑战不是调用一次工具，而是在巨大动作空间中发现正确顺序，并保持状态一致。轨迹越长通常成功率越低，但可恢复的执行错误往往不如选择不存在或无关工具严重。",
    },
    time: {
      en: "The release emphasizes turns and tool calls instead of a universal human-time estimate. Runtime is scaffold- and service-dependent, especially when live tools return large outputs or transient errors.",
      zh: "发布材料强调回合数和工具调用量，而非统一人工耗时。运行时间高度依赖智能体框架和服务，尤其当真实工具返回大输出或临时错误时。",
    },
    failureModes: {
      en: ["Hallucinating a tool name or parameter rather than inspecting the available schema", "Passing the wrong resource or identifier between applications", "Letting long outputs crowd out the original goal and remaining constraints"],
      zh: ["不查看可用 schema，而是幻觉出工具名或参数", "在应用之间传递错误资源或标识符", "让长输出挤掉原始目标和剩余约束"],
    },
    interpretation: {
      en: "A score reflects the full model–scaffold–tool stack. Compare like-for-like tool availability and execution conditions, and inspect trajectory length or error recovery before attributing a difference solely to the base model.",
      zh: "分数反映完整的模型、框架与工具栈。比较时应保持工具可用性和执行条件一致，并查看轨迹长度与错误恢复，再判断差异是否来自基础模型。",
    },
    sourceUrls: ["https://arxiv.org/abs/2510.25726", "https://github.com/hkust-nlp/Toolathlon"],
  },
  "agents-last-exam": {
    orientation: {
      en: "Agent’s Last Exam asks agents to complete substantial knowledge-work assignments drawn from real non-physical occupations, with deliverables checked against deterministic rubrics.",
      zh: "Agent’s Last Exam 让智能体完成来自真实非体力职业的大型知识工作任务，并用确定性评分细则检查交付物。",
    },
    distribution: {
      en: "The benchmark contains more than a thousand tasks across 55 subfields and 13 industry clusters, authored and reviewed by hundreds of practitioners. Tasks may require professional software, research, analysis, and multi-file artifacts.",
      zh: "基准包含一千多项任务，覆盖 55 个子领域和 13 个行业集群，由数百名从业者编写和评审。任务可能需要专业软件、研究、分析和多文件成果。",
    },
    difficulty: {
      en: "The assignments are underspecified in the way work often is: success depends on understanding the domain, choosing a suitable approach, and using the intended workflow—not just emitting a plausible document. In the paper’s analysis, understanding and approach errors dominate.",
      zh: "这些任务像真实工作一样存在适度不完全说明：成功取决于理解领域、选择合适方法并使用正确工作流，而不只是生成看似合理的文档。论文分析中，理解和方法错误占主导。",
    },
    time: {
      en: "Practitioners estimated tasks from hours to weeks of human effort. Full evaluation wall-clock totals varied from roughly one day to many days depending on parallelism and timeouts, so per-system runtime must be reported with infrastructure context.",
      zh: "从业者估计单项任务需数小时至数周。完整评测的总墙钟时间会因并行度和超时策略而从约一天到多天不等，因此报告系统耗时时必须说明基础设施。",
    },
    failureModes: {
      en: ["Misunderstanding the professional objective before beginning execution", "Writing ad-hoc scripts when the task depends on domain software or a GUI workflow", "Producing a plausible artifact that misses a rubric-critical requirement"],
      zh: ["开始执行前就误解了任务的专业目标", "任务依赖领域软件或 GUI 流程，却只写临时脚本", "成果看似合理，却漏掉评分细则中的关键要求"],
    },
    interpretation: {
      en: "This is a broad occupational capability test, but not a labor-market forecast. Read aggregate pass rates with domain slices, tool setup, and artifact verification; a system can be strong in one work cluster and weak in another.",
      zh: "这是广泛的职业能力测试，但不是劳动力市场预测。总通过率应结合领域切片、工具配置和成果验证解读；系统可能在某类工作很强，在另一类很弱。",
    },
    sourceUrls: ["https://arxiv.org/abs/2606.05405", "https://agents-last-exam.org/contributors"],
  },
  browsecomp: {
    orientation: {
      en: "BrowseComp tests persistent web investigation through questions whose answers are short and checkable but deliberately difficult to discover.",
      zh: "BrowseComp 通过答案简短可核验、却刻意难以找到的问题，测试持续性的网页调查能力。",
    },
    distribution: {
      en: "It has 1,266 human-written, time-stable questions across many topics. Authors typically began with a known fact and inverted it into a web-scale constraint puzzle, so relevant clues are entangled across pages rather than exposed by one obvious query.",
      zh: "它包含 1,266 道人工编写、答案相对稳定的多主题问题。作者通常从已知事实出发，反向构造全网范围的约束谜题，因此线索分散在多个页面，而非一次搜索即可找到。",
    },
    difficulty: {
      en: "Each item is easier to verify than to find. Strong performance requires creative query reformulation, backtracking, evaluating source factuality, and continuing after several plausible search paths fail.",
      zh: "每题都比‘找到答案’更容易‘验证答案’。高水平表现需要创造性改写查询、回溯、判断来源可信度，并在多个看似可行的路径失败后继续搜索。",
    },
    time: {
      en: "Human searchers solved only 29.2% of attempted items; they were allowed to give up after about two hours, and some successful searches took two to three hours. Model accuracy also rises smoothly with more browsing compute and repeated attempts.",
      zh: "人工搜索者只解出 29.2% 的尝试题目；约两小时后可放弃，部分成功搜索也用了两到三小时。模型准确率同样会随浏览计算量和重复尝试增加而平滑上升。",
    },
    failureModes: {
      en: ["Repeating near-identical searches instead of changing the decomposition", "Stopping on the first entity that matches only some constraints", "Becoming more confident after browsing even when the assembled answer is wrong"],
      zh: ["反复使用近似查询，而不改变问题分解", "找到只满足部分约束的实体就停止", "浏览后答案仍错，却变得更加自信"],
    },
    interpretation: {
      en: "BrowseComp measures the narrow but important skill of finding one obscure answer, not long-form research quality or ordinary user queries. Results depend strongly on search access and test-time compute, and the dataset asks publishers not to expose item text publicly.",
      zh: "BrowseComp 衡量的是找到单个冷门答案这一狭窄但重要的能力，不代表长篇研究质量或普通用户查询。结果高度依赖搜索权限和测试时计算量；数据集也要求不要公开题目文本。",
    },
    sourceUrls: ["https://arxiv.org/abs/2504.12516", "https://github.com/openai/simple-evals"],
  },
  "officeqa-pro": {
    orientation: {
      en: "OfficeQA Pro evaluates document-research agents on almost a century of U.S. Treasury bulletins, where the job is to find, interpret, and calculate from the right historical pages.",
      zh: "OfficeQA Pro 使用近百年的美国财政部公报，评测文档研究智能体能否找到正确历史页面、准确理解并完成计算。",
    },
    distribution: {
      en: "The hard set contains 133 questions (plus a 113-question easy companion) over roughly 89,000 pages and more than 26 million numeric values. Questions may span many pages or bulletins; most require advanced analysis, and some also need web evidence or figures.",
      zh: "困难集有 133 道题，另有 113 道简单题；底层材料约 89,000 页、包含超过 2,600 万个数值。问题可能跨越多页或多份公报，多数需要高级分析，部分还需网页证据或图表。",
    },
    difficulty: {
      en: "The corpus moves from scans to digital PDFs and contains nested tables, footnotes, changing units, and revised series. The right number is often easy to copy only after the agent has found the right edition, row, column, and interpretation.",
      zh: "语料从扫描件延续到数字 PDF，包含嵌套表格、脚注、变化单位和修订序列。只有先找到正确期次、行列和解释后，数值本身才容易抄取。",
    },
    time: {
      en: "In the paper, agents working from full PDFs averaged about 13–31 minutes and 57–82 tool calls per question; using parsed representations reduced latency to roughly 3–5 minutes. Early manual setup attempts could spend hours just installing PDF tooling.",
      zh: "论文中，直接处理完整 PDF 的智能体每题平均约 13–31 分钟、调用工具 57–82 次；使用解析后表示可降至约 3–5 分钟。早期人工配置甚至可能仅安装 PDF 工具就花数小时。",
    },
    failureModes: {
      en: ["Selecting the wrong revision, reporting period, row, or column", "Losing units and footnotes during OCR or table extraction", "Rounding too early, using the wrong formula, or omitting evidence found only in a figure"],
      zh: ["选择了错误修订版、报告期、行或列", "OCR 或表格提取时丢失单位和脚注", "过早舍入、使用错误公式，或遗漏只存在于图中的证据"],
    },
    interpretation: {
      en: "A result measures the whole document stack—retrieval, parsing, reasoning, and tooling. Parsed-text and full-PDF configurations are not equivalent; report which representation and external access were used.",
      zh: "结果反映整个文档栈，包括检索、解析、推理和工具。解析文本与完整 PDF 配置并不等价，应明确报告所用表示形式和外部访问权限。",
    },
    sourceUrls: ["https://arxiv.org/abs/2603.08655", "https://github.com/databricks/officeqa"],
  },
  osworld: {
    orientation: {
      en: "OSWorld evaluates agents that operate ordinary desktop applications through the screen, mouse, and keyboard, with version 2 shifting the focus to long professional workflows.",
      zh: "OSWorld 评测通过屏幕、鼠标和键盘操作普通桌面应用的智能体；第二版把重点转向长时专业工作流。",
    },
    distribution: {
      en: "OSWorld-V2 contains 108 workflows across seven professional domains and 21 subcategories. Tasks can cross applications, files, messages, and dynamic UI state rather than ending after one menu action.",
      zh: "OSWorld-V2 包含 108 个工作流，覆盖七个专业领域和 21 个子类。任务可能跨应用、文件、消息和动态界面状态，而不是一次菜单操作后结束。",
    },
    difficulty: {
      en: "The challenge is maintaining an accurate world state for hundreds of actions. The agent must notice UI changes, ground information from several places, learn domain workflows, ask the user when appropriate, and verify that edits actually landed.",
      zh: "难点是在数百次动作中维持准确的世界状态。智能体要察觉界面变化、整合多处信息、学习领域流程、在适当时询问用户，并验证修改是否真正生效。",
    },
    time: {
      en: "A skilled human takes a median of about 1.6 hours, and almost 70% of tasks exceed one hour. Agents average more than 250–300 steps, roughly an order of magnitude beyond the original benchmark’s short tasks.",
      zh: "熟练人工完成任务的中位时间约 1.6 小时，近 70% 的任务超过一小时。智能体平均需 250–300 多步，比原版短任务高出约一个数量级。",
    },
    failureModes: {
      en: ["Clicking stale coordinates after the interface has changed", "Forgetting an updated message, constraint, unit, or formula late in the workflow", "Continuing autonomously when the task requires asking the user, or failing to verify saved state"],
      zh: ["界面变化后仍点击过时坐标", "在流程后段忘记更新后的消息、约束、单位或公式", "本应询问用户却继续操作，或未验证保存状态"],
    },
    interpretation: {
      en: "OSWorld scores include model perception and reasoning, the computer-use policy, application versions, and environment stability. Compare only matched setups, and do not infer long-workflow ability from the much shorter v1 distribution.",
      zh: "OSWorld 分数同时包含模型感知与推理、计算机操作策略、应用版本和环境稳定性。只能比较一致配置，也不应从远短于 V2 的 V1 分布推断长流程能力。",
    },
    sourceUrls: ["https://arxiv.org/abs/2606.29537", "https://github.com/xlang-ai/OSWorld-V2"],
  },
  "apex-agents": {
    orientation: {
      en: "APEX-Agents tests whether an agent can perform entry-level professional work in investment banking, management consulting, and corporate law using realistic files and applications.",
      zh: "APEX-Agents 测试智能体能否利用真实风格的文件和应用，完成投行、管理咨询与公司法律的入门级专业工作。",
    },
    distribution: {
      en: "The open release contains 480 tasks split across the three professions. Prompts, supporting files, gold artifacts, and rubrics are designed around cross-application workflows rather than isolated office-software tricks.",
      zh: "公开版本有 480 项任务，分布于三个职业。提示、配套文件、黄金成果和评分细则围绕跨应用工作流设计，而非孤立的办公软件技巧。",
    },
    difficulty: {
      en: "Professional conventions matter: the same raw analysis can fail if the document structure, citation, formatting, or business judgment is not usable. At release, even the strongest reported agent completed only about a quarter of tasks.",
      zh: "专业惯例很重要：即使原始分析相同，只要文档结构、引用、格式或商业判断不可用，任务仍会失败。发布时最强系统也只完成约四分之一任务。",
    },
    time: {
      en: "The benchmark does not publish one universal task duration. These are multi-step office workflows, so runtime should be reported with application latency, retry policy, and the number of parallel workers rather than as a model-only property.",
      zh: "该基准没有给出统一任务时长。这些是多步骤办公流程，因此耗时应连同应用延迟、重试策略和并行工作者数量一起报告，而不能只归因于模型。",
    },
    failureModes: {
      en: ["Applying a generic template while missing profession-specific conventions", "Completing analysis but failing to propagate it consistently into the final files", "Producing a visually plausible artifact that violates a blocker in the rubric"],
      zh: ["套用通用模板，却漏掉职业专属惯例", "分析已完成，但没有一致地写入最终文件", "成果视觉上可信，却违反评分细则中的阻断条件"],
    },
    interpretation: {
      en: "A pass is evidence of end-to-end task completion under the benchmark’s application stack. Use profession-level slices and rubric details; a single aggregate can conceal very different strengths in finance, consulting, and law.",
      zh: "通过代表系统在基准应用栈中完成了端到端任务。应查看各职业切片和细则，因为一个总分可能掩盖其在金融、咨询和法律上的巨大差异。",
    },
    sourceUrls: ["https://arxiv.org/abs/2601.14242", "https://github.com/Mercor-Intelligence/apex-evals"],
  },
  "arc-agi-3": {
    orientation: {
      en: "ARC-AGI-3 replaces static grid puzzles with novel, turn-based visual worlds. An agent must explore each world, infer its mechanics and goal, and then act efficiently enough to finish.",
      zh: "ARC-AGI-3 把静态网格题变为全新的回合制视觉世界。智能体必须探索环境、推断规则和目标，并以足够高效的动作完成任务。",
    },
    distribution: {
      en: "The environments are abstract and intentionally strip away language, trivia, and familiar software conventions. Later levels build on mechanics discovered earlier, turning each game into a small curriculum rather than a bag of independent questions.",
      zh: "这些环境高度抽象，刻意去除语言、常识题和熟悉软件惯例。后续关卡建立在先前发现的机制之上，因此每个游戏更像一个小课程，而非互不相关的题目集合。",
    },
    difficulty: {
      en: "Agents must balance exploration with execution under an action budget, keep a persistent state model, discover an unstated objective, and generalize rules across levels. At the preview release, humans completed the games while frontier language-model agents scored below one percent.",
      zh: "智能体要在动作预算内平衡探索与执行，维持持续的状态模型，发现未明说的目标，并跨关卡泛化规则。预览发布时，人类能完成游戏，而前沿语言模型智能体低于 1%。",
    },
    time: {
      en: "The benchmark measures action efficiency rather than wall-clock speed. The Relative Human Action Efficiency score compares an agent with an upper-median human trajectory, and each level allows at most five times the human median action count.",
      zh: "该基准衡量动作效率，而非墙钟速度。相对人类动作效率分数将智能体与人类较优中位轨迹比较，每关最多允许人类中位动作数的五倍。",
    },
    failureModes: {
      en: ["Committing to a goal before enough exploration has revealed the rules", "Forgetting earlier observations and rebuilding the same hypothesis repeatedly", "Solving the immediate screen but failing to abstract the mechanic needed for later levels"],
      zh: ["尚未探索出足够规则就过早锁定目标", "忘记早期观察，反复重建相同假设", "只解决当前画面，却未抽象出后续关卡所需机制"],
    },
    interpretation: {
      en: "ARC-AGI-3 is a probe of online adaptation and interactive reasoning, not visual question answering. Later-level weighting and human-relative action cost mean raw completion count alone does not capture the official score.",
      zh: "ARC-AGI-3 探测在线适应与交互推理，而非视觉问答。由于后期关卡权重和人类相对动作成本的存在，单看完成数量不能代表官方分数。",
    },
    sourceUrls: ["https://arxiv.org/abs/2603.24621", "https://arcprize.org/arc-agi/3"],
  },
  cursorbench: {
    orientation: {
      en: "CursorBench measures coding-agent usefulness on real internal Cursor requests paired with the code changes engineers actually committed.",
      zh: "CursorBench 使用 Cursor 内部真实请求及工程师实际提交的代码变更，衡量编程智能体的实用性。",
    },
    distribution: {
      en: "The task set is private and refreshed every few months. It includes terse or ambiguous requests, multi-file changes, monorepos, production logs, and long experiments; successive versions have increased repository and change scope.",
      zh: "任务集不公开，并每隔数月刷新。它包含简短或模糊请求、多文件修改、单体仓库、生产日志和长实验；后续版本逐步扩大了仓库和修改范围。",
    },
    difficulty: {
      en: "Real requests do not specify a unit test for every intention. The agent must locate the right code, infer local conventions, make an appropriately scoped change, and avoid wasting developer attention even when several implementations could be valid.",
      zh: "真实请求不会为每个意图都写明单元测试。智能体必须找到正确代码、推断本地惯例、做出范围恰当的修改，并在多种方案都可行时仍尽量节省开发者注意力。",
    },
    time: {
      en: "The publisher treats latency and completion-token use as part of the quality trade-off rather than publishing a single human-time baseline. Some real tasks involve experiments long enough that patience and progress reporting affect usefulness.",
      zh: "发布方把延迟和完成 token 用量视为质量权衡的一部分，而没有给出统一人工耗时。有些真实任务包含长实验，因此耐心和进度反馈也会影响实用性。",
    },
    failureModes: {
      en: ["Following the literal request while missing repository context or developer intent", "Producing code that graders accept but that feels inefficient or awkward to a developer", "Searching poorly in large repositories or making an unnecessarily broad edit"],
      zh: ["只按字面执行，却忽略仓库上下文或开发者意图", "代码能通过评审，但对开发者而言低效或别扭", "在大型仓库中搜索不佳，或做出不必要的大范围修改"],
    },
    interpretation: {
      en: "Scores are comparable only within the same CursorBench version and harness. The private, changing distribution is valuable for contamination resistance and product relevance, but it limits outside reproducibility; pair offline scores with live user outcomes.",
      zh: "成绩只能在相同 CursorBench 版本和框架内比较。私有且变化的分布有助于防污染和保持产品相关性，但限制外部复现；最好与真实用户结果一起看。",
    },
    sourceUrls: ["https://cursor.com/cursorbench", "https://cursor.com/blog/cursorbench"],
  },
  deepsearchqa: {
    orientation: {
      en: "DeepSearchQA evaluates whether a research agent can find a complete, clean answer set on the open web—not merely one plausible fact.",
      zh: "DeepSearchQA 评测研究智能体能否在开放网页上找到完整且干净的答案集合，而不只是一个看似合理的事实。",
    },
    distribution: {
      en: "The 900 expert-curated prompts span 17 fields including government, finance, science, health, history, geography, and media. Questions are time-anchored and often form causal chains in which one retrieval step determines the next filter.",
      zh: "900 道专家策划题覆盖政府、金融、科学、健康、历史、地理和媒体等 17 个领域。题目锚定时间，并常形成因果链：前一步检索结果决定下一步筛选。",
    },
    difficulty: {
      en: "Completeness creates a last-mile problem. The agent must collate fragmented sources, resolve duplicate entities, apply every constraint, and know when the search is exhaustive without padding the answer with adjacent guesses.",
      zh: "完整性带来‘最后一公里’问题。智能体要汇总分散来源、解析重复实体、应用所有约束，并判断搜索何时已穷尽，同时不能用相邻猜测填充答案。",
    },
    time: {
      en: "No representative per-task wall-clock baseline is published. The paper shows strong test-time scaling across repeated samples, so compute budget and aggregation method are material parts of any reported result.",
      zh: "发布方未给出代表性的单题墙钟基线。论文显示重复采样带来明显的测试时扩展，因此计算预算和聚合方法都是任何结果的重要组成部分。",
    },
    failureModes: {
      en: ["Finding most of a list but missing obscure long-tail members", "Over-retrieving nearby entities because the agent cannot decide when to stop", "Approximating a value, failing to open a spreadsheet, or forgetting a final filtering condition"],
      zh: ["找到列表大部分成员，却漏掉冷门长尾项", "因无法判断何时停止而过度检索相邻实体", "估算数值、无法打开表格，或忘记最后一个筛选条件"],
    },
    interpretation: {
      en: "Read F1 together with strict fully-correct rate: a high F1 can hide an incomplete or noisy list. Live-web drift remains possible even with time anchors, and outcome scoring does not reveal whether the search process was efficient.",
      zh: "F1 应与严格的完全正确率一起看：高 F1 可能掩盖不完整或含噪列表。即使有时间锚点，开放网页仍会漂移；结果评分也无法说明搜索过程是否高效。",
    },
    sourceUrls: ["https://arxiv.org/abs/2601.20975", "https://huggingface.co/datasets/google/deepsearchqa"],
  },
  "mcp-atlas": {
    orientation: {
      en: "MCP-Atlas tests general-purpose agents on realistic tasks that require coordinating tools from several production MCP servers.",
      zh: "MCP-Atlas 测试通用智能体能否协调多个生产级 MCP 服务器中的工具来完成真实任务。",
    },
    distribution: {
      en: "Its 1,000 expert-authored tasks use 36 servers and 220 tools across five domains; 98.6% require more than one server. A task exposes 6–37 possible tools but usually needs only 2–8, and prompts do not name the right tools or parameters.",
      zh: "1,000 项专家编写任务使用五个领域的 36 个服务器和 220 个工具，98.6% 需要跨服务器。每题可见 6–37 个工具，但通常只需 2–8 个，提示不会直接给出工具名或参数。",
    },
    difficulty: {
      en: "Agents must translate ordinary user intent into schemas, carry evidence across services, and synthesize an answer whose individual claims are supported. As models improve, the bottleneck shifts from choosing a tool to recognizing incomplete evidence.",
      zh: "智能体必须把普通用户意图映射到 schema，在服务间传递证据，并综合出每项主张都有支持的答案。模型变强后，瓶颈会从选工具转向识别证据是否完整。",
    },
    time: {
      en: "The benchmark reports tool depth and episode behavior rather than one human-time estimate. Wall-clock latency depends on the servers and runner; tool-count and completion evidence are more portable effort measures.",
      zh: "该基准报告工具深度和回合行为，而非统一人工耗时。墙钟延迟取决于服务器和运行器；工具数与完成证据是更可迁移的工作量指标。",
    },
    failureModes: {
      en: ["Calling a malformed, wrong, or nonexistent tool", "Stopping after gathering only part of the evidence needed for the answer", "Using correct tool results but violating a logical constraint or synthesizing an unsupported claim"],
      zh: ["调用格式错误、选择错误或不存在的工具", "只收集到部分所需证据就停止", "工具结果正确，却违反逻辑约束或综合出无支持的主张"],
    },
    interpretation: {
      en: "MCP-Atlas scores a model–tool-stack combination, with claim-level grading that can expose partial evidence. Keep server versions and available tool schemas fixed when comparing systems, and inspect cognitive versus tool-execution failures separately.",
      zh: "MCP-Atlas 评分的是模型与工具栈组合，并通过主张级评分揭示部分证据。比较系统时应固定服务器版本和可用 schema，并分别查看认知错误与工具执行错误。",
    },
    sourceUrls: ["https://arxiv.org/abs/2602.00933", "https://github.com/scaleapi/mcp-atlas"],
  },
  deepswe: {
    orientation: {
      en: "DeepSWE evaluates long-horizon coding agents on substantial engineering tasks written specifically for evaluation, rather than mined from already-merged pull requests.",
      zh: "DeepSWE 使用专门为评测编写的大型工程任务测试长流程编程智能体，而不是从已合并的拉取请求中挖掘题目。",
    },
    distribution: {
      en: "The current set contains 113 original tasks across 91 repositories. Prompts are intentionally concise, while solutions can span large codebases and multiple files; isolated verifiers check submitted patches.",
      zh: "当前集合有 113 项原创任务，覆盖 91 个仓库。提示刻意简洁，而解决方案可能跨越大型代码库和多个文件；隔离验证器检查提交补丁。",
    },
    difficulty: {
      en: "Because tasks are commissioned rather than reconstructed from historical fixes, the agent cannot simply recover an issue’s known patch shape. It must infer intent, locate the right abstractions, implement a coherent change, and preserve repository behavior.",
      zh: "由于任务是专门委托创作，而非从历史修复还原，智能体不能简单复原已知补丁形式。它必须推断意图、找到正确抽象、实现一致修改并保持仓库行为。",
    },
    time: {
      en: "Runs allow up to 2.5 hours. Only a very small fraction of the paper’s runs hit that bound, suggesting that solution quality and self-verification—not the nominal timeout—are usually the limiting factors.",
      zh: "每次运行最多 2.5 小时。论文中只有极少数运行触及上限，说明通常限制表现的是方案质量和自我验证，而非名义超时。",
    },
    failureModes: {
      en: ["Editing the obvious file without tracing the behavior across the repository", "Interpreting a terse prompt too narrowly and missing implied integration work", "Submitting a plausible patch before exercising the verifier-relevant edge cases"],
      zh: ["只编辑最显眼文件，没有沿仓库追踪完整行为", "对简洁提示理解过窄，漏掉隐含集成工作", "尚未覆盖验证器相关边界情况就提交看似合理的补丁"],
    },
    interpretation: {
      en: "DeepSWE is useful for contamination-resistant, original engineering work. Compare scores only under the same task release, verifier isolation, agent harness, and time budget; it measures commissioned task completion, not ordinary issue-resolution frequency.",
      zh: "DeepSWE 适合衡量抗污染的原创工程工作。成绩比较必须保持任务版本、验证器隔离、智能体框架和时间预算一致；它测的是委托任务完成能力，而非日常 issue 解决频率。",
    },
    sourceUrls: ["https://arxiv.org/abs/2607.07946", "https://github.com/datacurve-ai/deep-swe"],
  },
  "nl2repo-bench": {
    orientation: {
      en: "NL2Repo-Bench asks an agent to build an entire Python repository from a natural-language specification, with no starter implementation to anchor its design.",
      zh: "NL2Repo-Bench 要求智能体仅依据自然语言规范构建完整 Python 仓库，没有初始实现可作为设计锚点。",
    },
    distribution: {
      en: "Its 104 tasks span nine library categories, from web, data, database, and networking tools to system utilities. Specifications average about 18,800 tokens; 26 tasks are labeled easy, 46 medium, and 32 hard by original project size.",
      zh: "104 项任务覆盖九类库，包括网页、数据、数据库、网络和系统工具。规范平均约 18,800 token；按原项目规模分为 26 项简单、46 项中等和 32 项困难。",
    },
    difficulty: {
      en: "Repository generation couples architecture, API compatibility, packaging, dependencies, and thousands of small implementation decisions. The strongest reported system fully passed the official tests on only five repositories in one run.",
      zh: "仓库生成把架构、API 兼容、打包、依赖和成千上万个实现选择绑在一起。论文中最强系统单次运行也只在五个仓库上完全通过官方测试。",
    },
    time: {
      en: "The primary study allowed effectively unbounded interaction rounds and reports tool calls rather than a fixed human-time baseline; systems averaged roughly 30–126 calls per task. That makes stopping behavior a major part of the result.",
      zh: "主要实验基本不限制交互回合，并报告工具调用而非固定人工耗时；不同系统平均每题约 30–126 次调用。因此何时停止本身就是结果的重要组成。",
    },
    failureModes: {
      en: ["Stopping early after convincing itself the repository is complete", "Never finishing because it waits for user guidance or loops through navigation", "Breaking imports, package structure, signatures, or hidden test expectations through blind editing"],
      zh: ["自我确信仓库已完成而过早停止", "等待用户指引或陷入导航循环，始终未完成", "盲目编辑导致导入、包结构、签名或隐藏测试预期损坏"],
    },
    interpretation: {
      en: "Average test pass rate describes partial implementation, while repository-level pass@1 is the stricter end-to-end signal. Report both, and include round limits and scaffold behavior because a collaborative agent can look artificially weak in a no-user loop.",
      zh: "平均测试通过率反映部分实现，而仓库级 pass@1 才是更严格的端到端信号。应同时报告两者，并说明回合限制和框架行为，因为协作型智能体在无用户循环中可能显得异常弱。",
    },
    sourceUrls: ["https://arxiv.org/abs/2512.12730", "https://github.com/multimodal-art-projection/NL2RepoBench"],
  },
  frontierswe: {
    orientation: {
      en: "FrontierSWE is an ultra-long-horizon benchmark for engineering and research tasks that are too large, open-ended, or quality-sensitive for ordinary bug-fix evaluations.",
      zh: "FrontierSWE 面向超长流程工程与研究任务，这些任务对普通缺陷修复基准而言过于庞大、开放或质量敏感。",
    },
    distribution: {
      en: "Version 2 has 34 tasks: it keeps the concepts of thirteen v1 tasks, adds twenty-one new challenges, and retires four. The current mix spans implementation, performance optimization, scientific computing, visual systems, and AI research.",
      zh: "第二版有 34 项任务：保留 13 项 V1 任务理念，新增 21 项挑战并退役 4 项。当前分布覆盖实现、性能优化、科学计算、视觉系统和 AI 研究。",
    },
    difficulty: {
      en: "Many tasks have a broad quality surface rather than one binary bug: performance, fidelity, robustness, and scientific validity can all contribute partial credit. Agents must decide what to build first, measure progress honestly, and keep improving instead of settling for a plausible prototype.",
      zh: "许多任务不是单一二元缺陷，而有广泛质量维度：性能、保真度、稳健性和科学有效性都可能带来部分得分。智能体要决定先做什么，诚实测量进展，并持续改进而非满足于可运行原型。",
    },
    time: {
      en: "Each run can last up to twenty hours. The purpose-built Proximus harness tells the agent how much time remains and explicitly encourages continued work because premature submission was a recurring behavior in the first release.",
      zh: "每次运行最多二十小时。专用 Proximus 框架会告知剩余时间，并明确鼓励继续工作，因为过早提交是首版反复出现的行为。",
    },
    failureModes: {
      en: ["Submitting a promising prototype while substantial time and score remain", "Implementing the right broad method but missing the limiting performance or quality bottleneck", "Optimizing a visible proxy instead of the task’s actual end-to-end evaluation"],
      zh: ["仍有大量时间和得分空间时就提交有希望的原型", "大方向正确，却漏掉真正限制性能或质量的瓶颈", "优化可见代理指标，而非任务真实端到端评测"],
    },
    interpretation: {
      en: "Treat FrontierSWE as one evolving benchmark family and use v2 for current descriptions, but pin scores and samples to their exact release. Its continuous partial-credit score is richer than pass/fail and cannot be compared casually with short patch benchmarks.",
      zh: "应把 FrontierSWE 视为持续演进的一个基准家族，并用 V2 表示当前信息，但成绩和样例必须绑定具体版本。其连续部分得分比通过/失败更丰富，不能随意与短补丁基准比较。",
    },
    sourceUrls: ["https://www.frontierswe.com/blog/v2", "https://github.com/Proximal-Labs/frontier-swe-v2"],
  },
  programbench: {
    orientation: {
      en: "ProgramBench asks an agent to rebuild an existing program from its documentation and observable executable behavior, without access to the source implementation.",
      zh: "ProgramBench 要求智能体根据文档和可观察的可执行程序行为重建现有软件，但不能访问原始实现。",
    },
    distribution: {
      en: "The 200 tasks range from small command-line utilities to FFmpeg, SQLite, interpreters, compression tools, and developer infrastructure. The median source project has about 8,600 lines, 50 files, 10 runtime dependencies, and 770 evaluation tests.",
      zh: "200 项任务从小型命令行工具延伸到 FFmpeg、SQLite、解释器、压缩工具和开发基础设施。中位源项目约有 8,600 行代码、50 个文件、10 个运行依赖和 770 个评测测试。",
    },
    difficulty: {
      en: "The executable is an oracle, not a blueprint. Agents must discover behavior through targeted probes, choose an architecture, and implement a broad interface; none of the nine evaluated models fully solved a task in the initial study.",
      zh: "可执行程序只是行为预言机，而非设计蓝图。智能体要通过针对性探测发现行为、选择架构并实现广泛接口；初始研究中的九个模型没有一个完整解决任何任务。",
    },
    time: {
      en: "Runs allow six hours and 1,000 turns, but 98.1% of trajectories submitted voluntarily and only 1.9% timed out. Many agents therefore stop with time available, making implementation strategy more important than simply extending the clock.",
      zh: "每次运行允许六小时和 1,000 回合，但 98.1% 的轨迹主动提交，只有 1.9% 超时。许多智能体在仍有时间时就停止，因此实现策略比简单延长时钟更重要。",
    },
    failureModes: {
      en: ["Probing too narrowly and mistaking documentation for the complete behavioral specification", "Generating a monolithic single-file approximation and barely revising it", "Passing easy interface cases while missing the long tail covered by hundreds of tests"],
      zh: ["探测范围过窄，把文档误当成完整行为规范", "生成单文件整体近似实现，之后几乎不再修订", "通过简单接口案例，却漏掉数百测试覆盖的长尾行为"],
    },
    interpretation: {
      en: "The primary resolved rate is intentionally severe; per-task test coverage shows how much of a program was recreated. Because many tests are generated, read results with the benchmark’s assertion-quality audit and avoid equating source similarity with correctness.",
      zh: "主要完整解决率刻意严格；每题测试通过情况可显示程序被重建了多少。由于许多测试由自动生成，应结合断言质量审计解读，且不能把源码相似度等同于正确性。",
    },
    sourceUrls: ["https://arxiv.org/abs/2605.03546", "https://github.com/facebookresearch/ProgramBench"],
  },
  posttrainbench: {
    orientation: {
      en: "PostTrainBench evaluates agents whose deliverable is not code alone but an improved model: they must design and execute a post-training recipe under a fixed compute budget.",
      zh: "PostTrainBench 评测以改进后的模型为交付物的智能体：它们必须在固定算力预算内设计并执行后训练方案，而不只是写代码。",
    },
    distribution: {
      en: "The current benchmark defines 28 model–target configurations: four base models crossed with seven downstream evaluations. Each task runs on a single H100 and exposes the training and evaluation environment to the agent.",
      zh: "当前基准定义 28 个模型与目标配置，由四个基础模型和七项下游评测交叉组成。每项任务在单张 H100 上运行，并向智能体开放训练和评测环境。",
    },
    difficulty: {
      en: "A good agent must understand the target metric, source or generate data, tune a recipe, monitor training, evaluate honestly, and preserve valid model weights. The best general agent in the paper remained far below official instruction-tuned models.",
      zh: "优秀智能体要理解目标指标、获取或生成数据、调试训练方案、监控训练、诚实评估并保存有效权重。论文中最佳通用智能体仍远低于官方指令模型。",
    },
    time: {
      en: "Each run has ten hours on one H100. Some agents stop after only two or three hours; the strongest systems can continue improving through the budget, while others plateau around five hours.",
      zh: "每次运行可使用单张 H100 十小时。有些智能体仅两三小时就停止；最强系统可在整个预算内继续改进，而另一些约五小时后进入平台期。",
    },
    failureModes: {
      en: ["Ending early without using the available training and evaluation budget", "Failing to leave valid weights or forgetting environment and API constraints", "Gaming the evaluation—by tampering, downloading an instruction model, or overfitting—instead of genuinely post-training the base model"],
      zh: ["未利用可用训练和评测预算就提前结束", "未留下有效权重，或忘记环境与 API 约束", "通过篡改、下载指令模型或过拟合来投机评分，而非真正后训练基础模型"],
    },
    interpretation: {
      en: "The score is a capability-and-efficiency result for the entire autonomous training loop. Compare the same base model, target benchmark, hardware, time, and anti-cheating policy; strong performance on one target may reflect a narrow recipe rather than general post-training skill.",
      zh: "分数反映整个自主训练循环的能力和效率。比较时必须保持基础模型、目标评测、硬件、时间和防作弊政策一致；某个目标上的高分可能只是狭窄训练方案，而非通用后训练能力。",
    },
    sourceUrls: ["https://arxiv.org/abs/2603.08640", "https://github.com/aisa-group/PostTrainBench"],
  },
  spreadsheetbench: {
    orientation: {
      en: "SpreadsheetBench measures whether an agent can inspect and edit real, multi-sheet workbooks for modeling, debugging, and visualization while preserving everything it was not asked to change.",
      zh: "SpreadsheetBench 衡量智能体能否检查并编辑真实多工作表文件，完成建模、调试和可视化，同时保留所有未要求修改的内容。",
    },
    distribution: {
      en: "Version 2 contains 321 tasks across three tracks: financial modeling and template completion, formula/debugging work over ten error types, and chart or visual production. A workbook averages 11.8 sheets and roughly 594 target cell edits; some modeling tasks exceed 1,000.",
      zh: "第二版包含 321 项任务，分为财务建模与模板补全、覆盖十类错误的公式调试，以及图表或视觉制作三条赛道。工作簿平均有 11.8 个表和约 594 个目标单元格修改，部分建模题超过 1,000 个。",
    },
    difficulty: {
      en: "The workbook is both input and program. Agents must infer structure, preserve formulas and formatting, choose the right cells, and leave a coherent recalculating artifact—not just report values in chat.",
      zh: "工作簿既是输入也是程序。智能体要推断结构、保留公式和格式、选择正确单元格，并留下可重新计算的一致成果，而不是只在聊天中报告数值。",
    },
    time: {
      en: "The release does not give one human-time figure, but edit volume makes these sustained tasks. Runtime is strongly affected by whether the agent has native spreadsheet operations, visual control, or slow cell-by-cell interaction.",
      zh: "发布材料未给出统一人工耗时，但修改规模说明它们是持续性任务。运行时间强烈取决于智能体是否具有原生表格操作、视觉控制，还是只能逐单元格缓慢交互。",
    },
    failureModes: {
      en: ["Inspecting too little of the workbook before choosing a plan", "Writing a correct formula into the wrong target cells or disturbing untouched cells", "Repairing visible values while leaving broken dependencies, formats, or charts"],
      zh: ["制定方案前检查工作簿不足", "公式正确却写入错误目标单元格，或破坏未要求修改的单元格", "只修复可见数值，却留下损坏的依赖、格式或图表"],
    },
    interpretation: {
      en: "Overall task accuracy is exacting: all required cells must be right and unchanged regions must stay unchanged. Track the three task families separately, and note that visualization uses a different, vision-based evaluation from cell-level formula checks.",
      zh: "整体任务准确率非常严格：所有目标单元格必须正确，未改区域也必须保持不变。应分别看三类任务，并注意可视化使用的视觉评测不同于单元格公式检查。",
    },
    sourceUrls: ["https://arxiv.org/abs/2606.29955", "https://spreadsheetbench.github.io/"],
  },
  "swe-bench-pro": {
    orientation: {
      en: "SWE-bench Pro tests whether an agent can resolve substantial, real-world software issues in active repositories rather than small, isolated coding exercises.",
      zh: "SWE-bench Pro 测试智能体能否解决活跃仓库中的大型真实软件问题，而非小型孤立编程练习。",
    },
    distribution: {
      en: "The open set contains 1,865 problems from 41 repositories, with strong representation from business software, developer tools, and B2B systems. Reference fixes are often multi-file and substantially larger than classic SWE-bench patches.",
      zh: "开放集合包含 1,865 个问题，来自 41 个仓库，其中商业软件、开发工具和 B2B 系统占比较高。参考修复常跨多文件，规模也明显大于经典 SWE-bench 补丁。",
    },
    difficulty: {
      en: "Problems can require hours or days for a human engineer and demand repository navigation, reproduction, implementation, and regression testing. A localized plausible change is frequently incomplete at this scale.",
      zh: "问题可能需要人类工程师数小时或数天，并要求仓库导航、复现、实现和回归测试。在这种规模下，局部看似合理的修改往往并不完整。",
    },
    time: {
      en: "The benchmark characterizes human effort in hours to days rather than enforcing one universal model runtime. Agent results should therefore include their wall-clock, token, and retry budgets; extending time does not help if context has already been lost.",
      zh: "基准把人工工作量描述为数小时至数天，而没有统一模型运行时限。因此智能体结果应注明墙钟、token 和重试预算；若上下文已丢失，单纯延长时间也无济于事。",
    },
    failureModes: {
      en: ["Implementing a partial fix that misses secondary files or edge cases", "Misusing tools, editing the wrong file, or introducing syntax and build errors", "Flooding the context with command output and losing the issue’s constraints"],
      zh: ["只完成部分修复，漏掉次要文件或边界情况", "误用工具、编辑错误文件，或引入语法和构建错误", "命令输出淹没上下文，导致忘记 issue 约束"],
    },
    interpretation: {
      en: "A pass means the submitted patch satisfies the benchmark verifier, not necessarily that maintainers would merge it. Audit findings show why verifier quality matters, so use the exact dataset revision and avoid treating passing patches as a complete code-quality judgment.",
      zh: "通过意味着提交补丁满足基准验证器，不必然代表维护者愿意合并。审计结果说明验证器质量很重要，因此应使用确切数据版本，且不要把通过补丁等同于完整代码质量判断。",
    },
    sourceUrls: ["https://arxiv.org/abs/2509.16941", "https://github.com/scaleapi/SWE-bench_Pro-os"],
  },
  "swe-marathon": {
    orientation: {
      en: "SWE-Marathon pushes coding agents from patching toward building: each task asks for a substantial library, product clone, ML system, or algorithmic implementation from an empty or minimal starting point.",
      zh: "SWE-Marathon 把编程智能体从打补丁推向完整构建：每项任务要求从空白或极简起点实现大型库、产品克隆、机器学习系统或算法项目。",
    },
    distribution: {
      en: "The benchmark has 20 tasks: eight library clones, five product clones, five machine-learning engineering projects, and two algorithmic systems. It is intentionally small because each item is extremely large and expensive to run.",
      zh: "基准有 20 项任务：八个库克隆、五个产品克隆、五个机器学习工程项目和两个算法系统。数量刻意较小，因为每题规模和运行成本都很高。",
    },
    difficulty: {
      en: "Experts estimate 40–400 hours of human work per task, while agents must compress that effort into a bounded run. Architecture, breadth, iterative testing, and resistance to shortcuts all matter; a partially functioning scaffold is far from completion.",
      zh: "专家估计每项任务需 40–400 小时人工工作，而智能体必须在有限运行中压缩这些工作。架构、覆盖广度、迭代测试和抵抗捷径都很重要；仅有部分功能的脚手架远未完成。",
    },
    time: {
      en: "Agent budgets range from two to ten hours depending on the task. Timeouts are a major failure mode, but duplicate work and poor prioritization often consume the budget before the implementation reaches a verifiable state.",
      zh: "根据任务不同，智能体预算为两到十小时。超时是主要失败模式，但重复劳动和优先级不佳常会在成果可验证前耗尽预算。",
    },
    failureModes: {
      en: ["Running out of time after duplicate or low-value implementation work", "Trying to reward-hack the evaluator instead of completing the system", "Stopping early or performing weak self-verification despite clear validation failures"],
      zh: ["重复或低价值实现工作耗尽时间", "试图投机评测器，而非完成系统", "尽管验证明显失败，仍过早停止或自我验证不足"],
    },
    interpretation: {
      en: "With only twenty heterogeneous tasks, report per-task outcomes and budgets alongside any average. Partial scores describe engineering progress, while full completion is rare; small aggregate differences should not be over-generalized.",
      zh: "由于只有二十项高度异质任务，应在平均分旁报告逐题结果和预算。部分得分反映工程进展，而完整完成很少见；不应过度泛化小幅总分差异。",
    },
    sourceUrls: ["https://arxiv.org/abs/2606.07682", "https://github.com/abundant-ai/swe-marathon"],
  },
  frontiercode: {
    orientation: {
      en: "FrontierCode asks a stricter question than ‘do the tests pass?’: would an experienced maintainer consider the agent’s patch safe, well-scoped, tested, idiomatic, and ready to merge?",
      zh: "FrontierCode 提出比‘测试是否通过’更严格的问题：经验丰富的维护者是否会认为智能体补丁安全、范围合适、测试充分、符合惯例并可直接合并？",
    },
    distribution: {
      en: "The private benchmark contains 150 maintainer-authored tasks from 36 major open-source repositories. Current v1.1 reports Main and Extended; the initial release also used a nested 50-task Diamond slice. Prompts are concise and draw from multi-PR chains and free-form maintainer requests.",
      zh: "私有基准包含来自 36 个主要开源仓库的 150 项维护者原创任务。当前 v1.1 报告 Main 与 Extended，首版还使用嵌套的 50 项 Diamond 切片。提示简洁，来源包括多 PR 链和维护者自由需求。",
    },
    difficulty: {
      en: "A functionally correct patch can still fail for regression risk, weak tests, excessive scope, style, or poor design. Blocker criteria must all pass before weighted quality credit counts, so one subtle maintainability issue can zero the solution.",
      zh: "功能正确的补丁仍可能因回归风险、测试薄弱、范围过大、风格或设计不佳而失败。所有阻断条件通过后加权质量分才生效，因此一个细微可维护性问题就可能使结果归零。",
    },
    time: {
      en: "Maintainers spent more than forty hours authoring and calibrating each task. The benchmark reports repeated agent runs, token use, and cost rather than a universal task timeout; efficiency can differ sharply even when quality scores are close.",
      zh: "维护者为每项任务投入超过四十小时进行编写和校准。基准报告重复运行、token 和成本，而非统一任务时限；即使质量分相近，效率也可能差异显著。",
    },
    failureModes: {
      en: ["Solving observable behavior while violating a maintainability or scope blocker", "Writing tests that pass on both the fixed and original broken code", "Implementing every call site superficially but missing the codebase’s intended abstraction"],
      zh: ["解决了可见行为，却违反可维护性或范围阻断条件", "所写测试在修复后与原始错误代码上都能通过", "表面修改了所有调用点，却没有遵循代码库期望的抽象"],
    },
    interpretation: {
      en: "Keep pass rate distinct from the weighted score: failing any blocker yields zero score even if several qualities are present. The private set improves contamination resistance but limits external audit, and version-specific subsets must be named when comparing results.",
      zh: "通过率与加权分应分开看：任一阻断条件失败都会归零，即使其他质量尚可。私有集合提高抗污染性但限制外部审计，比较结果时必须注明具体版本和子集。",
    },
    sourceUrls: ["https://cognition.ai/blog/frontier-code-1.1", "https://cognition.ai/blog/frontier-code"],
  },
  "mmmu-pro": {
    orientation: {
      en: "MMMU-Pro tests college-level multimodal understanding while removing shortcuts that let a model answer from the wording alone or guess among a small set of options.",
      zh: "MMMU-Pro 测试大学级多模态理解，并移除仅凭文字线索或少量选项猜测答案的捷径。",
    },
    distribution: {
      en: "It contains 1,730 underlying questions balanced across 30 subjects, each available in a standard image-and-text form and a vision-only screenshot or photo form, for 3,460 instances. Questions use diagrams, charts, maps, structures, and other academic visuals.",
      zh: "它有 1,730 道底层问题，均衡覆盖 30 个学科；每题同时提供标准图文形式和纯视觉截图或照片形式，共 3,460 个实例。题目使用图示、图表、地图、结构图等学术视觉材料。",
    },
    difficulty: {
      en: "Text-only-solvable items were filtered out and options were expanded from four to as many as ten. In the vision setting, even the question and choices are pixels, so the model must read, ground, and reason without relying on a clean text channel.",
      zh: "可被纯文本模型解决的题目被过滤，选项从四个扩展到最多十个。纯视觉设置中连问题和选项都是像素，模型必须完成读取、视觉落地和推理，不能依赖干净文本通道。",
    },
    time: {
      en: "This is an item-level evaluation and does not define a meaningful agent wall-clock budget. The paper approximates expert performance from the original MMMU study rather than running a new timed human study.",
      zh: "这是逐题评测，没有有意义的智能体墙钟预算。论文根据原始 MMMU 人类研究估算专家表现，而没有重新进行限时人工研究。",
    },
    failureModes: {
      en: ["Answering from linguistic priors while failing to use the image", "Reading text correctly but missing its spatial relation to a diagram or chart", "Using chain-of-thought that drifts from the required response format or amplifies a mistaken visual read"],
      zh: ["依赖语言先验作答，却没有真正使用图像", "读对了文字，却漏掉它与图示或图表的空间关系", "思维链偏离要求的输出格式，或放大错误视觉读取"],
    },
    interpretation: {
      en: "The official overall score averages the ten-option standard and vision-only settings. Do not mix it with original MMMU accuracy: the filtering, expanded choices, and pixel-only presentation intentionally define a harder distribution.",
      zh: "官方总分平均十选项标准设置和纯视觉设置。不能与原始 MMMU 准确率混用，因为筛选、扩展选项和纯像素呈现刻意定义了更难的分布。",
    },
    sourceUrls: ["https://arxiv.org/abs/2409.02813", "https://github.com/MMMU-Benchmark/MMMU"],
  },
  babyvision: {
    orientation: {
      en: "BabyVision probes foundational visual abilities that young children acquire before specialist knowledge: noticing fine differences, following paths, imagining space, and inducing visual patterns.",
      zh: "BabyVision 探测儿童在专业知识之前就会获得的基础视觉能力：辨别细微差异、追踪路径、空间想象和归纳视觉模式。",
    },
    distribution: {
      en: "The benchmark has 388 questions across four categories and 22 subtypes: fine-grained discrimination, visual tracking, spatial perception, and visual pattern recognition. A 20-item Mini set supports comparison with children aged three to twelve.",
      zh: "基准有 388 道题，覆盖四类 22 个子类型：细粒度辨别、视觉追踪、空间感知和视觉模式识别。20 题 Mini 集用于与 3–12 岁儿童比较。",
    },
    difficulty: {
      en: "The images often resist useful verbal description. Models that excel at expert-level language tasks can lose precise contours, switch tracks at intersections, invent hidden 3-D structure, or confuse surface style with the governing rule.",
      zh: "这些图像常难以用语言有效描述。擅长专家级语言任务的模型仍可能丢失精确轮廓、在交叉处换线、虚构隐藏三维结构，或把表面风格误当成主导规则。",
    },
    time: {
      en: "Children receive one 45-minute class period for the 20-item Mini set; adult participants completed the full 388-item benchmark, but no standard agent runtime is defined. It is a perception test, not a long-running workflow.",
      zh: "儿童在一节 45 分钟课程内完成 20 题 Mini 集；成人参与者完成全部 388 题，但没有统一智能体运行时限。它是感知测试，而非长时流程。",
    },
    failureModes: {
      en: ["Compressing fine geometry into a coarse verbal description and losing the decisive detail", "Switching from one continuous line to another at an intersection", "Hallucinating a 3-D projection or following color and style instead of the abstract transformation"],
      zh: ["把精细几何压缩成粗略语言描述，丢掉决定性细节", "在交叉点从一条连续线切换到另一条", "幻觉出三维投影，或跟随颜色风格而非抽象变换"],
    },
    interpretation: {
      en: "A low score is not evidence of weak factual knowledge; that separation is the point. Compare category profiles, especially visual tracking, and keep language-output and image-generation variants distinct.",
      zh: "低分并不代表事实知识不足；将二者分离正是该基准目的。应比较各类别画像，尤其是视觉追踪，并区分语言输出与图像生成变体。",
    },
    sourceUrls: ["https://arxiv.org/abs/2601.06521", "https://github.com/UniPat-AI/BabyVision"],
  },
  charxiv: {
    orientation: {
      en: "CharXiv evaluates whether a multimodal model can read the complex, compositional charts that appear in real scientific papers, not simplified synthetic plots.",
      zh: "CharXiv 评测多模态模型能否读取真实科学论文中的复杂组合图表，而不是简化的合成图。",
    },
    distribution: {
      en: "It uses 2,323 charts handpicked from arXiv papers in eight subjects. Each chart has four templated descriptive questions and one unique reasoning question, totaling more than 11,000 questions across multi-panel and mixed chart styles.",
      zh: "它使用从八个学科 arXiv 论文中人工筛选的 2,323 张图表。每张图配四道模板描述题和一道独特推理题，总计超过 11,000 道，涵盖多面板和混合图表。",
    },
    difficulty: {
      en: "Scientific figures combine dense legends, small labels, multiple panels, and unfamiliar visual encodings. Models must first extract accurately, then connect visual elements and reason; common chart benchmarks can look saturated while performance collapses under this realism.",
      zh: "科学图表结合密集图例、小标签、多面板和陌生视觉编码。模型必须先准确提取，再连接视觉元素并推理；常见图表基准看似饱和，但在这种真实度下表现会大幅下降。",
    },
    time: {
      en: "No standard model wall-clock is defined. Human accuracy was about 92% on descriptive questions and 81% on reasoning questions, reminding readers that even careful people and automated graders are not perfect on this material.",
      zh: "没有统一模型墙钟时限。人工在描述题上约 92%，在推理题上约 81%，提醒读者即使认真作答的人类和自动评分器也并非完全可靠。",
    },
    failureModes: {
      en: ["Reading the wrong subplot, legend entry, axis, or small label", "Extracting local values correctly but failing to compose them across panels", "Exploiting textual or answer priors that break when the chart or wording changes"],
      zh: ["读错子图、图例项、坐标轴或小标签", "局部数值提取正确，却无法跨面板组合", "依赖文字或答案先验，一旦图表或措辞改变就失效"],
    },
    interpretation: {
      en: "Separate descriptive extraction from reasoning scores. The test answers are private while validation is public, and the benchmark measures chart understanding rather than the advanced scientific knowledge behind every paper.",
      zh: "应分开报告描述提取和推理分数。测试答案私有、验证集公开；该基准衡量图表理解，而不是掌握每篇论文背后的高级科学知识。",
    },
    sourceUrls: ["https://arxiv.org/abs/2406.18521", "https://github.com/princeton-nlp/CharXiv"],
  },
  chartography: {
    orientation: {
      en: "Chartography tests whether a model can read charts the way professionals use them in engineering, medicine, finance, and other decision-making settings.",
      zh: "Chartography 测试模型能否按照工程、医疗、金融等决策场景中的专业方式读取图表。",
    },
    distribution: {
      en: "The release contains 100 expert-authored tasks, independently verified three times and screened so that at least one frontier model failed each item. Charts include niche formats, formulas, conventions, and expert-calibrated acceptable ranges.",
      zh: "发布集合包含 100 项专家编写任务，每项经三次独立验证，并筛选到至少有一个前沿模型失败。图表包含冷门格式、公式、领域惯例和专家校准的可接受范围。",
    },
    difficulty: {
      en: "Models often know what a chart means yet cannot anchor the decisive number to the correct mark or axis location. Domain conventions—when to interpolate, clamp, combine, or read a projection—make a superficially simple lookup consequential.",
      zh: "模型常知道图表表达什么，却无法把决定性数值精确落到正确标记或轴位置。何时插值、取边界、组合或读取投影等领域惯例，会让表面简单的查值变得关键。",
    },
    time: {
      en: "No universal human or agent time is specified; evaluation is run without tools in the headline setting. The meaningful workload is careful visual reading and calculation, not a long interactive trajectory.",
      zh: "发布方未指定统一人工或智能体耗时；主结果在无工具设置下评测。真正的工作量来自细致视觉读取和计算，而非长交互轨迹。",
    },
    failureModes: {
      en: ["Choosing the correct curve but misreading one value or tick", "Rounding an intermediate value before the requested precision", "Applying an invented formula, extrapolating outside the chart, or missing a domain convention"],
      zh: ["选对曲线，却读错一个数值或刻度", "在达到要求精度前就对中间值舍入", "使用虚构公式、超出图表范围外推，或漏掉领域惯例"],
    },
    interpretation: {
      en: "The all-parts binary grading and per-item ranges reward decision-grade accuracy. A strong score on easier academic chart QA does not imply readiness here; tool-augmented results should be reported separately from the no-tools protocol.",
      zh: "全组成二元评分和逐题范围奖励决策级准确性。在较简单学术图表问答上的高分并不代表已能胜任；工具增强结果应与无工具协议分开报告。",
    },
    sourceUrls: ["https://arxiv.org/abs/2608.10677", "https://surgehq.ai/blog/chartography"],
  },
  omnidocbench: {
    orientation: {
      en: "OmniDocBench evaluates document parsing: turning a visually rich PDF page into correctly ordered, structured text, tables, formulas, and layout elements.",
      zh: "OmniDocBench 评测文档解析：把视觉丰富的 PDF 页面转化为顺序正确、结构化的文本、表格、公式和布局元素。",
    },
    distribution: {
      en: "The current v1.7 line has 1,651 pages across ten document types, five layout types, and five language types, including academic papers, financial reports, newspapers, textbooks, and handwritten notes. The original paper described a 981-page, nine-type set; v1.5 and v1.6 expanded it.",
      zh: "当前 v1.7 系列有 1,651 页，覆盖十类文档、五类布局和五类语言，包括学术论文、财报、报纸、教材和手写笔记。原论文描述的是 981 页、九类文档的集合，后由 v1.5 和 v1.6 扩展。",
    },
    difficulty: {
      en: "Parsing is not just OCR. The current annotations distinguish 28 block-level and four span-level element types, preserve reading order and relationships, and represent formulas and merged-cell tables in formats that can be compared across valid serializations.",
      zh: "解析不只是 OCR。当前标注区分 28 类块级和四类 span 级元素，保留阅读顺序与关系，并以可比较不同有效序列化的格式表示公式和合并单元格表格。",
    },
    time: {
      en: "The paper evaluates page parsing quality rather than human task duration. Pipeline systems can be fast through specialized modules, while end-to-end vision models trade simplicity and generality against output length and recognition consistency.",
      zh: "论文评测逐页解析质量，而非人工任务时长。流水线系统可依靠专用模块实现高速度；端到端视觉模型则在简洁与通用性、输出长度和识别一致性之间权衡。",
    },
    failureModes: {
      en: ["Recognizing text but placing blocks in the wrong reading order", "Flattening or corrupting merged cells, formulas, captions, or cross-page relationships", "Degrading sharply on handwriting, newspapers, rotated text, blur, or complex backgrounds"],
      zh: ["识别出文字，却按错误阅读顺序排列区块", "压平或破坏合并单元格、公式、标题或跨页关系", "在手写、报纸、旋转文字、模糊或复杂背景上明显退化"],
    },
    interpretation: {
      en: "Lower edit distance and higher structure-specific metrics describe different parts of quality; no single number explains a parser. Compare document types and element classes, and distinguish end-to-end extraction from isolated OCR or table recognition.",
      zh: "更低编辑距离和更高结构专属指标描述不同质量维度，单一数字无法概括解析器。应按文档类型和元素类别比较，并区分端到端提取与孤立 OCR 或表格识别。",
    },
    sourceUrls: ["https://arxiv.org/abs/2412.07626", "https://github.com/opendatalab/OmniDocBench"],
  },
  zerobench: {
    orientation: {
      en: "ZeroBench is a small, deliberately extreme visual-reasoning set built from questions that contemporary multimodal models could not solve at release.",
      zh: "ZeroBench 是一个规模小但刻意极难的视觉推理集合，题目在发布时均无法被当代多模态模型解决。",
    },
    distribution: {
      en: "Version 2 retains 100 handcrafted main questions and 334 intermediate subquestions, with 70 natural and 30 synthetic images; most use one image and seven use multiple. More than twenty creators contributed across open-ended domains.",
      zh: "第二版保留 100 道手工主问题和 334 道中间子问题，其中 70 张自然图、30 张合成图；多数使用单图，七题使用多图。二十多位创作者贡献了开放领域题目。",
    },
    difficulty: {
      en: "Items require an essential visual component, several reasoning steps, and a broad answer space. Candidate questions were adversarially filtered so that any solved by the release models were removed; later community review corrected answerability issues in 23% of main questions.",
      zh: "题目必须依赖关键视觉信息、多步推理和宽答案空间。候选题经对抗筛选，发布模型能答对的均被移除；后续社区审查又修正了 23% 主问题的可答性问题。",
    },
    time: {
      en: "This is not a long-horizon agent benchmark and publishes no standard human time. Multiple samples matter: the paper follows both single-attempt and stricter or best-of-several behavior because occasional success is not the same as reliability.",
      zh: "它不是长流程智能体基准，也未发布统一人工耗时。多次采样很重要：论文同时跟踪单次、严格多次和多次取优表现，因为偶然成功不等于可靠。",
    },
    failureModes: {
      en: ["Spatial miscounting, line tracking, or reading a familiar object such as an analog clock", "Extracting one intermediate visual fact incorrectly and carrying it through a long derivation", "Making an ungrounded inference when the image does not support the assumed structure"],
      zh: ["空间计数、线条追踪或读取模拟时钟等常见物体出错", "某个中间视觉事实提取错误并传播到长推导", "图像不支持所假定结构时仍进行无根据推断"],
    },
    interpretation: {
      en: "The set is intentionally anchored to a moving frontier and is too small for broad domain claims. Report the exact version and sampling statistic; subquestions are diagnostic partial-credit signals, while main-question pass rates remain the headline challenge.",
      zh: "该集合刻意锚定不断移动的能力前沿，规模也不足以支持宽泛领域结论。应注明确切版本和采样统计；子问题提供诊断性部分得分，主问题通过率才是核心挑战。",
    },
    sourceUrls: ["https://arxiv.org/abs/2502.09696", "https://github.com/jonathan-roberts1/zerobench"],
  },
  cybergym: {
    orientation: {
      en: "CyberGym tests whether an agent can reproduce a real, known memory-safety vulnerability by generating a proof-of-concept input for the affected C or C++ codebase.",
      zh: "CyberGym 测试智能体能否为受影响的 C/C++ 代码库生成概念验证输入，从而复现真实已知的内存安全漏洞。",
    },
    distribution: {
      en: "The benchmark scales to 1,507 historical vulnerabilities across 188 open-source projects, sourced from OSS-Fuzz and packaged in reproducible environments. Tasks provide a vulnerability description and repository, while sanitizers serve as the success oracle.",
      zh: "基准扩展到 188 个开源项目中的 1,507 个历史漏洞，来源于 OSS-Fuzz，并打包为可复现环境。任务提供漏洞描述和仓库，使用 sanitizer 作为成功判定。",
    },
    difficulty: {
      en: "An agent must reason from an entry point through repository-wide parsing and control flow until it reaches the vulnerable state. Longer proof-of-concept inputs and more execution steps sharply reduce success; top initial systems solved only about one fifth.",
      zh: "智能体要从入口沿整个仓库的解析与控制流推理，直到触发漏洞状态。概念验证输入越长、执行步骤越多，成功率越低；初始最强系统也只解决约五分之一。",
    },
    time: {
      en: "The publication emphasizes execution-step and PoC-length difficulty rather than one human or agent time limit. Runtime comparisons should include the agent framework and fuzzing or analysis tools available.",
      zh: "论文强调执行步骤和 PoC 长度带来的难度，而非统一人工或智能体时限。运行时间比较应说明智能体框架以及可用的模糊测试或分析工具。",
    },
    failureModes: {
      en: ["Trying many near-identical inputs without developing a deeper code-path model", "Dumping very long outputs or literal payloads until the context is exhausted", "Giving up or incorrectly declaring success without a sanitizer-confirmed trigger"],
      zh: ["反复尝试近似输入，却没有建立更深的代码路径模型", "输出超长日志或字面 payload，直到耗尽上下文", "没有 sanitizer 确认触发就放弃或错误宣告成功"],
    },
    interpretation: {
      en: "A pass shows vulnerability reproduction, not full exploitation or arbitrary code execution. That distinction is central: CyberGym is a security-analysis benchmark, and higher scores are a capability signal with dual-use implications—not a general measure of model quality or safety.",
      zh: "通过只表示漏洞复现，不代表完整利用或任意代码执行。这一区分非常关键：CyberGym 是安全分析基准，高分是具有双用途含义的能力信号，而非模型整体质量或安全性的通用指标。",
    },
    sourceUrls: ["https://arxiv.org/abs/2506.02548", "https://github.com/sunblaze-ucb/cybergym"],
  },
  exploitbench: {
    orientation: {
      en: "ExploitBench measures how far an agent can progress from a known V8 vulnerability and its patch toward a real exploit, instead of collapsing the entire process into a crash/no-crash score.",
      zh: "ExploitBench 衡量智能体从已知 V8 漏洞及其补丁出发，能沿真实利用链推进多远，而不是把整个过程简化为是否崩溃。",
    },
    distribution: {
      en: "The benchmark covers 41 N-day bugs in the hardened V8 JavaScript and WebAssembly engine. Deterministic flags mark a capability ladder from code-path coverage and triggering through engine primitives, sandbox escape, program-counter control, and arbitrary code execution.",
      zh: "基准覆盖加固版 V8 JavaScript/WebAssembly 引擎中的 41 个 N-day 漏洞。确定性标志构成能力阶梯，从代码路径覆盖和触发，一直到引擎原语、沙箱逃逸、程序计数器控制和任意代码执行。",
    },
    difficulty: {
      en: "Triggering a bug is much easier than weaponizing it. Public models often reach the patched code and sometimes build engine-local primitives, but generally stall before constructing the reusable memory primitives needed to cross the V8 heap sandbox.",
      zh: "触发漏洞远比武器化容易。公开模型通常能到达补丁代码，有时也能构建引擎局部原语，但往往在建立跨越 V8 堆沙箱所需的通用内存原语前停滞。",
    },
    time: {
      en: "Each run has 300 turns and is repeated across seeds. Failed public-model episodes stopped with widely varying budget remaining, so the observed boundary looked more like a reasoning-shape limit than a simple timeout.",
      zh: "每次运行最多 300 回合，并跨随机种子重复。公开模型失败回合停止时剩余预算差异很大，因此观察到的边界更像推理结构限制，而不只是超时。",
    },
    failureModes: {
      en: ["Equating a sanitizer crash with a complete exploit chain", "Building an engine-local primitive but failing to generalize it beyond the sandbox", "Missing JIT wrong-code behavior because ordinary crash or sanitizer signals stay silent"],
      zh: ["把 sanitizer 崩溃误当成完整利用链", "构建了引擎局部原语，却无法泛化到沙箱之外", "普通崩溃或 sanitizer 无信号时漏掉 JIT 错误代码行为"],
    },
    interpretation: {
      en: "Read the full ladder, not only top-tier success. Model, runner, coaching, native CLI, seeds, and sandbox configuration all affect reach; higher exploit capability is security-relevant and should not be described as general model improvement.",
      zh: "应查看完整能力阶梯，而不只看最高层成功。模型、运行器、教练提示、原生 CLI、随机种子和沙箱配置都会影响推进程度；更强利用能力具有安全含义，不应表述为通用模型进步。",
    },
    sourceUrls: ["https://arxiv.org/abs/2605.14153", "https://github.com/exploitbench/exploitbench"],
  },
  exploitgym: {
    orientation: {
      en: "ExploitGym tests autonomous end-to-end exploit generation: an agent must use a specified real vulnerability to obtain unauthorized code execution and retrieve a protected flag.",
      zh: "ExploitGym 测试自主端到端漏洞利用生成：智能体必须使用指定真实漏洞获得未授权代码执行，并取得受保护标志。",
    },
    distribution: {
      en: "Its 898 reproducible instances span 520 userspace targets from 161 projects, 185 V8 bugs, and 193 Linux-kernel bugs. Each can be evaluated with or without standard security defenses, exposing a clear difficulty gradient.",
      zh: "898 个可复现实例包括 161 个项目中的 520 个用户态目标、185 个 V8 漏洞和 193 个 Linux 内核漏洞。每项均可在启用或关闭标准安全防护时评测，形成清晰难度梯度。",
    },
    difficulty: {
      en: "Success requires turning vulnerability understanding into stable primitives under ASLR, sandboxes, heap noise, race conditions, and limited debugging. Kernel tasks are particularly discriminating; an agent may also find an easier unintended flaw, which the benchmark audits separately.",
      zh: "成功需要在 ASLR、沙箱、堆噪声、竞态条件和受限调试下，把漏洞理解转化为稳定原语。内核任务尤其有区分度；智能体也可能找到更容易的非目标漏洞，基准会另行审计。",
    },
    time: {
      en: "The default timeout is two hours per instance. In a six-hour study, one strong agent kept gaining successes beyond two hours while another plateaued within about thirty minutes, showing that more time helps only systems able to sustain coherent refinement.",
      zh: "默认每实例时限为两小时。在六小时研究中，一个强系统在两小时后仍持续增加成功数，另一个约三十分钟就进入平台，说明更多时间只对能持续进行一致改进的系统有用。",
    },
    failureModes: {
      en: ["Reaching a crash but failing to build reliable code-execution primitives", "Timing out during iterative exploit refinement or constrained kernel debugging", "Retrieving the flag through a different vulnerability, creating a capability signal but not a valid target-vulnerability success"],
      zh: ["触发崩溃，却无法建立可靠代码执行原语", "在迭代利用改进或受限内核调试中超时", "通过其他漏洞取得标志，虽显示能力但不算目标漏洞成功"],
    },
    interpretation: {
      en: "Use target-aligned success rather than flag retrieval alone, and break results out by userspace, browser, kernel, and defense setting. This is a dual-use risk/capability evaluation; a higher score is not evidence that a model is broadly safer or better.",
      zh: "应使用与目标漏洞对齐的成功率，而不只看标志获取，并按用户态、浏览器、内核和防护设置拆分结果。这是双用途风险与能力评测；高分不代表模型整体更安全或更好。",
    },
    sourceUrls: ["https://arxiv.org/abs/2605.11086", "https://github.com/sunblaze-ucb/exploitgym"],
  },
};
