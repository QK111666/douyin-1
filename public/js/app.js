// ====== 工具函数 ======
function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function showProgress(text, pct) {
  const bar = document.getElementById('progressBar'), inner = document.getElementById('progressInner'), txt = document.getElementById('progressText');
  if (bar) bar.style.display = 'block';
  if (inner) inner.style.width = pct + '%';
  if (txt) { txt.style.display = 'block'; txt.textContent = text; }
}
function hideProgress() {
  const bar = document.getElementById('progressBar'), txt = document.getElementById('progressText');
  if (bar) bar.style.display = 'none'; if (txt) txt.style.display = 'none';
}
function showGuide(show) { const el = document.getElementById('emptyGuide'); if (el) el.style.display = show ? 'flex' : 'none'; }

async function callAPI(endpoint, data, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(API + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const json = await r.json();
    // 把 HTTP 状态码也带回去，方便上层判断
    json._httpStatus = r.status;
    return json;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      log('请求超时: ' + endpoint, 'err');
      return { success: false, errorCode: 'TIMEOUT', error: '请求超时' };
    }
    log('连接失败: ' + e.message, 'err');
    return { success: false, errorCode: 'NETWORK_ERROR', error: e.message };
  }
}

function getRandomWord(items, account, scriptName) {
  if (!items.length) return null;
  const historyKey = 'word_history_'+scriptName+'_'+account;
  let history = [];
  try { history = JSON.parse(localStorage.getItem(historyKey)||'[]'); } catch (e) { console.warn('历史记录异常:', e.message); }
  if (history.length >= items.length) history = [];
  const remainingIdx = [];
  for (let i = 0; i < items.length; i++) { if (!history.includes(i)) remainingIdx.push(i); }
  const randIdx = remainingIdx[Math.floor(Math.random() * remainingIdx.length)];
  history.push(randIdx);
  localStorage.setItem(historyKey, JSON.stringify(history));
  return { word: items[randIdx], index: randIdx };
}

function randomInterval(value) {
  const ranges = {1:[1,3],3:[3,8],5:[5,10],8:[8,13],10:[10,18],13:[13,25],15:[15,28],25:[25,38],30:[30,45],38:[38,50],50:[50,60],60:[55,70],70:[70,80]};
  const r = ranges[value];
  return r ? (Math.floor(Math.random()*(r[1]-r[0]+1))+r[0])*1000 : value*1000;
}

// ====== 核心日志函数 ======
function log(msg, type='') {
  const timeStr = new Date().toLocaleTimeString();
  const statusMap = {ok:'ok',err:'fail',send:'ok',start:'info',info:'info'};
  const iconMap = {ok:'\u2713',err:'\u2715',send:'\u2713',start:'\u2192',info:'\u2192'};
  const entry = {time:timeStr, msg, icon:iconMap[type]||'\u2022', statusClass:statusMap[type]||'info'};

  // 旧日志框
  const box = document.getElementById('logBox');
  if (box) {
    const icons = {ok:'✅',err:'❌',info:'\u2022',send:'💬',start:'🚀'};
    const div = document.createElement('div'); div.className = 'log-line';
    const ts = document.createElement('span'); ts.className = 'log-time'; ts.textContent = timeStr;
    const ms = document.createElement('span'); ms.className = 'log-text'; ms.style.color = type==='err'?'var(--error)':'var(--text-secondary)';
    ms.textContent = (icons[type]||'') + ' ' + msg;
    div.appendChild(ts); div.appendChild(ms);
    box.insertBefore(div, box.firstChild);
    if (box.children.length > 50) box.removeChild(box.lastChild);
  }

  globalLogs.push(entry);
  if (type === 'err') { for (const a of ACCOUNTS) { if (msg.includes(a)) { accountErrors[a]=true; break; } } }
  if (type === 'ok' || type === 'send') {
    for (const a of ACCOUNTS) {
      if (msg.includes('失败')) accountErrors[a]=true;
      else if (msg.includes(a)) accountErrors[a]=false;
    }
  }
  if (selectedAccount && msg.includes(selectedAccount)) detailLogs[selectedAccount].push(entry);

  const gl = document.getElementById('globalLogList');
  if (gl) {
    const li = document.createElement('div');
    li.className = 'log-item log-' + (type === 'err' ? 'error' : type === 'send' ? 'send' : type === 'ok' ? 'ok' : 'info');
    li.innerHTML = '<span class="log-item-time">'+timeStr+'</span><span class="log-item-msg">'+escapeHtml(msg)+'</span><span class="log-item-status '+entry.statusClass+'">'+entry.icon+'</span>';
    gl.appendChild(li); gl.scrollTop = gl.scrollHeight;
    while (gl.children.length > 200) gl.removeChild(gl.firstChild);
  }
  setText('globalLogCount', '共 '+globalLogs.length+' 条');
  updateDetailPanel();
}

// ====== 直播间历史 ======
function getLiveHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]'); } catch { return []; } }
function saveLiveHistory(hist) { localStorage.setItem(HISTORY_KEY, JSON.stringify(hist)); }
function addLiveToHistory(liveId) {
  let hist = getLiveHistory();
  hist = hist.filter(h => h.id !== liveId);
  hist.unshift({id:liveId, time:Date.now()});
  if (hist.length > MAX_HISTORY) hist = hist.slice(0, MAX_HISTORY);
  saveLiveHistory(hist);
  renderLiveHistory();
}
function renderLiveHistory() {
  const hist = getLiveHistory(), container = document.getElementById('liveHistory'), tags = document.getElementById('historyTags');
  if (!hist.length) { container.style.display='none'; return; }
  container.style.display = 'flex';
  tags.innerHTML = hist.map(h => '<span class="history-tag" onclick="selectLive(\''+h.id+'\')" title="点击填入">'+escapeHtml(h.id)+'</span>').join(' | ');
}
function selectLive(liveId) { const inp = document.getElementById('liveInput'); if (inp) inp.value = liveId; document.getElementById('btnEnter').click(); }

// ====== Toast 提示 ======
function showToast(msg, type) {
  const old = document.getElementById('toastMsg');
  if (old) old.remove();
  const t = document.createElement('div');
  t.id = 'toastMsg';
  t.textContent = msg;
  t.style.cssText = 'position:fixed;top:40px;left:50%;transform:translateX(-50%);z-index:9999;padding:6px 14px;border-radius:6px;font-size:11px;background:'+(type==='err'?'rgba(239,68,68,0.85)':'rgba(18,18,26,0.92)')+';color:#fff;border:1px solid rgba(34,34,46,0.2);pointer-events:none;transition:opacity 0.3s;';
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; setTimeout(() => t.remove(), 300); }, 2000);
}

