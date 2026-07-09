// ====== 话术/分组/AI生成 ======
// 依赖：config.js (scripts, selectedScript, scriptGroups, saveScripts, etc.)
// 依赖：app.js (log, escapeHtml, callAPI, renderScripts placeholder, etc.)

// ====== 渲染：话术列表 ======
function renderScripts() {
  const container = document.getElementById('scriptsList');
  if (!container) return;
  container.innerHTML = '';
  const names = Object.keys(scripts);
  if (!names.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;font-size:11px;color:rgba(161,161,170,0.12);">还没有词集，点「+ 新建」创建一个</div>';
    return;
  }
  names.forEach(name => {
    const words = scripts[name]||[], users = Object.entries(selectedScript||{}).filter(([a,s])=>s===name).map(([a])=>a);
    const item = document.createElement('div'); item.className='script-row';
    const icon = document.createElement('div'); icon.className='script-icon'; icon.textContent='💬';
    const info = document.createElement('div'); info.className='script-info';
    const nd = document.createElement('div'); nd.className='script-name'; nd.textContent=name;
    const md = document.createElement('div'); md.className='script-meta';
    md.textContent = words.length+' 条话术' + (users.length ? ' · '+users.length+' 个账号使用中' : '');
    info.appendChild(nd); info.appendChild(md);
    const badge = document.createElement('span'); badge.className='script-badge';
    if (users.length) {
      badge.textContent = users.length+' 账号';
      badge.style.cssText = 'font-size:9px;padding:1px 6px;border-radius:4px;background:rgba(34,197,94,0.08);color:rgba(34,197,94,0.5);border:1px solid rgba(34,197,94,0.12);';
    }
    item.appendChild(icon); item.appendChild(info); item.appendChild(badge);
    item.onclick = () => renderScriptDetail(name);
    container.appendChild(item);
  });
  updateDetailPanel();
}

function selectScript(name) {
  selectedScript[selectedAccount] = name;
  saveSelectedScript();
  const items = scripts[name];
  if (items && items.length) {
    const inp = document.getElementById('detailMsgInput');
    if (inp) inp.value = items[0];
  }
  // 同步发送行下拉
  const s2 = document.getElementById('detailScriptInput');
  if (s2) s2.value = name;
  updateDetailPanel();
  log(selectedAccount+' 已选词集 "'+name+'"', 'info');
}

function autoSelectScript() {
  const names = Object.keys(scripts);
  if (names.length) renderScriptDetail(names[0]);
  else {
    const wc = document.getElementById('scriptWordsContainer');
    if (wc) wc.innerHTML = '<div style="text-align:center;padding:40px 20px;font-size:11px;color:rgba(161,161,170,0.12);">👈 选择一个话术集，或点击「+ 新建」创建</div>';
  }
}
function refreshScriptSelectors() {
  const cur = selectedScript[selectedAccount]||'';
  // 发送行里的词集下拉
  const s2 = document.getElementById('detailScriptInput');
  if (s2) {
    s2.innerHTML = '<option value="">💬 选择词集...</option>';
    Object.keys(scripts).forEach(n => {
      const opt = document.createElement('option');
      opt.value = n; opt.textContent = n;
      if (n === cur) opt.selected = true;
      s2.appendChild(opt);
    });
  }
}

// ====== 分组系统 ======
function renderGroups() {
  const container = document.getElementById('groupsList');
  if (!container) return;
  container.innerHTML = '';
  const names = Object.keys(scriptGroups);
  if (!names.length) {
    container.innerHTML = '<div style="padding:30px;text-align:center;font-size:11px;color:rgba(161,161,170,0.12);">还没有分组，点「+ 新建」创建一个</div>';
    document.getElementById('btnApplyGroup').style.display='none';
    return;
  }
  names.forEach(name => {
    const g = scriptGroups[name];
    const sc = (g.scripts||[]);
    const item = document.createElement('div');
    item.className = 'script-row';
    item.onclick = () => showGroupDetail(name);
    const icon = document.createElement('div'); icon.className='script-icon'; icon.textContent='📁';
    const info = document.createElement('div'); info.className='script-info';
    const nd = document.createElement('div'); nd.className='script-name'; nd.textContent=name;
    const md = document.createElement('div'); md.className='script-meta';
    md.textContent = sc.length+' 个词集 · '+(g.mode==='no-repeat'?'不重复':'可重复');
    info.appendChild(nd); info.appendChild(md);
    item.appendChild(icon); item.appendChild(info);
    container.appendChild(item);
  });
  document.getElementById('btnApplyGroup').style.display='inline-block';
}

