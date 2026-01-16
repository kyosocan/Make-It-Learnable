import {
  ContentBlock,
  ContentBlockType,
  LearningMaterial,
  LearningMaterialType,
  MaterialScreenshot,
  LearningUnit,
  LearningUnitKind,
  Resource,
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

// TTS/ASR 配置
const TTS_API_URL = import.meta.env.VITE_TTS_API_URL || 'https://openspeech.bytedance.com/api/v1/tts';
const VOLCENGINE_APP_ID = import.meta.env.VITE_VOLCENGINE_APP_ID || '';
const VOLCENGINE_ACCESS_TOKEN = import.meta.env.VITE_VOLCENGINE_ACCESS_TOKEN || '';
const TTS_TOKEN = import.meta.env.VITE_TTS_TOKEN || '';

// 仅在有配置时初始化 TOS 客户端
const tosClient = TOS_AK && TOS_SK ? new TosClient({
  accessKeyId: TOS_AK,
  accessKeySecret: TOS_SK,
  region: TOS_REGION,
  endpoint: TOS_ENDPOINT,
}) : null;

/**
 * 语音合成 (TTS)
 */
export async function generateSpeech(text: string, voiceType: string = 'zh_male_M392_conversation_wvae_bigtts'): Promise<string> {
  if (!VOLCENGINE_APP_ID || !TTS_TOKEN) {
    console.warn('[TTS] AppID or Token not configured');
    return '';
  }

  const response = await fetch(TTS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer;${TTS_TOKEN}`,
    },
    body: JSON.stringify({
      app: { appid: VOLCENGINE_APP_ID, token: TTS_TOKEN, cluster: 'volcano_tts' },
      user: { uid: 'test_user' },
      audio: { voice_type: voiceType, encoding: 'mp3', speed_ratio: 1.0, rate: 24000 },
      request: { reqid: Math.random().toString(36).slice(2), text, operation: 'query' },
    }),
  });

  if (!response.ok) throw new Error(`TTS API 错误: ${response.status}`);
  const data = await response.json();
  if (data.code !== 3000) throw new Error(`TTS 失败: ${data.message}`);
  return data.data; // 返回 base64
}

/**
 * 语音识别 (ASR)
 */
export async function recognizeSpeech(audioBase64: string): Promise<string> {
  if (!VOLCENGINE_APP_ID || !VOLCENGINE_ACCESS_TOKEN) {
    console.warn('[ASR] AppID or Token not configured');
    return 'Mock recognition result';
  }

  const response = await fetch('https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-App-Key': VOLCENGINE_APP_ID,
      'X-Api-Access-Key': VOLCENGINE_ACCESS_TOKEN,
      'X-Api-Resource-Id': 'volc.bigasr.auc_turbo',
      'X-Api-Request-Id': Math.random().toString(36).slice(2),
    },
    body: JSON.stringify({
      user: { uid: VOLCENGINE_APP_ID },
      audio: { data: audioBase64 },
      request: { model_name: 'bigmodel' },
    }),
  });

  if (!response.ok) throw new Error(`ASR API 错误: ${response.status}`);
  const data = await response.json();
  return data.result?.text || '';
}

/**
 * 口语测评 Mock
 */
export async function evaluateOral(audioBase64: string, referenceText: string): Promise<{ score: number; feedback: string }> {
  console.log('[Oral] Evaluating audio for:', referenceText);
  // 模拟评估延迟
  await new Promise(resolve => setTimeout(resolve, 1500));
  return {
    score: Math.floor(Math.random() * 40) + 60, // 60-100
    feedback: 'Pronunciation is clear, but pay attention to the rhythm.'
  };
}

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

export async function uploadFileToTOS(file: File): Promise<string> {
  if (!tosClient) {
    console.warn('[TOS] TOS client not configured, returning local URL');
    return URL.createObjectURL(file);
  }

  const fileName = `materials/${Date.now()}-${file.name}`;
  
  await tosClient.putObject({
    bucket: TOS_BUCKET,
    key: fileName,
    body: file,
    contentType: file.type,
    acl: ACLType.ACLPublicRead,
  });

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
你是专业的语言教育专家。请从提供的课本页面或单词表截图中，识别并提取所有的核心英语单词、短语及其对应的中文含义、词性。

资料名称：${resource.title}

任务：
1. 识别图片中的单词、短语。
2. 提取其：英文 (word)、中文含义 (meaning)、词性 (pos)、例句 (example)。
3. 数量：尽量提取所有清晰可见的重点词汇。

输出格式（严格 JSON 数组）：
[
  {
    "id": "b-1",
    "type": "vocabulary",
    "title": "单词/短语原文",
    "summary": "中文含义",
    "pos": "词性",
    "example": "例句",
    "topic": "所属单元或主题"
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
  blocks: ContentBlock[],
  screenshots?: MaterialScreenshot[],
  config?: AIServiceConfig
): Promise<LearningUnit[]> {
  const prompt = `
你是特级教师和语言教育专家。你的任务是将识别出的英语单词/短语内容块（Blocks）加工为全方位的“听说读写”训练单元。

请遵循以下步骤进行处理：

【步骤 1：单元设计】
为每个单词/短语设计多种维度的练习。不要局限于单一题型。

【步骤 2：题型库与格式】
请根据以下题型库，为每个知识点选择最合适的 2-4 种练习：

1. **单词配图 (word_image)**: { "type": "word_image", "word": "apple", "image_prompt": "a fresh red apple on a table" }
2. **中文释义选择 (choice_definition)**: { "type": "choice_definition", "word": "apple", "options": ["苹果", "香蕉", "橘子", "梨"], "correct": 0 }
3. **拼写填空 (spelling_fill_blank)**: { "type": "spelling_fill_blank", "meaning": "苹果", "answer": "apple", "hint": "a_p_e" }
4. **听音选图 (listen_choice_image)**: { "type": "listen_choice_image", "audio_text": "apple", "options": [{"id": "a", "image_prompt": "apple"}, {"id": "b", "image_prompt": "banana"}], "correct": "a" }
5. **听音选词 (listen_choice_word)**: { "type": "listen_choice_word", "audio_text": "apple", "options": ["apple", "apply", "ample", "april"], "correct": 0 }
6. **听句默写 (dictation_sentence)**: { "type": "dictation_sentence", "audio_text": "I like to eat an apple every day.", "answer": "I like to eat an apple every day." }
7. **跟读打分 (repeat_scoring)**: { "type": "repeat_scoring", "text": "apple", "standard_audio_text": "apple" }
8. **图片→英文单词/短语 (image_to_word)**: { "type": "image_to_word", "image_prompt": "a red apple", "answer": "apple" }
9. **看图说话 (describe_image)**: { "type": "describe_image", "image_prompt": "a child eating an apple in a garden", "reference_text": "A child is eating an apple." }
10. **听问题回答 (listen_qa)**: { "type": "listen_qa", "audio_question": "What fruit is red and round?", "reference_answer": "It is an apple." }
11. **互动阅读-填空 (interactive_reading)**: { "type": "interactive_reading", "text": "An ( ) a day keeps the doctor away.", "options": ["apple", "banana"], "correct": 0 }
12. **选最佳标题 (best_title)**: { "type": "best_title", "passage": "...", "options": ["...", "..."], "correct": 0 }
13. **互动听力 (interactive_listening)**: { "type": "interactive_listening", "audio_text": "...", "questions": [...], "summary_prompt": "Summarize the story." }
14. **命题写作 (writing_prompt)**: { "type": "writing_prompt", "topic": "My favorite fruit", "requirements": ["at least 50 words", "mention why you like it"] }
15. **命题口语 (speaking_prompt)**: { "type": "speaking_prompt", "topic": "Talk about your breakfast", "key_words": ["apple", "milk", "bread"] }

【步骤 3：输出要求】
1. 输出必须是严格的 JSON 数组。
2. 每个对象的 "kind" 必须是上述 15 种类型之一。
3. "payload" 必须符合上述定义的结构。

Blocks 内容: ${JSON.stringify(blocks.map(b => ({ word: b.title, meaning: b.summary, pos: (b as any).pos, example: (b as any).example })))}

输出 JSON 数组：
[
  {
    "title": "练习标题",
    "kind": "word_image|choice_definition|...",
    "payload": { ... }
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
          const pageUnits = await generateLearningUnitsFromBlocksWithAI(pageBlocks, [shot], config);
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
    const units = await generateLearningUnitsFromBlocksWithAI(blocks, undefined, config);
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
