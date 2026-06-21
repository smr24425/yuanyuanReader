import type { CustomChapterRule } from "./chapterRuleCompiler";
import { compileChapterRules } from "./chapterRuleCompiler";

/** 第X章 / 第X回，或 EP.1、EP0001 等集數標記 */
export const CHAPTER_LINE_PATTERNS = [
  /第.{1,9}[章回]/,
  /^\s*EP\d+/i,
  /^\s*EP\.\d+/i,
] as const;

export function getChapterLinePatterns(
  customRules: CustomChapterRule[] = [],
): RegExp[] {
  return [...CHAPTER_LINE_PATTERNS, ...compileChapterRules(customRules)];
}

export function isChapterLine(
  line: string,
  customRules: CustomChapterRule[] = [],
): boolean {
  return getChapterLinePatterns(customRules).some((re) => re.test(line));
}

export const parseChapters = (
  content: string,
  customRules: CustomChapterRule[] = [],
) => {
  const patterns = getChapterLinePatterns(customRules);
  const lines = content.split("\n");
  const offsets: number[] = new Array(lines.length);

  let pos = 0;
  for (let i = 0; i < lines.length; i++) {
    offsets[i] = pos;
    pos += lines[i].length + 1;
  }

  const chapters = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (patterns.some((re) => re.test(raw))) {
      const title = raw.trim();
      const index = offsets[i];
      chapters.push({ title, index });
    }
  }
  return chapters;
};