function showGroupDetail(name) {
  const g = scriptGroups[name];
  if (!g) return;
  const gs = g.scripts||[];
  const container = document.getElementById('scriptWordsContainer');
  if (!container) return;
  let html = '<div style="background:rgba(254,44,85,0.02);border:1px solid rgba(254,44,85,0.06);border-radius:8px;padding:14px;">'+
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">'+
    '<span style="font-size:11px;font-weight:600;color:rgba(254,44,85,0.3);">📁 '+name+'</span>'+
    '<button class="btn btn-ghost btn-sm" style="color:rgba(239,68,68,0.4);" onclick="deleteGroup(\''+name+'\')">删除分组</button></div>'+
    '<div style="margin-bottom:10px;font-size:10px;color:rgba(161,161,170,0.2);">包含词集：</div>';
  if (gs.length) {
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">';
    gs.forEach(s => { html += '<span style="font-size:10px;padding:3px 8px;border-radius:4px;background:rgba(254,44,85,0.04);border:1px solid rgba(254,44,85,0.08);color:#fe2c55;">'+s+'</span>'; });
    html += '</div>';
  } else {
    html += '<div style="font-size:10px;color:rgba(161,161,170,0.08);margin-bottom:8px;">还没有添加词集</div>';
  }
  // 可用的词集列表（勾选添加）
  const allScripts = Object.keys(scripts);
  if (allScripts.length) {
    html += '<div style="margin-bottom:8px;font-size:10px;color:rgba(161,161,170,0.2);">添加词集：</div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">';
    allScripts.forEach(s => {
      const added = gs.includes(s);
      html += '<span class="group-add-script" data-group="'+name+'" data-script="'+s+'" style="font-size:10px;padding:3px 8px;border-radius:4px;cursor:pointer;'+
        (added ? 'background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.1);color:rgba(34,197,94,0.4);' :
          'background:rgba(0,0,0,0.1);border:1px solid rgba(34,34,46,0.15);color:rgba(161,161,170,0.2);')+'">'+
        s+(added?' ✓':' +')+'</span>';
    });
    html += '</div>';
  }
  // 模式选择
  html += '<div style="display:flex;align-items:center;gap:8px;font-size:10px;color:rgba(161,161,170,0.2);">分配模式：'+
    '<select id="groupModeSelect" data-group="'+name+'" style="background:rgba(0,0,0,0.1);border:1px solid rgba(34,34,46,0.15);border-radius:4px;padding:3px 6px;font-size:10px;color:#e4e4e7;outline:none;">'+
    '<option value="no-repeat"'+(g.mode==='no-repeat'?' selected':'')+'>不重复（每个账号不同词集）</option>'+
    '<option value="repeat"'+(g.mode==='repeat'?' selected':'')+'>可重复（所有账号同词集）</option></select></div>';
  html += '</div>';
  container.innerHTML = html;
}

window.deleteGroup = function(name) {
  if (!name || !confirm('删除分组「'+name+'」？')) return;
  delete scriptGroups[name]; saveGroups(); renderGroups();
  const wc = document.getElementById('scriptWordsContainer');
  if (wc) wc.innerHTML='';
};

// 分组 Tab 切换
document.getElementById('scriptTabBar')?.addEventListener('click', (e) => {
  const tab = e.target.dataset.stab;
  if (!tab) return;
  localStorage.setItem('script_tab', tab);
  document.querySelectorAll('[data-stab]').forEach(t => t.classList.toggle('active', t.dataset.stab===tab));
  document.getElementById('scriptsListView').style.display = tab==='scripts' ? 'block' : 'none';
  document.getElementById('groupsListView').style.display = tab==='groups' ? 'block' : 'none';
  document.getElementById('btnApplyGroup').style.display = tab==='groups' ? 'inline-block' : 'none';
  document.getElementById('scriptPageTitle').textContent = tab==='groups' ? '📁 分组管理' : '💬 话术管理';
  isGroupView = tab==='groups';
  if (tab==='groups') renderGroups();
  if (tab==='scripts') { renderScripts(); autoSelectScript(); }
});

