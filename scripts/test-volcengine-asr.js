#!/usr/bin/env node

/**
 * 火山引擎 ASR API 测试脚本
 * 功能：
 * 1. 读取 MP3 文件
 * 2. 将文件切分成 1 分钟（60秒）的片段
 * 3. 对每个片段调用火山引擎 ASR API 进行语音识别
 * 4. 将所有识别结果拼接并保存到文件
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';

// 配置参数
const defaultConfig = {
  apiUrl: 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash',
  appId: process.env.VOLCENGINE_APP_ID || '',
  accessToken: process.env.VOLCENGINE_ACCESS_TOKEN || '',
  resourceId: 'volc.bigasr.auc_turbo',
  segmentDuration: 60, // 每个片段时长（秒）
};

/**
 * 检查 ffmpeg 是否可用
 */
function checkFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取音频文件时长（秒）
 */
function getAudioDuration(filePath) {
  try {
    const output = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { encoding: 'utf-8' }
    );
    return parseFloat(output.trim());
  } catch (error) {
    console.error('获取音频时长失败:', error);
    throw error;
  }
}

/**
 * 切分音频文件为指定时长的片段
 */
function splitAudio(inputFile, outputDir, duration) {
  // 确保输出目录存在
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const audioDuration = getAudioDuration(inputFile);
  const segmentCount = Math.ceil(audioDuration / duration);
  const segmentFiles = [];

  console.log(`音频总时长: ${audioDuration.toFixed(2)} 秒`);
  console.log(`将切分为 ${segmentCount} 个片段，每个 ${duration} 秒`);

  for (let i = 0; i < segmentCount; i++) {
    const startTime = i * duration;
    const outputFile = path.join(outputDir, `segment_${i + 1}.mp3`);

    try {
      execSync(
        `ffmpeg -i "${inputFile}" -ss ${startTime} -t ${duration} -acodec copy "${outputFile}" -y`,
        { stdio: 'ignore' }
      );
      segmentFiles.push(outputFile);
      console.log(`✓ 已切分片段 ${i + 1}/${segmentCount}: ${outputFile}`);
    } catch (error) {
      console.error(`✗ 切分片段 ${i + 1} 失败:`, error);
      throw error;
    }
  }

  return segmentFiles;
}

/**
 * 将文件转换为 base64
 */
function fileToBase64(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString('base64');
}

/**
 * 调用火山引擎 ASR API
 */
async function recognizeTask(filePath, config) {
  const requestId = randomUUID();
  
  const headers = {
    'Content-Type': 'application/json',
    'X-Api-App-Key': config.appId,
    'X-Api-Access-Key': config.accessToken,
    'X-Api-Resource-Id': config.resourceId,
    'X-Api-Request-Id': requestId,
    'X-Api-Sequence': '-1',
  };

  // 将文件转换为 base64
  const base64Data = fileToBase64(filePath);

  const requestBody = {
    user: {
      uid: config.appId,
    },
    audio: {
      data: base64Data,
    },
    request: {
      model_name: 'bigmodel',
      // 可选参数：
      // enable_itn: true,        // 是否启用逆文本规范化
      // enable_punc: true,        // 是否启用标点符号
      // enable_ddc: true,         // 是否启用DDC
      // enable_speaker_info: false, // 是否启用说话人信息
    },
  };

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    // 检查响应头
    const statusCode = response.headers.get('X-Api-Status-Code');
    const message = response.headers.get('X-Api-Message');
    const logid = response.headers.get('X-Tt-Logid');

    if (statusCode) {
      console.log(`  X-Api-Status-Code: ${statusCode}`);
      console.log(`  X-Api-Message: ${message}`);
      console.log(`  X-Tt-Logid: ${logid}`);
    } else {
      console.error('  API 响应头异常:', Object.fromEntries(response.headers.entries()));
      throw new Error('API 响应头异常');
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 请求失败: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();

    // 检查状态码
    if (statusCode !== '20000000') {
      throw new Error(`API 返回错误: ${statusCode} - ${message || '未知错误'}`);
    }

    // 提取识别结果文本
    const text = data.result?.text || '';
    return {
      text,
      fullResponse: data,
      logid,
      statusCode,
    };
  } catch (error) {
    console.error('ASR API 调用失败:', error);
    throw error;
  }
}

