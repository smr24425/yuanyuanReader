export interface ChapterRef {
  title: string;
  index: number;
}

export interface Paragraph {
  text: string;
  chapterIndex: number | null;
  contentStart: number;
}

function parseSliceIntoParagraphs(
  slice: string,
  sliceStart: number,
  chapterIndex: number | null,
): Paragraph[] {
  const blocks = slice
    .split(/\n\s*\n+/g)
    .flatMap((sec) => sec.split(/\n+/g))
    .map((s) => s.trim())
    .filter(Boolean);

  const paras: Paragraph[] = [];
  let sliceSearchFrom = 0;
  for (const b of blocks) {
    const localIdx = slice.indexOf(b, sliceSearchFrom);
    const contentStart =
      localIdx >= 0 ? sliceStart + localIdx : sliceStart + sliceSearchFrom;
    paras.push({ text: b, chapterIndex, contentStart });
    sliceSearchFrom =
      localIdx >= 0 ? localIdx + b.length : sliceSearchFrom + b.length;
  }
  return paras;
}

function parseNoChapterParagraphs(text: string): Paragraph[] {
  const paras: Paragraph[] = [];
  let searchFrom = 0;
  for (const block of text.split(/\n\s*\n+/g)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const idx = text.indexOf(trimmed, searchFrom);
    const contentStart = idx >= 0 ? idx : searchFrom;
    paras.push({ text: trimmed, chapterIndex: null, contentStart });
    searchFrom = idx >= 0 ? idx + trimmed.length : searchFrom + trimmed.length;
  }
  return paras;
}

export function parseParagraphs(
  content: string,
  chapters: ChapterRef[] = [],
): Paragraph[] {
  const sorted = chapters.slice().sort((a, b) => a.index - b.index);

  if (sorted.length === 0) {
    return parseNoChapterParagraphs(content);
  }

  const paras: Paragraph[] = [];
  const firstChapterIndex = sorted[0].index;

  if (firstChapterIndex > 0) {
    const prefixSlice = content.slice(0, firstChapterIndex);
    paras.push(...parseSliceIntoParagraphs(prefixSlice, 0, null));
  }

  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i].index;
    const end = i + 1 < sorted.length ? sorted[i + 1].index : content.length;
    const slice = content.slice(start, end);
    paras.push(...parseSliceIntoParagraphs(slice, start, i));
  }

  return paras;
}
