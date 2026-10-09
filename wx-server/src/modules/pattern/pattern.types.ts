/** 拼豆图纸引擎 - 类型定义 */

export interface PaletteColor {
  /** 品牌色号，如 A1、B12 */
  code: string;
  /** HEX 色值，如 #FAF4C8 */
  hex: string;
}

export type BeadSize = 2.6 | 5 | 10;
export type PatternStyle = 'CARTOON' | 'REALISTIC';

/** 拼豆板型：小板 52×52、中板 78×78、大板 104×104（4 小板拼接） */
export type BoardType = 'SMALL' | 'MIDDLE' | 'LARGE';

/** 板型 → 每边格数 */
export const BOARD_GRID: Record<BoardType, number> = {
  SMALL: 52,
  MIDDLE: 78,
  LARGE: 104,
};

/** 网格上限：104 大板 + 余量（自定义网格不得超过该上限） */
export const GRID_MAX = 128;

export interface ColorUsage {
  /** 色号（品牌色） */
  code: string;
  /** HEX */
  hex: string;
  /** 该色用量（颗） */
  count: number;
  /** 折算包数（按每包 1000 颗） */
  packs: number;
  /** 占比 0~1 */
  ratio: number;
}

export interface GenerateOptions {
  /** 豆直径 mm：2.6 | 5 | 10，默认 5 */
  beadSize?: number;
  /** 板型：SMALL=52×52，MIDDLE=78×78，LARGE=104×104；不传则走 gridWidth/gridHeight 自定义网格 */
  boardType?: BoardType;
  /** 网格列数（宽度方向颗粒数），默认 32；仅自定义网格（不传 boardType）时生效，范围 8~128 */
  gridWidth?: number;
  /** 网格行数（高度方向颗粒数），默认按原图比例；仅自定义网格（不传 boardType）时生效，范围 8~128 */
  gridHeight?: number;
  /** 最大用色数 8~24，默认 16 */
  maxColors?: number;
  /** 风格，默认 CARTOON */
  style?: PatternStyle;
}

/** 图纸渲染时的背景模式 */
export type BackgroundMode = 'AUTO_TRANSPARENT' | 'ESTIMATE' | 'NONE';
/** 默认：自动检测背景，检测到则背景格透明；无法判定时保留主体色 */
export const DEFAULT_BG_MODE: BackgroundMode = 'AUTO_TRANSPARENT';

export interface PatternResult {
  patternId: string;
  /** 拼豆预览图 URL（相对路径 /uploads/...） */
  patternUrl: string;
  /** 原图 URL（相对路径 /uploads/...） */
  origUrl: string;
  gridWidth: number;
  gridHeight: number;
  totalBeans: number;
  colorCount: number;
  beadSize: number;
  /** 成品尺寸（cm） */
  sizeCm: { w: number; h: number };
  /** 按用量降序的配豆清单 */
  colors: ColorUsage[];
  palette: string;
  /** 网格数据（单元格色号，供前端绘制/订单留档；大图时可能较大） */
  cells?: Array<string | null>;
}

export interface StyleProfile {
  /** 每格采样边长（子采样数） */
  sampleSide: number;
  /** 背景占比阈值：超过则视为空格 */
  backgroundThreshold: number;
  /** 主色占比阈值：达到则直接用主色，否则回退平均色 */
  dominanceThreshold: number;
  /** 候选色目标数量系数 */
  candidateTargetRatio: number;
  /** 候选色合并距离系数 */
  candidateDistanceFactor: number;
  /** 平均色回退开关 */
  useAverageFallback: boolean;
}

export const STYLE_PROFILES: Record<PatternStyle, StyleProfile> = {
  CARTOON: {
    sampleSide: 7,
    backgroundThreshold: 0.72,
    dominanceThreshold: 0.34,
    candidateTargetRatio: 0.58,
    candidateDistanceFactor: 1.35,
    useAverageFallback: true,
  },
  REALISTIC: {
    sampleSide: 5,
    backgroundThreshold: 0.58,
    dominanceThreshold: 0.26,
    candidateTargetRatio: 0.95,
    candidateDistanceFactor: 0.65,
    useAverageFallback: true,
  },
};

/** 豆规格 → 成品宽度计算系数（mm 转 cm） */
export const BEAD_SIZES: BeadSize[] = [2.6, 5, 10];

/** 每包拼豆颗数（配豆统计用），可配 */
export const BEADS_PER_PACK = 1000;