/**
 * 清理临时文件
 */
function cleanupTempFiles(files, outputDir) {
  console.log('\n清理临时文件...');
  files.forEach(file => {
    try {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    } catch (error) {
      console.warn(`删除临时文件失败: ${file}`, error);
    }
  });

  try {
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn(`删除临时目录失败: ${outputDir}`, error);
  }
}

/**
 * 格式化时间为 MM:SS
 */
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
用法: node test-volcengine-asr.js <mp3文件路径> [选项]

选项:
  --app-id <id>          App ID (默认: 从环境变量 VOLCENGINE_APP_ID 获取)
  --access-token <token>  Access Token (默认: 从环境变量 VOLCENGINE_ACCESS_TOKEN 获取)
  --duration <seconds>    每个片段的时长（秒）(默认: 60)
  --output <file>         输出文件路径 (默认: volcengine_asr_result_<timestamp>.txt)
  --save-json            同时保存完整的 JSON 响应到文件

示例:
  node test-volcengine-asr.js audio.mp3 --app-id 123456789 --access-token your_token
  
环境变量示例:
  export VOLCENGINE_APP_ID=123456789
  export VOLCENGINE_ACCESS_TOKEN=your_access_token
  node test-volcengine-asr.js audio.mp3
    `);
    process.exit(1);
  }

  const inputFile = args[0];
  if (!fs.existsSync(inputFile)) {
    console.error(`错误: 文件不存在: ${inputFile}`);
    process.exit(1);
  }

  // 解析命令行参数
  const config = { ...defaultConfig };
  let outputFile = `volcengine_asr_result_${Date.now()}.txt`;
  let saveJson = false;

  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--app-id':
        config.appId = value;
        break;
      case '--access-token':
        config.accessToken = value;
        break;
      case '--duration':
        config.segmentDuration = parseInt(value, 10);
        break;
      case '--output':
        outputFile = value;
        break;
      case '--save-json':
        saveJson = true;
        i--; // 这个参数不需要值
        break;
    }
  }

  // 验证配置
  if (!config.appId || !config.accessToken) {
    console.error('错误: 必须提供 app-id 和 access-token');
    console.error('可以通过命令行参数或环境变量提供: VOLCENGINE_APP_ID, VOLCENGINE_ACCESS_TOKEN');
    process.exit(1);
  }

  // 检查 ffmpeg
  if (!checkFFmpeg()) {
    console.error('错误: 未找到 ffmpeg，请先安装 ffmpeg');
    console.error('安装方法: brew install ffmpeg (macOS) 或 apt-get install ffmpeg (Linux)');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('火山引擎 ASR API 测试脚本');
  console.log('='.repeat(60));
  console.log(`输入文件: ${inputFile}`);
  console.log(`API URL: ${config.apiUrl}`);
  console.log(`App ID: ${config.appId}`);
  console.log(`片段时长: ${config.segmentDuration} 秒`);
  console.log(`输出文件: ${outputFile}`);
  console.log('='.repeat(60));
  console.log();

  const tempDir = path.join(path.dirname(inputFile), `.asr_temp_${Date.now()}`);
  const segmentFiles = [];
  const results = [];
  const jsonResponses = [];

  const startTime = Date.now();

  try {
    // 1. 切分音频
    console.log('步骤 1: 切分音频文件...');
    const segments = splitAudio(inputFile, tempDir, config.segmentDuration);
    segmentFiles.push(...segments);
    console.log();

    // 2. 对每个片段调用 API
    console.log('步骤 2: 调用火山引擎 ASR API 进行识别...');
    for (let i = 0; i < segments.length; i++) {
      const segmentFile = segments[i];
      const segmentNum = i + 1;
      const segmentStartTime = i * config.segmentDuration;

      console.log(`\n处理片段 ${segmentNum}/${segments.length} (${formatTime(segmentStartTime)} - ${formatTime(segmentStartTime + config.segmentDuration)})...`);

      try {
        const result = await recognizeTask(segmentFile, config);

        results.push({
          segment: segmentNum,
          text: result.text.trim(),
          startTime: segmentStartTime,
          logid: result.logid,
          statusCode: result.statusCode,
        });

        if (saveJson) {
          jsonResponses.push({
            segment: segmentNum,
            startTime: segmentStartTime,
            response: result.fullResponse,
          });
        }

        console.log(`✓ 识别成功`);
        if (result.text.trim()) {
          console.log(`  结果: ${result.text.substring(0, 100)}${result.text.length > 100 ? '...' : ''}`);
        } else {
          console.log(`  结果: (空)`);
        }
      } catch (error) {
        console.error(`✗ 识别失败:`, error);
        results.push({
          segment: segmentNum,
          text: `[识别失败: ${error instanceof Error ? error.message : String(error)}]`,
          startTime: segmentStartTime,
          logid: null,
          statusCode: null,
        });
      }
    }

    // 3. 保存结果
    console.log('\n步骤 3: 保存识别结果...');
    let outputContent = `火山引擎 ASR 识别结果\n`;
    outputContent += `生成时间: ${new Date().toLocaleString('zh-CN')}\n`;
    outputContent += `输入文件: ${inputFile}\n`;
    outputContent += `总片段数: ${results.length}\n`;
    outputContent += `程序运行耗时: ${((Date.now() - startTime) / 1000).toFixed(2)} 秒\n`;
    outputContent += `${'='.repeat(60)}\n\n`;

    results.forEach((result) => {
      const startTime = result.startTime;
      const endTime = startTime + config.segmentDuration;
      const timeStr = `${formatTime(startTime)} - ${formatTime(endTime)}`;

      outputContent += `片段 ${result.segment} [${timeStr}]\n`;
      if (result.logid) {
        outputContent += `LogID: ${result.logid}\n`;
      }
      outputContent += `${'-'.repeat(60)}\n`;
      outputContent += `${result.text}\n\n`;
    });

    // 合并所有文本
    outputContent += `${'='.repeat(60)}\n`;
    outputContent += `合并结果:\n`;
    outputContent += `${'='.repeat(60)}\n\n`;
    const mergedText = results.map(r => r.text).join('\n');
    outputContent += mergedText;

    fs.writeFileSync(outputFile, outputContent, 'utf-8');
    console.log(`✓ 结果已保存到: ${outputFile}`);

    // 如果启用了保存 JSON，保存完整响应
    if (saveJson && jsonResponses.length > 0) {
      const jsonFile = outputFile.replace('.txt', '.json');
      fs.writeFileSync(
        jsonFile,
        JSON.stringify(jsonResponses, null, 2),
        'utf-8'
      );
      console.log(`✓ JSON 响应已保存到: ${jsonFile}`);
    }

    // 统计信息
    console.log('\n统计信息:');
    console.log(`  总片段数: ${results.length}`);
    console.log(`  成功识别: ${results.filter(r => !r.text.includes('[识别失败')).length}`);
    console.log(`  失败片段: ${results.filter(r => r.text.includes('[识别失败')).length}`);
    console.log(`  总字符数: ${mergedText.length}`);
    console.log(`  程序运行耗时: ${((Date.now() - startTime) / 1000).toFixed(2)} 秒`);

  } catch (error) {
    console.error('\n错误:', error);
    process.exit(1);
  } finally {
    // 清理临时文件
    cleanupTempFiles(segmentFiles, tempDir);
  }

  console.log('\n完成!');
}

// 运行主函数
main().catch(error => {
  console.error('未处理的错误:', error);
  process.exit(1);
});

