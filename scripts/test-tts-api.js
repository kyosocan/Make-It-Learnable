#!/usr/bin/env node

/**
 * TTS API 测试脚本
 * 功能：
 * 1. 调用 TTS API 将文本转换为语音
 * 2. 将返回的 base64 编码音频解码并保存为文件
 * 3. 支持流式和非流式两种模式
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置参数
const defaultConfig = {
  apiUrl: process.env.TTS_API_URL || 'https://openspeech.bytedance.com/api/v1/tts',
  appId: process.env.TTS_APP_ID || '',
  token: process.env.TTS_TOKEN || '',
  cluster: process.env.TTS_CLUSTER || 'volcano_tts',
  uid: process.env.TTS_UID || 'test_user',
  voiceType: process.env.TTS_VOICE_TYPE || 'zh_male_M392_conversation_wvae_bigtts',
  encoding: process.env.TTS_ENCODING || 'mp3',
  speedRatio: parseFloat(process.env.TTS_SPEED_RATIO || '1.0'),
  rate: parseInt(process.env.TTS_RATE || '24000', 10),
  operation: process.env.TTS_OPERATION || 'query', // query: 非流式, submit: 流式
};

/**
 * 生成 UUID
 */
function generateUUID() {
  return randomUUID();
}

/**
 * 调用 TTS API（非流式）
 */
async function callTTSAPI(text, config) {
  const reqid = generateUUID();
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer;${config.token}`, // 注意：Bearer和token之间用分号分隔
  };

  const body = {
    app: {
      appid: config.appId,
      token: config.token,
      cluster: config.cluster,
    },
    user: {
      uid: config.uid,
    },
    audio: {
      voice_type: config.voiceType,
      encoding: config.encoding,
      speed_ratio: config.speedRatio,
      rate: config.rate,
    },
    request: {
      reqid: reqid,
      text: text,
      operation: config.operation,
    },
  };

  try {
    console.log(`发送请求 (reqid: ${reqid})...`);
    console.log(`文本内容: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
    
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 请求失败: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();

    // 检查返回码
    if (data.code !== 3000) {
      throw new Error(`API 返回错误: code=${data.code}, message=${data.message || '未知错误'}`);
    }

    return {
      reqid: data.reqid,
      code: data.code,
      message: data.message,
      sequence: data.sequence,
      audioData: data.data, // base64 编码的音频数据
      duration: data.addition?.duration,
    };
  } catch (error) {
    console.error('TTS API 调用失败:', error);
    throw error;
  }
}

/**
 * 将 base64 字符串解码为音频文件
 */
function saveAudioFromBase64(base64Data, outputPath) {
  try {
    const audioBuffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(outputPath, audioBuffer);
    return audioBuffer.length;
  } catch (error) {
    console.error('保存音频文件失败:', error);
    throw error;
  }
}

