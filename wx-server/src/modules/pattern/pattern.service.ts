import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import sharp from 'sharp';
import { createHash } from 'crypto';
import {
  GenerateOptions,
  PatternResult,
  PatternStyle,
  STYLE_PROFILES,
  BEADS_PER_PACK,
  ColorUsage,
  BoardType,
  BOARD_GRID,
  GRID_MAX,
  BackgroundMode,
  DEFAULT_BG_MODE,
} from './pattern.types';
import { getPalette, nearestPaletteColor, colorDistance, hexToRgb, luminance, colorChroma, PaletteEntry, PALETTES } from './palettes';

/** 预览图每格像素（渲染用）：24px 保证圆角珠粒细节可见 */
const PX_PER_CELL = 24;
/** 图像解码上限（防内存溢出） */
const MAX_SOURCE_PIXELS = 1600 * 1600;
/** 背景容忍度（与边缘估计背景的 RGB 距离阈值） */
const BG_TOLERANCE = 24;

interface CellSample {
  /** 格子内子采样 RGB */
  samples: Array<[number, number, number]>;
  /** 格子内非背景样本平均色 */
  average: [number, number, number];
  /** 背景占比 0~1 */
  backgroundShare: number;
}

@Injectable()
export class PatternService {
  private readonly logger = new Logger(PatternService.name);
  private readonly outDir = join(process.cwd(), 'uploads', 'pattern');

  constructor() {
    if (!existsSync(this.outDir)) mkdirSync(this.outDir, { recursive: true });
  }

