# 拼豆图纸（图片转拼豆）接口契约 v1.0

> 配套《拼豆手工店小程序开发技术书 v1.3》第 6 节「来图定制」。
> 技术选型与算法设计见 `docs/pattern-engine-design.md`。
> 色板：MARD 291 色（基础 221 + 扩展 70），`{ code, hex }` 结构，见 `src/modules/pattern/palettes/mard-291.ts`。

## 1. 生成拼豆图纸

### POST /api/pattern/generate
- 鉴权：登录（小程序用户 JWT）
- Content-Type: `multipart/form-data`
- 字段：

| 字段 | 类型 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- | --- |
| file | file | 是 | - | 用户上传的原图（jpg/png/webp，≤15MB） |
| boardType | string | 否 | - | 板型：`SMALL`=52×52、`MIDDLE`=78×78、`LARGE`=104×104 格（正方形，忽略 gridWidth/Height）；不传则走自定义网格 |
| beadSize | number | 否 | 5 | 豆直径 mm：`2.6`(Mini) / `5`(Midi) / `10`(Maxi) |
| gridWidth | number | 否 | 32 | 自定义网格宽（格），范围 8~128；仅在未传 boardType 时生效 |
| gridHeight | number | 否 | - | 自定义网格高（格），范围 8~128；仅在未传 boardType 时生效；缺省按原图比例推算；同时给出时组成任意矩形网格（向下兼容：小尺寸可直接放在更大板子上，不强制铺满） |
| maxColors | number | 否 | 16 | 最多用色（种），范围 8~24 |
| style | string | 否 | CARTOON | `CARTOON`（卡通/扁平）/ `REALISTIC`（写实/渐变） |

> 板型换算（5mm 豆）：`SMALL` 52×52 = 2704 格 → 26×26cm；`MIDDLE` 78×78 = 6084 格 → 39×39cm；`LARGE` 104×104 = 10816 格 → 52×52cm（等价 4 块小板拼接）。
> 自定义网格（不传 boardType）：任意 8~128 格的宽×高矩形（如 40×60），不做拉伸，实现向下兼容。
> 预览图背景：背景格与珠间间隙输出为**透明**（alpha=0），只有珠粒本体不透明，方便叠加到任意底色展示。

- 成功 `200`：

```json
{
  "patternId": "p_4c9ba18ff42b_32x32_5_8_cartoon",
  "patternUrl": "/uploads/pattern/p_xxx.png",
  "origUrl": "/uploads/pattern/xxx-1718....jpg",
  "gridWidth": 32,
  "gridHeight": 32,
  "totalBeans": 1024,
  "colorCount": 2,
  "beadSize": 5,
  "sizeCm": { "w": 16.0, "h": 16.0 },
  "colors": [
    { "code": "B8", "hex": "#1C9C4F", "count": 316, "packs": 1, "ratio": 0.3086 },
    { "code": "R8", "hex": "#1A60C3", "count": 96,  "packs": 1, "ratio": 0.0938 }
  ],
  "palette": "mard-291"
}
```

- 字段口径：
  - `totalBeans = gridWidth × gridHeight`（满铺格数，含空白格）；
  - `sizeCm = grid × beadSize / 10`（每格=1颗豆直径）；
  - `colors[].count` 为实际用料颗数；`packs = ceil(count / 1000)` 为折算包数；`ratio` 相对满铺格数。
  - 空白（背景）格不计入 colors，渲染为空色块（白色）。
- 服务端同图同参数结果缓存在 `uploads/pattern/{patternId}.json`，返回 `patternId` 幂等可用；`patternUrl/origUrl` 由 `/uploads/` 静态服务直接可访问。

### GET /api/pattern/palettes
- 鉴权：无需登录
- 返回：

```json
{ "palettes": [ { "id": "mard-291", "label": "MARD 291色", "size": 291 } ] }
```

### GET /api/pattern/:patternId
- 鉴权：无需登录
- 返回与 generate 相同的图纸 JSON（读缓存）；缓存不存在返回 404。

## 2. 定制报价（按图纸精确计价）

### POST /api/custom/quote
- 鉴权：无需登录（预览报价）
- body（新增字段，size/qty 兼容旧版）：

