# LLCC ErrorCode 系统完整指南

## 一、项目背景

**问题**：之前后端API返回的错误信息是纯字符串（如"浏览器启动失败"），前端无法精确判断是哪种错误类型，只能用`includes()`猜测，导致错误处理不可靠。

**解决**：实现了一套结构化的 ErrorCode 系统，让后端返回标准化的错误码，前端用`switch(errorCode)`精确处理。

**时间**：2026-07-06

**参与人员**：海鸥 + AI

---

## 二、系统架构

### 2.1 整体数据流

```
前端请求
  ↓
server.mjs (路由分发)
  ↓
handleFirst / handleSend (新增路由处理函数)
  ↓
runScript('ads-tool.mjs') (执行脚本)
  ↓
ads-tool.mjs (输出JSON格式errorCode)
  ↓
前端收到标准化响应
  {
    "success": false,
    "errorCode": "BROWSER_OFFLINE",
    "error": "浏览器已离线",
    "data": null
  }
  ↓
前端handleSendError()用switch(errorCode)精确处理
```

### 2.2 关键文件对应关系

| 文件 | 功能 | 修改内容 |
|------|------|--------|
| `server/utils/response.js` | 统一的HTTP响应格式 | ✅ 修改sendError()加errorCode参数 |
| `server/routes/first.js` | /api/first 处理函数 | ✅ 新增+修改，解析ads-tool返回的errorCode |
| `server/routes/send.js` | /api/send 处理函数 | ✅ 新增+修改，解析ads-tool返回的errorCode |
| `server/ads-tool.mjs` | 浏览器操作脚本 | ✅ 修改，直接输出JSON格式errorCode |
| `server/server.mjs` | 主服务文件 | ✅ 修改，导入新路由函数 |
| `public/js/app.js` | 前端应用 | 已有handleSendError()，无需改动 |
| `server/config.js` | 配置文件 | 无改动，已有PROFILES导出 |
| `server/utils/script-executor.js` | 脚本执行工具 | 无改动，已有runScript导出 |

---

## 三、详细改动说明

### 3.1 response.js - 标准化响应格式

**位置**：`server/utils/response.js`

**改动**：
```javascript
// 【之前】
function sendError(res, error = 'Unknown error', statusCode = 400) {
  res.end(JSON.stringify({
    success: false,
    error
  }));
}

// 【之后】
function sendError(res, error = 'Unknown error', statusCode = 400, errorCode = 'UNKNOWN_ERROR') {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: false,
    errorCode,
    error,
    data: null
  }));
}
```

**关键点**：
- 加入`errorCode`参数（默认'UNKNOWN_ERROR'）
- 响应统一包含：`success`, `errorCode`, `error`, `data`
- 这样所有调用`sendError()`的地方都会自动获得标准格式

---

### 3.2 first.js - 启动API的errorCode处理

**位置**：`server/routes/first.js`

**核心逻辑**：

```javascript
export async function handleFirst(req, res, data) {
  const { liveId = '', account = '' } = data;
  const uid = PROFILES[account];

  // 1. 参数验证
  if (!liveId || !uid) {
    sendError(res, '缺少参数: liveId 或 account', 400, 'INVALID_PARAMS');
    return;
  }

  // 2. 执行脚本
  const result = await runScript('ads-tool.mjs', ['--live', liveId, '--first', '--account', account]);
  let success = result.code === 0;

  // 3. 【关键】解析ads-tool.mjs返回的JSON errorCode
  let errorCode = null;
  let errorMsg = '启动失败';
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
    // JSON解析失败，继续用旧方式
  }

  // 4. 返回响应（如果有errorCode就用，没有就降级）
  if (success) {
    sendSuccess(res, { message: '启动成功' });
  } else {
    if (errorCode) {
      const statusCode = errorCode === 'BROWSER_TIMEOUT' ? 500 : (errorCode === 'INVALID_PARAMS' ? 400 : 500);
      sendError(res, errorMsg, statusCode, errorCode);
    } else {
      // 降级方案
      if (result.output && result.output.includes('timeout')) {
        sendError(res, '浏览器启动超时', 500, 'BROWSER_TIMEOUT');
      } else {
        sendError(res, '浏览器启动失败', 500, 'BROWSER_START_FAILED');
      }
    }
  }
}
```

**返回的errorCode类型**：
- `INVALID_PARAMS` - 缺少必需参数
- `BROWSER_START_FAILED` - 浏览器启动失败
- `BROWSER_TIMEOUT` - CDP连接超时
- `NOT_IN_LIVE_ROOM` - 进入直播间失败
- `NETWORK_ERROR` - 网络连接失败
- `UNKNOWN_ERROR` - 其他未知错误

---

### 3.3 send.js - 发送API的errorCode处理

**位置**：`server/routes/send.js`

**核心逻辑**：

