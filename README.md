# 抖音1号 - LLCC ErrorCode 系统

## 项目简介

**抖音1号**是一个抖音直播间自动化互动系统，核心功能包括：
- 多账号管理
- 自动进入直播间
- 自动发送评论
- 智能错误处理

本仓库主要记录**ErrorCode 系统**的完整实现，这是一套结构化的错误码机制，让后端API返回标准化的错误信息，前端能精确处理每一种错误情况。

## 快速开始

### 安装依赖
```bash
cd LLCC
npm install
```

### 启动服务
```bash
bash start.sh
```

服务启动在 `http://localhost:3456`

### 访问前端
打开浏览器访问 `http://localhost:3456`，输入用户名和密码登录。

## ErrorCode 系统核心

### 问题背景

之前的错误处理方式：
```javascript
// ❌ 不靠谱的做法
if (result.output.includes('offline')) {
  // 可能是浏览器离线，也可能只是output里恰好有'offline'这个词
}
```

新的ErrorCode系统：
```javascript
// ✅ 精确的做法
switch(response.errorCode) {
  case 'BROWSER_OFFLINE':
    // 确定是浏览器离线
    break;
  case 'SEND_RATE_LIMITED':
    // 确定是频率限制，用指数退避重试
    break;
}
```

### 数据流

```
前端 POST /api/first
    ↓
handleFirst() 调用 ads-tool.mjs
    ↓
ads-tool.mjs 执行脚本，失败时输出：
{"success": false, "errorCode": "BROWSER_OFFLINE", "error": "..."}
    ↓
handleFirst() 解析JSON，提取errorCode
    ↓
前端收到标准化响应：
{
  "success": false,
  "errorCode": "BROWSER_OFFLINE",
  "error": "浏览器已离线",
  "data": null
}
```

### ErrorCode 类型

| 错误码 | HTTP状态 | 含义 | 前端处理 |
|--------|--------|------|--------|
| INVALID_PARAMS | 400 | 缺少参数 | 显示参数错误 |
| BROWSER_START_FAILED | 500 | 浏览器启动失败 | ERROR状态 |
| BROWSER_TIMEOUT | 500 | 浏览器超时 | ERROR状态+建议重启 |
| BROWSER_OFFLINE | 400 | 浏览器离线 | OFFLINE状态 |
| NOT_LOGGED_IN | 401 | 账号未登录 | OFFLINE状态 |
| NOT_IN_LIVE_ROOM | 400 | 不在直播间 | OFFLINE状态 |
| SEND_RATE_LIMITED | 429 | 频率限制 | 指数退避重试 |
| SEND_FAILED | 500 | 发送失败 | 简单重试 |
| NETWORK_ERROR | 500 | 网络错误 | 提示异常 |
| UNKNOWN_ERROR | 500 | 未知错误 | 显示原始信息 |

## API 文档

### POST /api/first - 启动浏览器

**请求**：
```bash
curl http://localhost:3456/api/first -X POST \
  -H "Content-Type: application/json" \
  -d '{"liveId":"629979087422","account":"zh1"}'
```

**参数**：
- `liveId` (string, required): 直播间ID
- `account` (string, required): 账号名称（zh1-zh10）

**成功响应** (200):
```json
{
  "success": true,
  "error": null,
  "errorCode": null,
  "data": {"message": "启动成功"}
}
```

**错误响应** (400/500):
```json
{
  "success": false,
  "errorCode": "BROWSER_OFFLINE",
  "error": "浏览器已离线",
  "data": null
}
```

### POST /api/send - 发送评论

**请求**：
```bash
curl http://localhost:3456/api/send -X POST \
  -H "Content-Type: application/json" \
  -d '{"msg":"你好","account":"zh1"}'
```

**参数**：
- `msg` (string, optional): 评论内容，默认"你好"
- `account` (string, required): 账号名称

**响应格式**同 /api/first

## 关键改动

1. **response.js** - 添加errorCode参数到sendError()
2. **ads-tool.mjs** - 输出JSON格式errorCode而不是console.log
3. **routes/first.js** - 新增，解析errorCode并返回
4. **routes/send.js** - 新增，解析errorCode并返回  
5. **server.mjs** - 导入新路由函数

详见 [ERRORCODE-SYSTEM-GUIDE.md](./ERRORCODE-SYSTEM-GUIDE.md)

## 前端集成

需要更新 `handleSendError()` 用switch(errorCode)处理每种错误类型。

## 测试

```bash
# 缺参数测试
curl http://localhost:3456/api/first -X POST -H "Content-Type: application/json" -d '{}'

# 完整启动测试
curl http://localhost:3456/api/first -X POST -H "Content-Type: application/json" -d '{"liveId":"629979087422","account":"zh1"}'

# 发送测试
curl http://localhost:3456/api/send -X POST -H "Content-Type: application/json" -d '{"msg":"你好","account":"zh1"}'
```

## 待完成

- [ ] 前端集成errorCode处理
- [ ] account-manager.js更新
- [ ] 完整端到端测试
- [ ] 生产部署

---

**最后更新**：2026-07-06 | **版本**：v1.0
