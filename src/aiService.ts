import {
  ContentBlock,
  ContentBlockType,
  LearningMaterial,
  LearningMaterialType,
  MaterialScreenshot,
  LearningUnit,
  LearningUnitKind,
  Resource,
  TaskType,
} from "./types";
import { TosClient, ACLType } from '@volcengine/tos-sdk';

// 从环境变量读取配置（Vite 使用 import.meta.env）
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || '/api-ai/openai-compatible/v1/chat/completions';
const APP_ID = import.meta.env.VITE_APP_ID || '';
const APP_KEY = import.meta.env.VITE_APP_KEY || '';

// TOS 配置 - 从环境变量读取
const TOS_AK = import.meta.env.VITE_TOS_AK || '';
const TOS_SK = import.meta.env.VITE_TOS_SK || '';
const TOS_REGION = import.meta.env.VITE_TOS_REGION || 'cn-beijing';
const TOS_ENDPOINT = import.meta.env.VITE_TOS_ENDPOINT || 'tos-cn-beijing.volces.com';
const TOS_BUCKET = import.meta.env.VITE_TOS_BUCKET || '';

// 仅在有配置时初始化 TOS 客户端
const tosClient = TOS_AK && TOS_SK ? new TosClient({
  accessKeyId: TOS_AK,
  accessKeySecret: TOS_SK,
  region: TOS_REGION,
  endpoint: TOS_ENDPOINT,
}) : null;

async function uploadImageToTOS(dataUrl: string): Promise<string> {
  if (!tosClient) {
    console.warn('[TOS] TOS client not configured, returning data URL directly');
    return dataUrl; // 如果没有配置 TOS，直接返回 data URL
  }

  const [header, base64Data] = dataUrl.split(',');
  const mimeType = header.split(':')[1].split(';')[0];
  const binaryString = window.atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });

  const fileName = `screenshots/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  
  await tosClient.putObject({
    bucket: TOS_BUCKET,
    key: fileName,
    body: blob,
    acl: ACLType.ACLPublicRead, // 必须设置为公共读，大模型才能下载到图片
  });

  // 返回公网可访问的 URL
  return `https://${TOS_BUCKET}.${TOS_ENDPOINT}/${fileName}`;
}

