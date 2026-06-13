import { EpubCFI } from "epubjs";
import type { Book as EpubBook } from "epubjs";
import { extractSentenceAt } from "./textSearch";

export interface EpubSearchResult {
  cfi: string;
  sentence: string;
}

function findKeywordMatchesInElement(
  root: HTMLElement,
  keyword: string,
): { range: Range; pos: number }[] {
  const matches: { range: Range; pos: number }[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: { node: Text; start: number }[] = [];
  let fullText = "";
  let node = walker.nextNode() as Text | null;

  while (node) {
    textNodes.push({ node, start: fullText.length });
    fullText += node.textContent ?? "";
    node = walker.nextNode() as Text | null;
  }

  let pos = fullText.indexOf(keyword);
  while (pos !== -1) {
    const endPos = pos + keyword.length;
    const startLoc = locateTextPosition(textNodes, pos);
    const endLoc = locateTextPosition(textNodes, endPos);
    if (startLoc && endLoc) {
      const range = root.ownerDocument.createRange();
      range.setStart(startLoc.node, startLoc.offset);
      range.setEnd(endLoc.node, endLoc.offset);
      matches.push({ range, pos });
    }
    pos = fullText.indexOf(keyword, pos + keyword.length);
  }

  return matches;
}

function locateTextPosition(
  textNodes: { node: Text; start: number }[],
  absoluteOffset: number,
): { node: Text; offset: number } | null {
  for (let i = 0; i < textNodes.length; i++) {
    const current = textNodes[i];
    const nextStart =
      i + 1 < textNodes.length
        ? textNodes[i + 1].start
        : current.start + (current.node.textContent?.length ?? 0);
    if (absoluteOffset >= current.start && absoluteOffset <= nextStart) {
      return {
        node: current.node,
        offset: absoluteOffset - current.start,
      };
    }
  }
  return null;
}

interface SpineSection {
  href: string;
  cfiBase: string;
  load: (request?: unknown) => Promise<unknown>;
  document: Document;
}

export async function searchEpub(
  book: EpubBook,
  keyword: string,
): Promise<EpubSearchResult[]> {
  if (!keyword.trim()) return [];

  await book.ready;
  const results: EpubSearchResult[] = [];
  const spineItems = (book.spine as { spineItems?: SpineSection[] }).spineItems;

  if (!spineItems?.length) return results;

  for (const item of spineItems) {
    await item.load(book.load.bind(book));
    const body = item.document?.body;
    if (!body) continue;

    const matches = findKeywordMatchesInElement(body, keyword);
    for (const { range, pos } of matches) {
      try {
        const fullText = body.textContent ?? "";
        const cfi = new EpubCFI(range, item.cfiBase).toString();
        const sentence = extractSentenceAt(fullText, pos);
        results.push({ cfi, sentence });
      } catch {
        // skip ranges that cannot produce valid CFI
      }
    }
  }

  return results;
}
