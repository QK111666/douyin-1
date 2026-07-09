# 一一助手 维护手册

## 启动/停止

```bash
cd /Users/mac/Desktop/LLcc
bash start.sh          # 网页模式
npm run electron       # 桌面模式
```

停止：`kill $(lsof -ti :3456)`

## 关键文件

| 文件 | 作用 |
|------|------|
| `config/.bit_key` | 比特浏览器API密钥 |
| `public/js/app.js` | 前端核心逻辑（1402行） |
| `server/server.mjs` | 后端API + 静态文件服务 |
| `server/browser-pool.js` | 浏览器持久CDP连接池 |
| `server/check-login.mjs` | 登录状态检测（子进程调用） |
| `server/config.js` | 后端唯一配置源 |

## 数据备份

用户数据存储在浏览器 localStorage，清除缓存会丢失。定期导出：
1. 打开 http://localhost:3456
2. F12 → Application → Local Storage
3. 复制 `douyin_scripts`、`selected_script_map`、`script_groups` 的值

## 已知问题

- 比特浏览器API (localhost:54345) 必须运行
- DeepSeek Key 配置后AI生成才可用
- PROFILES映射表在前端和后端各一份，新增账号需两边同步

## 日志

- 服务端：启动时的终端输出
- 前端：浏览器F12 → Console