```json
{
  "size": "25×25cm",
  "qty": 1,
  "patternId": "p_4c9ba18ff42b_32x32_5_8_cartoon"
}
```
或直接携带豆数（未走图纸流时）：
```json
{ "size": "25×25cm", "qty": 1, "totalBeans": 6400, "colorCount": 12, "sizeCm": { "w": 40, "h": 40 } }
```

- 成功 `200`：

```json
{
  "unitPrice": 75,
  "rawUnitPrice": 75,
  "deliveryDay": 3,
  "totalPrice": 75,
  "currency": "CNY",
  "pattern": { "totalBeans": 6400, "beanPricePer": 0.012 }
}
```

- 计价规则（见 `custom.service.ts` `quoteWithPattern`，参数从 `pricing_config` 读取）：
  `unitPrice = round5( totalBeans × bean单价 + totalBeans × 人工系数 + 基价 × 面积系数 )`，
  面积系数 `= round(sizeCm.w × sizeCm.h / 25)`，下限 1；`bean` 默认 0.012 元/颗、人工系数默认 0.006 元/颗、基价默认 25 元；结果五入到 5 元，最低 20 元。
  无 patternId/totalBeans 时回退尺寸阶梯价（与 preview.js 原有逻辑一致），qty≥3 享 95 折。

## 3. 创建定制订单（携带图纸）

### POST /api/custom/orders
- 鉴权：登录
- body（新增字段）：

```json
{
  "image": "/uploads/xxx.jpg",
  "size": "25×25cm",
  "qty": 1,
  "contact": "张三",
  "phone": "13800000000",
  "patternId": "p_xxx",
  "remark": "渐变背景"
}
```
或携图纸参数（未回传 patternId 时）：
`totalBeans / colorCount / colorsJson / style / gridWidth / gridHeight / beadSize / patternUrl`

- 服务端行为：
  - 有「patternId 且缓存可读」或「totalBeans」时，按图纸精确报价入库（`total_price`、`deposit = 50%`）；
  - `pattern_url` 存拼豆预览图 URL；`colors_json` 存完整图纸参数（含网格、豆规格、配豆清单 colors[code/hex/count/packs]）；
  - 若 `amountFen > 0`（用户已支付确认价）则尊重用户金额，不再重算；
  - `width/height` 存成品尺寸 cm（保持旧前端 `title` 展示 `32×32cm` 语义不变），网格/豆规格存 colors_json。

## 4. 错误
- 统一 `{ "statusCode": 400, "message": "..." }`；
- 常见：`无法读取图片信息`（非图片/损坏）、文件超限、未登录 `401`。

## 5. 前端接入点
- 小程序：`pages/custom/upload`（上传后调 generate）→ `pages/custom/preview`（展示 patternUrl + 配豆清单 + 规格可选 + 调 quote）→ `pages/custom/confirm`（下单传 patternId/patternUrl/totalBeans/colorsJson）。
- PC 后台：定制订单详情通过 `colors_json` 展示豆数/色数/图纸图，失败时可手动录入（写 audit_log，技术书 6.1）。

---

# 附：到店体验（座位开台）与统一收银接口契约 v2.0

> 配套《拼豆手工店小程序项目对接书》V2 精简方案：座位扫码开台、正计时计费、统一结账、收银台。
> 服务端角色：`USER`（小程序用户 JWT，`/api/user/login` 签发）；`STAFF/MANAGER/OWNER`（店员 JWT，`/api/staff/login` 签发，收银台与管理接口必需）。

## 6. 门店基础

### GET /api/store/info
- 鉴权：无需登录
- 返回：`{ id, name, address, phone, businessHours, latitude, longitude, status, notice, pricing: { beanUnitPrice, laborPriceNormal, laborPriceComplex, colorThreshold, pointsPerYuan, shippingFee, freeShippingThreshold }, store: { name, address, phone, businessHours } }`

### GET /api/store/packages
- 鉴权：无需登录
- 返回：`{ list: [{ id, name, type, price, priceText, durationMinutes, hourlyUnitPrice, deposit, description }] }`
- `type`：`HOURLY`（按实际用时×单价）/ `DURATION`（套餐内固定价，超时按补充价）/ `ALL_DAY`（全天固定价）

