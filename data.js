window.SITE_DATA = {
  meta: {
    version: "2.4",
    updated: "2026-08-21",
    language: "zh-CN"
  },
  person: {
    name: "尹宜博",
    englishName: "YIN YIBO",
    initials: "YYB",
    role: "数据科学与大数据技术本科新生",
    location: "山东 · 济南",
    email: { user: "cglezzul", host: "gmail", tld: "com" },
    summary: "向下扎根，向上生长。"
  },
  education: {
    school: "山东管理学院",
    major: "数据科学与大数据技术",
    degree: "本科",
    period: "2026.09—2030.06（预计）",
    location: "山东 · 济南",
    status: "2026 级 · 准大一"
  },
  interests: [
    {
      id: "data-engineering",
      title: "数据工程 / 大数据开发",
      summary: "关注数据采集、清洗、存储、处理与数据平台等工程问题。",
      status: "候选主方向"
    },
    {
      id: "software-engineering",
      title: "软件工程 / Java 后端",
      summary: "在程序设计和数据库基础形成后，通过工程项目验证适配度。",
      status: "候选交叉方向"
    },
    {
      id: "data-analysis",
      title: "数据分析 / 机器学习",
      summary: "结合统计学、Python 与小型实践，了解数据分析和机器学习的实际工作内容。",
      status: "探索方向"
    }
  ],
  growth: [
    {
      id: "site-baseline",
      date: "2026-08-15",
      type: "项目实践",
      title: "完成个人网站首个公开版本",
      summary: "完成个人档案、成长记录、项目作品与证书展示等页面，并建立后续持续更新的内容结构。",
      evidence: "个人网站 v2.1",
      public: true
    }
  ],
  projectCategories: [
    { id: "vibe-coding", mark: "AI", title: "Vibe Coding", description: "使用 AI 协作完成的网站、原型与小型工具。", examples: ["个人网站", "交互原型", "实用工具"] },
    { id: "program-data", mark: "</>", title: "程序与数据", description: "可运行程序、数据处理、可视化与数据库实践。", examples: ["课程程序", "数据分析", "可视化"] },
    { id: "automation", mark: "FLOW", title: "自动化工具", description: "减少重复操作的脚本、工作流与信息处理工具。", examples: ["自动脚本", "工作流", "信息整理"] },
    { id: "coursework", mark: "LAB", title: "课程实践", description: "课程作业、实验记录与阶段性综合实践。", examples: ["课程作业", "实验报告", "综合实践"] },
    { id: "research-analysis", mark: "R", title: "调研与分析", description: "围绕真实问题形成的调研、比较与分析成果。", examples: ["调查报告", "案例分析", "数据报告"] },
    { id: "other", mark: "+", title: "其他作品", description: "无法归入以上类别、但能够展示过程与结果的作品。", examples: ["演示设计", "内容作品", "其他实践"] }
  ],
  projects: [
    {
      id: "campus-core-defense",
      category: "vibe-coding",
      title: "校园核心防线：YYB",
      status: "可运行 · v0.5.1",
      period: "2026.08—至今",
      role: "项目发起、玩法设计、试玩反馈与验收",
      summary: "2D 俯视角动作塔防游戏：驾驶可独立瞄准的防卫坦克，在开放校园战场中建造设施、抵御波次敌人并守护能源核心。",
      result: "与 Codex 协作完成玩法实现、测试和打包；当前形成 Web 构建与 Windows 便携版交付链路，并通过 47 项自动化测试。",
      stack: ["Phaser", "TypeScript", "Vite", "Vitest", "Electron", "Codex"],
      cover: "assets/projects/campus-core-defense.webp",
      coverAlt: "校园核心防线游戏准备阶段画面",
      github: "",
      demo: "https://cglezzul-blip.github.io/tank/",
      detail: false,
      featured: true,
      includeInResume: false,
      public: true
    }
  ],
  achievementCategories: [
    { id: "certificates", code: "01", title: "证书", english: "CERTIFICATES", description: "课程、技能与资格证明。", directory: "assets/certificates/", href: "certificates.html" },
    { id: "competitions", code: "02", title: "竞赛", english: "COMPETITIONS", description: "参赛经历、获奖结果与团队职责。", directory: "assets/competitions/" },
    { id: "research", code: "03", title: "科研", english: "RESEARCH", description: "实验室、课题、研究助理与阶段成果。", directory: "assets/research/" },
    { id: "papers", code: "04", title: "论文", english: "PAPERS", description: "论文、投稿、录用与公开发表记录。", directory: "assets/papers/" },
    { id: "honors", code: "05", title: "荣誉奖项", english: "HONORS", description: "奖学金、荣誉称号与非竞赛类表彰。", directory: "assets/honors/" }
  ],
  achievements: [
    {
      type: "certificates",
      title: "人工智能训练师（初级）培训课程认证",
      issuer: "达摩院-机器智能技术事业部",
      date: "2026.08.14",
      validUntil: "2027.08.14",
      image: "assets/certificates/ai-trainer-junior-2026.webp",
      alt: "尹宜博人工智能训练师（初级）培训课程认证证书",
      public: true
    }
  ],
  resume: {
    profile: "山东管理学院数据科学与大数据技术专业 2026 级本科新生。当前处于大学前的能力起步阶段，关注数据工程、大数据开发与软件工程方向，计划通过课程成绩、可运行程序、真实项目和实践经历逐步建立可验证能力。",
    currentCapabilities: [
      { title: "AI 辅助工具", text: "使用 ChatGPT、Codex 进行基础信息整理、问题拆解与学习辅助。" },
      { title: "英语基础", text: "高考英语 100 分；暂无大学英语四六级或其他标准化语言成绩。" },
      { title: "编程状态", text: "尚未完成首个可运行程序，暂无可验证的编程语言熟练度。" }
    ],
    experience: [],
    awards: []
  }
};
