/**
 * 检测比特浏览器账号登录状态
 * 用法: node check-login.mjs [--account zh2]
 *
 * 注: 此脚本由 server.mjs 通过子进程调用，通过 __READY__ 信号返回结果
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'fs';
import { PROFILES } from './config.js';

const BIT_API = 'http://localhost:54345';
const BIT_KEY = process.env.BIT_KEY
  || (() => { try { return readFileSync('/tmp/bit_key.txt', 'utf-8').trim(); } catch { return ''; } })();
if (!BIT_KEY) { console.error('❌ 未设置 BIT_KEY'); process.exit(1); }

const CACHE_FILE = '/tmp/douyin_login_cache.json';
const accountProfiles = Object.entries(PROFILES).map(([name, id]) => ({ name, id }));

const args = process.argv.slice(2);
const accountOnly = args.find(a => a.startsWith('--account='))?.split('=')[1] || '';
const skipLogged = args.includes('--skip-logged');

function writeCache(data) {
  try { writeFileSync(CACHE_FILE, JSON.stringify(data)); } catch {}
}

function readCache() {
  try { return JSON.parse(readFileSync(CACHE_FILE, 'utf-8')); } catch { return {}; }
}

async function bitApi(path, data = {}) {
  const r = await fetch(BIT_API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': BIT_KEY },
    body: JSON.stringify(data)
  });
  return r.json();
}

async function getWsUrl(profile) {
  const res = await bitApi('/browser/open', { id: profile.id });
  if (!res.success) { console.error('❌ ${profile.name} 启动失败: ${res.msg}'); return null; }
  const wsData = res.data.ws;
  return (typeof wsData === 'string') ? wsData : (wsData?.puppeteer || wsData?.selenium || null);
}

async function stopBrowser(profile) {
  await bitApi('/browser/close', { id: profile.id });
}

async function checkProfile(profile) {
  const wsUrl = await getWsUrl(profile);
  if (!wsUrl) return '❌ 启动失败';
  try {
    const browser = await chromium.connectOverCDP(wsUrl);
    const pages = browser.contexts()[0]?.pages() || [];
    let loggedIn = false;
    for (const page of pages) {
      const cookies = await page.cookies();
      const hasSession = cookies.some(c => c.name.includes('sessionid') || c.name.includes('sid_guard') || c.name === 'sid_ucp_v2');
      if (hasSession) { loggedIn = true; break; }
    }
    await browser.close();
    await stopBrowser(profile);
    if (loggedIn) {
      writeCache({ ...readCache(), [profile.name]: 'logged_in' });
      return '✅ 在线';
    }
    writeCache({ ...readCache(), [profile.name]: 'not_logged_in' });
    return '⚠️ 未登录';
  } catch (e) {
    await stopBrowser(profile);
    return '❌ 检测失败: ' + e.message;
  }
}

async function main() {
  const cache = readCache();
  const profiles = accountOnly ? accountProfiles.filter(p => p.name === accountOnly) : accountProfiles;
  for (const p of profiles) {
    if (skipLogged && cache[p.name] === 'logged_in') continue;
    const status = await checkProfile(p);
    console.log(status + ' ' + p.name);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
