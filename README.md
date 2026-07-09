# 一一助手 — 抖音多账号直播间自动评论工具

> **桌面软件 | Electron + Node.js + 比特浏览器**
> 路径：`/Users/mac/Desktop/LLcc`

## 功能清单

| 功能 | 说明 |
|------|------|
| 多账号管理 | 10个账号（zh1-zh10），搜索/过滤/批量操作 |
| 直播间锁定 | 输入ID → 进场 → 自动弹确认启动 |
| 发送评论 | 手动单条 / 全部发送 / 全局定时循环 |
| 定时器 | 单账号定时（1s~60s），实际为随机范围 |
| 全局暂停 | 一键暂停所有定时器，恢复后继续 |
| 词集系统 | 创建话术集 → 添加词条 → AI生成 → 批量导入 |
| 分组系统 | 创建分组 → 添加词集 → 一键分配到账号（不重复/可重复） |
| 真随机词条 | 记录历史避免重复，全部用完自动重置 |
| 直播间历史 | 自动记录进过的房间ID，点击填入 |
| 错误处理 | ErrorCode系统前后端对接，自动重试 |
| 浏览器检测 | 30分钟自动检测 + 手动刷新 |
| 日志 | 每账号独立日志 + 全局日志 |
| 桌面应用 | Electron 独立窗口，1280×800 |

## 项目结构

```
LLcc/
├── public/                  ← 前端
│   ├── index.html           ← 主页面（两栏布局）
│   ├── login.html           ← 登录页
│   ├── css/style.css        ← 样式
│   └── js/app.js            ← 前端逻辑（1402行）
├── server/                  ← 后端
│   ├── server.mjs           ← HTTP API（端口3456，含静态文件服务）
│   ├── browser-pool.js      ← 浏览器持久CDP连接池
│   ├── check-login.mjs      ← 登录检测
│   └── config.js            ← 配置（PROFILES等）
├── electron/main.js         ← Electron桌面入口
├── config/.bit_key          ← 比特浏览器API密钥
├── start.sh                 ← 网页模式启动脚本
├── package.json             ← npm run electron
└── README.md
```

## 启动方式

**桌面应用模式（推荐）：**
```bash
cd /Users/mac/Desktop/LLcc
npm run electron
```

**网页服务器模式：**
```bash
cd /Users/mac/Desktop/LLcc
bash start.sh
# 浏览器打开 http://localhost:3456/
# 登录：admin / admin
```

## 数据存储

所有数据存浏览器 localStorage：

| Key | 内容 |
|-----|------|
| `douyin_scripts` | 词集数据 |
| `selected_script_map` | 账号→词集映射 |
| `script_groups` | 分组数据 |
| `lxbtb_live_history` | 直播间历史 |
| `nb_login` | 登录态 |
| `script_tab` | 话术页tab记忆 |

## 依赖

- **比特浏览器**（localhost:54345）— 浏览器实例管理
- **Playwright** — CDP连接控制页面
- **DeepSeek API** — AI生成话术（可选，需配置密钥）
- **Electron** — 桌面应用壳

## 最近更新

**v2.0 — 2026-07-06**
- 两栏布局（左账号列表 + 右详情面板）
- 过滤标签 + 批量操作 + 全选
- 分组系统（创建分组 → 一键分配词集）
- 全局定时 + 全局暂停（真正停掉所有定时器）
- 进场后自动提示启动
- 真随机词条（不重复）
- 浏览器30分钟自动检测
- Electron 桌面应用
- 代码清理（从60+文件精简到22文件）