// ====== 页面切换 / 选择账号 ======
function switchPage(idx) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('page-'+idx);
  if (target) target.classList.add('active');
  document.querySelectorAll('.sidebar-icon[data-page]').forEach(el => el.classList.toggle('active', parseInt(el.dataset.page)===idx));
  if (idx === 0) { renderAccountList(); updateDetailPanel(); refreshScriptSelectors(); }
  if (idx === 2) {
    const lastTab = localStorage.getItem('script_tab') || 'scripts';
    document.querySelectorAll('[data-stab]').forEach(t => t.classList.toggle('active', t.dataset.stab===lastTab));
    document.getElementById('scriptsListView').style.display = lastTab==='scripts' ? 'block' : 'none';
    document.getElementById('groupsListView').style.display = lastTab==='groups' ? 'block' : 'none';
    document.getElementById('btnApplyGroup').style.display = lastTab==='groups' ? 'inline-block' : 'none';
    document.getElementById('scriptPageTitle').textContent = lastTab==='groups' ? '📁 分组管理' : '💬 话术管理';
    isGroupView = lastTab==='groups';
    if (lastTab==='groups') renderGroups(); else { renderScripts(); autoSelectScript(); }
  }
}
function selectAccount(account) { selectedAccount = account; updateDetailPanel(); }

// ====== 渲染：账号列表 ======
function renderAccountList() {
  const container = document.getElementById('accountList');
  if (!container) return;
  container.innerHTML = '';
  const activeFilter = document.querySelector('.filter-tag.active');
  const filterVal = activeFilter ? activeFilter.dataset.filter : 'all';
  ACCOUNTS.forEach((acc, i) => {
    const isActive = acc === selectedAccount;
    const state = getAccountState(acc);
    const isOnline = state === 'ONLINE' || state === 'SENDING';
    const hasError = accountErrors[acc] || state === 'OFFLINE';
    if (filterVal==='online' && !isOnline) return;
    if (filterVal==='offline' && (isOnline||hasError)) return;
    if (filterVal==='error' && !hasError) return;
    if (accountFilter && !acc.toLowerCase().includes(accountFilter)) return;
    const colorIdx = i % AVATAR_COLORS.length;
    const row = document.createElement('div');
    let rc = 'account-row';
    if (isActive) rc += ' active';
    if (!isOnline && !hasError) rc += ' offline';
    if (batchSelected[acc]) rc += ' batch-selected';
    row.className = rc; row.dataset.account = acc;
    const cb = document.createElement('input'); cb.type='checkbox'; cb.className='row-checkbox';
    cb.checked = batchSelected[acc]||false;
    cb.onclick = e => { e.stopPropagation(); toggleBatch(acc); };
    const avatar = document.createElement('div'); avatar.className='row-avatar';
    avatar.style.background = AVATAR_COLORS[colorIdx];
    avatar.textContent = acc.replace('zh','').padStart(2,'0');
    const info = document.createElement('div'); info.className='row-info';
    const nd = document.createElement('div'); nd.className='row-name';
    nd.textContent = acc;
    if (hasError) nd.innerHTML = acc+' <span style="font-size:9px;color:rgba(239,68,68,0.4);">(报错)</span>';
    const sd = document.createElement('div'); sd.className='row-sub';
    const sn2 = selectedScript[acc] || '';
    const loggedIn = loginStatuses[acc];
    const statusText = hasError ? '⛔ 发送失败' : (isOnline ? '已启动 · '+(sendCounts[acc]||0)+'条'+(sn2?' · '+sn2:'') : (loggedIn ? '🔑 已登录 · 未启动' : '未启动'));
    sd.textContent = statusText;
    info.appendChild(nd); info.appendChild(sd);
    const ind = document.createElement('div');
    ind.className = 'row-indicator ' + (hasError ? 'error' : (isOnline ? 'online' : 'offline'));
    row.appendChild(cb); row.appendChild(avatar); row.appendChild(info); row.appendChild(ind);
    row.onclick = () => selectAccount(acc);
    container.appendChild(row);
  });
}

function toggleBatch(acc) {
  batchSelected[acc] = !batchSelected[acc];
  const count = Object.values(batchSelected).filter(Boolean).length;
  const bar = document.getElementById('batchBar'), cnt = document.getElementById('batchCount');
  if (cnt) cnt.textContent = '已选 '+count+' 个';
  if (bar) bar.classList.toggle('show', count>0);
  renderAccountList();
}
function updateFilter(filter) {
  document.querySelectorAll('#filterBar .filter-tag').forEach(t => t.classList.toggle('active', t.dataset.filter===filter));
  renderAccountList();
}
function updateLoginStatus(account, loggedIn) {
  const el = document.getElementById('loginStatus'), txt = document.getElementById('loginStatusText');
  if (!el||!txt) return;
  el.style.display = 'flex';
  el.className = 'login-status '+(loggedIn?'logged-in':'logged-out');
  txt.textContent = account + (loggedIn?' 已登录':' 未登录');
}