### GET /api/store/seats?available=1
- 鉴权：无需登录；`available=1` 只返回空闲座位
- 返回：`{ list: [{ id, seatNo, area, status, token }] }`
- `token` 为座位独立二维码内容（兼容纯 token / `seat=tok-A01` / 完整 URL 三类扫码结果）

## 7. 开台与会话（到店 DIY）

### POST /api/store/sessions
- 鉴权：登录（USER）；顾客扫码/输座位号开台
- body：`{ seatNo?, seatToken?, packageId? }`
- 座位已占用时返回 `{ occupied: true, ...会话详情 }`（幂等，不重复开台）
- 成功 `200`：`{ ...会话详情, occupied: false, startAt, packageName, message }`

### POST /api/store/sessions/assist
- 鉴权：STAFF/MANAGER/OWNER；老板/店员帮顾客开台
- body：`{ seatNo?, seatToken?, packageId?, userId? }`

### GET /api/store/sessions/:orderId
- 鉴权：本人（`user_id=0` 的游客桌可被任意登录用户查看）
- 会话详情返回字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| orderId / orderNo | number / string | 订单 ID 与单号（`SS` 开头） |
| seatNo / seatArea / seatToken | string | 座位信息 |
| packageId / packageName / timingType | - | 套餐信息 |
| status | string | `TIMING` 计时中 / `COMPLETED` 待收款 / `SETTLED` 已结账 |
| startAt / endAt / elapsedMinutes | - | 计时信息（正计时，分钟向上取整） |
| packageMinutes / remainMinutes / overtimeMinutes | - | 套餐剩余与超时分钟 |
| timingFee / timingFeeText | number / string | 计时费（超套餐自动补差价） |
| accessoryFee / accessoryFeeText | number / string | 配件费 |
| totalFee / totalFeeText | number / string | 合计 `= 计时费 + 配件费` |
| deposit / settledFee | number | 押金 / 实收 |
| items | array | 账单明细 `{ id, itemType: 'TIMING'/'ACCESSORY', name, quantity, amount, amountText }` |

- 计费规则（`calcTimingFee`，与前端实时估费一致）：
  - 无套餐 / `HOURLY` 按时长套餐：`用时(分钟) / 60 × 小时单价`（默认 10 元/时）；
  - `DURATION` 套餐：套餐内固定套餐价；超时部分 `(用时 - 套餐时长) / 60 × 小时单价` 补差价，返回 `overtimeMinutes`；
  - `ALL_DAY`：固定套餐价，不超时计费。

### POST /api/store/sessions/:orderId/accessories
- 鉴权：本人；body：`{ items: [{ productId, qty }] }`
- 仅 `TIMING`/`COMPLETED` 状态可加购；扣库存；返回合并后的账单明细与最新 `accessoryFee`。

### POST /api/store/sessions/:orderId/end
- 鉴权：本人；结束计时 → `status=COMPLETED`（待收款）、座位置 `PENDING_SETTLE`、按实际用时定格费用。
- 返回会话详情 + `message`。

## 8. 店员登录与收银台

### POST /api/staff/login
- 鉴权：无需登录；body：`{ username, password }`
- 返回：`{ token, staffInfo: { id, username, realName, role, storeId } }`；`role ∈ STAFF/MANAGER/OWNER`。
- 演示账号（seed 自动创建，密码 `demo123456`）：`owner`（王老板）/ `manager`（张店长）/ `staff01`（李店员）。

### GET /api/admin/ops/cashier/orders?status=
- 鉴权：OWNER/MANAGER；`status=PENDING` 待收款（`COMPLETED`）、`status=TIMING` 计时中、不传=全部未结账
- 返回：`{ list: [{ orderId, orderNo, seatId, seatNo, seatArea, status, timingType, startAt, endAt, elapsedMinutes, overtimeMinutes, timingFee, accessoryFee, couponDeduction, totalFee, totalFeeText, createdAt }] }`