// 新建分组
document.getElementById('btnNewGroup')?.addEventListener('click', () => {
  const inp = document.getElementById('newGroupName');
  if (!inp) return;
  const name = inp.value.trim();
  if (!name) { log('❌ 请输入分组名称','err'); return; }
  if (scriptGroups[name]) { log('❌ 分组已存在','err'); return; }
  scriptGroups[name] = { scripts: [], mode: 'no-repeat' };
  saveGroups(); renderGroups(); inp.value='';
  log('✅ 已创建分组「'+name+'」','ok');
});

// 分组-添加/移除词集（委托）
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('group-add-script')) {
    const gn = e.target.dataset.group;
    const sn = e.target.dataset.script;
    if (!gn || !sn || !scriptGroups[gn]) return;
    const idx = scriptGroups[gn].scripts.indexOf(sn);
    if (idx >= 0) scriptGroups[gn].scripts.splice(idx, 1);
    else scriptGroups[gn].scripts.push(sn);
    saveGroups(); showGroupDetail(gn);
  }
});

// 分组-模式切换
document.addEventListener('change', (e) => {
  if (e.target.id === 'groupModeSelect') {
    const gn = e.target.dataset.group;
    if (gn && scriptGroups[gn]) { scriptGroups[gn].mode = e.target.value; saveGroups(); }
  }
});

// 应用到账号
document.getElementById('btnApplyGroup')?.addEventListener('click', () => {
  const names = Object.keys(scriptGroups);
  if (!names.length) { log('❌ 没有可用的分组','err'); return; }
  // 创建选择弹窗
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
  const dialog = document.createElement('div');
  dialog.style.cssText = 'background:#0c0c12;border:1px solid rgba(34,34,46,0.4);border-radius:12px;padding:20px 24px;min-width:350px;max-width:420px;box-shadow:0 8px 30px rgba(0,0,0,0.3);';
  let html = '<div style="font-size:14px;font-weight:600;margin-bottom:12px;color:#e4e4e7;">应用分组到账号</div>';
  html += '<div style="margin-bottom:10px;font-size:11px;color:rgba(161,161,170,0.3);">选择分组：</div>';
  html += '<select id="applyGroupSelect" style="width:100%;margin-bottom:14px;padding:8px;font-size:12px;background:rgba(0,0,0,0.15);border:1px solid rgba(34,34,46,0.2);border-radius:6px;color:#e4e4e7;outline:none;">';
  names.forEach(n => { html += '<option value="'+n+'">'+n+'</option>'; });
  html += '</select>';
  html += '<div style="margin-bottom:10px;font-size:11px;color:rgba(161,161,170,0.3);">应用到账号：'+
    '<span id="applySelectAll" style="margin-left:8px;font-size:9px;color:rgba(254,44,85,0.3);cursor:pointer;">全选</span></div>';
  html += '<div style="max-height:200px;overflow-y:auto;margin-bottom:14px;">';
  ACCOUNTS.forEach(acc => {
    html += '<label style="display:flex;align-items:center;gap:8px;padding:4px 6px;font-size:12px;color:rgba(161,161,170,0.5);cursor:pointer;">'+
      '<input type="checkbox" class="apply-account" value="'+acc+'" style="accent-color:#fe2c55;">'+acc+'</label>';
  });
  html += '</div><div style="display:flex;gap:8px;justify-content:flex-end;">'+
    '<button id="modalCancel2" style="padding:6px 14px;border-radius:6px;border:1px solid rgba(34,34,46,0.3);background:transparent;color:rgba(161,161,170,0.5);cursor:pointer;font-size:11px;">取消</button>'+
    '<button id="applyConfirm" style="padding:6px 14px;border-radius:6px;border:none;background:#fe2c55;color:#fff;cursor:pointer;font-size:11px;">✅ 应用</button></div>';
  dialog.innerHTML = html; overlay.appendChild(dialog); document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target===overlay) document.body.removeChild(overlay); });
  document.getElementById('modalCancel2')?.addEventListener('click', () => document.body.removeChild(overlay));
  document.getElementById('applySelectAll')?.addEventListener('click', function() {
    const checked = this.textContent === '全选';
    document.querySelectorAll('.apply-account').forEach(cb => cb.checked = checked);
    this.textContent = checked ? '取消全选' : '全选';
  });
  document.getElementById('applyConfirm')?.addEventListener('click', () => {
    const gn = document.getElementById('applyGroupSelect')?.value;
    const g = scriptGroups[gn];
    const checked = [...document.querySelectorAll('.apply-account:checked')].map(cb => cb.value);
    document.body.removeChild(overlay);
    if (!gn || !g || !checked.length) { log('❌ 请选择分组和账号','err'); return; }
    const gs = g.scripts||[];
    if (!gs.length) { log('❌ 分组「'+gn+'」没有词集','err'); return; }

    // 不重复模式：词集数不足警告
    if (g.mode !== 'repeat' && gs.length < checked.length) {
      if (!confirm('⚠️ 词集不足！分组「'+gn+'」只有 '+gs.length+' 个词集，但选择了 '+checked.length+' 个账号。\n\n不重复模式下会轮询复用词集。\n\n建议添加更多词集或切换为可重复模式。\n\n仍然继续？')) return;
    }
    if (g.mode === 'repeat') {
      // 所有账号用第一个词集
      checked.forEach(acc => { selectedScript[acc] = gs[0]; });
      log('✅ 已分配「'+gs[0]+'」到 '+checked.length+' 个账号','ok');
    } else {
      // 不重复模式：轮询分配
      checked.forEach((acc, i) => { selectedScript[acc] = gs[i % gs.length]; });
      log('✅ 已轮询分配 '+gs.length+' 个词集到 '+checked.length+' 个账号','ok');
    }
    saveSelectedScript();
    refreshScriptSelectors();
    updateDetailPanel();
  });
});

