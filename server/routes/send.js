/**
 * POST /api/send — 发送评论
 */

import { runScript } from '../utils/script-executor.js';
import { sendSuccess, sendError } from '../utils/response.js';

export async function handleSend(req, res, data) {
  try {
    const { msg = '你好', account = '' } = data;

    if (!account) {
      sendError(res, '缺少账号参数', 400, 'INVALID_PARAMS');
      return;
    }

    const result = await runScript('ads-tool.mjs', ['--send', msg, '--account', account]);
    let success = result.code === 0;

    // 尝试解析 ads-tool.mjs 返回的 JSON errorCode
    let errorCode = null;
    let errorMsg = '发送失败';
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

    console.log(`${account} 发送${success ? '成功' : '失败'}: ${result.output.substring(0, 100)}`);

    if (success) {
      sendSuccess(res, { message: '发送成功', output: result.output.substring(0, 200) });
    } else {
      // 使用从 ads-tool.mjs 返回的 errorCode，或者降级到基于输出字符串的猜测
      if (errorCode) {
        sendError(res, errorMsg, 400, errorCode);
      } else {
        // 降级方案：根据输出字符串猜测
        const output = result.output || '';
        if (output.includes('offline') || output.includes('浏览器')) {
          sendError(res, '浏览器已离线', 400, 'BROWSER_OFFLINE');
        } else if (output.includes('login') || output.includes('登录')) {
          sendError(res, '账号未登录', 401, 'NOT_LOGGED_IN');
        } else if (output.includes('live') || output.includes('直播间')) {
          sendError(res, '不在直播间', 400, 'NOT_IN_LIVE_ROOM');
        } else if (output.includes('rate') || output.includes('频繁')) {
          sendError(res, '发送过于频繁，请稍候', 429, 'SEND_RATE_LIMITED');
        } else {
          sendError(res, '发送失败', 500, 'SEND_FAILED');
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
