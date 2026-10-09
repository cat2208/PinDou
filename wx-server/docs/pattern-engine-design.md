# 拼豆图纸引擎 设计文档（v1）

> 依据《拼豆手工店小程序开发技术书_v1.3》第 5 章（来图定制：调用图纸服务返回颗数/色数/色号用量，按定价算法实时报价）与 6.1 节（图纸生成服务降级、PC 后台手动录入）。
> 图片来源：开源项目 Jett-Wu/Perler_Beads_Generator（MIT 协议，github.com/Jett-Wu/Perler_Beads_Generator），本地参考副本见 `pbg_ref/`。

## 1. 调研结论

### 1.1 拼豆规格（行业标准）
| 规格 | 颗粒直径 | 定位 | 成品细腻度 |
| --- | --- | --- | --- |
| Mini | 2.6mm | 进阶玩家、高细节、MARD 品牌主流 | 高 |
| **Midi（默认）** | **5mm** | **行业默认标准，本店主流** | 中 |
| Maxi | 10mm | 低龄儿童 | 低 |

- 成品尺寸公式：`成品宽(cm) = 网格列数 × 颗粒直径(mm) / 10`，高同理。
- 单品预估豆量：`total_beans = col × row`；常用标准板为 29×29。

### 1.2 色板
- 借鉴开源项目已验证的 **MARD 291 色**（基础 225 色 + 扩展 66 色）数据，`pbg_ref/src/palette.ts` 已完整提取（色号 + HEX）。
- 色板做成后端 JSON 配置（`src/modules/pattern/palettes/`），首期内置 MARD 291；后续可加 Perler/Hama/Artkal 或国产明创色板，不改代码、只换数据。
- 颜色距离采用**加权 RGB（redMean）公式**（开源验证观感良好，计算成本低于 CIEDE2000，适合服务端批量处理）：
  `d = sqrt((2+r̄/256)·ΔR² + 4·ΔG² + (2+(255-r̄)/256)·ΔB²)`，r̄=(R₁+R₂)/2

### 1.3 转换流程（取精华）
1. **解码缩放**：sharp 解码图片 → 按目标网格尺寸等比缩放（网格 16~100 列，H 保持原图比例）。
2. **背景估计**：取图像四边边缘像素做 16 级量化桶直方图，出现最多的桶均值作为背景色；alpha<24 视为透明。
3. **网格区域采样**：每个网格单元内不取单像素，而是按 `sampleSide×sampleSide` 子区域采样，保留平均色与主色。
4. **候选色选择**：按像素出现数排序，限制 `maxColors`（默认 16，用户可选 8~24）；优先保留高彩度/深色特征色，再按多样性补足；与已选色距离小于阈值则拒绝（避免同色系冗余）。
5. **单格选色**：主色占比 ≥ dominanceThreshold 用主色，否则用单元平均色匹配最近色板色（`useAverageFallback`）。
6. **降噪三件套（去糟粕）**：
   - `reduceSpeckles`：邻域多数色替换孤立散点（按强度 0~4 迭代）；
   - `reduceTinyRegions`：连通域分析，合并小于阈值的小色块到相邻相似色；
   - `mergeSimilarColors`：用量占比极小的稀有色并入视觉相似色，控制色数不超限。
7. **用量统计**：按色号累计颗数，按 `beadsPerPack`（默认 1000 颗/包）折算配豆包数。

### 1.4 两档风格参数（沿用开源调校值）
| 参数 | cartoon（默认） | realistic |
| --- | --- | --- |
| sampleSide | 7 | 5 |
| backgroundThreshold | 0.72 | 0.58 |
| dominanceThreshold | 0.34 | 0.26 |
| candidateTargetRatio | 0.58 | 0.95 |
| candidateDistanceFactor | 1.35 | 0.65 |

## 2. 本店适配（取其精华去其糟粕）

| 开源项目做法 | 本店适配 |
| --- | --- |
| 纯浏览器端处理（canvas） | 后端 NestJS + sharp，小程序端零负担，一次生成全员复用 |
| 仅支持 MARD 2.6mm 色号 | 通用色板 JSON + 豆规格可选（2.6/5/10mm），默认 5mm Midi |
| 生成图纸后自行导出 | 服务端直接渲染 **拼豆预览图 PNG**（每格一色块，供小程序展示） |
| 无价格联动 | 与 `custom/quote` 联动：按 total_beans × 豆单价 + 人工/工艺费实时报价 |
| 无降级路径 | 图纸服务异常时技术书 6.1 约定：不阻断下单，PC 后台手动录入图纸参数 |

## 3. 接口契约

### POST /api/pattern/generate（公开，登录即可）
请求（multipart，字段 file 为图片）：
```
{ "beadSize": 5,        // 豆直径 mm：2.6 | 5 | 10，默认 5
  "gridWidth": 0,       // 网格列数，0=按尺寸自动（默认 32）
  "maxColors": 16,      // 8~24，默认 16
  "style": "CARTOON" }  // CARTOON | REALISTIC
```
响应：
```
{ code: 0, data: {
  patternId: "p_xxx",
  patternUrl: "/uploads/pattern/xxx.png",   // 拼豆预览图
  origUrl: "/uploads/pattern/xxx_orig.jpg", // 原图
  gridWidth: 32, gridHeight: 40,
  totalBeans: 1280, colorCount: 14, beadSize: 5,
  sizeCm: { w: 16, h: 20 },
  colors: [ { code:"A01", hex:"#FAF4C8", count:120, packs:1, ratio:0.094 } ],  // 按 count 降序
  palette: "mard-291",
  manualAvailable: false }
}
```
- patternUrl 由前端 `request.js normalizeImg` 自动补全域名。
- 图片落盘 `uploads/pattern/{哈希}.png`，生成结果同时缓存 `uploads/pattern/{哈希}.json`（同一图重复生成直接复用，避免重复算）。

### POST /api/custom/orders（扩展，沿用现有）
新增可选字段：`patternUrl / colorCount / totalBeans / colorsJson / style / beadSize`；保存进 `custom_order.pattern_url / colors_json 等`（表结构已预留）。

### POST /api/admin/custom-order/:id/pattern-manual（PC 后台降级录入，技术书 6.1）
```
{ "width":32,"height":40,"total_beans":1280,"color_count":14,"colors_json":[...],"difficulty":"NORMAL" }
```
写入 audit_log（action=PATTERN_MANUAL_INPUT，记录前后快照）。

## 4. 豆价联动（quote）
- `unitPrice = ceil(totalBeans × 豆单价) + 人工基价(按网格面积) + 工艺费(style 加成)`，五入到元；
- 豆单价/基价从 `pricing_config`（后台可配）读取，缺少时用默认（豆 0.012 元/颗、基价 25 元）。
- 报价接口 `POST /api/custom/quote` 增加可选 `patternId`：携带时按图纸精确报价；不带时维持现尺寸阶梯报价。