// ====== 渲染：话术详情区 ======
function renderScriptDetail(name, expandPreview) {
  const container = document.getElementById('scriptWordsContainer');
  if (!container) return;
  const words = scripts[name]||[];
  const users = Object.entries(selectedScript||{}).filter(([a,s])=>s===name).map(([a])=>a);
  const showAll = expandPreview === true;
  const MAX_TABLE = showAll ? words.length : 50;
  const displayWords = words.slice(0, MAX_TABLE);

  let html = '<div style="background:rgba(254,44,85,0.02);border:1px solid rgba(254,44,85,0.06);border-radius:8px;padding:14px;">'+
    // 头部
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">'+
    '<span style="font-size:11px;font-weight:600;color:rgba(254,44,85,0.3);">💬 '+name+'</span>'+
    '<span style="font-size:10px;color:rgba(161,161,170,0.2);">'+words.length+'条</span>'+
    (users.length ? '<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(254,44,85,0.06);color:#fe2c55;border:1px solid rgba(254,44,85,0.08);">使用: '+users.join(', ')+'</span>' : '')+
    '<span style="flex:1"></span>'+
    '<button class="script-apply" data-name="'+name+'" style="font-size:10px;color:rgba(34,197,94,0.35);cursor:pointer;background:none;border:none;font-family:inherit;margin-right:4px;" title="应用到当前账号 '+selectedAccount+'">📌 应用到 '+selectedAccount+'</button>'+'<button class="script-del" data-name="'+name+'" style="font-size:10px;color:rgba(239,68,68,0.4);cursor:pointer;background:none;border:none;font-family:inherit;">删除</button></div>'+
    // 添加行
    '<div style="display:flex;gap:6px;margin-bottom:10px;">'+
    '<input class="new-word-input" data-name="'+name+'" placeholder="新词条(≤'+MAX_WORD_LEN+'字)" maxlength="'+MAX_WORD_LEN+'" '+
    'style="flex:1;background:rgba(0,0,0,0.15);border:1px solid rgba(34,34,46,0.2);border-radius:4px;padding:5px 8px;font-size:11px;color:#e4e4e7;outline:none;" />'+
    '<button class="btn-add-word" data-name="'+name+'" style="padding:5px 12px;font-size:10px;border-radius:4px;background:#fe2c55;color:#fff;border:none;cursor:pointer;">添加</button></div>';

  // 词云预览（大词集时折叠，可展开）
  if (words.length > 50) {
    html += '<div style="margin-bottom:8px;">'+
      '<span id="previewToggle" data-name="'+name+'" style="font-size:10px;color:rgba(254,44,85,0.3);cursor:pointer;user-select:none;">'+
      (showAll ? '📕 收起表格' : '📖 展开全部 ('+words.length+'条)')+'</span></div>';
  }

  // 搜索框（大词集）
  if (words.length > 30) {
    html += '<input id="wordSearchInput" data-name="'+name+'" placeholder="搜索词条..." '+
      'style="width:100%;margin-bottom:8px;background:rgba(0,0,0,0.12);border:1px solid rgba(34,34,46,0.15);border-radius:4px;padding:5px 8px;font-size:10px;color:#e4e4e7;outline:none;" />';
  }

  // 词云（预览模式）
  if (!showAll && words.length > 30) {
    const cloudWords = words.slice(0, 100);
    html += '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:10px;max-height:120px;overflow-y:auto;">';
    cloudWords.forEach((w,i) => {
      html += '<span style="font-size:9px;background:rgba(18,18,26,0.4);padding:2px 5px;border-radius:3px;border:1px solid rgba(34,34,46,0.2);display:inline-flex;align-items:center;gap:2px;">'+
        escapeHtml(w).substring(0,15)+(escapeHtml(w).length>15?'..':'')+
        '<span class="script-word-del" data-name="'+name+'" data-index="'+i+'" style="cursor:pointer;font-size:7px;color:rgba(161,161,170,0.15);">×</span></span>';
    });
    if (words.length > 100) html += '<span style="font-size:9px;color:rgba(161,161,170,0.1);padding:2px 5px;">+'+(words.length-100)+' 条...</span>';
    html += '</div>';
  }

  // 表格
  html += '<div style="border:1px solid rgba(34,34,46,0.12);border-radius:6px;overflow:hidden;">'+
    '<div style="display:flex;background:rgba(0,0,0,0.12);border-bottom:1px solid rgba(34,34,46,0.1);font-size:9px;color:rgba(161,161,170,0.2);font-weight:600;">'+
    '<span style="width:32px;padding:5px 8px;text-align:center;">#</span>'+
    '<span style="flex:1;padding:5px 8px;">词条内容</span>'+
    '<span style="width:40px;padding:5px 8px;text-align:center;"></span></div>';
  displayWords.slice(0, showAll ? words.length : 50).forEach((w,i) => {
    html += '<div style="display:flex;align-items:center;border-bottom:'+(i<Math.min(words.length,showAll?words.length:50)-1?'1px solid rgba(34,34,46,0.04)':'none')+';font-size:11px;">'+
      '<span style="width:32px;padding:6px 8px;text-align:center;color:rgba(161,161,170,0.12);font-size:9px;">'+(i+1).toString().padStart(2,'0')+'</span>'+
      '<span style="flex:1;padding:6px 8px;color:rgba(228,228,231,0.7);">'+escapeHtml(w)+'</span>'+
      '<span style="width:40px;padding:6px 8px;text-align:center;">'+
      '<span class="script-word-del" data-name="'+name+'" data-index="'+i+'" style="cursor:pointer;font-size:9px;color:rgba(161,161,170,0.15);">✕</span></span></div>';
  });
  if (words.length > 50 && !showAll) {
    html += '<div style="padding:8px;text-align:center;font-size:10px;color:rgba(161,161,170,0.1);">仅显示前 50 条，点击上方「展开全部」查看全部 '+words.length+' 条</div>';
  }
  html += '</div></div>';
  container.innerHTML = html;
}