// ====== 渲染：详情面板 ======
function updateDetailPanel() {
  const acc = selectedAccount, idx = ACCOUNTS.indexOf(acc), colorIdx = idx>=0 ? idx%AVATAR_COLORS.length : 0;
  const av = document.getElementById('detailAvatar');
  if (av) { av.textContent=acc.replace('zh','').padStart(2,'0'); av.style.background=AVATAR_COLORS[colorIdx]; }
  setText('detailName', acc);
  const state = getAccountState(acc);
  const isOnline = state === 'ONLINE' || state === 'SENDING';
  const hasError = accountErrors[acc] || state === 'ERROR';
  const st = document.getElementById('detailStatus');
  if (st) {
    if (state === 'ERROR') {
      st.innerHTML = '● <span style="color:#ef4444;">出错</span>';
    } else if (state === 'STARTING') {
      st.innerHTML = '● <span style="color:#f59e0b;">启动中...</span>';
    } else if (isOnline) {
      st.innerHTML = '● <span style="color:#10b981;">在线</span>';
    } else {
      st.innerHTML = '○ 离线';
    }
  }

  const totalOnline = ACCOUNTS.filter(a => getAccountState(a) === 'ONLINE' || getAccountState(a) === 'SENDING').length;
  const totalError = ACCOUNTS.filter(a => accountErrors[a]).length;
  document.querySelectorAll('.filter-tag').forEach(t => {
    const f = t.dataset.filter;
    if (f==='all') t.textContent = '全部 '+ACCOUNTS.length;
    else if (f==='online') t.textContent = '在线 '+totalOnline;
    else if (f==='error') t.textContent = '报错 '+totalError;
    else if (f==='offline') t.textContent = '离线 '+(ACCOUNTS.length-totalOnline-totalError);
  });
  updateLoginStatus(acc, isOnline);
  renderAccountList();

  const totalSent = detailLogs[acc] ? detailLogs[acc].length : 0;
  setText('detailSendCount', '已发送 '+totalSent+' 条');
  const ll = document.getElementById('detailLogList');
  if (ll) {
    ll.innerHTML = '';
    if (detailLogs[acc]) detailLogs[acc].forEach(item => {
      const li = document.createElement('div');
      const typeClass = item.statusClass === 'fail' ? 'log-error' : item.statusClass === 'ok' ? 'log-ok' : 'log-info';
      li.className = 'log-item ' + typeClass;
      li.innerHTML = '<span class="log-item-time">'+item.time+'</span><span class="log-item-msg">'+escapeHtml(item.msg)+'</span><span class="log-item-status '+item.statusClass+'">'+item.icon+'</span>';
      ll.appendChild(li);
    });
    ll.scrollTop = ll.scrollHeight;
  }
  setText('detailLogCount', '共 '+(detailLogs[acc]?detailLogs[acc].length:0)+' 条');

  const timerSel = document.getElementById('detailTimerSelect');
  if (timerSel) {
    const ts = timerStates[acc];
    timerSel.value = ts && ts.interval ? String(ts.interval) : '0';
  }

  const pauseBtn = document.getElementById('detailPauseBtn');
  if (pauseBtn) pauseBtn.textContent = (timerStates[acc] && timerStates[acc].running) ? '⏸ 暂停' : '▶ 恢复';

  const scriptTag = document.getElementById('detailScriptTag');
  if (scriptTag) {
    const bound = selectedScript[acc];
    scriptTag.textContent = bound ? '💬 词集：'+bound : '💬 词集：无';
    scriptTag.style.background = bound ? 'rgba(34,197,94,0.08)' : 'transparent';
    scriptTag.style.color = bound ? 'rgba(34,197,94,0.55)' : 'rgba(161,161,170,0.3)';
    scriptTag.style.border = bound ? '1px solid rgba(34,197,94,0.12)' : '1px solid transparent';
    scriptTag.style.padding = '2px 6px';
    scriptTag.style.borderRadius = '4px';
  }

  // 发送模式切换按钮 + 输入框切换
  const sm = localStorage.getItem('send_mode_type_'+acc) || 'script';
  const modeBtn = document.getElementById('detailSendModeBtn');
  if (modeBtn) { modeBtn.textContent = sm === 'script' ? '📋' : '✍️'; modeBtn.title = sm === 'script' ? '词集发送 · 点击切换自定义' : '自定义发送 · 点击切换词集'; }
  const msgInput = document.getElementById('detailMsgInput');
  const scriptInput = document.getElementById('detailScriptInput');
  if (msgInput && scriptInput) {
    if (sm === 'script') { msgInput.style.display = 'none'; scriptInput.style.display = ''; }
    else { msgInput.style.display = ''; scriptInput.style.display = 'none'; }
  }
  const modeTag = document.getElementById('detailModeTag');
  if (modeTag) {
    const mode = localStorage.getItem('send_mode_'+acc) || 'sequence';
    modeTag.textContent = mode==='random' ? '🎲 模式：随机' : '➡ 模式：顺序';
  }

  // 窗口显隐按钮（小眼睛）
  const eyeBtn = document.getElementById('detailEyeBtn');
  if (eyeBtn) {
    const isVis = windowVisible[acc];
    eyeBtn.textContent = isVis ? '👁' : '👁‍🗨';
    eyeBtn.title = isVis ? '窗口可见 · 点击隐藏' : '窗口隐藏 · 点击显示';
    eyeBtn.style.opacity = isOnline ? '1' : '0.6';
    eyeBtn.style.background = isVis ? 'rgba(254,44,85,0.1)' : 'rgba(34,34,46,0.2)';
    eyeBtn.style.border = isVis ? '1px solid rgba(254,44,85,0.2)' : '1px solid rgba(34,34,46,0.3)';
    eyeBtn.style.borderRadius = '6px';
    eyeBtn.style.pointerEvents = isOnline ? 'auto' : 'none';
  }

  const startBtn = document.getElementById('detailStartBtn');
  if (startBtn) {
    const state = getAccountState(acc);
    if (state === 'ONLINE' || state === 'SENDING') {
      startBtn.textContent='已启动';
      startBtn.className='btn btn-secondary btn-sm';
      startBtn.disabled=true;
    } else if (state === 'STARTING') {
      startBtn.textContent='启动中...';
      startBtn.className='btn btn-warning btn-sm';
      startBtn.disabled=true;
    } else if (state === 'ERROR') {
      startBtn.textContent='出错 · 重新启动';
      startBtn.className='btn btn-danger btn-sm';
      startBtn.disabled=false;
    } else {
      startBtn.textContent='启动直播间';
      startBtn.className='btn btn-primary btn-sm';
      startBtn.disabled=false;
    }
  }
  updateStats();
}

// ====== 话术/分组/AI生成函数占位 ======
// 实际实现在 scripts.js 中
function renderScripts() {}
function autoSelectScript() {}
function refreshScriptSelectors() {}
function renderGroups() {}

// ====== 核心业务：浏览器管理 ======
// ====== 新状态管理函数 ======
function setAccountState(account, newState, error = null) {
  accountStatus[account].state = newState;
  accountStatus[account].lastError = error;
  if (newState === 'ONLINE') {
    accountStatus[account].failCount = 0;  // 恢复在线时重置失败计数
  }
  updateDetailPanel();
}

function getAccountState(account) {
  return accountStatus[account].state;
}
async function checkBrowserStatus(account) {
  try {
    const r = await fetch(API+'/api/run', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({cmd:'check-browser',account}) });
    const data = await r.json();
    if (data.running === true) {
      setAccountState(account, 'ONLINE');
    } else {
      setAccountState(account, 'OFFLINE');
    }
    return data.running===true;
  } catch { return false; }
}

