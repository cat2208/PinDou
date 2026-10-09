import { PaletteColor } from '../pattern.types';
import { MARD_291_COLORS, PALETTE_ID } from './mard-291';
import { MARD_221_COLORS, PALETTE_ID_221 } from './mard-221';

export interface PaletteEntry {
  id: string;
  label: string;
  colors: PaletteColor[];
}

/** 内置色板注册表：默认 MARD 221 色（精简版，剔除冗余近似色） */
export const PALETTES: PaletteEntry[] = [
  { id: PALETTE_ID_221, label: 'MARD 221色', colors: MARD_221_COLORS },
  { id: PALETTE_ID, label: 'MARD 291色（完整版）', colors: MARD_291_COLORS },
];

export function getPalette(id?: string): PaletteEntry {
  const found = id ? PALETTES.find((p) => p.id === id) : undefined;
  return found ?? PALETTES[0];
}

/** 加权 RGB 色距（redMean），观感优于欧氏距离且计算快 */
export function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  const redMean = (a[0] + b[0]) / 2;
  const r = a[0] - b[0];
  const g = a[1] - b[1];
  const blue = a[2] - b[2];
  return Math.sqrt(
    (2 + redMean / 256) * r * r + 4 * g * g + (2 + (255 - redMean) / 256) * blue * blue,
  );
}

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** 最近色板色 */
export function nearestPaletteColor(
  rgb: [number, number, number],
  candidates: PaletteColor[],
): PaletteColor {
  let best = candidates[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const color of candidates) {
    const d = colorDistance(rgb, hexToRgb(color.hex));
    if (d < bestDistance) {
      best = color;
      bestDistance = d;
    }
  }
  return best;
}

export function luminance(rgb: [number, number, number]): number {
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
}

export function colorChroma(rgb: [number, number, number]): number {
  return Math.max(...rgb) - Math.min(...rgb);
}