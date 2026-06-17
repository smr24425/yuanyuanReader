// utils/txtParser.ts

/** 第X章 / 第X回，或 EP.1、EP.2 等集數標記 */
export const CHAPTER_LINE_PATTERNS = [
  /第.{1,9}[章回]/,
  /^\s*EP\.\d+/i,
] as const;

export function isChapterLine(line: string): boolean {
  return CHAPTER_LINE_PATTERNS.some((re) => re.test(line));
}

export const parseChapters = (content: string) => {
  // 統一行尾：支援 \r\n / \n
  const lines = content.split("\n"); // 保留每行內容（可能含 \r）
  const offsets: number[] = new Array(lines.length);

  // 計算每一行在全文的「起始字元位移」
  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    offsets[i] = pos;
    // 每行長度 + 1（for the '\n' we split on）
    // 行尾若有 \r 也算在該行內容長度內，因為原文中是 `...\r\n`
    pos += lines[i].length + 1;
  }

  const chapters = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (isChapterLine(raw)) {
      const title = raw.trim();
      const index = offsets[i]; // ← 這裡是「字元位移」
      chapters.push({ title, index });
    }
  }
  return chapters;
};
