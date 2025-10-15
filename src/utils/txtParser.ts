// utils/txtParser.ts
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
  const re = /第.{1,9}[章回]/; // 你的原本規則

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (re.test(raw)) {
      const title = raw.trim();
      const index = offsets[i]; // ← 這裡是「字元位移」
      chapters.push({ title, index });
    }
  }
  return chapters;
};
