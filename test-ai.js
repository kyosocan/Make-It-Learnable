// test-ai.js
const API_ENDPOINT = 'http://ai-service.tal.com/openai-compatible/v1/chat/completions';

// 请在此处填写你的真实凭证进行测试
const APP_ID = '300000863';
const APP_KEY = 'fe76afd3cb0c93880476978c6a9e7747';

async function testConnection() {
  console.log('🚀 开始测试 TAL AI 服务接口...');
  console.log(`📡 目标地址: ${API_ENDPOINT}`);
  
  const payload = {
    model: "gemini-2.5-flash-preview",
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant."
      },
      {
        role: "user",
        content: "你好，请确认你能收到这条消息。"
      }
    ],
    extra_body: {
      "reasoning_token": 0
    }
  };

  try {
    const startTime = Date.now();
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${APP_ID}:${APP_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const duration = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      console.log('✅ 测试成功！');
      console.log(`⏱️ 响应时间: ${duration}ms`);
      console.log('🤖 AI 回复:', data.choices[0].message.content);
    } else {
      console.error('❌ 接口返回错误:');
      console.error(`状态码: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`详情: ${errorText}`);
    }
  } catch (error) {
    console.error('🛑 网络请求失败:');
    if (error.code === 'ENOTFOUND') {
      console.error('原因: 无法解析域名。请检查是否已连接 VPN 或公司办公网。');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('原因: 链接被拒绝。请检查接口地址或端口是否正确。');
    } else {
      console.error(`详情: ${error.message}`);
    }
  }
}

testConnection();