```javascript
export async function handleSend(req, res, data) {
  const { msg = '你好', account = '' } = data;

  // 1. 参数验证
  if (!account) {
    sendError(res, '缺少账号参数', 400, 'INVALID_PARAMS');
    return;
  }

  // 2. 执行脚本
  const result = await runScript('ads-tool.mjs', ['--send', msg, '--account', account]);
  let success = result.code === 0;

  // 3. 【关键】解析ads-tool.mjs返回的JSON errorCode
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
    // JSON解析失败，继续用旧方式
  }

  // 4. 返回响应（如果有errorCode就用，没有就降级）
  if (success) {
    sendSuccess(res, { message: '发送成功' });
  } else {
    if (errorCode) {
      sendError(res, errorMsg, 400, errorCode);
    } else {
      // 降级方案：根据output字符串猜测
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
}
```

**返回的errorCode类型**：
- `INVALID_PARAMS` - 缺少必需参数
- `BROWSER_OFFLINE` - 浏览器已离线
- `NOT_LOGGED_IN` - 账号未登录
- `NOT_IN_LIVE_ROOM` - 不在直播间
- `SEND_RATE_LIMITED` - 频率限制
- `SEND_FAILED` - 发送失败
- `NETWORK_ERROR` - 网络连接失败
- `UNKNOWN_ERROR` - 其他未知错误

---

### 3.4 ads-tool.mjs - 直接输出JSON errorCode

**位置**：`server/ads-tool.mjs`

**改动1**：添加辅助函数
```javascript
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
```

**改动2**：修改关键函数使用新的exitWithError/exitWithSuccess
```javascript
// openBrowser函数
async function openBrowser(profile) {
  const res = await bitApi('/browser/open', { id: profile.id });
  if (!res.success) {
    exitWithError('BROWSER_START_FAILED', profile.name + ' 启动失败: ' + res.msg);
  }
  // ... 后续逻辑
}

// connectCDPWithRetry函数
async function connectCDPWithRetry(wsUrl, maxWait = 10000) {
  // ... 重试逻辑
  exitWithError('BROWSER_TIMEOUT', 'CDP 连接超时');
}

// getPageForProfile函数 catch块
} catch (e) {
  exitWithError('BROWSER_START_FAILED', '浏览器连接失败: ' + e.message);
}

// main函数中的错误处理
if (isFirst) {
  // ...
  try {
    await sp.page.goto('https://live.douyin.com/' + LIVE_ID);
    // ...
  } catch (e) {
    exitWithError('NOT_IN_LIVE_ROOM', p.name + ' 进入直播间失败: ' + e.message);
  }
} else {
  // --send 模式
  const el = await pg.$('[contenteditable="true"]');
  if (el) {
    try {
      // ... 发送逻辑
    } catch (e) {
      exitWithError('SEND_FAILED', p.name + ' 发送失败: ' + e.message);
    }
  } else {
    exitWithError('NOT_IN_LIVE_ROOM', p.name + ' 输入框未找到（可能不在直播间）');
  }
}
```

**关键优势**：
- 不再输出杂乱的console.log/console.error
- 只输出JSON格式的errorCode
- first.js和send.js能精确解析

---

### 3.5 server.mjs - 导入新路由

**位置**：`server/server.mjs`

**改动1**：添加导入
```javascript
import { handleFirst } from './routes/first.js';
import { handleSend } from './routes/send.js';
```

**改动2**：替换/api/first处理
```javascript
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
```

**改动3**：替换/api/send处理
```javascript
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
```

---

## 四、ErrorCode 完整映射表

| ErrorCode | HTTP状态码 | 含义 | 前端处理方式 |
|-----------|-----------|------|-----------|
| INVALID_PARAMS | 400 | 缺少必需参数 | 显示"参数错误"提示 |
| BROWSER_START_FAILED | 500 | 浏览器启动失败 | 设为ERROR状态，提示用户重试 |
| BROWSER_TIMEOUT | 500 | 浏览器启动超时（CDP连接超时） | 设为ERROR状态，建议重启浏览器 |
| BROWSER_OFFLINE | 400 | 浏览器已离线 | 设为OFFLINE状态，提示启动 |
| NOT_LOGGED_IN | 401 | 账号未登录 | 设为OFFLINE状态，提示登录 |
| NOT_IN_LIVE_ROOM | 400 | 不在直播间 | 设为OFFLINE状态，提示进入直播间 |
| SEND_RATE_LIMITED | 429 | 发送频率限制 | 指数退避重试（2s, 4s, 6s...） |
| SEND_FAILED | 500 | 发送失败 | 简单重试（1s, 2s, 3s...） |
| NETWORK_ERROR | 500 | 网络连接失败 | 提示网络异常 |
| UNKNOWN_ERROR | 500 | 未知错误 | 显示原始错误信息 |

---

