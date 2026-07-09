#!/bin/bash
# 一一助手 — 启动后端服务
# 用法: ./start.sh

DIR="$(cd "$(dirname "$0")" && pwd)"

# 读取 BIT_KEY：优先找配置文件，其次环境变量
BIT_KEY_FILE="$DIR/config/.bit_key"
if [ -f "$BIT_KEY_FILE" ]; then
  export BIT_KEY="$(cat "$BIT_KEY_FILE" | tr -d '\n\r')"
elif [ -f /tmp/bit_key.txt ]; then
  export BIT_KEY="$(cat /tmp/bit_key.txt | tr -d '\n\r')"
fi

if [ -z "$BIT_KEY" ]; then
  echo "❌ 需要 BIT_KEY"
  echo "   方式1: echo '你的密钥' > $DIR/.bit_key"
  echo "   方式2: export BIT_KEY='你的密钥'"
  exit 1
fi

# 杀旧进程
OLD_PID=$(lsof -ti :3456 2>/dev/null)
if [ -n "$OLD_PID" ]; then
  echo "🔄 关闭旧服务 (PID $OLD_PID)..."
  kill "$OLD_PID" 2>/dev/null
  sleep 1
fi

# 启动
cd "$DIR" && node server/server.mjs
