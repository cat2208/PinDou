/** 公共工具：订单号、时间格式化、金额换算 */

export function genNo(prefix: string, date = new Date()): string {
  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  const d = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}${d}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}${rand}`;
}

export function fmtTime(d: Date | string | null | undefined): string {
  if (!d) return '';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

export function yuan2fen(amount: string | number): number {
  return Math.round(Number(amount) * 100);
}

export function fen2yuan(fen: number): number {
  return Math.round(fen) / 100;
}

export function dayAdd(days: number, from = new Date()): Date {
  const t = new Date(from);
  t.setDate(t.getDate() + days);
  return t;
}

export function hourMinute(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}