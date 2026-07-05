/**
 * 抖音多账号 — 比特浏览器版 v2
 * 
 * 启动: node src/ads-tool.mjs --live 629979087422 --account zh1
 * 发送: node src/ads-tool.mjs --send "你好" --account zh1
 * 
 * v2: 启动后按顺序层叠堆放窗口
 */

import { chromium } from 'playwright';

const BIT_API = 'http://localhost:54345';
const BIT_KEY = process.env.BIT_KEY || '';
if (!BIT_KEY) { console.error('❌ 需要设置环境变量 BIT_KEY'); process.exit(1); }

const args = process.argv.slice(2);
const PROFILES = [
  { id: '181a2fc64f47429d817e647569f72c2d', name: 'zh1' },
  { id: '1e102d85738a473186df65556b103ca2', name: 'zh2' },
  { id: 'e2d0b41016a44d8f99f4b2ada455b703', name: 'zh3' },
  { id: '5bcfba45002240e0b9b0e72026e71fa2', name: 'zh4' },
  { id: 'b5e1aa36d1b3472ba37590c53b551e10', name: 'zh5' },
  { id: '5da62ece312941b2870c28bb7c223366', name: 'zh6' },
  { id: '495196ecf5ab439993a12860c9a353d1', name: 'zh7' },
  { id: '85c9214c164645be9eac70bdd8686905', name: 'zh8' },
  { id: '76ceabe7719440228ab37e049610d292', name: 'zh9' },
  { id: '8e8c34beebbb40d191c750fb6b1aba93', name: 'zh10' }
];

// 层叠参数：每个窗口偏移 40px，最多叠满 600px 后从头开始
const CASCADE_STEP = 40;
const CASCADE_WRAP = 600;
const WIN_W = 540;
const WIN_H = 880;
const BASE_LEFT = 100;
const BASE_TOP = 80;

const isFirst = args.includes('--first');
const isShow = args.includes('--show');
let customLiveId = '';
let customMsg = '';
let targetAccount = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--live' && args[i+1]) customLiveId = args[i+1];
  if (args[i] === '--send' && args[i+1]) customMsg = args[i+1];
  if (args[i] === '--account' && args[i+1]) targetAccount = args[i+1];
}

const LIVE_ID = customLiveId;
const msg = customMsg || '你好';

// 统一的错误输出格式
function exitWithError(errorCode, errorMsg) {
  console.log(JSON.stringify({
    success: false,
    errorCode,
    error: errorMsg
  }));
  process.exit(1);
}

// 成功输出格式
function exitWithSuccess(msg) {
  console.log(JSON.stringify({
    success: true,
    message: msg
  }));
  console.log('__READY__');
  process.exit(0);
}

async function bitApi(path, data = {}) {
  const r = await fetch(BIT_API + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': BIT_KEY
    },
    body: JSON.stringify(data)
  });
  return r.json();
}

async function openBrowser(profile) {
  const res = await bitApi('/browser/open', { id: profile.id });
  if (!res.success) {
    exitWithError('BROWSER_START_FAILED', profile.name + ' 启动失败: ' + res.msg);
  }
  // 比特 API ws 返回的是对象 {puppeteer, selenium, http}，需要提 puppeteer 字段
  const wsData = res.data.ws;
  const wsUrl = (typeof wsData === 'string') ? wsData : (wsData?.puppeteer || wsData?.selenium || null);
  if (!wsUrl) {
    exitWithError('BROWSER_START_FAILED', profile.name + ' 无法获取 WebSocket 地址');
  }
  return { ws: wsUrl };
}

async function closeBrowser(profile) {
  await bitApi('/browser/close', { id: profile.id });
}

async function cascadeWindow(page, index) {
  try {
    const cdp = await page.context().newCDPSession(page);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    const offset = (index * CASCADE_STEP) % CASCADE_WRAP;
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: { left: BASE_LEFT + offset, top: BASE_TOP + offset, width: WIN_W, height: WIN_H }
    });
  } catch (e) {
    console.error('窗口定位失败: ' + e.message);
  }
}

// 最小化浏览器窗口（启动后自动隐藏）
async function minimizeWindow(page) {
  try {
    const cdp = await page.context().newCDPSession(page);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: { windowState: 'minimized' }
    });
    return true;
  } catch (e) {
    console.error('最小化失败: ' + e.message);
    return false;
  }
}

// 恢复浏览器窗口（显示出来）
async function restoreWindow(page, index) {
  try {
    const cdp = await page.context().newCDPSession(page);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    const offset = (index * CASCADE_STEP) % CASCADE_WRAP;
    await cdp.send('Browser.setWindowBounds', {
      windowId,
      bounds: { windowState: 'normal', left: BASE_LEFT + offset, top: BASE_TOP + offset, width: WIN_W, height: WIN_H }
    });
    await page.bringToFront();
    return true;
  } catch (e) {
    console.error('恢复窗口失败: ' + e.message);
    return false;
  }
}