export interface AIServiceConfig {
  appId: string;
  appKey: string;
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

function stripCodeFences(text: string): string {
  return text.replace(/```(?:json)?/g, "").trim();
}

function extractFirstJsonLike(text: string): string {
  const s = stripCodeFences(text);
  const firstObj = s.indexOf("{");
  const firstArr = s.indexOf("[");
  if (firstObj === -1 && firstArr === -1) return s;
  const start = firstArr !== -1 && (firstArr < firstObj || firstObj === -1) ? firstArr : firstObj;
  const endObj = s.lastIndexOf("}");
  const endArr = s.lastIndexOf("]");
  const end = endArr !== -1 && (endArr > endObj || endObj === -1) ? endArr : endObj;
  if (end === -1 || end <= start) return s.slice(start);
  return s.slice(start, end + 1);
}

function safeJsonParse<T>(text: string): T {
  console.log('[JSON Parse] Original text length:', text.length);
  
  // 先尝试最标准的解析
  try {
    const candidate = extractFirstJsonLike(text);
    return JSON.parse(candidate) as T;
  } catch (e) {
    console.warn('[JSON Parse] Initial parse failed, entering deep recovery mode...');
  }

  // 深度恢复模式：直接扫描所有 { } 块
  const objects: any[] = [];
  let stack = 0;
  let start = -1;
  
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (stack === 0) start = i;
      stack++;
    } else if (text[i] === '}') {
      stack--;
      if (stack === 0 && start !== -1) {
        const objStr = text.slice(start, i + 1);
        try {
          // 清洗掉对象内部可能存在的控制字符或乱码
          const cleaned = objStr.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
          objects.push(JSON.parse(cleaned));
        } catch (objErr) {
          console.warn('[JSON Parse] Failed to parse individual object, skipping:', objStr.slice(0, 50) + '...');
        }
        start = -1;
      }
    }
  }

  if (objects.length > 0) {
    console.log(`[JSON Parse] Successfully recovered ${objects.length} objects.`);
    return objects as unknown as T;
  }

  throw new Error('无法从 AI 响应中提取任何有效的 JSON 对象');
}

async function callAI(prompt: string, config?: AIServiceConfig): Promise<string> {
  const appId = config?.appId || APP_ID;
  const appKey = config?.appKey || APP_KEY;

  console.log('[AI Call] Starting AI call (pro-1.5 model)...');
  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${appId}:${appKey}`,
    },
    body: JSON.stringify({
      // 使用更稳定的 Pro 模型而非 Flash，减少格式错误
      model: "doubao-seed-1.6-flash", 
      messages: [
        { role: "system", content: "You are a helpful teacher. Output ONLY a valid JSON array of objects. No preamble, no conversational text." },
        { role: "user", content: prompt },
      ],
      extra_body: { reasoning_token: 0 },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`[AI Call] Error: ${response.status}`, text);
    throw new Error(`API 错误: ${response.status} ${text}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  console.log('[AI Call] Response content:', content);
  return content;
}

type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

async function callAIWithImages(prompt: string, screenshots: MaterialScreenshot[], config?: AIServiceConfig): Promise<string> {
  const appId = config?.appId || APP_ID;
  const appKey = config?.appKey || APP_KEY;

  console.log(`[AI Call] Starting vision AI call with ${screenshots.length} images...`);
  
  // 先将所有截图上传到 TOS
  console.log('[TOS] Uploading images...');
  const imageUrls = await Promise.all(
    screenshots.map(s => uploadImageToTOS(s.dataUrl))
  );
  console.log('[TOS] Upload complete. URLs:', imageUrls);

  // 根据用户示例调整结构：图片在前，文本在后
  const parts: ChatContentPart[] = [
    ...imageUrls.map(url => ({
      type: "image_url" as const,
      image_url: { url },
    })),
    { type: "text", text: prompt },
  ];

  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${appId}:${appKey}`,
    },
    body: JSON.stringify({
      // model: "doubao-seed-1.6-flash",
      model:"gemini-2.5-flash-preview",
      messages: [
        { role: "system", content: "You are a helpful assistant that outputs STRICT JSON only." },
        { role: "user", content: parts },
      ],
      reasoning_effort: "medium",
      extra_body: { reasoning_token: 0 },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`[AI Call] Error: ${response.status}`, text);
    throw new Error(`API 错误: ${response.status} ${text}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  console.log('[AI Call] Response content:', content);
  return content;
}

export function inferMaterialTypeFromFileName(fileName: string): LearningMaterialType {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.includes("视频")) return "video";
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp")) return "image";
  if (lower.includes("套卷") || lower.includes("试卷") || lower.includes("真题") || lower.includes("题集") || lower.includes("习题")) return "exercise";
  return "pdf";
}

function normalizeBlockType(t: string, materialType: LearningMaterialType): ContentBlockType {
  const v = (t || "").toLowerCase().trim();
  const map: Record<string, ContentBlockType> = {
    concept: "concept",
    definition: "definition",
    example: "example",
    exercise: "exercise",
    question: "question",
    explanation: "explanation",
    explanation_clip: "explanation_clip",
    vocabulary: "vocabulary",
    other: "other",
  };
  if (map[v]) return map[v];
  if (materialType === "exercise") return "question";
  return "other";
}

export async function extractContentBlocksWithAI(
  resource: Pick<Resource, "id" | "title" | "fileName" | "materialType" | "notes">,
  screenshots?: MaterialScreenshot[],
  config?: AIServiceConfig
): Promise<ContentBlock[]> {
  const hasImages = screenshots && screenshots.length > 0;
  const prompt = `
你是特级教师。请识别资料中核心知识点（生字词、多音字、近反义词、课文理解要点等）。
资料名称：${resource.title}

任务：
1. 直接提取原始信息，不要加工。
2. 数量：5-15 个核心知识块。

输出格式（严格 JSON 数组）：
[
  {
    "id": "b-1",
    "type": "vocabulary|sentence|comprehension",
    "title": "标题",
    "summary": "详细内容描述"
  }
]
  `.trim();

  let content: string;
  try {
    content = hasImages ? await callAIWithImages(prompt, screenshots!, config) : await callAI(prompt, config);
  } catch (e) {
    console.warn('[extractContentBlocksWithAI] Primary AI call failed, trying fallback...', e);
    content = await callAI(prompt, config);
  }
  
  console.log('[extractContentBlocksWithAI] Received content:', content);
  const arr = safeJsonParse<Array<Record<string, JsonValue>>>(content);
  return arr.map((raw, i) => ({
    id: String(raw.id ?? `b-${i + 1}`),
    resourceId: resource.id,
    type: normalizeBlockType(String(raw.type ?? ""), resource.materialType),
    title: String(raw.title ?? `内容块 ${i + 1}`),
    summary: raw.summary ? String(raw.summary) : undefined,
    topic: raw.topic ? String(raw.topic) : undefined,
    difficulty: typeof raw.difficulty === "number" ? (Math.min(5, Math.max(1, raw.difficulty)) as 1 | 2 | 3 | 4 | 5) : undefined,
    pageStart: typeof raw.pageStart === "number" ? raw.pageStart : undefined,
    pageEnd: typeof raw.pageEnd === "number" ? raw.pageEnd : undefined,
    timeStartSec: typeof raw.timeStartSec === "number" ? raw.timeStartSec : undefined,
    timeEndSec: typeof raw.timeEndSec === "number" ? raw.timeEndSec : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
  }));
}

export async function generateLearningUnitsFromBlocksWithAI(
  resource: Pick<Resource, "id" | "title" | "fileName" | "materialType" | "notes">,
  blocks: ContentBlock[],
  screenshots?: MaterialScreenshot[],
  config?: AIServiceConfig
): Promise<LearningUnit[]> {
  const prompt = `
你是特级教师。你的任务是将识别出的知识内容块（Blocks）加工为高效的学习单元。

请遵循以下步骤进行处理：

【步骤 1：单元划分】
1. 每个知识块（Block）必须对应生成一个学习单元（Unit）。
2. **重要**：生成的 Unit 的 "title" 必须与对应的 Block 的 "title" 完全一致。

【步骤 2：高效格式判断】
针对每个知识块，判断采用哪种练习格式最科学。禁止使用“闪卡”形式。
判断依据：
- 基础记忆类（如生字词）：必须使用拼写检测 (spelling)。
- 概念辨析类（如多音字、易混词）：适合选择题 (choice)。
- 语义关系类（如近反义词）：适合连线题 (matching)。
- 实际应用类（如词语搭配、填空）：适合填空题 (fill_blank)。
- 表达提升类（如仿写）：适合仿写题 (imitation)。
- 深度理解类（如课文主题）：适合问答练习 (qa)。

【步骤 3：结构化内容生成】
- **拼写检测 (spelling)**: { "type": "spelling", "cards": [{ "word": "完整词语", "quiz": "带下划线的题目(如: 碧_)", "answer": "缺失的字(如: 绿)", "pinyin": "pīn yīn", "meaning": "意思" }] }
- **选择题 (choice)**: { "type": "choice", "questions": [{ "question": "...", "options": ["A", "B", "C", "D"], "correct": 0, "explanation": "..." }] }
- **连线题 (matching)**: { "type": "matching", "items": [{ "left": "...", "right": "..." }] }
- **填空题 (fill_blank)**: { "type": "fill_blank", "questions": [{ "sentence": "句子必须包含空括号，且括号内严禁出现答案，如: 这里的风景真( )啊！", "answer": "正确答案", "explanation": "..." }] }
- **仿写题 (imitation)**: { "type": "imitation", "questions": [{ "original": "原句", "skeleton": "结构", "tip": "技巧" }] }
- **问答练习 (qa)**: { "type": "qa", "questions": [{ "question": "问题", "answer": "参考答案" }] }

【步骤 4：组装】
1. title 必须等于原 Block 标题。
2. payload 结构必须严格符合上述 JSON 定义。

Blocks 内容: ${JSON.stringify(blocks.map(b => ({ title: b.title, summary: b.summary })))}

输出 JSON 数组：
[
  {
    "title": "必须与 Block 标题一致",
    "kind": "memory|discrimination|semantic|collocation|expression|comprehension",
    "payload": { ...内容... }
  }
]
  `.trim();

  let content: string;
  const hasImages = screenshots && screenshots.length > 0;
  try {
    content = hasImages ? await callAIWithImages(prompt, screenshots!, config) : await callAI(prompt, config);
  } catch (e) {
    console.warn('[generateLearningUnitsFromBlocksWithAI] Primary AI call failed, trying fallback...', e);
    content = await callAI(prompt, config);
  }
  
  console.log('[generateLearningUnitsFromBlocksWithAI] Received content:', content);
  const arr = safeJsonParse<Array<Record<string, JsonValue>>>(content);

  const units = arr.map((raw, i) => {
    return {
      id: String(raw.id ?? `u-${i + 1}`),
      title: String(raw.title ?? `学习包 ${i + 1}`),
      status: "todo",
      type: 'exercise',
      kind: raw.kind ? (String(raw.kind) as LearningUnitKind) : undefined,
      sourceBlockIds: [],
      payload: raw.payload && typeof raw.payload === "object" ? (raw.payload as Record<string, unknown>) : undefined,
    } satisfies LearningUnit;
  });

  return units;
}

export async function parseMaterialWithAI(
  fileNameOrInput:
    | string
    | { fileName: string; notes?: string; materialType?: LearningMaterialType; screenshots?: MaterialScreenshot[] },
  config?: AIServiceConfig
): Promise<{ resource: Resource; blocks: ContentBlock[]; units: LearningUnit[] }> {
  const input =
    typeof fileNameOrInput === "string"
      ? { fileName: fileNameOrInput, notes: undefined, materialType: inferMaterialTypeFromFileName(fileNameOrInput) }
      : {
          fileName: fileNameOrInput.fileName,
          notes: fileNameOrInput.notes,
          materialType: fileNameOrInput.materialType ?? inferMaterialTypeFromFileName(fileNameOrInput.fileName),
        };

  const now = Date.now();
  const resource: Resource = {
    id: `r-${now}`,
    title: input.fileName.replace(/\.[^.]+$/, ""),
    source: "upload",
    fileName: input.fileName,
    materialType: input.materialType,
    createdAt: now,
    notes: input.notes,
  };

  try {
    const screenshots = typeof fileNameOrInput === "string" ? undefined : fileNameOrInput.screenshots;
    
    if (screenshots && screenshots.length > 0) {
      let allBlocks: ContentBlock[] = [];
      let allUnits: LearningUnit[] = [];

      for (const [index, shot] of screenshots.entries()) {
        const pageNum = shot.pageNumber || (index + 1);
        try {
          const pageBlocks = await extractContentBlocksWithAI(resource, [shot], config);
          const pageUnits = await generateLearningUnitsFromBlocksWithAI(resource, pageBlocks, [shot], config);
          const taggedUnits = pageUnits.map(u => ({ ...u, pageNumber: pageNum }));
          
          allBlocks = [...allBlocks, ...pageBlocks];
          allUnits = [...allUnits, ...taggedUnits];
        } catch (e) {
          console.warn(`第 ${pageNum} 页解析失败`, e);
        }
      }
      return { resource, blocks: allBlocks, units: allUnits };
    }

    const blocks = await extractContentBlocksWithAI(resource, undefined, config);
    const units = await generateLearningUnitsFromBlocksWithAI(resource, blocks, undefined, config);
    return { resource, blocks, units };
  } catch (error) {
    console.error("AI 解析失败:", error);
    throw error;
  }
}

export async function generateStudyPlanWithAI(
  planTitle: string,
  materials: LearningMaterial[],
  days: number,
  config?: AIServiceConfig
): Promise<{ days: { dayIndex: number; units: (LearningUnit & { materialId: string })[] }[] }> {
  const appId = config?.appId || APP_ID;
  const appKey = config?.appKey || APP_KEY;

  const materialsContext = materials.map(m => `- ${m.title} (${m.type}, 包含 ${m.units.length} 个单元)`).join('\n');

    const prompt = `
    你是一个专业的学习规划专家。
    现在有以下资料：
    ${materialsContext}
    
    请为用户制定一个为期 ${days} 天的学习计划，标题为《${planTitle}》。
    
    要求：
    1. 每日动作要多样化，仅包含练习测试 (exercise)。
    2. 任务要与提供的资料挂钩。
    3. 返回 JSON 格式，包含 days 数组。
    
    示例格式：
    {
      "days": [
        {
          "dayIndex": 1,
          "units": [
            { "id": "t1", "title": "任务标题", "type": "exercise", "materialId": "资料ID", "status": "todo" }
          ]
        }
      ]
    }
    
    只需返回 JSON，不要解释。
  `;

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${appId}:${appKey}`
    },
    body: JSON.stringify({
      model: "doubao-seed-1.6-flash",
      messages: [
        { role: "system", content: "You are a helpful expert learning planner." },
        { role: "user", content: prompt }
      ],
      extra_body: { "reasoning_token": 0 }
    })
  });

  if (!response.ok) throw new Error(`API 错误: ${response.status}`);
  const data = await response.json();
  const content = data.choices[0].message.content;
  const jsonString = content.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(jsonString);
  if (parsed?.days && Array.isArray(parsed.days)) {
    parsed.days = parsed.days.map((d: any) => ({
      ...d,
      units: Array.isArray(d.units) ? d.units.filter((u: any) => u?.type === "exercise") : [],
    }));
  }
  return parsed;
}
