// src/utils/storage.ts
const STORAGE_KEYS = {
  readerFontSize: "reader.fontSize",
} as const;

export const DEFAULT_FONT_SIZE = 14;
export const MIN_FONT_SIZE = 10;
export const MAX_FONT_SIZE = 24;

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function safeGetItem(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function getReaderFontSize(): number {
  const raw = safeGetItem(STORAGE_KEYS.readerFontSize);
  if (!raw) return DEFAULT_FONT_SIZE;
  const n = Number(raw);
  if (Number.isNaN(n)) return DEFAULT_FONT_SIZE;
  return clamp(n, MIN_FONT_SIZE, MAX_FONT_SIZE);
}

export function setReaderFontSize(px: number): void {
  const v = clamp(px, MIN_FONT_SIZE, MAX_FONT_SIZE);
  safeSetItem(STORAGE_KEYS.readerFontSize, String(v));
}
