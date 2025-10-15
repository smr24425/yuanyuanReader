// readFileWithEncodingFallback.ts
import * as jschardet from "jschardet";

/**
 * 將 jschardet 的 encoding 標籤正規化為 TextDecoder 可用的名稱。
 * 同時處理常見別名（e.g., gbk -> gb18030）。
 */
function normalizeEncoding(label?: string): string | null {
  if (!label) return null;
  const enc = label.toLowerCase().trim();

  // 常見別名與標籤歸一
  if (enc.startsWith("utf-8") || enc === "utf8") return "utf-8";
  if (enc === "big5" || enc === "big-5" || enc === "cp950") return "big5";
  if (enc === "gbk" || enc === "gb2312" || enc === "x-gbk") return "gb18030"; // 瀏覽器 TextDecoder 對 gbk 通常用 gb18030
  if (enc === "gb18030") return "gb18030";
  if (
    enc === "shift_jis" ||
    enc === "shift-jis" ||
    enc === "sjis" ||
    enc === "ms_kanji"
  )
    return "shift_jis";
  if (enc === "windows-1252" || enc === "cp1252" || enc === "ansi_x3.4-1968")
    return "windows-1252";
  if (enc === "iso-8859-1" || enc === "latin1" || enc === "latin-1")
    return "iso-8859-1";
  if (enc === "utf-16le" || enc === "utf-16") return "utf-16le";
  if (enc === "utf-16be") return "utf-16be";

  // 其它 TextDecoder 支援的 label 基本上按原樣嘗試
  return enc;
}

/** 嘗試用指定編碼解碼；不支援或失敗則回傳 null */
function tryDecode(buf: Uint8Array, encoding: string): string | null {
  try {
    if (!("TextDecoder" in window)) return null;
    const dec = new TextDecoder(encoding as any, { fatal: false });
    return dec.decode(buf);
  } catch {
    return null;
  }
}

/** 簡易 BOM 偵測，只處理瀏覽器普遍支援的幾種 */
function detectBom(buf: Uint8Array): string | null {
  // UTF-8 BOM: EF BB BF
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)
    return "utf-8";
  // UTF-16 LE BOM: FF FE
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return "utf-16le";
  // UTF-16 BE BOM: FE FF
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return "utf-16be";

  //（註）UTF-32 在瀏覽器 TextDecoder 支援度不好，這裡不處理
  return null;
}

function toBinaryString(buf: Uint8Array, maxBytes = 64 * 1024): string {
  const len = Math.min(buf.length, maxBytes);
  let s = "";
  // 用分段避免 call stack 爆掉
  const chunk = 0x8000; // 32KB
  for (let i = 0; i < len; i += chunk) {
    const end = Math.min(i + chunk, len);
    s += String.fromCharCode(...buf.subarray(i, end));
  }
  return s;
}

/**
 * 使用 BOM → jschardet → 常見編碼後援 的順序讀取文字。
 * 支援輸入 File / Blob / ArrayBuffer / Uint8Array。
 */
export async function readFileWithEncodingFallback(
  input: File | Blob | ArrayBuffer | Uint8Array
): Promise<string> {
  // 讀 bytes
  let arrayBuffer: ArrayBuffer;
  if (input instanceof Uint8Array) {
    arrayBuffer = input.buffer.slice(
      input.byteOffset,
      input.byteOffset + input.byteLength
    ) as any;
  } else if (input instanceof ArrayBuffer) {
    arrayBuffer = input;
  } else {
    arrayBuffer = await input.arrayBuffer();
  }
  const u8 = new Uint8Array(arrayBuffer);

  // 1) BOM
  const bomEnc = detectBom(u8);
  if (bomEnc) {
    const text = tryDecode(u8, bomEnc);
    if (text != null) return stripBom(text);
  }

  // 2) jschardet 偵測（改：先轉二進位字串再 detect）
  let detectedEnc: string | null = null;
  try {
    const binStr = toBinaryString(u8); // ★ 這行是關鍵
    const d = jschardet.detect(binStr); // ★ 改丟字串
    detectedEnc = normalizeEncoding(d?.encoding);
  } catch {
    detectedEnc = null;
  }

  if (detectedEnc) {
    const text = tryDecode(u8, detectedEnc);
    if (text != null) return stripBom(text);
  }

  // 3) 後援清單
  const fallbacks = [
    "utf-8",
    "big5",
    "gb18030",
    "shift_jis",
    "windows-1252",
    "iso-8859-1",
  ];
  for (const enc of fallbacks) {
    const text = tryDecode(u8, enc);
    if (text != null) return stripBom(text);
  }

  // 4) 保底
  return stripBom(new TextDecoder("utf-8", { fatal: false }).decode(u8));
}

/** 去除可能殘留的 BOM/ZWSP */
function stripBom(s: string): string {
  if (!s) return s;
  // \uFEFF: BOM, \u200B: Zero Width Space（有些檔案開頭會混進來）
  return s.replace(/^\uFEFF|\u200B/g, "");
}