// 词集预览展开/收起委托
document.addEventListener('click', (e) => {
  if (e.target.id === 'previewToggle') {
    const name = e.target.dataset.name;
    if (name) renderScriptDetail(name, true);
  }
});
// -- 话术管理：新建 --
document.getElementById('btnNewScript')?.addEventListener('click', () => {
  const inp = document.getElementById('newScriptName');
  if (!inp) return;
  const name = inp.value.trim();
  if (!name) { log('❌ 请输入词集名称', 'err'); return; }
  const n = name;
  inp.value = '';
  if (scripts[n]) { log('❌ 词集已存在', 'err'); return; }
  scripts[n] = []; saveScripts(); renderScripts(); selectScript(n);
  log('✅ 已创建词集 "'+n+'"', 'ok');
});

// -- 话术列表点击 -> 展开详情 --
document.getElementById('scriptsList')?.addEventListener('click', (e) => {
  const row = e.target.closest('.script-row');
  if (!row) return;
  const name = row.querySelector('.script-name')?.textContent;
  if (name && scripts[name]) renderScriptDetail(name);
});

// -- 词条添加/删除/词集删除（文档委托） --
const DEL_SCRIPT = 'deleteScript';
window[DEL_SCRIPT] = function(name) {
  if (!name || !confirm('删除词集「'+name+'」？')) return;
  delete scripts[name]; saveScripts(); renderScripts();
  const wc = document.getElementById('scriptWordsContainer');
  if (wc) wc.innerHTML='';
  ACCOUNTS.forEach(acc => { localStorage.removeItem('word_history_'+name+'_'+acc); localStorage.removeItem('script_index_'+name+'_'+acc); });
  Object.keys(selectedScript).forEach(acc => { if (selectedScript[acc]===name) delete selectedScript[acc]; });
  saveSelectedScript();
  log('🗑 已删除词集「'+name+'」', 'info');
};
document.addEventListener('click', (e) => {
  const name = e.target.dataset?.name;
  if (e.target.classList.contains('btn-add-word') && name) {
    const input = document.querySelector('.new-word-input[data-name="'+name+'"]');
    const word = input ? input.value.trim() : '';
    if (!word || word.length>MAX_WORD_LEN) return;
    if (!Array.isArray(scripts[name])) scripts[name]=[];
    scripts[name].push(word); saveScripts(); renderScripts(); renderScriptDetail(name);
    if (input) input.value='';
    return;
  }
  if (e.target.classList.contains('script-word-del') && name) {
    const idx = parseInt(e.target.dataset.index);
    if (!isNaN(idx) && scripts[name]) { scripts[name].splice(idx,1); saveScripts(); renderScripts(); renderScriptDetail(name); }
    return;
  }
  if (e.target.classList.contains('script-del')) {
    const n = e.target.dataset.name;
    if (!n || !confirm('删除词集「'+n+'」？')) return;
    delete scripts[n]; saveScripts(); renderScripts(); autoSelectScript();
    ACCOUNTS.forEach(acc => { localStorage.removeItem('word_history_'+n+'_'+acc); localStorage.removeItem('script_index_'+n+'_'+acc); });
    Object.keys(selectedScript).forEach(acc => { if (selectedScript[acc]===n) delete selectedScript[acc]; });
    saveSelectedScript();
    log('🗑 已删除词集「'+n+'」', 'info');
    return;
  }
  if (e.target.classList.contains('script-apply')) {
    const n = e.target.dataset.name;
    if (n) selectScript(n);
    return;
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key==='Enter' && e.target.classList.contains('new-word-input')) {
    const name = e.target.dataset.name;
    if (name) document.querySelector('.btn-add-word[data-name="'+name+'"]')?.click();
  }
});


