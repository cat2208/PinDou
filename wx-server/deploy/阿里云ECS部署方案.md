# 拼豆手工店小程序 · 阿里云 ECS 部署方案

版本：v1.4 ｜ 适用环境：阿里云 ECS（Ubuntu 22.04 / 2C4G 起步）｜ 后端：NestJS（Node 20）+ MySQL 8.0 + Redis

---

## 0. 部署架构总览

```
微信小程序（用户端）
   │  HTTPS（wx.request / wx.uploadFile）
   ▼
阿里云 SLB / ECS 公网IP:443
   ▼
Nginx（HTTPS 终结、静态资源、反向代理）
   ├── /api      → 127.0.0.1:3000  NestJS（systemd 守护，node dist/main.js）
   ├── /uploads  → 本地 uploads/ 静态目录（图片/图纸/拼豆预览/质检照片）
   ├── /admin    → 127.0.0.1:3000  PC 运营管理后台（后端静态托管 public/admin）
   ├── /images   → 127.0.0.1:3000  站点图片资源（banner 等，后端静态托管 public/images）
   └── 证书      → 阿里云 SSL 证书（域名 xxx.com）
   ▼
MySQL 8.0（本机 127.0.0.1:3306，库 wx_shop）＋ Redis 6/7（127.0.0.1:6379）

对象存储（可选进阶）：当前图片走本机 uploads/；量大后迁移阿里云 OSS
```

- 开发期（WSL Ubuntu 22.04）与生产环境的**代码同一**，仅 `.env` 配置不同。
- 全部中间件（MySQL / Redis / Node）均在本机安装，无外部依赖，可一键脚本化部署。
- **PC 运营管理后台**由后端直接托管（NestJS ServeStatic 挂载 `public/admin`），
  无需单独部署前端构建产物；访问方式见第 6 节。

---

## 1. 购买与初始化 ECS

| 项 | 建议值 |
| --- | --- |
| 地域 | 就近用户（如华东1-杭州） |
| 实例规格 | 2 vCPU / 4GB 起步（1C2G 仅够演示） |
| 系统 | Ubuntu 22.04 64 位 |
| 磁盘 | 40GB 高效云盘起（uploads 图片会增长，可挂数据盘） |
| 安全组放行 | 22（仅限自己IP）, 80, 443；可关闭 3000 直连 |

初始化动作：
```bash
sudo apt update && sudo apt -y upgrade
# 确认时区
sudo timedatectl set-timezone Asia/Shanghai
```

---

## 2. 域名与证书

1. 购买/备案域名（阿里云 ICP 备案必需，小程序审核要求）。
2. 域名解析：A 记录指向 ECS 公网 IP。
3. 申请 SSL 证书：阿里云数字证书管理服务 → 免费证书（DV），绑定主域名与 `api.` 子域。
4. 下载 **Nginx 格式**证书包，内含 `.pem`（证书）与 `.key`（私钥）。

推荐域名规划：
| 用途 | 域名 | 说明 |
| --- | --- | --- |
| API 后端 | `api.yourdomain.com` | 小程序 request 合法域名只填它 |
| PC 管理后台 | `admin.yourdomain.com` | 可选独立域名；不加域名时通过 `api.yourdomain.com/admin/index.html` 访问 |

> 小程序 `request`/`uploadFile` 合法域名必须是 **HTTPS 且经 ICP 备案**，IP 或 http 直接不可用。

---

## 3. 手动一键部署（推荐路径）

把本项目 `deploy/` 目录与 `wx-server` 源码上传服务器后：

```bash
# 1. 进入服务器端部署脚本所在目录
cd ~/deploy

# 2. 查看配置项（脚本头部常量，按需修改域名/密码）
vim scripts/deploy.sh

# 3. 执行部署（支持幂等，可多次运行）
sudo bash scripts/deploy.sh
```

脚本自动完成：安装 Node 20 / MySQL 8 / Redis / Nginx → 建库导 schema → 写 .env →
npm install + build → 注册 systemd 服务 → 写 Nginx 配置并 reload → 输出自检信息。

> 若服务器已装好部分组件，脚本会跳过对应安装段。

---

## 4. 手动分步部署（若想自行控制每步）

### 4.1 安装 Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v20.x
```

### 4.2 安装 MySQL 8.0

```bash
sudo apt install -y mysql-server
sudo service mysql start

