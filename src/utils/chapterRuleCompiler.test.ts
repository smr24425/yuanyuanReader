import { describe, expect, it } from "vitest";
import {
  compileChapterRule,
  formatRulePreview,
  getRulePreviewExamples,
  type CustomChapterRule,
} from "./chapterRuleCompiler";
import { isChapterLine, parseChapters } from "./txtParser";

describe("chapterRuleCompiler", () => {
  it("compiles prefix-digits rule", () => {
    const rule: CustomChapterRule = {
      id: "1",
      type: "prefix-digits",
      prefix: "Episode",
    };
    expect(isChapterLine("Episode12 標題", [rule])).toBe(true);
    expect(isChapterLine("Episode.12", [rule])).toBe(false);
  });

  it("compiles prefix-dot-digits rule", () => {
    const rule: CustomChapterRule = {
      id: "2",
      type: "prefix-dot-digits",
      prefix: "Vol",
    };
    expect(isChapterLine("Vol.3 第三章", [rule])).toBe(true);
  });

  it("compiles line-starts-with rule", () => {
    const rule: CustomChapterRule = {
      id: "3",
      type: "line-starts-with",
      prefix: "序章",
    };
    expect(isChapterLine("序章 前言", [rule])).toBe(true);
  });

  it("escapes special regex characters in prefix", () => {
    const rule: CustomChapterRule = {
      id: "4",
      type: "prefix-digits",
      prefix: "EP+",
    };
    const re = compileChapterRule(rule);
    expect(re.test("EP+1")).toBe(true);
    expect(re.test("EP1")).toBe(false);
  });

  it("returns human-readable preview without regex", () => {
    const rule: CustomChapterRule = {
      id: "5",
      type: "prefix-digits",
      prefix: "EP",
    };
    expect(formatRulePreview(rule)).toBe("將匹配：EP0001、EP1");
    expect(getRulePreviewExamples(rule)).toEqual(["EP0001", "EP1"]);
  });
});

describe("parseChapters with custom rules", () => {
  it("merges custom rules with built-in rules", () => {
    const content = "序章 開始\n\n正文\n\nEpisode1 第一章\n\n更多正文";
    const chapters = parseChapters(content, [
      { id: "1", type: "line-starts-with", prefix: "序章" },
      { id: "2", type: "prefix-digits", prefix: "Episode" },
    ]);

    expect(chapters).toHaveLength(2);
    expect(chapters[0].title).toBe("序章 開始");
    expect(chapters[1].title).toBe("Episode1 第一章");
  });
});
