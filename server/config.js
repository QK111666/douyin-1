/**
 * LLCC 后端配置
 * 集中读取环境变量、文件、硬编码配置
 */

import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const PROJECT_DIR = dirname(dirname(__filename));

// ============ 端口 ============
export const PORT = parseInt(process.env.PORT || '3456', 10);

// ============ 比特浏览器 API ============
export const BIT_API = process.env.BIT_API || 'http://localhost:54345';
export const BIT_KEY = (() => {
  const key = process.env.BIT_KEY || '';
  if (!key) {
    console.error('❌ 需要设置环境变量 BIT_KEY');
    process.exit(1);
  }
  return key;
})();

// ============ 登录鉴权 ============
export const LX_USERNAME = process.env.LX_USERNAME || 'admin';

export const LX_PASSWORD = (() => {
  const env = process.env.LX_PASSWORD;
  if (env) return env;

  const filePaths = [
    '/tmp/lx_password.txt',
    `${PROJECT_DIR}/config/.lx_password`
  ];

  for (const p of filePaths) {
    try {
      if (existsSync(p)) {
        return readFileSync(p, 'utf8').trim();
      }
    } catch (e) {
      console.warn('读取凭证文件异常:', e.message);
    }
  }

  return 'admin';
})();

// ============ DeepSeek AI ============
export const DEEPSEEK_KEY = (() => {
  const env = process.env.DEEPSEEK_KEY;
  if (env) return env;

  try {
    return readFileSync('/tmp/deepseek_key.txt', 'utf8').trim();
  } catch {
    return '';
  }
})();

export const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions';
export const AI_ENABLED = Boolean(DEEPSEEK_KEY);

// ============ 账号配置 ============
export const PROFILES = {
  zh1: '181a2fc64f47429d817e647569f72c2d',
  zh2: '1e102d85738a473186df65556b103ca2',
  zh3: 'e2d0b41016a44d8f99f4b2ada455b703',
  zh4: '5bcfba45002240e0b9b0e72026e71fa2',
  zh5: 'b5e1aa36d1b3472ba37590c53b551e10',
  zh6: '5da62ece312941b2870c28bb7c223366',
  zh7: '495196ecf5ab439993a12860c9a353d1',
  zh8: '85c9214c164645be9eac70bdd8686905',
  zh9: '76ceabe7719440228ab37e049610d292',
  zh10: '8e8c34beebbb40d191c750fb6b1aba93'
};

// ============ 路径配置 ============
export const NODE_PATH = (() => {
  const candidates = [
    `${PROJECT_DIR}/node_modules`,
    `${PROJECT_DIR}/../node_modules`,
    '/Users/mac/Desktop/lx/node_modules'
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  return `${PROJECT_DIR}/node_modules`;
})();

export const BROWSERS_PATH = (() => {
  const candidates = [
    `${PROJECT_DIR}/../browsers`,
    `${PROJECT_DIR}/browsers`,
    `${PROJECT_DIR}/../lx/browsers`
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  return `${PROJECT_DIR}/../browsers`;
})();

// ============ 超时配置（毫秒） ============
export const TIMEOUTS = {
  browserStart: 30000,      // 浏览器启动超时
  scriptExecution: 60000,   // 脚本执行超时
  apiCall: 10000,          // API调用超时
  aiGenerate: 20000        // AI生成超时
};

// ============ 重试配置 ============
export const RETRIES = {
  maxAttempts: 3,
  initialDelay: 1000,      // 初始延迟（毫秒）
  maxDelay: 10000          // 最大延迟（毫秒）
};

// ============ 日志配置 ============
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info'; // 'debug' | 'info' | 'warn' | 'error'
export const LOG_FILE = process.env.LOG_FILE || '/tmp/llcc.log';

export default {
  PORT,
  BIT_API,
  BIT_KEY,
  LX_USERNAME,
  LX_PASSWORD,
  DEEPSEEK_KEY,
  DEEPSEEK_API,
  AI_ENABLED,
  PROFILES,
  NODE_PATH,
  BROWSERS_PATH,
  TIMEOUTS,
  RETRIES,
  LOG_LEVEL,
  LOG_FILE,
  PROJECT_DIR
};