# 创建业务库与专用账号（与本地开发一致，便于切环境）
sudo mysql <<'SQL'
CREATE DATABASE IF NOT EXISTS wx_shop DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'wx_app'@'localhost' IDENTIFIED BY '替换为强密码';
CREATE USER IF NOT EXISTS 'wx_app'@'127.0.0.1' IDENTIFIED BY '替换为强密码';
GRANT ALL PRIVILEGES ON wx_shop.* TO 'wx_app'@'localhost';
GRANT ALL PRIVILEGES ON wx_shop.* TO 'wx_app'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

# 导入表结构 + 种子数据
mysql -uwx_app -p'替换为强密码' wx_shop < db/schema.sql
```

MySQL 安全加固（生产必做）：
```bash
sudo mysql_secure_installation   # 设 root 密码、删匿名用户、禁远程 root
```
> 后端只通过 `127.0.0.1` 连 MySQL，不要开 3306 公网端口。

### 4.3 安装 Redis 6/7

```bash
sudo apt install -y redis-server
sudo service redis-server start
# 默认仅监听 127.0.0.1，无需改配置
```

### 4.4 部署后端应用

```bash
# 假设已把 wx-server 源码放到 /opt/wx-server
cd /opt/wx-server
cp .env.example .env    # 如仓库无 .env.example，按下方「生产 .env 模板」创建
npm ci --omit=dev --no-audit --no-fund   # 或 npm install
npm run build
```

**生产 `.env` 模板**（关键项，其余沿用开发默认）：

```ini
NODE_ENV=production
PORT=3000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=wx_app
DB_PASSWORD=替换为强密码
DB_NAME=wx_shop

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0

JWT_SECRET=替换为32字节以上随机串
JWT_EXPIRES_IN=7d

# ===== 微信小程序（上线前必须替换为真实值）=====
WX_APPID=你的小程序AppID
WX_SECRET=你的小程序AppSecret
WX_MOCK_LOGIN=false      # 关闭 mock，走真实微信 code2session

# 上传图片对外访问前缀：生产必须是 https 域名
UPLOAD_DIR=uploads
PUBLIC_BASE_URL=https://api.yourdomain.com

DEFAULT_STORE_ID=1
```

> 生成随机 JWT 密钥：`openssl rand -hex 32`

### 4.5 进程守护（systemd）

把 `deploy/systemd/wx-server.service` 放入 `/etc/systemd/system/`：

```bash
sudo cp deploy/systemd/wx-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wx-server
sudo systemctl status wx-server
```

常用命令：
```bash
sudo systemctl restart wx-server    # 重启
journalctl -u wx-server -f          # 看日志
```

### 4.6 Nginx 反向代理 + HTTPS

把 `deploy/nginx/api.conf` 放入 `/etc/nginx/conf.d/`（按实际证书路径调整）：

```bash
sudo cp deploy/nginx/api.conf /etc/nginx/conf.d/api.conf
sudo nginx -t && sudo systemctl reload nginx
```

`api.conf` 已包含 `/api`、`/uploads` 反代；使用 `deploy.sh` 一键部署时还会自动写入
`/admin`、`/images` 反代。若手工分步部署，请同样为两个路径补充 proxy_pass（见 deploy.sh 第 6 节模板）。

可选：PC 后台独立域名（`admin.yourdomain.com`）：

```bash
sudo cp deploy/nginx/admin.conf /etc/nginx/conf.d/admin.conf
# 编辑文件：把 server_name 与证书路径改为实际域名
sudo nginx -t && sudo systemctl reload nginx
```

---

## 4.7 拼豆来图定制功能说明

拼豆功能（来图转图纸）随后端一起部署，无需额外组件：

| 项 | 说明 |
| --- | --- |
| 接口 | `POST /api/pattern/generate`（登录后可调用，multipart 上传图片） |
| 图纸读取 | `GET /api/pattern/:id`（公开，配豆清单/规格） |
| 色板 | 内置 MARD 291 色拼豆色板（`src/modules/pattern/palettes/`），可增删改色号 |
| 图纸产物 | 写入 `uploads/pattern/`，经 `/uploads/pattern/xxx.png` 公网访问 |
| 尺寸/颗数 | 支持豆规格 5mm（默认）/10mm，网格边长 8~120，颗数=网格宽×高，尺寸按豆径折算 |
| 配豆清单 | 每色给出颗数与包数（1000 颗/包），用于库存与报价 |

部署注意：
- `uploads/pattern/` 目录会随业务增长，注意磁盘与备份（第 7 节）。
- Nginx `client_max_body_size 20m` 已覆盖图纸原图上传。

---

## 5. 微信公众平台配置（上线关键）

| 配置项 | 值 | 位置 |
| --- | --- | --- |
| request 合法域名 | `https://api.yourdomain.com` | 小程序后台 → 开发管理 → 开发设置 → 服务器域名 |
| uploadFile 合法域名 | `https://api.yourdomain.com` | 同上（图片上传接口） |
| downloadFile 合法域名 | `https://api.yourdomain.com` | 同上 |
| 业务域名 | 同 uploadFile | 若用到 web-view |
| 服务器域名校验 | 下载校验文件放 Nginx 根目录即可 | 按后台提示 |

