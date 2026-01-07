export type LearningMaterialType = "pdf" | "exercise" | "video" | "image";

export type TaskType = "flashcard" | "exercise" | "video";

export type MaterialScreenshot = {
  id: string;
  createdAt: number;
  pageNumber?: number;
  dataUrl: string; // data:image/...;base64,...
};

// =========================
// V1 内容结构：Resource -> ContentBlock -> LearningUnit -> StudyPlan
// =========================

export type ResourceSource = "community" | "upload";

export type Resource = {
  id: string;
  title: string;
  source: ResourceSource;
  fileName?: string;
  mimeType?: string;
  materialType: LearningMaterialType;
  createdAt: number;
  notes?: string; // 用户补充说明（年级/科目/目标等）
  ossUrl?: string; // 永久保存的 OSS 地址
};

export type ContentBlockType =
  | "concept"
  | "definition"
  | "example"
  | "exercise"
  | "question"
  | "explanation"
  | "explanation_clip"
  | "vocabulary"
  | "other";

export type ContentBlock = {
  id: string;
  resourceId: string;
  type: ContentBlockType;
  title: string;
  summary?: string;
  topic?: string; // 章节/知识点归属，用于编排
  difficulty?: 1 | 2 | 3 | 4 | 5;
  // 文档定位
  pageStart?: number;
  pageEnd?: number;
  // 视频定位
  timeStartSec?: number;
  timeEndSec?: number;
  // 扩展字段：用于后续更多适配/分析
  tags?: string[];
};

export type LearningUnitKind =
  | "memory" // 词语/字词 - 精准记忆
  | "discrimination" // 多音字/易混词 - 辨析
  | "semantic" // 近反义词 - 语义理解
  | "collocation" // 词语搭配 - 语感
  | "expression" // 句子仿写 - 表达迁移
  | "comprehension" // 课文理解 - 结构化理解
  | "quiz" // 综合测试
  | "review"; // 复习任务

export type LearningUnit = {
  id: string;
  title: string;
  status: "todo" | "done";
  // type 仍用于现有 UI/计划消费（3 种）
  type?: TaskType;
  // kind 对齐你提出的 6 种学习单元（可扩展）
  kind?: LearningUnitKind;
  // 溯源：一个 unit 可由多个 blocks 生成
  sourceBlockIds?: string[];
  cognitiveGoal?: string; // 认知目标：记忆/理解/应用/检测/复习等
  presentation?: "text" | "video" | "mixed"; // 展现形态（V1 仅做标注）
  pageNumber?: number; // PDF 对应的页码
  summary?: string;
  keyPoints?: string[];
  // 可选：为闪卡/题目提供结构化内容（V1 可为空）
  payload?: Record<string, unknown>;
};

export type LearningMaterial = {
  id: string;
  title: string;
  type: LearningMaterialType;
  totalUnits: number;
  units: LearningUnit[];
  // V1 新增：保存结构块，便于调试与后续加工
  resource?: Resource;
  blocks?: ContentBlock[];
  // 本地文件（仅用于前端预览/截图；不会上传到后端）
  localFileUrl?: string;
  // PDF 截图（用于 AI 多模态理解，可选）
  screenshots?: MaterialScreenshot[];
  // 解析状态
  status?: 'parsing' | 'ready';
  parsingProgress?: number;
};

export type StudyDay = {
  dayIndex: number;
  date?: string; // ISO 格式日期 YYYY-MM-DD
  units: (LearningUnit & { materialId?: string })[];
};

export type StudyPlan = {
  id: string;
  title: string;
  materialIds: string[];
  days: StudyDay[];
  createdAt: number;
};

