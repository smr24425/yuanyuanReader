import React from "react";

interface HighlightTextProps {
  text: string;
  keyword: string;
  contentStart: number;
  matchOffsets: number[];
  activeMatchOffset: number | null;
}

const HighlightText: React.FC<HighlightTextProps> = ({
  text,
  keyword,
  contentStart,
  matchOffsets,
  activeMatchOffset,
}) => {
  if (!keyword) return <>{text}</>;

  const matchSet = new Set(matchOffsets);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let pos = text.indexOf(keyword);

  while (pos !== -1) {
    if (pos > cursor) {
      parts.push(text.slice(cursor, pos));
    }

    const globalOffset = contentStart + pos;
    const isActive = globalOffset === activeMatchOffset;
    const isMatch = matchSet.has(globalOffset);

    parts.push(
      <mark
        key={`${globalOffset}-${pos}`}
        className={
          isActive
            ? "search-highlight search-highlight--active"
            : isMatch
              ? "search-highlight"
              : undefined
        }
      >
        {text.slice(pos, pos + keyword.length)}
      </mark>,
    );

    cursor = pos + keyword.length;
    pos = text.indexOf(keyword, cursor);
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return <>{parts}</>;
};

export default HighlightText;
