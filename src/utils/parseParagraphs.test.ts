import { describe, expect, it } from "vitest";
import { parseParagraphs } from "./parseParagraphs";
import { findParagraphIndex } from "./textSearch";

describe("parseParagraphs", () => {
  it("includes prefix paragraphs before the first chapter with correct contentStart", () => {
    const content =
      "作者：某某\n\n這是序章前言。\n\n第1章 開始\n\n第一章正文。";
    const chapters = [{ title: "第1章 開始", index: content.indexOf("第1章") }];

    const paragraphs = parseParagraphs(content, chapters);

    expect(paragraphs[0]).toEqual({
      text: "作者：某某",
      chapterIndex: null,
      contentStart: 0,
    });
    expect(paragraphs[1]).toEqual({
      text: "這是序章前言。",
      chapterIndex: null,
      contentStart: content.indexOf("這是序章前言。"),
    });
    expect(paragraphs.some((p) => p.text === "第一章正文。")).toBe(true);
  });

  it("does not add prefix paragraphs when the first chapter starts at index 0", () => {
    const content = "第1章 開始\n\n第一章正文。\n\n第2章 繼續\n\n第二章正文。";
    const ch1Index = 0;
    const ch2Index = content.indexOf("第2章");
    const chapters = [
      { title: "第1章 開始", index: ch1Index },
      { title: "第2章 繼續", index: ch2Index },
    ];

    const paragraphs = parseParagraphs(content, chapters);

    expect(paragraphs.every((p) => p.chapterIndex !== null || p.text === "")).toBe(
      true,
    );
    expect(paragraphs[0].chapterIndex).toBe(0);
    expect(paragraphs[0].text).toBe("第1章 開始");
    expect(paragraphs[0].contentStart).toBe(0);
  });

  it("parses content without chapters using double-newline blocks", () => {
    const content = "第一段\n\n第二段";
    const paragraphs = parseParagraphs(content, []);

    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].contentStart).toBe(0);
    expect(paragraphs[1].contentStart).toBe(content.indexOf("第二段"));
  });
});

describe("findParagraphIndex with prefix content", () => {
  it("returns the correct paragraph index for offsets in the prefix", () => {
    const content =
      "作者：某某\n\n這是序章前言。\n\n第1章 開始\n\n第一章正文。";
    const chapters = [{ title: "第1章 開始", index: content.indexOf("第1章") }];
    const paragraphs = parseParagraphs(content, chapters);

    const prefixKeywordOffset = content.indexOf("序章前言");
    const paraIdx = findParagraphIndex(paragraphs, prefixKeywordOffset);

    expect(paragraphs[paraIdx].text).toBe("這是序章前言。");
    expect(paragraphs[paraIdx].chapterIndex).toBe(null);
  });
});