// ====== 核心业务：定时器 ======
function stopTimer(account) {
  if (timerStates[account]) timerStates[account].running = false;
  if (timers[account]) { clearTimeout(timers[account]); delete timers[account]; }
}
function startTimerForAccount(account) {
  const interval = timerStates[account] && timerStates[account].interval>0 ? timerStates[account].interval : 0;
  if (interval <= 0) return;
  stopTimer(account);
  if (!timerStates[account]) timerStates[account] = {};
  timerStates[account].running = true;
  timerStates[account].interval = interval;
  async function tick() {
    if (globalPaused || !timerStates[account] || !timerStates[account].running) return;
    const sendMode = localStorage.getItem('send_mode_type_'+account) || 'script';
    const sn = selectedScript[account];
    let msg = '';
    if (sendMode === 'custom') {
      const inp = document.getElementById('detailMsgInput');
      msg = inp ? inp.value.trim() : '';
      if (!msg) msg = '你好';
    } else if (sn && scripts[sn] && scripts[sn].length) {
      const items = scripts[sn], mode = localStorage.getItem('send_mode_'+account)||'sequence';
      const ik = 'script_index_'+sn+'_'+account;
      let idx = parseInt(localStorage.getItem(ik)||'0');
      if (mode === 'random') { const r = getRandomWord(items,account,sn); if (r) { idx=r.index; msg=r.word; localStorage.setItem(ik,String((idx+1)%items.length)); } else msg='你好'; }
      else { if (idx>=items.length) idx=0; msg=items[idx]||'你好'; if (mode!=='random') localStorage.setItem(ik,String((idx+1)%items.length)); }
    } else {
      const inp = document.getElementById('detailMsgInput'), ginp = document.getElementById('globalMsg');
      msg = inp && account===selectedAccount ? inp.value.trim() : (ginp ? ginp.value.trim() : '');
      if (!msg) msg = '你好';
    }
    log('⏰ '+account+' -> "'+msg+'"', 'send');
    await callAPI('/api/send', {msg, account});
    if (timerStates[account] && timerStates[account].running) timers[account] = setTimeout(tick, randomInterval(interval));
  }
  tick();
  updateDetailPanel();
  log(account+' 定时已启动: '+interval+'s', 'info');
}

// ====== 核心业务：启动直播间 ======
async function startRoomForAccount(account) {
  if (!lockedLiveId) { log('❌ 请先确认直播间', 'err'); return; }

  // 防重复启动：如果已经在启动或已在线，直接返回
  const currentState = getAccountState(account);
  if (currentState === 'STARTING') {
    log(account + ' ℹ️ 正在启动中，请稍候...', 'info');
    return;
  }
  if (currentState === 'ONLINE' || currentState === 'SENDING') {
    log(account + ' ℹ️ 已经启动，无需重复启动', 'info');
    return;
  }

  stopTimer(account);
  setAccountState(account, 'STARTING');
  log('🚀 '+account+' 启动中...', 'start');

  try {
    const result = await callAPI('/api/first', {liveId:lockedLiveId, msg:'', account});

    // 防守性判断：只有 success === true 才认为成功（不是 !== false）
    if (result && result.success === true) {
      setAccountState(account, 'ONLINE');
      log('✅ '+account+' 已启动，可以发送了', 'ok');
    } else {
      // 优先用 errorCode，其次用 error 消息
      const errorCode = result?.errorCode || 'UNKNOWN';
      const errorMsg = result?.error || '启动失败';
      setAccountState(account, 'ERROR', errorMsg);
      accountStatus[account].errorCode = errorCode;
      log('❌ '+account+' 启动失败：' + errorMsg, 'err');
    }
  } catch (error) {
    setAccountState(account, 'ERROR', error.message || '网络错误');
    accountStatus[account].errorCode = 'NETWORK_ERROR';
    log('❌ '+account+' 启动异常：' + error.message, 'err');
  }

  if (account === selectedAccount) updateDetailPanel();
}

// ====== 核心业务：发送 ======
async function sendForAccount(account) {
  // 全局暂停时什么都不做
  if (globalPaused) return false;
  // 检查状态，只有 ONLINE 才能发送
  const state = getAccountState(account);
  if (state !== 'ONLINE') {
    if (state === 'ERROR') {
      log(account+' ⚠️ 账号出错：' + accountStatus[account].lastError, 'info');
    } else if (state === 'OFFLINE') {
      log(account+' ⚠️ 浏览器未启动，请先启动', 'info');
    } else if (state === 'STARTING') {
      log(account+' ⏳ 浏览器启动中，请稍候再发送', 'info');
    } else {
      log(account+' ⚠️ 账号状态异常（'+state+'），请检查', 'info');
    }
    return false;
  }

  setAccountState(account, 'SENDING');

  // 获取发送的消息（检查发送模式）
  const sendMode = localStorage.getItem('send_mode_type_'+account) || 'script';
  const sn = selectedScript[account];
  let msg = '';
  if (sendMode === 'custom') {
    // 自定义模式：强制用输入框
    const inp = document.getElementById('detailMsgInput');
    msg = inp ? inp.value.trim() : '';
    if (!msg) msg = '你好';
  } else if (sn && scripts[sn] && scripts[sn].length) {
    // 词集模式：用选中的词集
    const items = scripts[sn];
    const mode = localStorage.getItem('send_mode_'+account)||'sequence';
    const ik = 'script_index_'+sn+'_'+account;
    let idx = parseInt(localStorage.getItem(ik)||'0');
    if (mode === 'random') {
      const r = getRandomWord(items, account, sn);
      if (r) { idx = r.index; msg = r.word; localStorage.setItem(ik, String((idx+1)%items.length)); } else msg = '你好';
    } else {
      if (idx >= items.length) idx = 0;
      msg = items[idx]||'你好';
      if (mode !== 'random') localStorage.setItem(ik, String((idx+1)%items.length));
    }
  } else {
    if (account === selectedAccount) {
      const inp = document.getElementById('detailMsgInput');
      msg = inp ? inp.value.trim() : '';
    } else {
      const ginp = document.getElementById('globalMsg');
      msg = ginp ? ginp.value.trim() : '';
    }
    if (!msg) msg = '你好';
  }

  try {
    const result = await callAPI('/api/send', {msg, account, liveId: lockedLiveId});

    // 防守性判断：只有 success === true 才认为成功
    if (result && result.success === true) {
      // ✅ 发送成功
      sendCounts[account] = (sendCounts[account]||0) + 1;
      setAccountState(account, 'ONLINE', null);
      accountStatus[account].failCount = 0;
      accountStatus[account].errorCode = null;
      log('💬 '+account+' 已发送："'+msg+'"', 'send');
      updateDetailPanel();
      return true;
    } else {
      // ❌ API 返回失败，用错误码判断
      const errorCode = result?.errorCode || 'UNKNOWN_ERROR';
      const errorMsg = result?.error || '发送失败';
      return handleSendError(account, errorCode, errorMsg, msg);
    }
  } catch (error) {
    // ❌ 网络或其他错误
    return handleSendError(account, 'NETWORK_ERROR', error.message || '网络错误', msg);
  }
}

