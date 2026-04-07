const STORAGE_KEYS = {
  readerFontSize: "reader.fontSize",
  readerBgColor: "reader.bgColor",
  readerTextColor: "reader.textColor",
  isPasscodeEnabled: "isPasscodeEnabled",
  isBiometricEnabled: "isBiometricEnabled",
  passcode: "appPasscode",
  lockTabSwipe: "lockTabSwipe",
} as const;

export const DEFAULT_FONT_SIZE = 14;
export const MIN_FONT_SIZE = 10;
export const MAX_FONT_SIZE = 24;
export const DEFAULT_BG_COLOR = "#000000"; // 黑底
export const DEFAULT_TEXT_COLOR = "#ffffff"; // 白字

// 輔助函式：限制數值範圍
export const clamp = (n: number, lo: number, hi: number): number => {
  return Math.max(lo, Math.min(hi, n));
};

// 內部使用的安全操作封裝
const safeGetItem = (key: string): string | null => {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetItem = (key: string, value: string): void => {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
};

const safeRemoveItem = (key: string): void => {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

// --- 閱讀器設定相關 ---

export const getReaderFontSize = (): number => {
  const raw = safeGetItem(STORAGE_KEYS.readerFontSize);
  if (!raw) return DEFAULT_FONT_SIZE;
  const n = Number(raw);
  if (Number.isNaN(n)) return DEFAULT_FONT_SIZE;
  return clamp(n, MIN_FONT_SIZE, MAX_FONT_SIZE);
};

export const setReaderFontSize = (px: number): void => {
  const v = clamp(px, MIN_FONT_SIZE, MAX_FONT_SIZE);
  safeSetItem(STORAGE_KEYS.readerFontSize, String(v));
};

export const getReaderBgColor = (): string => {
  const raw = safeGetItem(STORAGE_KEYS.readerBgColor);
  return raw || DEFAULT_BG_COLOR;
};

export const setReaderBgColor = (color: string): void => {
  safeSetItem(STORAGE_KEYS.readerBgColor, color);
};

export const getReaderTextColor = (): string => {
  const raw = safeGetItem(STORAGE_KEYS.readerTextColor);
  return raw || DEFAULT_TEXT_COLOR;
};

export const setReaderTextColor = (color: string): void => {
  safeSetItem(STORAGE_KEYS.readerTextColor, color);
};

// --- 密碼保護相關 ---

/** 檢查是否啟用了密碼保護 */
export const getPasscodeEnabled = (): boolean => {
  return safeGetItem(STORAGE_KEYS.isPasscodeEnabled) === "true";
};

/** 設定密碼保護開關 */
export const setPasscodeEnabled = (enabled: boolean): void => {
  safeSetItem(STORAGE_KEYS.isPasscodeEnabled, String(enabled));
};

/** 獲取儲存的密碼 */
export const getAppPasscode = (): string | null => {
  return safeGetItem(STORAGE_KEYS.passcode);
};

/** 設定/更新密碼 */
export const setAppPasscode = (code: string) => {
  safeSetItem(STORAGE_KEYS.passcode, code);
};
export const removePasscode = () => {
  safeRemoveItem(STORAGE_KEYS.passcode);
};
export const getWebAuthnId = (): string | null => {
  return safeGetItem("app_webauthn_id");
};
export const setWebAuthnId = (id: string | null) => {
  if (id) {
    safeSetItem("app_webauthn_id", id);
  } else {
    safeRemoveItem("app_webauthn_id");
  }
};
export const getBiometricEnabled = (): boolean => {
  return safeGetItem(STORAGE_KEYS.isBiometricEnabled) === "true";
};

/** 設定密碼保護開關 */
export const setBiometricEnabled = (enabled: boolean): void => {
  safeSetItem(STORAGE_KEYS.isBiometricEnabled, String(enabled));
};

/** 驗證輸入的密碼是否正確 */
export const verifyPasscode = (input: string): boolean => {
  const saved = getAppPasscode();
  return saved !== null && saved === input;
};

// --- 書庫設定相關 ---

/** 獲取是否鎖定書庫 Tab 滑動 */
export const getTabSwipeLocked = (): boolean => {
  return safeGetItem(STORAGE_KEYS.lockTabSwipe) === "true";
};

/** 設定是否鎖定書庫 Tab 滑動 */
export const setTabSwipeLocked = (locked: boolean): void => {
  safeSetItem(STORAGE_KEYS.lockTabSwipe, String(locked));
};