async function connectCDPWithRetry(wsUrl, maxWait = 10000) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < maxWait) {
    try {
      return await chromium.connectOverCDP(wsUrl);
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 300));
    }
  }
  exitWithError('BROWSER_TIMEOUT', 'CDP 连接超时');
}

async function getPageForProfile(profile, index) {
  const result = await openBrowser(profile);
  if (!result) {
    exitWithError('BROWSER_START_FAILED', profile.name + ' 浏览器启动失败');
  }

  try {
    const browser = await connectCDPWithRetry(result.ws);

    const pages = [];
    for (const ctx of browser.contexts()) {
      for (const p of ctx.pages()) { pages.push(p); }
      try { await ctx.setViewportSize({ width: 420, height: 750 }); } catch (e) {
        // 视口大小设置失败，继续
      }
    }
    for (let i = 0; i < pages.length - 1; i++) { await pages[i].close(); }

    const page = pages[pages.length - 1];
    await cascadeWindow(page, index);

    return { browser, page };
  } catch (e) {
    exitWithError('BROWSER_START_FAILED', '浏览器连接失败: ' + e.message);
  }
}

function getProfileIndex(profile) {
  return PROFILES.findIndex(p => p.id === profile.id);
}

async function main() {
  let profiles = PROFILES;
  if (targetAccount) {
    profiles = PROFILES.filter(p => p.name === targetAccount);
  }

  if (isFirst) {
    for (const p of profiles) {
      const idx = getProfileIndex(p);
      const sp = await getPageForProfile(p, idx >= 0 ? idx : 0);
      if (!sp) {
        exitWithError('BROWSER_START_FAILED', p.name + ' 启动失败');
      }
      try {
        await sp.page.goto('https://live.douyin.com/' + LIVE_ID, { waitUntil: 'domcontentloaded' });
        // 自动最小化浏览器窗口，不让它挡住 app
        await minimizeWindow(sp.page);
        console.log('✅ ' + p.name + ' 已进入直播间 (已隐藏)');
      } catch (e) {
        exitWithError('NOT_IN_LIVE_ROOM', p.name + ' 进入直播间失败: ' + e.message);
      }
    }
    exitWithSuccess('所有账号已启动');
  } else if (isShow) {
    // --show 模式：恢复浏览器窗口到前台
    for (const p of profiles) {
      const idx = getProfileIndex(p);
      const sp = await getPageForProfile(p, idx >= 0 ? idx : 0);
      if (!sp) {
        exitWithError('BROWSER_OFFLINE', p.name + ' 浏览器已离线');
      }

      let targetPage = null;
      for (const ctx of sp.browser.contexts()) {
        for (const pg of ctx.pages()) {
          if (pg.url().includes('live.douyin.com')) { targetPage = pg; break; }
        }
        if (targetPage) break;
      }
      const pg = targetPage || sp.page;
      await restoreWindow(pg, idx >= 0 ? idx : 0);
      console.log('✅ ' + p.name + ' 窗口已显示');
      // 保留连接让窗口保持在前台
    }
    exitWithSuccess('窗口已显示');
  } else {
    // --send 模式：发送消息
    for (const p of profiles) {
      const idx = getProfileIndex(p);
      const sp = await getPageForProfile(p, idx >= 0 ? idx : 0);
      if (!sp) {
        exitWithError('BROWSER_OFFLINE', p.name + ' 浏览器已离线');
      }

      await new Promise(r => setTimeout(r, 3000));

      let targetPage = null;
      for (const ctx of sp.browser.contexts()) {
        for (const pg of ctx.pages()) {
          if (pg.url().includes('live.douyin.com')) { targetPage = pg; break; }
        }
        if (targetPage) break;
      }

      const pg = targetPage || sp.page;

      const el = await pg.$('[contenteditable="true"]');
      if (el) {
        try {
          await el.click();
          await pg.waitForTimeout(500);
          await el.fill(msg);
          await pg.waitForTimeout(500);
          await pg.keyboard.press('Enter');
          console.log('✅ ' + p.name + ' -> "' + msg + '"');
        } catch (e) {
          exitWithError('SEND_FAILED', p.name + ' 发送失败: ' + e.message);
        }
      } else {
        exitWithError('NOT_IN_LIVE_ROOM', p.name + ' 输入框未找到（可能不在直播间）');
      }
      // 断开发送的 CDP 连接，不关浏览器本身
      await sp.browser.close().catch(() => {
        // 连接已关闭或出错，忽略
      });
    }
    exitWithSuccess('消息已发送');
  }
}

main().then(() => {
  // 延迟退出，让浏览器有时间写 cookie
  setTimeout(() => process.exit(0), 2000);
}).catch(e => {
  exitWithError('UNKNOWN_ERROR', e.message || '未知错误');
});