// 根据错误码精确处理
function handleSendError(account, errorCode, errorMsg, msg) {
  // 按错误码分类处理
  switch(errorCode) {
  case 'BROWSER_OFFLINE':
    // 浏览器离线 → 设为 OFFLINE，需要重新启动
    setAccountState(account, 'OFFLINE', '浏览器已关闭');
    log(account+' ⚠️ 浏览器已关闭，请重新启动', 'info');
    break;

  case 'NOT_LOGGED_IN':
    // 账号未登录 → 设为 OFFLINE，自动弹出窗口让用户登录
    setAccountState(account, 'OFFLINE', '账号未登录');
    accountStatus[account].errorCode = errorCode;
    log(account+' ⚠️ 账号登录过期，窗口已弹出，请登录', 'info');
    toggleWindow(account);  // 自动弹回屏幕中间
    break;

  case 'RATE_LIMITED':
    // 限流 → 保持 ONLINE，自动重试
    accountStatus[account].failCount++;
    setAccountState(account, 'ONLINE', '发送过于频繁');
    log(account+' ⚠️ 发送过于频繁，自动延缓', 'info');
    if (accountStatus[account].failCount < 5) {
      timers[account] = setTimeout(() => sendForAccount(account), 2000 * accountStatus[account].failCount);
    }
    break;

  case 'NETWORK_ERROR':
  case 'TIMEOUT':
    // 网络错误/超时 → 自动重试，重试耗尽后重置状态
    accountStatus[account].failCount++;
    if (accountStatus[account].failCount < 3) {
      setAccountState(account, 'ONLINE', errorCode === 'TIMEOUT' ? '请求超时' : '网络错误');
      log(account+' ⚠️ ' + (errorCode === 'TIMEOUT' ? '请求超时' : '网络错误') + '，自动重试('+accountStatus[account].failCount+'/3)...', 'info');
      timers[account] = setTimeout(() => sendForAccount(account), 1000 * accountStatus[account].failCount);
    } else {
      // 3次重试全部失败，回退到ONLINE并清除发送中状态
      setAccountState(account, 'ONLINE', null);
      accountStatus[account].errorCode = null;
      log(account+' ❌ ' + (errorCode === 'TIMEOUT' ? '请求超时' : '网络错误') + '，重试3次均失败，请检查浏览器连接', 'err');
    }
    break;

  default:
    // 其他错误 → ERROR 状态，需要人工处理
    setAccountState(account, 'ERROR', errorMsg);
    accountStatus[account].errorCode = errorCode;
    log(account+' ⚠️ 发送错误（' + errorCode + '）：' + errorMsg, 'info');
  }

  updateDetailPanel();
  return false;
}

// ====== 窗口显隐切换 ======
async function toggleWindow(account) {
  const acc = account || selectedAccount;
  const isVisible = windowVisible[acc];
  const cmd = isVisible ? 'hide-browser' : 'show-browser';
  const result = await callAPI('/api/run', { cmd, account: acc });
  if (result && result.code === 0) {
    windowVisible[acc] = !isVisible;
    log((isVisible ? '🙈 ' : '👁 ') + acc + (isVisible ? ' 已隐藏' : ' 已显示'), 'info');
    updateDetailPanel();
  } else {
    log('❌ ' + acc + ' 窗口切换失败', 'err');
  }
}

// ====== 核心业务：登录检测 ======
async function checkLoginStatus(accountOnly) {
  log('🔍 检测'+(accountOnly?' '+accountOnly:'所有账号')+'登录状态...', 'info');
  const body = {};
  if (accountOnly) body.account = accountOnly;
  body.skipLogged = false;
  const result = await callAPI('/api/check-login', body);
  if (result) {
    let waited = 0;
    const poll = setInterval(async () => {
      waited += 2000;
      try {
        const sr = await fetch(API+'/api/status'), sd = sr.ok ? await sr.json() : {};
        if (sd && sd.loginStatuses && Object.keys(sd.loginStatuses).length) {
          for (const [name, lm] of Object.entries(sd.loginStatuses)) {
            loginStatuses[name] = lm.includes('已登录');
            log(name+': '+(loginStatuses[name]?'🔑 已登录':'❌ '+lm), loginStatuses[name]?'ok':'info');
            if (lm.includes('已登录') && getAccountState(name) === 'OFFLINE') {
              setAccountState(name, 'ONLINE');
            }
          }
          log('✅ 登录状态检测完成', 'ok');
          clearInterval(poll);
          updateDetailPanel();
        }
      } catch (e) { console.warn('状态检测异常:', e.message); }
      if (waited >= 30000) { log('⏰ 登录状态检测超时', 'info'); clearInterval(poll); }
    }, 2000);
  }
}

// ====== 事件绑定 ======

// -- 📍 确定直播间（只锁定，不自动启动） --
document.getElementById('btnOneShot')?.addEventListener('click', () => {
  const liveId = document.getElementById('liveInput').value.trim();
  if (!/^\d+$/.test(liveId)) { log('❌ 直播间ID不合法', 'err'); return; }
  if (!confirm('确定直播间？\nhttps://live.douyin.com/'+liveId+'\n\n⚠️ 请确认该直播间正在直播中')) return;
  lockedLiveId = liveId;
  addLiveToHistory(liveId);
  document.getElementById('liveInput').style.display = 'none';
  document.getElementById('btnOneShot').style.display = 'none';
  document.getElementById('lockedBadge').style.display = 'inline-flex';
  document.getElementById('lockedId').textContent = liveId;
  document.getElementById('detailStartBtn')?.removeAttribute('disabled');
  document.getElementById('btnStartAll')?.removeAttribute('disabled');
  log('✅ 已锁定直播间 '+liveId+'，请手动启动账号', 'ok');
  updateStats();
  updateDetailPanel();
});

