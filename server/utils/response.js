/**
 * 统一响应格式工具
 */

/**
 * 发送成功响应
 * @param {object} res - HTTP response 对象
 * @param {object} data - 响应数据
 * @param {number} statusCode - HTTP 状态码，默认 200
 */
export function sendSuccess(res, data = {}, statusCode = 200) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: true,
    data
  }));
}

/**
 * 发送错误响应
 * @param {object} res - HTTP response 对象
 * @param {string} error - 错误信息
 * @param {number} statusCode - HTTP 状态码，默认 400
 * @param {string} errorCode - 错误码，默认 'UNKNOWN_ERROR'
 */
export function sendError(res, error = 'Unknown error', statusCode = 400, errorCode = 'UNKNOWN_ERROR') {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: false,
    errorCode,
    error,
    data: null
  }));
}

export default { sendSuccess, sendError };
