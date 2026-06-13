export interface ParagraphWithOffset {
  text: string;
  contentStart: number;
}

export interface TextSearchResult {
  offset: number;
  sentence: string;
}

export function findAllMatches(text: string, keyword: string): number[] {
  if (!keyword) return [];
  const indices: number[] = [];
  let pos = text.indexOf(keyword);
  while (pos !== -1) {
    indices.push(pos);
    pos = text.indexOf(keyword, pos + keyword.length);
  }
  return indices;
}

export function extractSentenceAt(text: string, offset: number): string {
  let start = 0;
  for (let i = offset - 1; i >= 0; i--) {
    if (/[。！？!?；;\n]/.test(text[i])) {
      start = i + 1;
      break;
    }
  }

  let end = text.length;
  for (let i = offset; i < text.length; i++) {
    if (/[。！？!?；;\n]/.test(text[i])) {
      end = i + 1;
      break;
    }
  }

  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

export function buildTextSearchResults(
  text: string,
  keyword: string,
): TextSearchResult[] {
  return findAllMatches(text, keyword).map((offset) => ({
    offset,
    sentence: extractSentenceAt(text, offset),
  }));
}

export function findParagraphIndex(
  paragraphs: ParagraphWithOffset[],
  charOffset: number,
): number {
  if (paragraphs.length === 0) return 0;
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    if (charOffset >= paragraphs[i].contentStart) {
      return i;
    }
  }
  return 0;
}