// -- 直播间锁定 --
document.getElementById('btnEnter')?.addEventListener('click', () => {
  const liveId = document.getElementById('liveInput').value.trim();
  if (!/^\d+$/.test(liveId)) { log('❌ 直播间ID不合法', 'err'); return; }
  if (!confirm('确定直播间？\nhttps://live.douyin.com/'+liveId+'\n\n⚠️ 请确认该直播间正在直播中')) return;
  lockedLiveId = liveId;
  addLiveToHistory(liveId);
  document.getElementById('liveInput').style.display='none';
  document.getElementById('btnEnter').style.display='none';
  document.getElementById('btnOneShot').style.display='none';
  document.getElementById('lockedBadge').style.display='inline-flex';
  document.getElementById('lockedId').textContent = liveId;
  document.getElementById('detailStartBtn')?.removeAttribute('disabled');
  document.getElementById('btnStartAll')?.removeAttribute('disabled');
  log('✅ 已锁定直播间 '+liveId+'，请手动启动账号', 'ok');
  updateDetailPanel();
});
document.getElementById('btnUnlock')?.addEventListener('click', () => {
  lockedLiveId = '';
  document.getElementById('liveInput').style.display='';
  document.getElementById('btnOneShot').style.display='';
  document.getElementById('btnEnter').style.display='';
  document.getElementById('lockedBadge').style.display='none';
  document.getElementById('detailStartBtn')?.setAttribute('disabled','true');
  document.getElementById('btnStartAll').disabled = true;
  log('🔄 可重新输入', 'info');
});

// -- 详情面板 --
document.getElementById('detailStartBtn')?.addEventListener('click', () => { if (getAccountState(selectedAccount) !== 'ONLINE' && getAccountState(selectedAccount) !== 'STARTING') startRoomForAccount(selectedAccount); });
document.getElementById('detailSendBtn')?.addEventListener('click', () => { sendForAccount(selectedAccount); });
document.getElementById('detailMsgInput')?.addEventListener('keydown', (e) => { if (e.key==='Enter') document.getElementById('detailSendBtn')?.click(); });
document.getElementById('detailTimerSelect')?.addEventListener('change', function() {
  const val = parseInt(this.value);
  if (!timerStates[selectedAccount]) timerStates[selectedAccount] = {};
  timerStates[selectedAccount].interval = val;
  // 不再自动启动！只保存间隔，等点击发送或全局定时才启动
  if (val<=0) stopTimer(selectedAccount);
  updateDetailPanel();
});
document.getElementById('detailPauseBtn')?.addEventListener('click', function() {
  const acc = selectedAccount;
  const ts = timerStates[acc];
  if (ts && ts.running) { stopTimer(acc); if (!timerStates[acc]) timerStates[acc]={}; timerStates[acc].userPaused = true; this.textContent='▶ 恢复'; log(acc+' 已暂停', 'info'); }
  else {
    const iv = ts && ts.interval>0 ? ts.interval : (parseInt(document.getElementById('detailTimerSelect')?.value||'0'));
    if (iv>0) { if (!timerStates[acc]) timerStates[acc]={}; timerStates[acc].interval=iv; timerStates[acc].userPaused = false; startTimerForAccount(acc); this.textContent='⏸ 暂停'; }
    else log('⚠️ 请先选择定时时间', 'info');
  }
});
// detailRefreshBtn 事件绑定在初始化段
document.getElementById('detailEyeBtn')?.addEventListener('click', () => toggleWindow(selectedAccount));

// -- 话术标签（点击切换词集） --
document.getElementById('detailScriptTag')?.addEventListener('click', () => {
  const names = Object.keys(scripts);
  if (!names.length) { log('❌ 没有可用的词集，请先创建', 'info'); return; }
  const current = selectedScript[selectedAccount], idx = current ? names.indexOf(current) : -1;
  selectScript(names[(idx+1) % names.length]);
});

// -- 发送模式切换按钮（输入框右边的小按钮） --
document.getElementById('detailSendModeBtn')?.addEventListener('click', function() {
  const cur = localStorage.getItem('send_mode_type_'+selectedAccount) || 'script';
  const next = cur === 'script' ? 'custom' : 'script';
  localStorage.setItem('send_mode_type_'+selectedAccount, next);
  updateDetailPanel();
  log(selectedAccount+' 发送模式: '+(next==='script'?'词集':'自定义'), 'info');
});

// -- 模式标签（点击切换顺序/随机） --
document.getElementById('detailModeTag')?.addEventListener('click', () => {
  const cur = localStorage.getItem('send_mode_'+selectedAccount)||'sequence', next = cur==='sequence'?'random':'sequence';
  localStorage.setItem('send_mode_'+selectedAccount, next);
  updateDetailPanel();
  log(selectedAccount+' 模式: '+(next==='random'?'🎲 随机':'➡ 顺序'), 'info');
});

// -- 搜索过滤 --
document.getElementById('accountSearch')?.addEventListener('input', function() { accountFilter=this.value.toLowerCase().trim(); renderAccountList(); });

// -- 过滤标签委托 --
document.addEventListener('click', (e) => { if (e.target.classList.contains('filter-tag') && e.target.dataset.filter) updateFilter(e.target.dataset.filter); });

// -- 全选 --
document.getElementById('selectAllCheckbox')?.addEventListener('change', function() {
  ACCOUNTS.forEach(a => batchSelected[a]=this.checked);
  const cnt = document.getElementById('batchCount'), bar = document.getElementById('batchBar');
  if (cnt) cnt.textContent = '已选 '+(this.checked?ACCOUNTS.length:0)+' 个';
  if (bar) bar.classList.toggle('show', this.checked);
  renderAccountList();
});

// -- 批量启动/停止 --
document.getElementById('batchStart')?.addEventListener('click', () => {
  const accounts = ACCOUNTS.filter(a => batchSelected[a]);
  if (!accounts.length) return;
  showToast('启动 ' + accounts.length + ' 个账号');
  const total = accounts.length;
  showProgress('启动中: ' + accounts.join(', '), 0);
  let done = 0;
  accounts.forEach(async acc => {
    const state = getAccountState(acc);
    if (state !== 'ONLINE' && state !== 'STARTING') await startRoomForAccount(acc);
    done++; showProgress('启动中 '+done+'/'+total, (done/total)*100);
    if (done>=total) setTimeout(hideProgress, 1000);
  });
});
document.getElementById('batchStop')?.addEventListener('click', () => {
  const accounts = ACCOUNTS.filter(a=>batchSelected[a]);
  if (!accounts.length) return;
  showToast('暂停 '+accounts.length+' 个账号');
  accounts.forEach(acc=>stopTimer(acc));
});