### POST /api/admin/ops/cashier/:orderId/pay
- 鉴权：OWNER/MANAGER；body：`{ couponId?, discountAmount?, payMethod?: 'CASH'|'WECHAT' }`
- 流程：券抵扣（`DISCOUNT` 按折扣率、其余按面值，取 min(抵扣, 应收)）→ 手动优惠（与券二选一，未传券时生效）→ 写 `payment_record(STORE_SETTLE, PAID)` → 订单 `SETTLED` → 座位释放 `IDLE` → 券核销日志。
- 返回：`{ orderId, orderNo, totalFee, couponDeduct, discountAmount, deduction, settledFee, settledFeeText, status: 'SETTLED', message }`

### PUT /api/admin/ops/cashier/:orderId/price
- 鉴权：OWNER/MANAGER；body：`{ totalFee }`；已结账订单不可改价。
- 返回：`{ orderId, totalFee, message }`

### GET /api/admin/ops/cashier/coupons?keyword=
- 鉴权：OWNER/MANAGER；可用于收银台的券（`UNUSED` 且未过期）
- 返回：`{ list: [{ id, code, couponType, typeText, value, faceValue, discountRate, expireAt }] }`

### GET /api/admin/ops/cashier/income
- 鉴权：OWNER/MANAGER；收入统计分项
- 返回：

```json
{
  "today":  { "timing": 0, "goods": 0, "custom": 0, "total": 0, "orderCount": 0 },
  "month":  { "timing": 0, "goods": 0, "custom": 0, "total": 0, "orderCount": 0 },
  "total":  { "timing": 0, "goods": 0, "custom": 0, "total": 0, "orderCount": 0 },
  "trend":  [ { "date": "10/3", "amount": 0, "orderCount": 0 } ]
}
```

- 分项口径：`timing` = 到店结账（`biz_type: STORE_SETTLE`）；`goods` = 商城与配件（`MALL` / `ACCESSORY`）；`custom` = 来图定制（`CUSTOM_DEPOSIT` / `CUSTOM_BALANCE`）；`trend` 为近 7 日按支付时间的销售额。

## 9. 统一订单查询（前端订单列表/详情）

### GET /api/orders?status=
- 鉴权：登录（USER）；返回定制（custom）+ 到店（store）+ 商城（mall）三类的合并列表，按创建时间倒序
- `status` 支持逗号分隔的前端状态 token：
  - 进行中：`pending_payment,in_production,quality_checking,shipping` → 定制 `PENDING/ACCEPTED/COLORING/ASSEMBLING/IRONING/QC_*/SHIPPED/DELIVERED` + 到店 `TIMING/COMPLETED`；
  - 已完成：`completed` → 定制 `DONE/CONFIRMED` + 到店 `SETTLED`；
  - 商城订单仅在"全部"（不传/`all`）时返回。
- 列表项统一字段：`{ id, orderNo, type: 'custom'|'store'|'mall', status, statusText, totalPrice, title, image, qty, createdAt }`
- 到店订单 `status` 已映射为前端 token：`TIMING→timing`（计时中）、`COMPLETED→pending_settle`（待收款）、`SETTLED→completed`（已结账）、`CANCELLED→cancelled`。

### GET /api/orders/:id
- 鉴权：本人；支持数字 ID 或单号（`PD/SS/MM` 前缀）；按 custom → store → mall 顺序匹配。
- store 详情在列表字段基础上增加：`items`（账单明细）、`paidAt`、`timeline`；custom/mall 详情含 `address/contact/phone/express/remark` 等定制专属字段。
- 定制订单在 `status=shipping`（`SHIPPED/DELIVERED`）时可调 `POST /api/orders/:id/confirm` 确认收货。

## 10. 前端接入点（V2）
- 到店：扫码/输座位号 → `pages/store/scan-timing`（选套餐开台 → 正计时/剩余时间 → 配件加购 → 结束生成账单）；
- 顾客订单：`pages/order/list`（全部/进行中/已完成，三类订单混排）+ `pages/order/detail`（按 type 分流渲染）；
- 收银台：`pages/owner/cashier`（staff 登录 → 待收款/计时中列表 → 选券或输优惠金额收款 → 改价 → 收入统计看板：今日/本月/累计分项 + 近 7 日趋势）；入口位于"我的"页「收银台」。