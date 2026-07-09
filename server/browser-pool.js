/**
 * 浏览器持久连接池
 * 替代每次发送spawn新进程，改为维持CDP长连接复用
 *
 * 窗口策略：移出屏幕（窗口 state=normal 但 x=-10000）
 *   → send() 的 click+fill 事件序列正常触发，不会因 minimize 弹窗
 *   → showWindow() 才把窗口拉到屏幕中间
 */
import { chromium } from 'playwright';

// 屏幕外坐标，窗口保持 normal 状态但用户看不见
const OFFSCREEN_X = -10000;
const OFFSCREEN_Y = 0;

class BrowserPool {
  constructor() {
    this.conns = new Map();    // account → { browser, page, liveId }
    this.locked = new Map();   // account → Promise (防并发)
  }

  /**
   * 安全检测 page 是否存活，带超时（默认3秒）
   * 替代裸 page.evaluate(() => 1)，防止死 CDP 连接卡死整个流程
   */
  async _isAlive(page, timeoutMs = 3000) {
    try {
      await Promise.race([
        page.evaluate(() => 1),
        new Promise((_, reject) => setTimeout(() => reject(new Error('ALIVE_CHECK_TIMEOUT')), timeoutMs))
      ]);
      return true;
    } catch {
      return false;
    }
  }

  _wsUrlFrom(result) {
    const ws = result.data?.ws;
    if (!ws) return null;
    if (typeof ws === 'string') return ws;
    return ws.puppeteer || ws.selenium || null;
  }

  async _lock(account) {
    while (this.locked.has(account)) await this.locked.get(account);
    let release;
    const p = new Promise(r => { release = () => { this.locked.delete(account); r(); }; });
    this.locked.set(account, p);
    return release;
  }

  /**
   * 通过 CDP 把窗口移到屏幕外
   */
  async _moveOffScreen(page) {
    try {
      const cdp = await page.context().newCDPSession(page);
      const { windowId } = await cdp.send('Browser.getWindowForTarget');
      await cdp.send('Browser.setWindowBounds', {
        windowId,
        bounds: { left: OFFSCREEN_X, top: OFFSCREEN_Y, width: 420, height: 750, windowState: 'normal' }
      });
    } catch {}
  }