// -- 全部启动 --
document.getElementById('btnStartAll')?.addEventListener('click', async function() {
  if (!confirm('启动全部 '+ACCOUNTS.length+' 个账号？')) return;
  this.disabled = true;
  log('🚀 启动全部 '+ACCOUNTS.length+' 个账号', 'start');
  for (let idx=0; idx<ACCOUNTS.length; idx++) {
    await startRoomForAccount(ACCOUNTS[idx]);
    await new Promise(r => setTimeout(r, 300 + Math.floor(Math.random() * 500)));
  }
  this.disabled = false;
  refreshScriptSelectors();
});

// -- 自定义启动 --
document.getElementById('btnStartCustom')?.addEventListener('click', () => {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
  const dialog = document.createElement('div');
  dialog.style.cssText = 'background:#0c0c12;border:1px solid rgba(34,34,46,0.4);border-radius:12px;padding:20px 24px;min-width:300px;max-width:400px;box-shadow:0 8px 30px rgba(0,0,0,0.3);';
  let html = '<div style="font-size:14px;font-weight:600;margin-bottom:12px;color:#e4e4e7;">选择要启动的账号</div>';
  html += '<div style="margin-bottom:12px;max-height:300px;overflow-y:auto;">';
  ACCOUNTS.forEach(acc => {
    html += '<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:12px;color:rgba(161,161,170,0.5);">' +
      '<input type="checkbox" class="chk-account" value="'+acc+'" checked style="accent-color:#fe2c55;">' +
      acc + '</label>';
  });
  html += '</div><div style="display:flex;gap:8px;justify-content:flex-end;">' +
    '<button id="modalCancel" style="padding:6px 14px;border-radius:6px;border:1px solid rgba(34,34,46,0.3);background:transparent;color:rgba(161,161,170,0.5);cursor:pointer;font-size:11px;">取消</button>' +
    '<button id="modalConfirm" style="padding:6px 14px;border-radius:6px;border:none;background:#fe2c55;color:#fff;cursor:pointer;font-size:11px;">🚀 启动所选</button></div>';
  dialog.innerHTML = html; overlay.appendChild(dialog); document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target===overlay) document.body.removeChild(overlay); });
  document.getElementById('modalCancel')?.addEventListener('click', () => document.body.removeChild(overlay));
  document.getElementById('modalConfirm')?.addEventListener('click', async () => {
    const checked = [...document.querySelectorAll('.chk-account:checked')].map(cb => cb.value);
    document.body.removeChild(overlay);
    if (!checked.length) { log('❌ 请至少选择一个账号','err'); return; }
    if (!confirm('启动以下 '+checked.length+' 个账号？\n'+checked.join(', '))) return;
    log('🚀 自定义启动: '+checked.join(', '), 'start');
    for (const acc of checked) { await startRoomForAccount(acc); await new Promise(r=>setTimeout(r,300+Math.floor(Math.random()*500))); }
    refreshScriptSelectors();
  });
});

// -- 快速启动 --
document.getElementById('btnQuickStartRoom')?.addEventListener('click', () => { startRoomForAccount(selectedAccount); });

// -- 发送全部 --
document.getElementById('btnSendAll')?.addEventListener('click', async () => {
  if (globalPaused) { log('⏸ 全局已暂停，请先恢复', 'info'); return; }
  let sentCount = 0;
  for (const account of ACCOUNTS) {
    const ok = await sendForAccount(account);
    if (ok) sentCount++;
  }
  updateDetailPanel();
  log('全部发送完成 ('+sentCount+'个账号)', 'ok');
});

// -- 全部开刷：启动所有在线账号的独立定时器 --
document.getElementById('btnStartAllTimers')?.addEventListener('click', () => {
  if (globalPaused) { log('⏸ 全局已暂停，请先恢复', 'info'); return; }
  let started = 0;
  for (const acc of ACCOUNTS) {
    const state = getAccountState(acc);
    if (state !== 'ONLINE') continue;
    const ts = timerStates[acc];
    if (!ts || !ts.interval || ts.interval <= 0) continue;
    stopTimer(acc);
    startTimerForAccount(acc);
    started++;
  }
  if (started) {
    log('▶ 已启动 '+started+' 个账号的定时发送', 'ok');
    showToast('已启动 ' + started + ' 个账号');
  } else {
    log('⚠️ 没有可启动的账号（请先设置定时时间并启动浏览器）', 'info');
  }
});

// -- 全局暂停/恢复 --
document.getElementById('btnPauseAll')?.addEventListener('click', function() {
  if (globalPaused) {
    globalPaused = false;
    this.textContent = '⏸ 暂停'; this.style.background='transparent'; this.style.color='';
    // 恢复所有按钮
    ['btnSendAll','btnStartAll','btnStartCustom','btnStartAllTimers','globalTimerToggle'].forEach(id => {
      const el = document.getElementById(id); if (el) { el.disabled = false; el.style.opacity = ''; el.style.pointerEvents = ''; }
    });
    document.getElementById('detailSendBtn') && (document.getElementById('detailSendBtn').disabled = false);
    for (const acc of ACCOUNTS) { const ts=timerStates[acc]; if (ts && ts.interval>0 && !ts.running && !ts.userPaused) startTimerForAccount(acc); }
    checkAllBrowsers();
    log('▶️ 全局已恢复', 'info');
  } else {
    globalPaused = true;
    this.textContent='▶ 已暂停'; this.style.background='rgba(239,68,68,0.1)'; this.style.color='#ef4444';
    // 立即停止全局定时器
    if (globalTimerId) { clearTimeout(globalTimerId); globalTimerId=null; }
    if (globalTimerOn) {
      globalTimerOn=false;
      document.getElementById('globalTimerStatus').textContent='关';
      document.getElementById('globalTimerToggle').style.background='rgba(34,34,46,0.1)';
    }
    // 停止所有单个账号的定时器
    for (const acc of ACCOUNTS) stopTimer(acc);
    // 锁定所有操作按钮
    ['btnSendAll','btnStartAll','btnStartCustom','btnStartAllTimers','globalTimerToggle'].forEach(id => {
      const el = document.getElementById(id); if (el) { el.disabled = true; el.style.opacity = '0.3'; el.style.pointerEvents = 'none'; }
    });
    document.getElementById('detailSendBtn') && (document.getElementById('detailSendBtn').disabled = true);
    log('⏸ 全局暂停 — 所有操作已锁定', 'info');
  }
});

