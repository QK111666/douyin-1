/**
 * 抖音多账号 — HTTP API 后端（比特浏览器版）
 * 
 * 启动: node server/server.mjs
 */

import http from 'http';
import { spawn } from 'child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync, createReadStream } from 'fs';
import { extname } from 'path';
import { handleFirst } from './routes/first.js';
import { handleSend } from './routes/send.js';

const PORT = 3456;
const BIT_API = 'http://localhost:54345';
const BIT_KEY = process.env.BIT_KEY || '';
if (!BIT_KEY) { console.error('❌ 需要设置环境变量 BIT_KEY'); process.exit(1); }

// 登录鉴权配置
const LX_USERNAME = process.env.LX_USERNAME || 'admin';
const LX_PASSWORD = process.env.LX_PASSWORD || (() => {
  try { return readFileSync('/tmp/lx_password.txt', 'utf8').trim(); } catch { return 'admin'; }
})();

// DeepSeek AI 配置
const DEEPSEEK_KEY = (() => {
  try { return readFileSync('/tmp/deepseek_key.txt', 'utf8').trim(); }
  catch { return process.env.DEEPSEEK_KEY || ''; }
})();
const DEEPSEEK_API = 'https://api.deepseek.com/v1/chat/completions';
const AI_ENABLED = !!DEEPSEEK_KEY;
const PROJECT_DIR = process.cwd();

let NODE_PATH = '';
if (existsSync(PROJECT_DIR + '/node_modules')) NODE_PATH = PROJECT_DIR + '/node_modules';
else if (existsSync(PROJECT_DIR + '/../node_modules')) NODE_PATH = PROJECT_DIR + '/../node_modules';
else NODE_PATH = '/Users/mac/Desktop/lx/node_modules';

let BROWSERS_PATH = PROJECT_DIR + '/../browsers';
if (!existsSync(BROWSERS_PATH)) {
  const altPaths = [PROJECT_DIR + '/browsers', PROJECT_DIR + '/../lx/browsers'];
  for (const p of altPaths) {
    if (existsSync(p)) { BROWSERS_PATH = p; break; }
  }
}

const PROFILES = {
  zh1: '181a2fc64f47429d817e647569f72c2d',
  zh2: '1e102d85738a473186df65556b103ca2',
  zh3: 'e2d0b41016a44d8f99f4b2ada455b703',
  zh4: '5bcfba45002240e0b9b0e72026e71fa2',
  zh5: 'b5e1aa36d1b3472ba37590c53b551e10',
  zh6: '5da62ece312941b2870c28bb7c223366',
  zh7: '495196ecf5ab439993a12860c9a353d1',
  zh8: '85c9214c164645be9eac70bdd8686905',
  zh9: '76ceabe7719440228ab37e049610d292',
  zh10: '8e8c34beebbb40d191c750fb6b1aba93',
};

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

    // POST /api/first — 启动浏览器
    if (path === '/api/first') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        const data = JSON.parse(body || '{}');
        await handleFirst(req, res, data);
      });
      return;
    }

    // POST /api/send — 发送评论
    if (path === '/api/send') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        const data = JSON.parse(body || '{}');
        await handleSend(req, res, data);
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
          const uid = PROFILES[account];
          res.writeHead(200, { 'Content-Type': 'application/json' });
          if (uid) {
            try {
              // 用 browser/list 查询（不会启动新浏览器）
              const r = await bitApi('/browser/list', { page: 1, pageSize: 100 });
              const list = r.data?.list || [];
              const running = list.some(item => item.id === uid);
              res.end(JSON.stringify({ running }));
            } catch (e) {
              res.end(JSON.stringify({ running: false, error: e.message }));
            }
          } else {
            res.end(JSON.stringify({ running: false, error: 'unknown account' }));
          }
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
          // 恢复浏览器窗口到前台
          const result = await runScript('ads-tool.mjs', ['--show', '--account', account]);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ code: result.code, output: result.output.substring(0, 200) }));
          return;
        }

        if (cmd === 'stop-browser') {
          const uid = PROFILES[account];
          res.writeHead(200, { 'Content-Type': 'application/json' });
          if (uid) {
            try {
              // 1. 先尝试 CDP 连接（触发浏览器 flush cookie 到磁盘）
              try {
                const openRes = await bitApi('/browser/open', { id: uid });
                if (openRes.success && openRes.data?.ws) {
                  const wsData = openRes.data.ws;
                  const wsUrl = typeof wsData === 'string' ? wsData : (wsData?.puppeteer || wsData?.selenium || null);
                  if (!wsUrl) throw new Error('无法获取 WS 地址');
                  const { chromium } = await import('playwright');
                  const browser = await chromium.connectOverCDP(wsUrl);
                  // 给浏览器 2 秒写 cookie/session
                  await new Promise(r => setTimeout(r, 2000));
                  await browser.close().catch(() => {});
                }
              } catch(e) {
                // CDP 优雅关闭失败，继续走 API 强关
              }
              // 2. 最后 API 强关
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
          writeFileSync(dir + '/' + (data.name || 'default') + '.json', JSON.stringify(data.words || []));
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