  /**
   * 打开浏览器并建立持久CDP连接
   */
  async connect(account, profileId, bitApi, liveId, opts = {}) {
    const release = await this._lock(account);
    try {
      // 已连接且直播间相同 → 验证存活后直接复用
      const existing = this.conns.get(account);
      if (existing && existing.liveId === liveId) {
        if (await this._isAlive(existing.page)) return existing;
        this.conns.delete(account);
      }
      // 已连接但直播间不同 或 连接已死 → 先断开
      if (existing) await this._disconnect(account);

      // 开浏览器
      const openRes = await bitApi('/browser/open', { id: profileId, open_urls: 'https://live.douyin.com/' + liveId });
      if (!openRes.success) throw new Error(openRes.msg || '启动失败');

      const wsUrl = this._wsUrlFrom(openRes);
      if (!wsUrl) throw new Error('无法获取 WebSocket 地址');

      // 带重试的CDP连接
      const maxWait = 10000, start = Date.now();
      let browser, lastErr;
      while (Date.now() - start < maxWait) {
        try { browser = await chromium.connectOverCDP(wsUrl); break; }
        catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 300)); }
      }
      if (!browser) throw new Error('CDP连接超时: ' + lastErr?.message);

      // 管理页面
      const pages = [];
      for (const ctx of browser.contexts()) {
        for (const p of ctx.pages()) pages.push(p);
        try { await ctx.setViewportSize({ width: 420, height: 750 }); } catch {}
      }
      // 关掉多余页面
      for (let i = 0; i < pages.length - 1; i++) await pages[i].close();
      let page = pages.length > 0 ? pages[pages.length - 1] : null;
      if (!page) page = await browser.contexts()[0].newPage();

      // 移到屏幕外（代替最小化）
      //   windowState=normal → click/fill 的事件序列正常触发，不会触发 macOS 窗口恢复
      if (opts.offscreen !== false) {
        await this._moveOffScreen(page);
      }

      // 导航到直播间
      await page.goto('https://live.douyin.com/' + liveId, { waitUntil: 'domcontentloaded', timeout: 15000 });

      // 导航后再次移屏 — page.goto 可能重置窗口位置
      if (opts.offscreen !== false) {
        await this._moveOffScreen(page);
      }

      const conn = { browser, page, liveId };
      this.conns.set(account, conn);
      return conn;
    } finally { release(); }
  }

  /**
   * 发送评论（复用已有CDP连接）
   *  窗口在屏幕外 state=normal → click+fill 完整事件序列正常触发
   *  → 风控事件不丢失 + 窗口不会弹到屏幕上
   */
  async send(account, msg) {
    const release = await this._lock(account);
    try {
      const conn = this.conns.get(account);
      if (!conn) return { success: false, errorCode: 'BROWSER_OFFLINE', error: '浏览器未连接' };

      // 验证连接存活（3秒超时）
      if (!(await this._isAlive(conn.page))) {
        this.conns.delete(account);
        return { success: false, errorCode: 'BROWSER_OFFLINE', error: 'CDP连接已断开' };
      }

      // 找直播页
      let targetPage = null;
      for (const ctx of conn.browser.contexts()) {
        for (const pg of ctx.pages()) {
          if (pg.url().includes('live.douyin.com')) { targetPage = pg; break; }
        }
        if (targetPage) break;
      }
      const pg = targetPage || conn.page;

      // 发送 — 完整事件序列，风控友好
      const el = await pg.$('[contenteditable="true"]');
      if (!el) return { success: false, errorCode: 'NOT_IN_LIVE_ROOM', error: '输入框未找到' };

      // 点击输入框获取焦点
      await el.click();
      await pg.waitForTimeout(300);

      // 清除已有内容：直接操作DOM + 派发input事件让React感知清空
      await el.evaluate(el => {
        el.textContent = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await pg.waitForTimeout(80);

      // 模拟真打字触发React完整事件链，el.fill()在contenteditable上不触发React更新
      await pg.keyboard.type(msg, { delay: 80 });
      await pg.waitForTimeout(300);

      // 找发送按钮点击（Enter在抖音contenteditable里会被当成换行，不触发发送）
      // 方案1：从输入框DOM层级往上找容器内的发送按钮
      let clicked = await el.evaluate(el => {
        const bar = el.closest('[class*="comment"],[class*="input"],[class*="chat"],[class*="footer"],[class*="bottom"]');
        if (!bar) return false;
        const btn = bar.querySelector('[class*="send"],[class*="Send"],[class*="submit"]');
        if (btn) { btn.click(); return true; }
        return false;
      });
      // 方案2：全局搜发送按钮
      if (!clicked) {
        const sendBtn = await pg.$('[class*="send"]:not([contenteditable])') || await pg.$('[class*="Send"]:not([contenteditable])');
        if (sendBtn) { await sendBtn.click(); clicked = true; }
      }
      // 兜底：按Enter
      if (!clicked) {
        await el.focus();
        await pg.waitForTimeout(80);
        await pg.keyboard.press('Enter');
      }

      // 兜底：发送后确保窗口仍在屏幕外（防止页面JS/视频播放把窗口拉回屏幕）
      await this._moveOffScreen(pg);

      return { success: true, message: '发送成功' };
    } catch (e) {
      return { success: false, errorCode: 'SEND_FAILED', error: e.message };
    } finally { release(); }
  }

  /**
   * 检查连接状态
   */
  async checkStatus(account) {
    const conn = this.conns.get(account);
    if (!conn) return false;
    if (await this._isAlive(conn.page)) return true;
    this.conns.delete(account);
    return false;
  }

  /**
   * 恢复/显示窗口 — 从屏幕外拉到屏幕中间
   */
  async showWindow(account) {
    const conn = this.conns.get(account);
    if (!conn) return false;
    try {
      const cdp = await conn.page.context().newCDPSession(conn.page);
      const { windowId } = await cdp.send('Browser.getWindowForTarget');
      await cdp.send('Browser.setWindowBounds', {
        windowId,
        bounds: { left: 100, top: 50, width: 420, height: 750, windowState: 'normal' }
      });
      await conn.page.bringToFront();
      return true;
    } catch { return false; }
  }

  /**
   * 隐藏窗口 — 移到屏幕外
   */
  async hideWindow(account) {
    const conn = this.conns.get(account);
    if (!conn) return false;
    try {
      await this._moveOffScreen(conn.page);
      return true;
    } catch { return false; }
  }

  /**
   * 断开单个账号（安全版：死连接不卡 browser.close()）
   */
  async _disconnect(account) {
    const conn = this.conns.get(account);
    if (conn) {
      this.conns.delete(account);  // 先删，防止其他地方拿到死引用
      // 仅当连接还活着时才优雅关闭；死了直接跳过
      const alive = await this._isAlive(conn.page, 2000);
      if (alive) {
        try { await conn.browser.close().catch(() => {}); } catch {}
      }
    }
  }
  async disconnect(account) {
    const release = await this._lock(account);
    try { await this._disconnect(account); }
    finally { release(); }
  }

  /**
   * 断开全部
   */
  async disconnectAll() {
    for (const [acc] of this.conns) await this.disconnect(acc);
  }
}

export const pool = new BrowserPool();
