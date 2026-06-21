import { describe, expect, it } from "vitest";
import { isChapterLine, parseChapters } from "./txtParser";
import { parseParagraphs } from "./parseParagraphs";

describe("isChapterLine", () => {
  it("matches 第X章 / 第X回", () => {
    expect(isChapterLine("第1章 開始")).toBe(true);
    expect(isChapterLine("第一百二十回 尾聲")).toBe(true);
  });

  it("matches EP.N and EP zero-padded episode markers", () => {
    expect(isChapterLine("EP.1 序章")).toBe(true);
    expect(isChapterLine("EP.2")).toBe(true);
    expect(isChapterLine("  ep.10 標題")).toBe(true);
    expect(isChapterLine("EP0001 序章")).toBe(true);
    expect(isChapterLine("ep1 開始")).toBe(true);
  });

  it("does not match ordinary lines", () => {
    expect(isChapterLine("這是普通段落。")).toBe(false);
    expect(isChapterLine("STEP.1 教學")).toBe(false);
  });
});

describe("parseChapters", () => {
  it("detects EP0001 chapter markers", () => {
    const content = "EP0001 序章\n\n正文一。\n\nEP0002 第二章\n\n正文二。";
    const chapters = parseChapters(content);

    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("EP0001 序章");
    expect(chapters[1].title).toBe("EP0002 第二章");
  });

  it("detects EP.1 / EP.2 chapter markers", () => {
    const content = "EP.1 序章\n\n正文一。\n\nEP.2 外傳\n\n正文二。";
    const chapters = parseChapters(content);

    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("EP.1 序章");
    expect(chapters[1].title).toBe("EP.2 外傳");
    expect(chapters[0].index).toBe(0);
    expect(chapters[1].index).toBe(content.indexOf("EP.2"));
  });

  it("detects mixed 第X章 and EP.N markers", () => {
    const content = "第1章 開始\n\n正文\n\nEP.1 外傳\n\n外傳正文";
    const chapters = parseChapters(content);

    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("第1章 開始");
    expect(chapters[1].title).toBe("EP.1 外傳");
  });

  it("keeps prefix content when the first marker is EP.1", () => {
    const content = "作者：某某\n\nEP.1 序章\n\n正文。";
    const chapters = parseChapters(content);
    const paragraphs = parseParagraphs(content, chapters);

    expect(chapters[0].title).toBe("EP.1 序章");
    expect(paragraphs[0].text).toBe("作者：某某");
    expect(paragraphs[0].chapterIndex).toBe(null);
  });
});