## 五、前端对接指南

### 5.1 响应格式示例

**成功响应**：
```json
{
  "success": true,
  "error": null,
  "errorCode": null,
  "data": {
    "message": "启动成功"
  }
}
```

**失败响应**：
```json
{
  "success": false,
  "errorCode": "BROWSER_OFFLINE",
  "error": "浏览器已离线",
  "data": null
}
```

### 5.2 前端handleSendError()的处理示例

```javascript
function handleSendError(errorCode, errorMsg) {
  switch(errorCode) {
    case 'BROWSER_OFFLINE':
    case 'NOT_LOGGED_IN':
    case 'NOT_IN_LIVE_ROOM':
      setAccountState(account, 'OFFLINE', errorMsg);
      break;
    
    case 'SEND_RATE_LIMITED':
      // 指数退避重试
      retryWithExponentialBackoff(account, [2000, 4000, 6000]);
      break;
    
    case 'SEND_FAILED':
    case 'NETWORK_ERROR':
      // 简单重试
      retryWithFixedInterval(account, [1000, 2000, 3000]);
      break;
    
    case 'INVALID_PARAMS':
      showError('参数错误: ' + errorMsg);
      break;
    
    default:
      setAccountState(account, 'ERROR', errorMsg);
  }
}
```

---

## 六、测试步骤

### 6.1 启动服务

```bash
cd /Users/mac/Desktop/LLCC
bash start.sh
```

### 6.2 缺参数测试（应返回INVALID_PARAMS）

```bash
curl http://localhost:3456/api/first -X POST \
  -H "Content-Type: application/json" \
  -d '{}'
```

预期响应：
```json
{
  "success": false,
  "errorCode": "INVALID_PARAMS",
  "error": "缺少参数: liveId 或 account",
  "data": null
}
```

### 6.3 完整启动测试

```bash
curl http://localhost:3456/api/first -X POST \
  -H "Content-Type: application/json" \
  -d '{"liveId":"629979087422","account":"zh1"}'
```

会返回BROWSER_START_FAILED、BROWSER_TIMEOUT或成功，具体取决于浏览器状态。

### 6.4 发送测试

```bash
curl http://localhost:3456/api/send -X POST \
  -H "Content-Type: application/json" \
  -d '{"msg":"你好","account":"zh1"}'
```

会返回各种errorCode或成功。

---

## 七、常见问题排查

### Q1: 为什么前端收到的还是旧格式响应？

**A**: 检查server.mjs有没有正确导入handleFirst和handleSend，以及有没有替换旧的/api/first和/api/send处理逻辑。

### Q2: ads-tool.mjs还在输出console.log，没有输出JSON？

**A**: 检查ads-tool.mjs有没有替换成exitWithError()和exitWithSuccess()函数。确保所有error path都调用exitWithError()而不是console.error()。

### Q3: first.js/send.js报错找不到PROFILES？

**A**: 检查import是否正确：`import { PROFILES } from '../config.js'`。config.js必须导出PROFILES。

### Q4: response.js的sendError()还是输出旧格式？

**A**: 检查sendError函数签名是否更新为：`function sendError(res, error, statusCode, errorCode)`，并且确实调用了`res.writeHead(statusCode, ...)`和输出了errorCode。

### Q5: JSON解析失败时会怎样？

**A**: first.js/send.js都有try-catch包裹JSON解析，失败时会进入降级方案（用output字符串猜测errorCode）。这是为了兼容旧的ads-tool.mjs。

---

## 八、下一步工作

### 已完成 ✅
- [x] response.js加errorCode参数
- [x] first.js完整改造
- [x] send.js完整改造
- [x] ads-tool.mjs直接输出JSON
- [x] server.mjs导入新路由
- [x] 快速测试验证

### 待做 ⏳
- [ ] account-manager.js更新（仍在用旧的browserStarted）
- [ ] 完整端到端测试（10个账号并发）
- [ ] 前端app.js集成errorCode处理
- [ ] 生产环境部署

---

## 九、文件变更清单

| 文件 | 修改行数 | 改动类型 |
|------|--------|--------|
| server/utils/response.js | 5-14 | 修改sendError函数 |
| server/routes/first.js | 全文 | 新增 |
| server/routes/send.js | 全文 | 新增 |
| server/ads-tool.mjs | 50-280 | 修改+新增辅助函数 |
| server/server.mjs | 1-228 | 导入+替换路由处理 |

---

## 十、参考资源

- 项目位置：`/Users/mac/Desktop/LLCC/`
- 后端配置：`server/config.js`（包含PROFILES、超时配置等）
- 脚本执行：`server/utils/script-executor.js`（runScript函数）
- 前端集成：`public/js/app.js`（需要更新handleSendError()）

---

**最后修改时间**：2026-07-06 23:00

**作者**：海鸥 + AI

**版本**：v1.0

