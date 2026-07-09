/**
 * 抖音多账号 — HTTP API 后端（比特浏览器版）
 * 
 * 启动: node server/server.mjs
 */

import http from 'http';
import { spawn } from 'child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync, createReadStream } from 'fs';
import { extname } from 'path';
import { pool } from './browser-pool.js';
import {
  PORT, BIT_API, BIT_KEY, LX_USERNAME, LX_PASSWORD,
  DEEPSEEK_KEY, DEEPSEEK_API, AI_ENABLED,
  PROFILES, NODE_PATH, BROWSERS_PATH
} from './config.js';

const PROJECT_DIR = process.cwd();

let loginStatuses = {};

async function bitApi(path, data = {}) {
  const r = await fetch(BIT_API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': BIT_KEY },
    body: JSON.stringify(data)
  });
  return r.json();
}

function runScript(script, args = [], env = {}) {
  return new Promise((resolve, reject) => {
    const cmd = 'node';
    const scriptPath = PROJECT_DIR + '/server/' + script;
    const fullArgs = [scriptPath, ...args];
    const proc = spawn(cmd, fullArgs, {
      cwd: PROJECT_DIR,
      env: { ...process.env, NODE_PATH, PLAYWRIGHT_BROWSERS_PATH: BROWSERS_PATH, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let output = '';
    let resolved = false;
    proc.stdout.on('data', data => {
      const text = data.toString();
      output += text;
      // __READY__ 信号：页面导航完成，立即返回给前端，不等退出延迟
      if (!resolved && text.includes('__READY__')) {
        resolved = true;
        resolve({ code: 0, output });
      }
    });
    proc.stderr.on('data', data => { output += data.toString(); });
    proc.on('close', code => {
      if (!resolved) resolve({ code, output });
    });
    proc.on('error', err => reject(err));
    setTimeout(() => { proc.kill(); resolve({ code: -1, output: output + '\n⏰ 执行超时' }); }, 120000);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS — 只允许本机来源
  const origin = req.headers['origin'] || '';
  const allowedOrigins = ['http://localhost:3456', 'http://127.0.0.1:3456', 'null'];
  const allowOrigin = allowedOrigins.includes(origin) ? origin : (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') ? origin : 'http://localhost:3456');
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.end(); return; }

  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  try {
    // POST /api/ai-generate — 生成单条评论
    if (path === '/api/ai-generate') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        const data = JSON.parse(body || '{}');
        const topic = data.topic || '直播间互动评论';
        const style = data.style || '友好';
        const count = data.count || 1;

        if (!AI_ENABLED) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: '未配置 DEEPSEEK_KEY' }));
          return;
        }

        try {
          const r = await fetch(DEEPSEEK_API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + DEEPSEEK_KEY
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              messages: [{
                role: 'user',
                content: '你是一个抖音直播间互动助手。请生成' + count + '条短评论，每条不超过25个字。风格：' + style + '。主题/场景：' + topic + '。要求：自然口语化、不重复、适合直播间互动。只输出评论，每行一条，不要编号。'
              }],
              max_tokens: 200,
              temperature: 0.9
            })
          });
          const result = await r.json();
          const text = result.choices?.[0]?.message?.content || '';
          const comments = text.split('\n').map(s => s.trim()).filter(s => s && s.length <= 25);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ comments, raw: text }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    // POST /api/login — 服务端登录验证
    if (path === '/api/login') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const data = JSON.parse(body || '{}');
        const ok = data.username === LX_USERNAME && data.password === LX_PASSWORD;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: ok, error: ok ? '' : '账号或密码错误' }));
      });
      return;
    }

    // GET /api/status
    if (path === '/api/status' && req.method === 'GET') {
      // 读取 check-login.mjs 写出的缓存
      try {
        if (existsSync('/tmp/douyin_login_cache.json')) {
          loginStatuses = JSON.parse(readFileSync('/tmp/douyin_login_cache.json', 'utf-8'));
        }
      } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', profiles: Object.keys(PROFILES), loginStatuses }));
      return;
    }

    // POST /api/first — 启动浏览器（持久CDP连接）
    if (path === '/api/first') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body || '{}');
          const { liveId = '', account = '' } = data;
          const uid = PROFILES[account];
          if (!liveId || !uid) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, errorCode: 'INVALID_PARAMS', error: '缺少参数', data: null }));
            return;
          }
          await pool.connect(account, uid, bitApi, liveId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, data: { message: '启动成功' } }));
        } catch (e) {
          const code = e.message.includes('超时') ? 'BROWSER_TIMEOUT' : 'BROWSER_START_FAILED';
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, errorCode: code, error: e.message, data: null }));
        }
      });
      return;
    }

    // POST /api/send — 发送评论
    if (path === '/api/send') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body || '{}');
          const { msg = '你好', account = '' } = data;
          if (!account) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, errorCode: 'INVALID_PARAMS', error: '缺少账号参数', data: null }));
            return;
          }
          const result = await pool.send(account, msg);
          res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result.success ? { success: true, data: { message: result.message } } : { success: false, errorCode: result.errorCode, error: result.error, data: null }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, errorCode: 'UNKNOWN_ERROR', error: e.message, data: null }));
        }
      });
      return;
    }

    // POST /api/run — 执行命令
    if (path === '/api/run') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        const data = JSON.parse(body || '{}');
        const cmd = data.cmd || '';
        const account = data.account || '';

        if (cmd === 'check-browser') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          const running = await pool.checkStatus(account);
          res.end(JSON.stringify({ running }));
          return;
        }

        if (cmd === 'start-browser' || cmd === 'mark-logged') {
          const uid = PROFILES[account];
          res.writeHead(200, { 'Content-Type': 'application/json' });
          if (!uid) { res.end(JSON.stringify({ code: -1, error: 'unknown account' })); return; }
          try {
            const url = data.url || 'https://www.douyin.com';
            await bitApi('/browser/open', { id: uid, open_urls: url });
            res.end(JSON.stringify({ code: 0 }));
          } catch (e) {
            res.end(JSON.stringify({ code: -1, error: e.message }));
          }
          return;
        }

        if (cmd === 'show-browser') {
          const ok = await pool.showWindow(account);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: ok ? 0 : -1, output: ok ? '窗口已显示' : '显示失败' }));
          return;
        }

        if (cmd === 'hide-browser') {
          const ok = await pool.hideWindow(account);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: ok ? 0 : -1, output: ok ? '窗口已隐藏' : '隐藏失败' }));
          return;
        }

        if (cmd === 'stop-browser') {
          const uid = PROFILES[account];
          res.writeHead(200, { 'Content-Type': 'application/json' });
          if (uid) {
            try {
              // 1. 从连接池断连（CDP优雅关闭+flush cookie）
              await pool.disconnect(account);
              // 2. API 强关
              await bitApi('/browser/close', { id: uid });
              res.end(JSON.stringify({ code: 0 }));
            } catch (e) {
              res.end(JSON.stringify({ code: -1, error: e.message }));
            }
          } else { res.end(JSON.stringify({ code: -1, error: 'unknown account' })); }
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: -1, error: '未知命令' }));
      });
      return;
    }

    // POST /api/check-login — 检测登录状态（调用 check-login.mjs）
    if (path === '/api/check-login') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        const data = JSON.parse(body || '{}');
        const result = await runScript('check-login.mjs', data.account ? ['--account=' + data.account] : []);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: result.code === 0 ? 'ok' : 'error', output: result.output }));
      });
      return;
    }

    // POST /api/import-scripts — 保存词集
    if (path === '/api/import-scripts') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const data = JSON.parse(body || '{}');
        try {
          const dir = '/tmp/lxcc_scripts';
          if (!existsSync(dir)) mkdirSync(dir);
          const safeName = (data.name || 'default').replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '_').substring(0, 50) || 'default';
          writeFileSync(dir + '/' + safeName + '.json', JSON.stringify(data.words || []));
        } catch {}
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      });
      return;
    }

    // 静态文件服务 — 从 public/ 提供
    const MIME = { '.html': 'text/html;charset=utf-8', '.css': 'text/css;charset=utf-8', '.js': 'application/javascript;charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
    const filePath = PROJECT_DIR + '/public' + (path === '/' ? '/index.html' : path);
    if (existsSync(filePath)) {
      const ext = extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      createReadStream(filePath).pipe(res);
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));

  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

export function startServer(port = PORT) {
  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log('🤖 比特浏览器后端 :' + port);
      if (AI_ENABLED) console.log('🧠 DeepSeek AI 已就绪'); else console.log('⚠️ DeepSeek AI 未配置 (设 DEEPSEEK_KEY 环境变量)');
      resolve(server);
    });
  });
}

// 直接运行时自动启动 (node server/server.mjs)
const isDirectRun = process.argv[1] && (process.argv[1].endsWith('server.mjs') || process.argv[1].endsWith('server/server.mjs'));
if (isDirectRun) {
  startServer(PORT);
}
