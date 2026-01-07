// test-parsing.js
// 这个脚本模拟真实的资料解析全流程：Block 提取 -> Unit 生成
// 运行方式：node test-parsing.js

const API_ENDPOINT = 'http://ai-service.tal.com/openai-compatible/v1/chat/completions';
const APP_ID = '300000863';
const APP_KEY = 'fe76afd3cb0c93880476978c6a9e7747';

// 模拟截图数据 (一个极小的 1x1 像素 JPEG 的 base64，用于测试接口连通性)
const MOCK_IMAGE_BASE64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVWV1hZWmNkZWZnaGlqc3R1dnd4eXqGhcXl9GVlpyE9gpOT0ztTV1V9zdXn5+k67i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwA/fD//2Q==';

async function callAI(messages) {
  const payload = {
    model: "gemini-2.5-flash-preview",
    messages: messages,
    extra_body: { "reasoning_token": 0 }
  };

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${APP_ID}:${APP_KEY}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function testFullFlow() {
  console.log('🏁 开始全流程测试...');

  try {
    // 步骤 1: 提取 Blocks
    console.log('\nStep 1: 正在提取 Content Blocks...');
    const step1Prompt = `你是特级教师。请分析这份资料：三年级语文总结。任务：提取核心知识点（如生字、词语、搭配、仿写、课文要点）。数量要求：5个。输出格式：JSON 数组，包含 id, title, summary。`;
    
    // 测试带图片的请求
    const step1Messages = [
      { role: "system", content: "You are a helpful assistant that outputs STRICT JSON only." },
      { 
        role: "user", 
        content: [
          { type: "text", text: step1Prompt },
          { type: "image_url", image_url: { url: MOCK_IMAGE_BASE64 } }
        ] 
      }
    ];

    const blocksJson = await callAI(step1Messages);
    console.log('✅ Step 1 成功！提取到的 Blocks:', blocksJson);
    const blocks = JSON.parse(blocksJson.replace(/```json|```/g, '').trim());

    // 步骤 2: 加工 Units
    console.log('\nStep 2: 正在加工为 Learning Units...');
    const step2Prompt = `请将这些 Blocks 加工为学习任务：memory, discrimination, semantic, collocation, expression, comprehension。Blocks: ${JSON.stringify(blocks)}。输出 JSON 数组，每个 unit 包含：id, title, kind, type(flashcard|exercise), payload。`;
    
    const step2Messages = [
      { role: "system", content: "You are a helpful assistant that outputs STRICT JSON only." },
      { role: "user", content: step2Prompt }
    ];

    const unitsJson = await callAI(step2Messages);
    console.log('✅ Step 2 成功！生成的 Units:', unitsJson);

    console.log('\n🎉 测试圆满完成！连通性与逻辑处理均正常。');

  } catch (error) {
    console.error('\n❌ 测试失败！');
    console.error('错误信息:', error.message);
    if (error.message.includes('413')) {
      console.error('原因分析: Payload Too Large。图片可能还是太大了。');
    } else if (error.message.includes('504') || error.message.includes('timeout')) {
      console.error('原因分析: 接口响应超时。可能是生成的任务数量太多。');
    }
  }
}

testFullFlow();

