# 变更日志

## [v1.0] - 2026-07-06

### 🎯 主要功能

实现了完整的 ErrorCode 系统，用结构化的错误码替代字符串错误消息，让前端能精确处理每一种错误情况。

### ✨ 新增

#### 文件
- `server/routes/first.js` - POST /api/first 处理函数（新增）
- `server/routes/send.js` - POST /api/send 处理函数（新增）
- `ERRORCODE-SYSTEM-GUIDE.md` - 完整技术文档
- `README.md` - 项目文档
- `CHANGELOG.md` - 本文件

#### 功能
- ErrorCode 系统：10种标准化错误码
  - INVALID_PARAMS (400) - 参数错误
  - BROWSER_START_FAILED (500) - 浏览器启动失败
  - BROWSER_TIMEOUT (500) - 浏览器超时
  - BROWSER_OFFLINE (400) - 浏览器离线
  - NOT_LOGGED_IN (401) - 未登录
  - NOT_IN_LIVE_ROOM (400) - 不在直播间
  - SEND_RATE_LIMITED (429) - 频率限制
  - SEND_FAILED (500) - 发送失败
  - NETWORK_ERROR (500) - 网络错误
  - UNKNOWN_ERROR (500) - 未知错误

- JSON 格式响应
  ```json
  {
    "success": false,
    "errorCode": "BROWSER_OFFLINE",
    "error": "浏览器已离线",
    "data": null
  }
  ```

### 🔧 改动

#### server/utils/response.js
- 修改 `sendError()` 函数，添加 `errorCode` 参数（第4个参数）
- 响应格式统一为：`{success, errorCode, error, data}`

#### server/ads-tool.mjs
- 添加 `exitWithError(errorCode, errorMsg)` 函数
- 添加 `exitWithSuccess(msg)` 函数
- 修改 `openBrowser()` - 启动失败时调用 `exitWithError('BROWSER_START_FAILED')`
- 修改 `connectCDPWithRetry()` - 超时时调用 `exitWithError('BROWSER_TIMEOUT')`
- 修改 `getPageForProfile()` - 连接失败时调用 `exitWithError()`
- 修改 `main()` 函数 - 所有错误路径都用 `exitWithError()` 或 `exitWithSuccess()`
- 修改 `cascadeWindow()` 的 catch 块 - 填充注释而不是空块

#### server/routes/first.js
- 完全新增（之前逻辑在 server.mjs 中）
- 解析 ads-tool.mjs 返回的 JSON errorCode
- 有降级方案（如果 ads-tool 没返回 errorCode 则用字符串匹配）
- 返回统一格式的 HTTP 响应

#### server/routes/send.js
- 完全新增（之前逻辑在 server.mjs 中）
- 解析 ads-tool.mjs 返回的 JSON errorCode
- 有降级方案
- 返回统一格式的 HTTP 响应

#### server/server.mjs
- 添加导入：`import { handleFirst } from './routes/first.js'`
- 添加导入：`import { handleSend } from './routes/send.js'`
- 替换 `/api/first` 处理 - 从内联改为调用 `handleFirst()`
- 替换 `/api/send` 处理 - 从内联改为调用 `handleSend()`

### 🐛 修复

- 之前 response.js 的 sendError() 没有设置 HTTP 状态码响应头
- 之前 ads-tool.mjs 的错误信息杂乱（混合了日志和错误），前端无法精确判断
- 之前 first.js 和 send.js 的错误处理都在 server.mjs 中，代码重复且难以维护

### 📊 测试验证

- ✅ 缺参数测试：返回 INVALID_PARAMS
- ✅ 完整流程测试：各个 errorCode 正常返回
- ✅ ESLint 验证：0 errors, 2 warnings（unused变量，可忽略）

### 📝 文档

- 新增 `ERRORCODE-SYSTEM-GUIDE.md`（超详细的技术文档，包含排查指南）
- 新增 `README.md`（项目快速开始）
- 新增 `CHANGELOG.md`（本文件）

### 🚀 后续工作

**优先级高**：
- [ ] 前端 app.js 集成 errorCode 处理（switch而不是includes）
- [ ] account-manager.js 更新为新的五态机
- [ ] 完整端到端测试（10个账号并发启动+发送）

**优先级中**：
- [ ] 前端持久化本地重试状态
- [ ] 添加更细粒度的错误码（如 BROWSER_VERSION_MISMATCH 等）
- [ ] 生产环境部署检查表

**优先级低**：
- [ ] 国际化错误消息
- [ ] 错误上报系统
- [ ] 错误恢复自动化

### 🎓 关键学习

1. **不要用字符串匹配判断错误类型** - 容易误判，改用结构化错误码
2. **错误处理要贯穿全栈** - 从脚本层、API层到前端层都要有一致的标准
3. **降级方案很重要** - 新系统部署时，万一脚本还没更新，也能用旧方式兼容

### 🔗 相关文件

- 技术文档：[ERRORCODE-SYSTEM-GUIDE.md](./ERRORCODE-SYSTEM-GUIDE.md)
- API文档：[README.md](./README.md)
- 主服务：[server/server.mjs](./server/server.mjs)
- 脚本层：[server/ads-tool.mjs](./server/ads-tool.mjs)

---

## 安装和使用

```bash
# 安装
npm install

# 启动服务
bash start.sh

# 测试缺参数
curl http://localhost:3456/api/first -X POST -H "Content-Type: application/json" -d '{}'

# 测试完整流程
curl http://localhost:3456/api/first -X POST -H "Content-Type: application/json" -d '{"liveId":"629979087422","account":"zh1"}'
```

---

**项目名**：抖音1号 LLCC  
**版本**：v1.0  
**发布日期**：2026-07-06  
**作者**：海鸥 + AI