> 合法域名**必须 HTTPS**、**已备案**、域名与证书一致。配置后约 5~10 分钟生效。

微信支付（如需真实收款，一期可先沙箱）：
1. 开通微信支付商户号，产品中心开通「小程序支付（JSAPI）」。
2. 服务端支付模块替换 mock：`POST /api/pay/wxpay` 处调用 `wxpay` SDK 统一下单，回调 `/api/pay/notify` 验签后更新订单。

---

## 6. 小程序端发布步骤

```bash
# 1. 后端已上线且接口可访问后，修改小程序请求层的 baseURL
#    wx/utils/request.js 中 BASE_URL 改为 https://api.yourdomain.com
#    注意：模拟器可用 localhost，真机/发布必须 https 域名

# 2. 微信开发者工具 → 详情 → 域名信息 → 将 api.yourdomain.com 加入不校验合法域名（仅开发调试）

# 3. 工具栏「上传」→ 填版本号（如 1.0.0）与备注 → 上传代码

# 4. 小程序后台 → 版本管理 → 开发版本 → 提交审核 → 填写类目与隐私授权说明

# 5. 审核通过 → 发布（全量或分阶段）
```

## 6.1 PC 运营管理后台访问

PC 后台为后端静态托管的单文件页面（`public/admin/index.html`），登录鉴权（JWT）。

| 方案 | 访问地址 | 配置 |
| --- | --- | --- |
| 不加独立域名 | `https://api.yourdomain.com/admin/index.html` | 只需 `api.conf`/`deploy.sh` 含 `/admin` 反代（已内置） |
| 独立域名 | `https://admin.yourdomain.com/admin/index.html` | 另配 `deploy/nginx/admin.conf` |

种子账号（T4 初始化脚本写入）：
| 账号 | 密码 | 角色 |
| --- | --- | --- |
| `manager` | `demo123456` | 店长（MANAGER） |
| `owner` | `demo123456` | 老板（OWNER） |

> 上线后请立即通过后台「账号管理」或在库中修改密码。后台功能：仪表盘、订单管理、
> 定制订单（含拼豆配豆清单查看）、商品管理、库存、优惠券、运营定价、会员等级管理。

发布前自检清单：
- [ ] `WX_MOCK_LOGIN=false`，AppID/Secret 已填真实值
- [ ] 真机预览走通：登录、首页、下单、订单详情
- [ ] 图片上传后 `https://api.yourdomain.com/uploads/...` 可访问
- [ ] PC 后台 `https://api.yourdomain.com/admin/index.html` 可用种子账号登录
- [ ] 拼豆图纸：小程序来图定制上传图片 → 生成预览 → 配豆清单正确
- [ ] HTTPS 证书无过期告警，`/api/config/public` 通过 `https://api.yourdomain.com/api/config/public` 可访问
- [ ] 小程序后台合法域名已配置并生效
- [ ] MySQL/Redis 无公网暴露

---

## 7. 备份与运维

```bash
# 每日数据库备份（crontab 示例，每天 03:00）
# 0 3 * * * mysqldump -uwx_app -p'密码' wx_shop | gzip > /backup/wx_shop_$(date +\%F).sql.gz

# uploads 图片目录
# 建议同数据盘快照一起备份，或后续迁 OSS

# 应用日志
journalctl -u wx-server --since "1 hour ago"

# 资源监控（2C4G 起步足够；高峰期关注 CPU 与内存）
htop / free -h / df -h
```

---

## 8. 常见问题

| 现象 | 排查 |
| --- | --- |
| 小程序报「不在以下 request 合法域名列表中」 | 域名未配置/未备案/证书不符，按第 5 节核对 |
| 接口 502 | Nginx 未代理或后端未启动：`systemctl status wx-server`、`nginx -t` |
| 登录失败 40001 | WX_APPID / WX_SECRET 与小程序不匹配，或未在后台开启「登录」能力 |
| 图片上传后打不开 | PUBLIC_BASE_URL 是否 https 域名；uploads 目录权限 `www-data` 可读 |
| 数据库连接失败 | .env 密码/账号与 MySQL 授权不一致；3306 仅限 127.0.0.1 |