// -- 全局定时（开关式，走单账号定时逻辑） --
document.getElementById('globalTimerToggle')?.addEventListener('click', () => {
  if (globalTimerOn) {
    // 关闭：停掉所有定时器
    if (globalTimerId) { clearTimeout(globalTimerId); globalTimerId=null; }
    globalTimerOn=false;
    document.getElementById('globalTimerStatus').textContent='关';
    document.getElementById('globalTimerToggle').style.background='rgba(34,34,46,0.1)';
    document.getElementById('globalTimerToggle').style.color='rgba(161,161,170,0.3)';
    document.getElementById('globalTimerToggle').style.border='1px solid rgba(34,34,46,0.1)';
    document.getElementById('detailTimerSelect').disabled = false;
    for (const acc of ACCOUNTS) stopTimer(acc);
    log('⏰ 全局定时已关闭', 'info');
  } else {
    globalTimerOn=true;
    document.getElementById('globalTimerStatus').textContent='开';
    document.getElementById('globalTimerToggle').style.background='rgba(34,197,94,0.1)';
    document.getElementById('globalTimerToggle').style.color='rgba(34,197,94,0.4)';
    document.getElementById('globalTimerToggle').style.border='1px solid rgba(34,197,94,0.1)';
    document.getElementById('detailTimerSelect').disabled = true;
    let started = 0;
    for (const acc of ACCOUNTS) {
      const state = getAccountState(acc);
      if (state !== 'ONLINE') continue;
      stopTimer(acc);
      if (!timerStates[acc]) timerStates[acc] = {};
      // 有单账号定时 → 用那个；没有 → 随机30-80秒
      if (!timerStates[acc].interval || timerStates[acc].interval <= 0) {
        timerStates[acc].interval = 30 + Math.floor(Math.random() * 51); // 30-80s
      }
      timerStates[acc].userPaused = false;
      startTimerForAccount(acc);
      started++;
    }
    log('⏰ 全局定时已开启：'+started+'个在线账号（有定时的用自己的间隔，没有的随机30-80s）', 'info');
  }
});

// -- 关闭全部 --
document.getElementById('btnCloseAll')?.addEventListener('click', async () => {
  if (!confirm('关闭所有比特浏览器窗口？')) return;
  log('🖥 正在关闭全部窗口...', 'info');
  document.getElementById('btnStartAll').disabled = false;
  if (globalTimerId) { clearTimeout(globalTimerId); globalTimerId=null; }
  if (globalTimerOn) {
    globalTimerOn=false;
    document.getElementById('globalTimerStatus').textContent='关';
    document.getElementById('globalTimerKnob').style.left='2px'; document.getElementById('globalTimerKnob').style.background='var(--text-muted)';
    document.getElementById('globalTimerToggle').style.background='rgba(34,34,46,0.1)';
  }
  for (const acc of ACCOUNTS) { stopTimer(acc); delete timerStates[acc]; delete selectedScript[acc]; setAccountState(acc, 'OFFLINE'); sendCounts[acc]=0; }
  saveSelectedScript();
  let closed = 0;
  for (const [name] of Object.entries(PROFILE_MAP)) {
    try {
      await fetch(API+'/api/run', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({cmd:'stop-browser', account:name}) });
      closed++; log('✅ '+name+' 已关闭', 'ok');
    } catch(e) { log('❌ '+name+' 关闭失败: '+e.message, 'err'); }
  }
  log('🖥 共关闭 '+closed+' 个窗口', 'ok');
});

// -- 清空日志 --
document.getElementById('btnClearLog')?.addEventListener('click', () => { document.getElementById('logBox').innerHTML = ''; });
document.getElementById('globalLogClear')?.addEventListener('click', () => {
  globalLogs = [];
  const gl = document.getElementById('globalLogList');
  if (gl) gl.innerHTML = '';
  setText('globalLogCount', '共 0 条');
});
// ====== 浏览器状态检测 ======
async function checkAllBrowsers() {
  log('🔍 检测所有浏览器状态...', 'info');
  let online = 0;
  for (const acc of ACCOUNTS) {
    const running = await checkBrowserStatus(acc);
    if (running) online++;
  }
  log('📊 在线: '+online+'/'+ACCOUNTS.length, 'info');
  updateDetailPanel();
}
document.getElementById('detailRefreshBtn')?.addEventListener('click', async function() {
  this.textContent='检测中...'; this.disabled=true;
  await checkAllBrowsers();
  this.textContent='刷新'; this.disabled=false;
});

// ====== 数据看板 ======
function updateStats() {
  const online = ACCOUNTS.filter(a => { const s = getAccountState(a); return s === 'ONLINE' || s === 'SENDING'; }).length;
  const totalSent = Object.values(sendCounts).reduce((a,b) => a + (b||0), 0);
  const totalErrors = ACCOUNTS.filter(a => accountErrors[a]).length;
  const totalSends = totalSent + totalErrors;
  const rate = totalSends > 0 ? Math.round((totalSent / totalSends) * 100) : 0;

  const el = document.getElementById('statsBar');
  if (el) el.style.display = 'flex';
  document.getElementById('statOnline') && (document.getElementById('statOnline').textContent = online);
  document.getElementById('statSent') && (document.getElementById('statSent').textContent = totalSent);
  document.getElementById('statRate') && (document.getElementById('statRate').textContent = rate + '%');
  document.getElementById('statErrors') && (document.getElementById('statErrors').textContent = totalErrors);
}

// ====== 账号健康预警 ======
const _warned = {};
function checkHealth() {
  for (const acc of ACCOUNTS) {
    const fc = accountStatus[acc]?.failCount || 0;
    if (fc >= 3 && !_warned[acc]) {
      _warned[acc] = true;
      showToast('⚠️ '+acc+' 连续 '+fc+' 次发送失败！', 'err');
      log('🚨 '+acc+' 健康预警：连续 '+fc+' 次发送失败，请检查', 'err');
    }
    if (fc === 0) _warned[acc] = false;
  }
}
// 每30秒检查一次账号健康
setInterval(checkHealth, 30000);

// ====== 初始化 ======
log('浏览器准备工作已就绪', 'info');
renderLiveHistory();
log('输入直播间ID → 进入 → 启动 → 发送', 'info');
setTimeout(() => { renderAccountList(); updateDetailPanel(); refreshScriptSelectors(); }, 100);
setTimeout(() => showGuide(true), 200);
// 定期检测浏览器状态（每 30 分钟）
setInterval(() => {
  if (document.querySelector('.page.active#page-0')) checkAllBrowsers();
}, 1800000);