// -- 导入 --
document.getElementById('btnToggleImport')?.addEventListener('click', function() {
  const area = document.getElementById('importArea'), show = area.style.display!=='block';
  area.style.display = show ? 'block' : 'none';
  this.textContent = show ? '✖ 关闭导入' : '📥 导入';
  if (show) {
    const dl = document.getElementById('scriptNamesList'); dl.innerHTML='';
    Object.keys(scripts).forEach(k => { const o=document.createElement('option'); o.value=k; dl.appendChild(o); });
    const keys = Object.keys(scripts);
    if (keys.length) document.getElementById('importScriptName').value = keys[keys.length-1];
  }
});
document.getElementById('btnImportScripts')?.addEventListener('click', async function() {
  const name = document.getElementById('importScriptName').value.trim(), text = document.getElementById('importWordsText').value.trim(), st = document.getElementById('importStatus');
  if (!name) { st.textContent='❌ 请填写词集名称'; return; }
  if (!text) { st.textContent='❌ 请粘贴词条'; return; }
  const words = [...new Set(text.split('\n').map(l=>l.trim()).filter(l=>l.length>0 && l.length<=25))];
  if (!words.length) { st.textContent='❌ 没有有效的词条（长度≤25字）'; return; }
  this.disabled=true; this.textContent='⏳ 导入中...'; st.textContent='共 '+words.length+' 条，正在导入...';
  if (!scripts[name]) scripts[name]=[];
  const existing = new Set(scripts[name]), newWords = words.filter(w=>!existing.has(w));
  scripts[name].push(...newWords); saveScripts(); renderScripts(); refreshScriptSelectors();
  try { await fetch(API+'/api/import-scripts', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,words:newWords}) }); } catch (e) { console.warn('导入脚本异常:', e.message); }
  this.disabled=false; this.textContent='📥 导入';
  st.textContent='✅ 已导入 '+newWords.length+' 条（跳过 '+(words.length-newWords.length)+' 条已有词条）';
  document.getElementById('importWordsText').value='';
});

