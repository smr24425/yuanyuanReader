export type ChapterRuleType =
  | "prefix-digits"
  | "prefix-dot-digits"
  | "line-starts-with";

export interface CustomChapterRule {
  id: string;
  type: ChapterRuleType;
  prefix: string;
}

export const CHAPTER_RULE_TYPE_LABELS: Record<ChapterRuleType, string> = {
  "prefix-digits": "行首關鍵字 + 數字",
  "prefix-dot-digits": "行首關鍵字 + . + 數字",
  "line-starts-with": "行首固定文字",
};

export const CHAPTER_RULE_TYPE_OPTIONS: {
  value: ChapterRuleType;
  label: string;
}[] = [
  { value: "prefix-digits", label: CHAPTER_RULE_TYPE_LABELS["prefix-digits"] },
  {
    value: "prefix-dot-digits",
    label: CHAPTER_RULE_TYPE_LABELS["prefix-dot-digits"],
  },
  {
    value: "line-starts-with",
    label: CHAPTER_RULE_TYPE_LABELS["line-starts-with"],
  },
];

export const BUILTIN_CHAPTER_RULE_DESCRIPTIONS = [
  "第X章 / 第X回（如：第1章、第一百回）",
  "EP + 數字（如：EP0001、EP1）",
  "EP + . + 數字（如：EP.1）",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function compileChapterRule(rule: CustomChapterRule): RegExp {
  const prefix = escapeRegExp(rule.prefix.trim());
  switch (rule.type) {
    case "prefix-digits":
      return new RegExp(`^\\s*${prefix}\\d+`, "i");
    case "prefix-dot-digits":
      return new RegExp(`^\\s*${prefix}\\.\\d+`, "i");
    case "line-starts-with":
      return new RegExp(`^\\s*${prefix}`, "i");
  }
}

export function compileChapterRules(rules: CustomChapterRule[]): RegExp[] {
  return rules.map(compileChapterRule);
}

export function getRuleSummary(rule: CustomChapterRule): string {
  return `${CHAPTER_RULE_TYPE_LABELS[rule.type]}：「${rule.prefix}」`;
}

export function getRulePreviewExamples(rule: CustomChapterRule): string[] {
  const prefix = rule.prefix.trim() || "關鍵字";
  switch (rule.type) {
    case "prefix-digits":
      return [`${prefix}0001`, `${prefix}1`];
    case "prefix-dot-digits":
      return [`${prefix}.1`, `${prefix}.12`];
    case "line-starts-with":
      return [prefix, `${prefix} 標題`];
  }
}

export function formatRulePreview(rule: CustomChapterRule): string {
  const examples = getRulePreviewExamples(rule);
  return `將匹配：${examples.join("、")}`;
}
