/**
 * POST /api/first — 启动浏览器
 */

import { PROFILES } from '../config.js';
import { runScript } from '../utils/script-executor.js';
import { sendSuccess, sendError } from '../utils/response.js';

export async function handleFirst(req, res, data) {
  try {
    const { liveId = '', account = '' } = data;
    const uid = PROFILES[account];

    if (!liveId || !uid) {
      sendError(res, '缺少参数: liveId 或 account', 400, 'INVALID_PARAMS');
      return;
    }

    const result = await runScript('ads-tool.mjs', ['--live', liveId, '--first', '--account', account]);
    let success = result.code === 0;

    // 尝试解析 ads-tool.mjs 返回的 JSON errorCode
    let errorCode = null;
    let errorMsg = '启动失败';
    try {
      const lines = result.output.split('\n');
      for (const line of lines) {
        if (line.startsWith('{')) {
          const parsed = JSON.parse(line);
          if (parsed.errorCode) {
            errorCode = parsed.errorCode;
            errorMsg = parsed.error || errorMsg;
          } else if (parsed.success === true) {
            success = true;
            errorMsg = parsed.message;
          }
        }
      }
    } catch (parseErr) {
      // JSON 解析失败，继续使用基于 output 的判断
    }

    console.log(`${account} 启动${success ? '成功' : '失败'}: ${result.output.substring(0, 100)}`);

    if (success) {
      sendSuccess(res, { message: '启动成功', output: result.output.substring(0, 200) });
    } else {
      // 使用从 ads-tool.mjs 返回的 errorCode
      if (errorCode) {
        const statusCode = errorCode === 'BROWSER_TIMEOUT' ? 500 : (errorCode === 'INVALID_PARAMS' ? 400 : 500);
        sendError(res, errorMsg, statusCode, errorCode);
      } else {
        // 降级方案：区分超时还是其他失败
        if (result.output && result.output.includes('timeout')) {
          sendError(res, '浏览器启动超时', 500, 'BROWSER_TIMEOUT');
        } else {
          sendError(res, '浏览器启动失败', 500, 'BROWSER_START_FAILED');
        }
      }
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      sendError(res, '网络连接失败', 500, 'NETWORK_ERROR');
    } else {
      sendError(res, err.message, 500, 'UNKNOWN_ERROR');
    }
  }
}
