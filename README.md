# 拼豆手工店小程序

拼豆手工店一体化前后端工程：微信小程序门店端 + NestJS 后端 + 客服收银台。

## 目录结构

```
PinDou/
├── wx/          # 微信小程序前端（扫码开台计时 / 商城 / 定制拼豆 / 订单 / 会员 / 收银台）
└── wx-server/   # NestJS 后端（座位计费 / 统一订单 / 收银台 / pattern 拼豆图案引擎）
```

## 快速开始

### 后端（wx-server）

```bash
cd wx-server
npm install
cp .env.example .env          # 回填数据库密码、JWT 密钥、微信 AppID/Secret
npm run build
npm run start:prod            # 生产模式启动（默认 3000 端口）
```

首次部署需先初始化数据库：

```bash
mysql -u root -p < db/schema.sql              # 建库建表
npm run seed                                   # 写入基础数据（管理员/店员/商品/座位等）
```

### 小程序前端（wx）

1. 微信开发者工具 → 导入项目 → 选择 `wx/` 目录
2. 修改 `wx/utils/config.js` 中后端地址为本机或服务器地址
3. 编译运行；扫码开台页可先用工具生成座位二维码调试

### 图案生成引擎

`wx-server/pattern` 引擎支持三种标准板型（传 `boardType`）：

| 板型   | 网格规格   |
| ------ | ---------- |
| SMALL  | 52 × 52    |
| MIDDLE | 78 × 78    |
| LARGE  | 104 × 104  |

上传图片自动背景透明化；预览图与成图均为透明底 PNG。接口契约见 `wx-server/docs/pattern-api-contract.md`。

## 门店/收银台演示账号

- owner / manager / staff01，密码均为 `demo123456`（仅演示环境）

## 技术栈

- 前端：微信小程序原生（ES6 + WXSS）
- 后端：NestJS + TypeORM + MySQL + Redis（可选）+ JWT
- 收银台：静态 HTML（`wx-server/public/admin`）