  /** 图片文件 → 拼豆图纸（生成预览图 + 配豆清单 + 元数据缓存） */
  async generateFromFile(file: Express.Multer.File, opts: GenerateOptions = {}): Promise<PatternResult> {
    const beadSize = this.clampBeadSize(opts.beadSize ?? 5);
    const style: PatternStyle = opts.style === 'REALISTIC' ? 'REALISTIC' : 'CARTOON';
    const maxColors = Math.max(8, Math.min(24, Math.round(opts.maxColors ?? 16)));
    const prop = STYLE_PROFILES[style];
    const palette = getPalette();

    const image = sharp(file.buffer);
    const meta = await image.metadata();
    if (!meta.width || !meta.height) throw new Error('无法读取图片信息');
    // 等比限制解码尺寸
    const scale = Math.min(1, Math.sqrt(MAX_SOURCE_PIXELS / (meta.width * meta.height)));
    const dw = Math.max(1, Math.round(meta.width * scale));
    const dh = Math.max(1, Math.round(meta.height * scale));
    const { data, info } = await image
      .resize(dw, dh, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    if (w <= 0 || h <= 0) throw new Error('图片解码失败');

    // 网格尺寸：传板型时按板型正方形网格（52/78/104）；不传板型时按自定义 gridWidth + gridHeight/比例（可向下兼容任意不大于 GRID_MAX 的尺寸）
    const board: BoardType | null =
      opts.boardType === 'SMALL' || opts.boardType === 'MIDDLE' || opts.boardType === 'LARGE' ? opts.boardType : null;
    let gridWidth: number;
    let gridHeight: number;
    if (board) {
      const side = BOARD_GRID[board];
      gridWidth = side;
      gridHeight = side;
    } else {
      const wantW = Math.max(8, Math.min(GRID_MAX, Math.round(opts.gridWidth ?? 32)));
      gridWidth = Math.max(8, Math.min(wantW, w));
      const wantH = opts.gridHeight ? Math.max(8, Math.min(GRID_MAX, Math.round(opts.gridHeight))) : 0;
      gridHeight = wantH
        ? Math.max(8, Math.min(wantH, h))
        : Math.max(8, Math.min(GRID_MAX, Math.round((gridWidth * h) / w)));
    }
    const totalBeans = gridWidth * gridHeight;

    // 1. 背景估计（边缘像素量化桶）
    const bg = this.estimateBackground(data, w, h);
    // 2. 网格区域采样
    const cells = this.sampleCells(data, w, h, gridWidth, gridHeight, prop.sampleSide, bg, palette);
    // 3. 候选色选择（限色）
    const candidates = this.selectCandidateColors(cells, palette, maxColors, prop);
    // 4. 单格选色（主色 / 平均色回退）
    let grid = this.assignCellColors(cells, candidates, prop);
    // 5. 降噪三件套
    grid = this.reduceSpeckles(grid, gridWidth, gridHeight, palette, 1);
    grid = this.reduceTinyRegions(grid, gridWidth, gridHeight, palette, 2);
    grid = this.mergeSimilarColors(grid, palette, 2);

    // 6. 用量统计
    const usage = this.summarizeUsage(grid, palette, totalBeans);

    // 7. 渲染预览图
    const patternId = this.patternId(file.buffer, gridWidth, gridHeight, beadSize, maxColors, style);
    const patternFile = `${patternId}.png`;
    const patternPath = join(this.outDir, patternFile);
    await this.renderPreview(grid, gridWidth, gridHeight, patternPath);

    // 8. 原图留档 + 元数据缓存
    const origId = createHash('md5').update(file.buffer).digest('hex').slice(0, 16);
    const origFile = `${origId}-${Date.now()}.jpg`;
    const origPath = join(this.outDir, origFile);
    await sharp(file.buffer).resize(600, 600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(origPath);

    const result: PatternResult = {
      patternId,
      patternUrl: `/uploads/pattern/${patternFile}`,
      origUrl: `/uploads/pattern/${origFile}`,
      gridWidth,
      gridHeight,
      totalBeans,
      colorCount: usage.length,
      beadSize,
      sizeCm: {
        w: +((gridWidth * beadSize) / 10).toFixed(1),
        h: +((gridHeight * beadSize) / 10).toFixed(1),
      },
      colors: usage,
      palette: palette.id,
      cells: grid,
    };
    this.cacheResult(patternId, result);
    return result;
  }

  /** 可用色板列表 */
  listPalettes() {
    return PALETTES.map((p) => ({ id: p.id, label: p.label, size: p.colors.length }));
  }

  /** 按 patternId 读取已缓存的生成结果 */
  readCached(patternId: string): PatternResult | null {
    try {
      const raw = readFileSync(join(this.outDir, `${patternId}.json`), 'utf8');
      const parsed = JSON.parse(raw);
      return parsed as PatternResult;
    } catch {
      return null;
    }
  }

  // ---------- 私有工具 ----------

  private clampBeadSize(v: number): 2.6 | 5 | 10 {
    if (v === 2.6 || v === 10) return v;
    return 5;
  }

  private patternId(buffer: Buffer, w: number, h: number, bead: number, colors: number, style: PatternStyle): string {
    const hash = createHash('md5').update(buffer).digest('hex').slice(0, 12);
    return `p_${hash}_${w}x${h}_${bead}_${colors}_${style.toLowerCase()}`;
  }

  private cacheResult(id: string, result: PatternResult) {
    try {
      const { cells, ...meta } = result;
      writeFileSync(join(this.outDir, `${id}.json`), JSON.stringify({ ...meta, cellsStored: cells ? cells.length : 0 }), 'utf8');
    } catch (e) {
      this.logger.warn(`cache result failed: ${e}`);
    }
  }

  /** 边缘像素量化桶估背景色（众数） */
  private edgeModeColor(data: Buffer, w: number, h: number): [number, number, number] {
    const samples: Array<[number, number, number]> = [];
    const stepX = Math.max(1, Math.floor(w / 80));
    const stepY = Math.max(1, Math.floor(h / 80));
    const push = (x: number, y: number) => {
      const i = (y * w + x) * 4;
      if (data[i + 3] >= 24) samples.push([data[i], data[i + 1], data[i + 2]]);
    };
    for (let x = 0; x < w; x += stepX) {
      push(x, 0);
      if (h > 1) push(x, h - 1);
    }
    for (let y = 0; y < h; y += stepY) {
      push(0, y);
      if (w > 1) push(w - 1, y);
    }
    if (samples.length === 0) return [255, 255, 255];
    const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
    for (const [r, g, b] of samples) {
      const key = `${Math.round(r / 16) * 16},${Math.round(g / 16) * 16},${Math.round(b / 16) * 16}`;
      const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count += 1;
      buckets.set(key, bucket);
    }
    const best = [...buckets.values()].sort((a, b) => b.count - a.count)[0];
    return [Math.round(best.r / best.count), Math.round(best.g / best.count), Math.round(best.b / best.count)];
  }

  /**
   * 统一背景判定：背景色须同时满足「边缘众数色」与「四角平均色接近」。
   * 四角颜色差异大（无统一背景、全幅内容图）时返回 null，表示不剔除任何颜色；
   * 四角含透明像素时也返回 null（透明区域由 alpha 通道单独剔除）。
   */
  private estimateBackground(data: Buffer, w: number, h: number): [number, number, number] | null {
    const k = Math.max(2, Math.min(8, Math.floor(Math.min(w, h) / 8)));
    const cornerAvg = (cx: number, cy: number): [number, number, number] | null => {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = 0; dy < k; dy += 1) {
        for (let dx = 0; dx < k; dx += 1) {
          const x = Math.min(w - 1, cx + dx);
          const y = Math.min(h - 1, cy + dy);
          const i = (y * w + x) * 4;
          if (data[i + 3] >= 24) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            n += 1;
          }
        }
      }
      return n === 0 ? null : [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
    };
    const corners = [
      cornerAvg(0, 0),
      cornerAvg(Math.max(0, w - k), 0),
      cornerAvg(0, Math.max(0, h - k)),
      cornerAvg(Math.max(0, w - k), Math.max(0, h - k)),
    ];
    if (corners.some((c) => c === null)) return null;
    const avg: [number, number, number] = [
      Math.round(corners.reduce((s, c) => s + c![0], 0) / 4),
      Math.round(corners.reduce((s, c) => s + c![1], 0) / 4),
      Math.round(corners.reduce((s, c) => s + c![2], 0) / 4),
    ];
    const edge = this.edgeModeColor(data, w, h);
    return colorDistance(edge, avg) <= 64 ? avg : null;
  }

  /** 网格区域采样：每格 sampleSide×sampleSide 子采样，统计背景占比与平均色 */
  private sampleCells(
    data: Buffer,
    w: number,
    h: number,
    gridWidth: number,
    gridHeight: number,
    sampleSide: number,
    bg: [number, number, number] | null,
    palette: PaletteEntry,
  ): Array<{ samples: Array<[number, number, number]>; average: [number, number, number]; backgroundShare: number }> {
    const side = Math.max(2, Math.min(sampleSide, Math.floor(Math.min(w / gridWidth, h / gridHeight))));
    const cells: CellSample[] = [];
    for (let gy = 0; gy < gridHeight; gy += 1) {
      for (let gx = 0; gx < gridWidth; gx += 1) {
        const x0 = Math.floor((gx * w) / gridWidth);
        const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * w) / gridWidth));
        const y0 = Math.floor((gy * h) / gridHeight);
        const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * h) / gridHeight));
        const samples: Array<[number, number, number]> = [];
        let bgCount = 0;
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        for (let s = 0; s < side; s += 1) {
          const px = x0 + Math.floor(((x1 - x0) * (s + 0.5)) / side);
          for (let t = 0; t < side; t += 1) {
            const py = y0 + Math.floor(((y1 - y0) * (t + 0.5)) / side);
            const i = (py * w + px) * 4;
            const alpha = data[i + 3];
            if (alpha < 24) {
              bgCount += 1;
              continue;
            }
            const rgb: [number, number, number] = [data[i], data[i + 1], data[i + 2]];
            if (bg !== null && colorDistance(rgb, bg) <= BG_TOLERANCE) {
              bgCount += 1;
              continue;
            }
            samples.push(rgb);
            rSum += rgb[0];
            gSum += rgb[1];
            bSum += rgb[2];
          }
        }
        const total = side * side;
        const average: [number, number, number] =
          samples.length > 0
            ? [
                Math.round(rSum / samples.length),
                Math.round(gSum / samples.length),
                Math.round(bSum / samples.length),
              ]
            : bg;
        cells.push({ samples, average, backgroundShare: bgCount / total });
      }
    }
    return cells;
  }

  /**
   * 候选色选择：基于所有采样样本的全色板匹配统计 → 限色。
   * 保底高频色 + 特征色（高彩/深色）保护 + 多样性去重。
   */
  private selectCandidateColors(
    cells: CellSample[],
    palette: PaletteEntry,
    maxColors: number,
    prop: { candidateTargetRatio: number; candidateDistanceFactor: number },
  ): PaletteEntry['colors'] {
    const counts = new Map<string, number>();
    for (const cell of cells) {
      if (cell.samples.length === 0) continue;
      const bucket = new Map<string, number>();
      for (const rgb of cell.samples) {
        const color = nearestPaletteColor(rgb, palette.colors);
        bucket.set(color.code, (bucket.get(color.code) ?? 0) + 1);
      }
      for (const [code, n] of bucket) counts.set(code, (counts.get(code) ?? 0) + n);
    }
    const ranked = [...counts.entries()]
      .map(([code, count]) => ({
        color: palette.colors.find((c) => c.code === code)!,
        count,
        chroma: colorChroma(hexToRgb(palette.colors.find((c) => c.code === code)!.hex)),
        light: luminance(hexToRgb(palette.colors.find((c) => c.code === code)!.hex)),
      }))
      .filter((x) => x.color)
      .sort((a, b) => b.count - a.count);
    if (ranked.length === 0 || maxColors <= 0) return palette.colors.slice(0, Math.max(1, maxColors));

    const selected: Array<{ code: string }> = [];
    const selectedCodes = new Set<string>();
    const threshold = (first: number, level: number) => (first + level * 7) * prop.candidateDistanceFactor;

    // 1) 保底：高频前 28%
    const keepCount = Math.max(1, Math.ceil(maxColors * 0.28));
    for (const item of ranked.slice(0, keepCount)) {
      selectedCodes.add(item.color.code);
      selected.push({ code: item.color.code });
    }
    // 2) 特征色（高彩度或深色）保护，评估与已选色的距离
    const isFeature = (item: typeof ranked[0]) => item.chroma > 48 || item.light < 45;
    const featureSlots = Math.max(2, Math.ceil(maxColors * 0.22));
    const featureAdded = new Set<string>();
    for (const item of ranked) {
      if (selectedCodes.has(item.color.code) || featureAdded.has(item.color.code)) continue;
      if (!isFeature(item)) continue;
      const nearest = Math.min(
        ...selected.map((s) => colorDistance(hexToRgb(this.codeHex(palette, s.code)), hexToRgb(item.color.hex))),
      );
      if (nearest > threshold(18, featureAdded.size)) {
        selectedCodes.add(item.color.code);
        selected.push({ code: item.color.code });
        featureAdded.add(item.color.code);
      }
      if (selected.length >= maxColors || featureAdded.size >= featureSlots) break;
    }
    // 3) 多样性补足至目标量
    const target = Math.ceil(maxColors * prop.candidateTargetRatio);
    for (let guard = 0; guard < ranked.length && selected.length < Math.min(maxColors, Math.max(target, keepCount + 1)); guard += 1) {
      const item = ranked[guard];
      if (selectedCodes.has(item.color.code)) continue;
      const nearest = Math.min(...selected.map((s) => colorDistance(hexToRgb(this.codeHex(palette, s.code)), hexToRgb(item.color.hex))));
      if (nearest > threshold(18, selected.length)) {
        selectedCodes.add(item.color.code);
        selected.push({ code: item.color.code });
      }
    }
    // 4) 兜底：直接按频率取满
    for (const item of ranked) {
      if (selected.length >= maxColors) break;
      if (!selectedCodes.has(item.color.code)) {
        selectedCodes.add(item.color.code);
        selected.push({ code: item.color.code });
      }
    }
    return selected.map((s) => palette.colors.find((c) => c.code === s.code)!).filter(Boolean);
  }

  private codeHex(palette: PaletteEntry, code: string): string {
    return palette.colors.find((c) => c.code === code)?.hex ?? '#000000';
  }

  /** 单格选色：主色占比达标用主色，否则平均色回退 */
  private assignCellColors(
    cells: CellSample[],
    candidates: PaletteEntry['colors'],
    prop: { dominanceThreshold: number; useAverageFallback: boolean },
  ): Array<string | null> {
    return cells.map((cell) => {
      if (cell.backgroundShare >= 0.72 || cell.samples.length === 0) return null;
      const bucket = new Map<string, number>();
      for (const rgb of cell.samples) {
        const color = nearestPaletteColor(rgb, candidates);
        bucket.set(color.code, (bucket.get(color.code) ?? 0) + 1);
      }
      const ranked = [...bucket.entries()].sort((a, b) => b[1] - a[1]);
      const [primaryCode, primaryCount] = ranked[0];
      const share = primaryCount / cell.samples.length;
      if (share >= prop.dominanceThreshold || !prop.useAverageFallback) return primaryCode;
      return nearestPaletteColor(cell.average, candidates).code;
    });
  }

  /** 减散点：邻域多数色替换孤立点 */
  private reduceSpeckles(grid: Array<string | null>, w: number, h: number, palette: PaletteEntry, iterations: number): Array<string | null> {
    if (iterations <= 0) return grid;
    const similar = (a: string, b: string) => a === b || colorDistance(hexToRgb(a === null ? '#fff' : this.codeHex(palette, a)), hexToRgb(b === null ? '#fff' : this.codeHex(palette, b))) <= 52;
    let cur = grid.slice();
    for (let pass = 0; pass < iterations; pass += 1) {
      const next = cur.slice();
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const idx = y * w + x;
          const c = cur[idx];
          if (!c) continue;
          const nearby: string[] = [];
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const v = cur[ny * w + nx];
              if (v) nearby.push(v);
            }
          }
          const majority = this.majorityOf(nearby);
          if (!majority) continue;
          const sameCount = nearby.filter((v) => v === c).length;
          if (sameCount <= 1 && majority !== c && similar(c, majority)) {
            next[idx] = majority;
          }
        }
      }
      cur = next;
    }
    return cur;
  }

  /** 小区域合并：连通域小于阈值则并到相邻最多色 */
  private reduceTinyRegions(grid: Array<string | null>, w: number, h: number, palette: PaletteEntry, maxRegionSize: number): Array<string | null> {
    if (maxRegionSize <= 0) return grid;
    const next = grid.slice();
    const visited = new Uint8Array(grid.length);
    const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const similar = (a: string, b: string) => a === b || colorDistance(hexToRgb(this.codeHex(palette, a)), hexToRgb(this.codeHex(palette, b))) <= 62;
    for (let start = 0; start < grid.length; start += 1) {
      const c = grid[start];
      if (!c || visited[start]) continue;
      const region: number[] = [];
      const border = new Map<string, number>();
      const queue = [start];
      visited[start] = 1;
      for (let qi = 0; qi < queue.length; qi += 1) {
        const idx = queue[qi];
        region.push(idx);
        const x = idx % w;
        const y = Math.floor(idx / w);
        for (const [dx, dy] of offsets) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          const nc = grid[ni];
          if (nc === c && !visited[ni]) {
            visited[ni] = 1;
            queue.push(ni);
          } else if (nc && nc !== c) {
            border.set(nc, (border.get(nc) ?? 0) + 1);
          }
        }
      }
      if (region.length > maxRegionSize || border.size === 0) continue;
      const replacement = [...border.entries()]
        .sort((a, b) => b[1] - a[1])
        .find(([nc]) => similar(c, nc))?.[0];
      if (!replacement) continue;
      for (const idx of region) next[idx] = replacement;
    }
    return next;
  }

  /** 低频相似色合并：总量占比极小且颜色相近的并入高频色 */
  private mergeSimilarColors(grid: Array<string | null>, palette: PaletteEntry, level: number): Array<string | null> {
    if (level <= 0) return grid;
    const counts = new Map<string, number>();
    for (const c of grid) {
      if (!c) continue;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const rows = [...counts.entries()]
      .map(([code, count]) => ({ code, count, color: palette.colors.find((p) => p.code === code) }))
      .filter((x) => x.color)
      .sort((a, b) => b.count - a.count);
    if (rows.length === 0) return grid;
    const total = grid.length;
    const threshold = (level: number) => level <= 1 ? 40 : level === 2 ? 58 : 74;
    const th = threshold(level);
    const replacements = new Map<string, string>();
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const rare = row.count <= Math.max(3, total * (0.006 + level * 0.003));
      const target = rows.slice(0, i).find((prev) =>
        colorDistance(hexToRgb(row.color!.hex), hexToRgb(prev.color!.hex)) <= (rare ? th * 1.45 : th),
      );
      if (target) replacements.set(row.code, replacements.get(target.code) ?? target.code);
    }
    if (replacements.size === 0) return grid;
    return grid.map((c) => (c ? replacements.get(c) ?? c : null));
  }

  private majorityOf(list: string[]): string | null {
    if (list.length === 0) return null;
    const counts = new Map<string, number>();
    for (const v of list) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  /** 配豆用量统计 */
  private summarizeUsage(grid: Array<string | null>, palette: PaletteEntry, totalBeans: number): ColorUsage[] {
    const counts = new Map<string, number>();
    for (const c of grid) {
      if (!c) continue;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([code, count]) => ({
        code,
        hex: palette.colors.find((p) => p.code === code)?.hex ?? '#000000',
        count,
        packs: Math.max(1, Math.ceil(count / BEADS_PER_PACK)),
        ratio: +(count / totalBeans).toFixed(4),
      }))
      .sort((a, b) => b.count - a.count);
  }

  /** 渲染拼豆预览图：每格一颗圆角珠粒（含高光/内阴影/珠间间隙），背景格与间隙全透明，只有珠粒本体不透明 */
  private async renderPreview(grid: Array<string | null>, w: number, h: number, outPath: string): Promise<void> {
    const cell = PX_PER_CELL;          // 24
    const gap = 2;                      // 珠间间隙（珠粒实际直径 = cell - gap = 22）
    const beadR = (cell - gap) / 2;     // 珠半径 11
    const sw = w * cell;
    const sh = h * cell;
    const buffer = Buffer.alloc(sw * sh * 4);

    const fill = (px: number, py: number, r: number, g: number, b: number, a: number) => {
      const idx = (py * sw + px) * 4;
      buffer[idx] = r;
      buffer[idx + 1] = g;
      buffer[idx + 2] = b;
      buffer[idx + 3] = a;
    };

    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const code = grid[y * w + x];
        const baseRgb = code ? hexToRgb(this.codeHex(getPalette(), code)) : [255, 255, 255];
        const ox = x * cell;
        const oy = y * cell;
        const cx = cell / 2;   // 珠粒圆心使用格内局部坐标
        const cy = cell / 2;

        for (let py = 0; py < cell; py += 1) {
          for (let px = 0; px < cell; px += 1) {
            const dx = px + 0.5 - cx;
            const dy = py + 0.5 - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (!code) {
              // 背景格：全透明
              fill(ox + px, oy + py, 0, 0, 0, 0);
              continue;
            }

            if (dist > beadR) {
              // 珠间间隙：透明（模拟拼豆板孔洞露底），背景透明时也不遮挡
              fill(ox + px, oy + py, 0, 0, 0, 0);
              continue;
            }

            // 基础塑料色
            let rr = baseRgb[0];
            let gg = baseRgb[1];
            let bb = baseRgb[2];

            // 高光：左上 30% 区域提亮（模拟塑料反光）
            const hlFactor = Math.max(0, 1 - (dx * dx + dy * dy) / (beadR * beadR * 0.25));
            if (dx < 0 && dy < 0) {
              const hl = hlFactor * 0.30;
              rr = Math.min(255, Math.round(rr + (255 - rr) * hl));
              gg = Math.min(255, Math.round(gg + (255 - gg) * hl));
              bb = Math.min(255, Math.round(bb + (255 - bb) * hl));
            }

            // 内阴影：右下 40% 区域压暗（模拟珠体曲面凹陷）
            const shFactor = Math.max(0, (dx + beadR * 0.3) / (beadR * 1.3)) *
                             Math.max(0, (dy + beadR * 0.3) / (beadR * 1.3));
            if (dx > 0 || dy > 0) {
              const sd = shFactor * 0.22;
              rr = Math.max(0, Math.round(rr * (1 - sd)));
              gg = Math.max(0, Math.round(gg * (1 - sd)));
              bb = Math.max(0, Math.round(bb * (1 - sd)));
            }

            // 边缘抗锯齿：向透明渐变
            const edge = beadR - dist;
            if (edge < 1.5) {
              const alpha = Math.min(255, Math.round((edge / 1.5) * 255));
              fill(ox + px, oy + py, rr, gg, bb, alpha);
            } else {
              fill(ox + px, oy + py, rr, gg, bb, 255);
            }
          }
        }
      }
    }

    await sharp(buffer, { raw: { width: sw, height: sh, channels: 4 } })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
  }
}