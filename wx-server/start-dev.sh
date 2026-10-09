#!/usr/bin/env bash
# 拼豆手工店后端 - 本地一键启动脚本
# 用法：在 WSL Ubuntu-22.04 内执行  bash start-dev.sh
# 幂等：后端已在运行时会跳过启动，直接输出状态
set -uo pipefail

APP_DIR="/mnt/c/Users/21929/Desktop/wx-server"
LOG="/tmp/wx-server.log"
PORT=3000
HEALTH_URL="http://127.0.0.1:${PORT}/api/config/public"

echo "==> 1/3 确保基础服务已启动"
service mysql status >/dev/null 2>&1 || service mysql start
service redis-server status >/dev/null 2>&1 || service redis-server start

echo "==> 2/3 检查后端是否已在运行"
if curl -s -m 2 -o /dev/null "${HEALTH_URL}"; then
  echo "    端口 ${PORT} 已有服务响应，无需重复启动"
  echo "    服务地址: http://127.0.0.1:${PORT}"
  exit 0
fi

echo "==> 3/3 启动后端 (node dist/main.js) 并等待健康检查"
cd "${APP_DIR}" || { echo "    ERROR 目录不存在: ${APP_DIR}"; exit 1; }
setsid nohup node dist/main.js > "${LOG}" 2>&1 < /dev/null &

for i in $(seq 1 20); do
  sleep 1
  if curl -s -m 2 -o /dev/null "${HEALTH_URL}"; then
    echo "    OK - 后端已就绪"
    echo "    服务地址: http://127.0.0.1:${PORT}"
    echo "    运行日志: ${LOG}"
    exit 0
  fi
done

echo "    FAIL - 后端未能就绪，最近日志："
tail -30 "${LOG}" 2>/dev/null
exit 1