// -- AI 生成词集 --
window.openAIGenModal = function() {
  document.getElementById('aiGenName').value = '';
  document.getElementById('aiGenModal').style.display = 'flex';
  var prog = document.getElementById('aiGenProgress');
  if (prog) prog.style.display = 'none';
  var btn = document.getElementById('aiGenConfirm');
  if (btn) btn.disabled = false;
};

window.aiGenerate = async function() {
  var name = document.getElementById('aiGenName').value.trim();
  if (!name) {
    var prog0 = document.getElementById('aiGenProgress');
    if (prog0) { prog0.style.display = 'block'; prog0.innerHTML = '<span style="color:#ef4444;">❌ 请输入词集名称</span>'; }
    return;
  }
  if (scripts[name]) {
    var prog1 = document.getElementById('aiGenProgress');
    if (prog1) { prog1.style.display = 'block'; prog1.innerHTML = '<span style="color:#ef4444;">❌ 词集「' + name + '」已存在，请换一个名称</span>'; }
    return;
  }
  var style = document.getElementById('aiGenStyle').value;
  var count = parseInt(document.getElementById('aiGenCount').value);
  var btn = document.getElementById('aiGenConfirm');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 生成中...'; }
  var prog = document.getElementById('aiGenProgress');
  if (prog) prog.style.display = 'block';
  if (prog) prog.innerHTML = '⏳ 开始生成...';
  var batchSize = 20, batches = Math.ceil(count / batchSize);
  var allComments = [];
  var delay = count >= 200 ? 800 : 500;  // 大批量多歇一会，避免被限流
  for (var b = 0; b < batches; b++) {
    var remaining = Math.min(batchSize, count - b * batchSize);
    var ok = false;
    // 每批最多重试3次
    for (var retry = 0; retry < 3 && !ok; retry++) {
      try {
        var ctrl = new AbortController();
        var tid = setTimeout(function() { ctrl.abort(); }, 20000);  // 20s超时
        var r = await fetch(API + '/api/ai-generate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({topic:name, style:style, count:remaining}), signal: ctrl.signal });
        clearTimeout(tid);
        var d = await r.json();
        if (d.comments && d.comments.length) {
          allComments = allComments.concat(d.comments);
          ok = true;
        }
      } catch(e) {
        if (retry < 2) {
          if (prog) prog.innerHTML = '<span style="color:rgba(245,158,11,0.5);">⏳ 第' + (b+1) + '批失败，重试(' + (retry+2) + '/3)...</span>';
          await new Promise(function(r) { setTimeout(r, 1000); });
        } else {
          log('🤖 第' + (b+1) + '批生成失败，已跳过', 'err');
        }
      }
    }
    var pct = Math.round((allComments.length / count) * 100);
    if (prog) prog.innerHTML = '<div style="margin-bottom:6px;"><div style="height:4px;background:rgba(254,44,85,0.08);border-radius:2px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#fe2c55,#c026d3);border-radius:2px;"></div></div></div><span style="font-size:11px;">已生成 ' + allComments.length + ' / ' + count + ' 条（' + pct + '%）</span>';
    if (b < batches - 1) await new Promise(function(r) { setTimeout(r, delay); });
  }
  if (allComments.length) {
    var unique = allComments.filter(function(w, i) { return allComments.indexOf(w) === i && w.length <= 25; }).slice(0, count);
    scripts[name] = unique; saveScripts(); renderScripts(); refreshScriptSelectors();
    document.getElementById('aiGenModal').style.display = 'none';
    log('🧠 已创建词集 "' + name + '" (' + unique.length + '条)', 'ok');
  } else log('🤖 生成失败，请重试', 'err');
  var btn2 = document.getElementById('aiGenConfirm');
  if (btn2) { btn2.disabled = false; btn2.textContent = '🚀 开始生成'; }
  var prog2 = document.getElementById('aiGenProgress');
  if (prog2) prog2.style.display = 'none';
};

// -- 刷新话术 --
document.getElementById('btnRefreshScripts')?.addEventListener('click', () => { refreshScriptSelectors(); renderScripts(); log('🔄 话术词条已更新', 'info'); });