/**
 * 获取文件大小（人类可读格式）
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
用法: node test-tts-api.js <文本内容> [选项]

选项:
  --api-url <url>         API URL (默认: https://openspeech.bytedance.com/api/v1/tts)
  --app-id <id>           App ID (默认: 从环境变量 TTS_APP_ID 获取)
  --token <token>         Token (默认: 从环境变量 TTS_TOKEN 获取)
  --cluster <cluster>     集群名称 (默认: volcano_tts)
  --uid <uid>             用户ID (默认: test_user)
  --voice-type <type>     音色类型 (默认: zh_male_M392_conversation_wvae_bigtts)
  --encoding <format>     音频编码格式 (默认: mp3, 可选: wav/pcm/ogg_opus/mp3)
  --speed-ratio <ratio>   语速 (默认: 1.0, 范围: 0.1-2.0)
  --rate <rate>           采样率 (默认: 24000, 可选: 8000/16000/24000)
  --operation <op>        操作类型 (默认: query, 可选: query/submit)
  --output <file>          输出文件路径 (默认: tts_output_<timestamp>.<encoding>)
  --text-file <file>       从文件读取文本内容（替代命令行文本参数）

示例:
  # 直接指定文本
  node test-tts-api.js "你好，这是测试文本" --app-id appid123 --token your_token

  # 从文件读取文本
  node test-tts-api.js --text-file input.txt --app-id appid123 --token your_token

  # 使用环境变量
  export TTS_APP_ID=appid123
  export TTS_TOKEN=your_token
  node test-tts-api.js "测试文本"
    `);
    process.exit(1);
  }

  // 解析命令行参数
  const config = { ...defaultConfig };
  let text = '';
  let textFile = '';
  let outputFile = '';

  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--api-url':
        config.apiUrl = value;
        break;
      case '--app-id':
        config.appId = value;
        break;
      case '--token':
        config.token = value;
        break;
      case '--cluster':
        config.cluster = value;
        break;
      case '--uid':
        config.uid = value;
        break;
      case '--voice-type':
        config.voiceType = value;
        break;
      case '--encoding':
        config.encoding = value;
        break;
      case '--speed-ratio':
        config.speedRatio = parseFloat(value);
        break;
      case '--rate':
        config.rate = parseInt(value, 10);
        break;
      case '--operation':
        config.operation = value;
        break;
      case '--output':
        outputFile = value;
        break;
      case '--text-file':
        textFile = value;
        i--; // 这个参数不需要值
        break;
      default:
        // 如果不是以 -- 开头，可能是文本内容
        if (!flag.startsWith('--')) {
          text = flag;
          i--; // 回退，因为已经处理了这个参数
        }
        break;
    }
  }

  // 处理文本输入
  if (textFile) {
    if (!fs.existsSync(textFile)) {
      console.error(`错误: 文件不存在: ${textFile}`);
      process.exit(1);
    }
    text = fs.readFileSync(textFile, 'utf-8').trim();
  } else if (!text) {
    // 如果没有指定文本文件，尝试从最后一个参数获取文本
    const lastArg = args[args.length - 1];
    if (lastArg && !lastArg.startsWith('--')) {
      text = lastArg;
    } else {
      console.error('错误: 必须提供文本内容或使用 --text-file 指定文件');
      process.exit(1);
    }
  }

  // 验证文本长度（UTF-8编码，限制1024字节）
  const textBytes = Buffer.from(text, 'utf-8').length;
  if (textBytes > 1024) {
    console.error(`错误: 文本长度超过限制 (${textBytes} 字节 > 1024 字节)`);
    console.error(`当前文本: ${text.substring(0, 100)}...`);
    process.exit(1);
  }

  // 验证配置
  if (!config.appId || !config.token) {
    console.error('错误: 必须提供 app-id 和 token');
    console.error('可以通过命令行参数或环境变量提供: TTS_APP_ID, TTS_TOKEN');
    process.exit(1);
  }

  // 验证 operation
  if (config.operation !== 'query' && config.operation !== 'submit') {
    console.error('错误: operation 必须是 "query" 或 "submit"');
    process.exit(1);
  }

  // 设置输出文件名
  if (!outputFile) {
    const timestamp = Date.now();
    const ext = config.encoding === 'pcm' ? 'pcm' : config.encoding;
    outputFile = `tts_output_${timestamp}.${ext}`;
  }

  console.log('='.repeat(60));
  console.log('TTS API 测试脚本');
  console.log('='.repeat(60));
  console.log(`API URL: ${config.apiUrl}`);
  console.log(`App ID: ${config.appId}`);
  console.log(`集群: ${config.cluster}`);
  console.log(`用户ID: ${config.uid}`);
  console.log(`音色类型: ${config.voiceType}`);
  console.log(`音频编码: ${config.encoding}`);
  console.log(`语速: ${config.speedRatio}`);
  console.log(`采样率: ${config.rate}`);
  console.log(`操作类型: ${config.operation}`);
  console.log(`文本长度: ${text.length} 字符 (${textBytes} 字节)`);
  console.log(`输出文件: ${outputFile}`);
  console.log('='.repeat(60));
  console.log();

  try {
    const startTime = Date.now();

    // 调用 TTS API
    console.log('调用 TTS API...');
    const result = await callTTSAPI(text, config);

    console.log(`✓ API 调用成功`);
    console.log(`  请求ID: ${result.reqid}`);
    console.log(`  状态码: ${result.code}`);
    console.log(`  消息: ${result.message}`);
    console.log(`  序列号: ${result.sequence}`);
    if (result.duration) {
      console.log(`  音频时长: ${result.duration} ms`);
    }

    // 保存音频文件
    console.log('\n保存音频文件...');
    if (!result.audioData) {
      throw new Error('API 返回的音频数据为空');
    }

    const fileSize = saveAudioFromBase64(result.audioData, outputFile);
    console.log(`✓ 音频文件已保存: ${outputFile}`);
    console.log(`  文件大小: ${formatFileSize(fileSize)}`);

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n总耗时: ${elapsedTime} 秒`);

    // 保存结果信息到文本文件
    const infoFile = outputFile.replace(/\.[^.]+$/, '_info.txt');
    const infoContent = `TTS 合成结果
生成时间: ${new Date().toLocaleString('zh-CN')}
请求ID: ${result.reqid}
状态码: ${result.code}
消息: ${result.message}
序列号: ${result.sequence}
音频时长: ${result.duration || '未知'} ms
文件大小: ${formatFileSize(fileSize)}
总耗时: ${elapsedTime} 秒
${'='.repeat(60)}
文本内容:
${text}
`;
    fs.writeFileSync(infoFile, infoContent, 'utf-8');
    console.log(`✓ 结果信息已保存: ${infoFile}`);

  } catch (error) {
    console.error('\n错误:', error);
    process.exit(1);
  }

  console.log('\n完成!');
}

// 运行主函数
main().catch(error => {
  console.error('未处理的错误:', error);
  process.exit(1);
});

