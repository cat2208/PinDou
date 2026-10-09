#!/usr/bin/env bash
# ============================================================
# 拼豆手工店小程序 · 阿里云 ECS（Ubuntu 22.04）一键部署脚本
# 用法: sudo bash deploy.sh
# 幂等：可重复执行，各阶段会自动跳过已完成的步骤
# ============================================================
set -euo pipefail

# ---------- 配置区（按需修改）----------
APP_DIR="/opt/wx-server"                 # 后端源码部署位置（脚本会自动拷贝）
DOMAIN="api.yourdomain.com"              # API 域名（HTTPS 证书绑定域名）
DB_NAME="wx_shop"
DB_USER="wx_app"
DB_PASS="WxApp_2026_ChangeMe!"           # 生产务必修改为强密码
JWT_SECRET="$(openssl rand -hex 32)"     # 每次执行生成新的随机密钥
WX_APPID="wx_dev_mock_appid"             # 上线前替换为真实 AppID
WX_SECRET="wx_dev_mock_secret"           # 上线前替换为真实 AppSecret
WX_MOCK_LOGIN="true"                     # 生产置 false
# ---------- 配置区结束 ----------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
log() { echo -e "\033[1;32m[deploy]\033[0m $*"; }
err() { echo -e "\033[1;31m[deploy-error]\033[0m $*"; exit 1; }

[ "$(id -u)" = "0" ] || err "请使用 sudo 运行：sudo bash deploy.sh"

# ---------- 1. 系统依赖 ----------
log "安装系统依赖 ..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  log "安装 Node.js 20 ..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if ! command -v mysql >/dev/null 2>&1; then
  log "安装 MySQL 8 ..."
  apt-get install -y mysql-server
  systemctl enable --now mysql
fi

if ! command -v redis-server >/dev/null 2>&1; then
  log "安装 Redis ..."
  apt-get install -y redis-server
  systemctl enable --now redis-server
fi

if ! command -v nginx >/dev/null 2>&1; then
  log "安装 Nginx ..."
  apt-get install -y nginx
  systemctl enable --now nginx
fi

# ---------- 2. MySQL 建库与授权 ----------
log "初始化数据库（幂等）..."
for i in 1 2 3 4 5; do
  mysqladmin ping --silent 2>/dev/null && break
  sleep 2
done
mysql <<SQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

# 导入表结构（仅在业务表不存在时执行，保留运行数据）
HAS_TABLE=$(mysql -N -s -u${DB_USER} -p"${DB_PASS}" ${DB_NAME} -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${DB_NAME}' AND table_name='product';" 2>/dev/null || echo 0)
if [ "${HAS_TABLE}" = "0" ]; then
  log "导入表结构与种子数据 ..."
  mysql -u${DB_USER} -p"${DB_PASS}" ${DB_NAME} < "${SCRIPT_DIR}/../db/schema.sql"
else
  log "数据库已有业务表，跳过 schema 导入"
fi

# ---------- 3. 部署后端代码 ----------
log "部署后端代码到 ${APP_DIR} ..."
mkdir -p "${APP_DIR}"
# 只拷贝源码与配置（排除 node_modules / dist / .git）
rsync -a --delete \
  --exclude node_modules --exclude dist --exclude .git --exclude .env \
  "${SCRIPT_DIR}/../" "${APP_DIR}/" 2>/dev/null || cp -r "${SCRIPT_DIR}/../." "${APP_DIR}/"

cd "${APP_DIR}"
log "npm install + build ..."
npm ci --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund
npm run build

# ---------- 4. 写 .env ----------
log "写入生产 .env ..."
cat > "${APP_DIR}/.env" <<EOF
# ===== 应用 =====
NODE_ENV=production
PORT=3000

# ===== 数据库 =====
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_NAME=${DB_NAME}

# ===== Redis =====
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0

# ===== JWT =====
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d

# ===== 微信小程序 =====
WX_APPID=${WX_APPID}
WX_SECRET=${WX_SECRET}
WX_MOCK_LOGIN=${WX_MOCK_LOGIN}

# ===== 上传 =====
UPLOAD_DIR=uploads
PUBLIC_BASE_URL=https://${DOMAIN}

# ===== 门店 =====
DEFAULT_STORE_ID=1
EOF
chmod 600 "${APP_DIR}/.env"

# ---------- 5. systemd 服务 ----------
log "注册 systemd 服务 ..."
cat > /etc/systemd/system/wx-server.service <<EOF
[Unit]
Description=WX PinDou Shop Backend
After=network.target mysql.service redis-server.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/node ${APP_DIR}/dist/main.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable wx-server
systemctl restart wx-server
sleep 2
systemctl is-active --quiet wx-server || err "wx-server 启动失败，请查看: journalctl -u wx-server -n 50"

# ---------- 6. Nginx 反代 ----------
log "写入 Nginx 配置（${DOMAIN}）..."
mkdir -p /etc/nginx/conf.d
cat > /etc/nginx/conf.d/wx-api.conf <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    # 380 端口 HTTP 仅用于 ACME/校验，生产可整段 301 跳 HTTPS
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    # !!! 替换为实际证书路径 !!!
    ssl_certificate     /etc/ssl/certs/${DOMAIN}.pem;
    ssl_certificate_key /etc/ssl/private/${DOMAIN}.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    client_max_body_size 20m;

    # 后端 API
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    # 上传图片静态资源
    location /uploads/ {
        alias ${APP_DIR}/uploads/;
        expires 7d;
    }

    # PC 运营管理后台（后端静态托管 public/admin，URL 形如 /admin/index.html）
    location /admin/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # 站点图片资源（banner 等），URL 形如 /images/home/banner1.png
    location /images/ {
        proxy_pass http://127.0.0.1:3000;
        expires 7d;
    }
}
EOF
nginx -t && systemctl reload nginx || err "Nginx 配置校验失败"

# ---------- 7. 自检 ----------
log "自检 ..."
sleep 1
CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/config/public || echo 000)
echo "  /api/config/public (本机): HTTP ${CODE}"
ADMIN_CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/admin/index.html || echo 000)
echo "  /admin/index.html      (本机): HTTP ${ADMIN_CODE}"
echo ""
echo "==============================================="
echo " 部署完成！剩余人工步骤："
echo "  1. 将证书文件放到 /etc/ssl/certs/${DOMAIN}.pem 和 /etc/ssl/private/${DOMAIN}.key"
echo "  2. 修改 .env 中的 WX_APPID / WX_SECRET / WX_MOCK_LOGIN=false"
echo "  3. 小程序后台配置 request/uploadFile 合法域名 https://${DOMAIN}"
echo "  4. 用微信开发者工具上传代码并提交审核"
echo "  5. PC 管理后台访问: https://${DOMAIN}/admin/index.html"
echo "     (或用 deploy/nginx/admin.conf 绑定独立域名 admin.yourdomain.com)"
echo "==============================================="