import React, { useEffect, useState } from "react";
import { NavBar } from "antd-mobile";
import HighlightText from "../HighlightText";
import { findAllMatches } from "../../utils/textSearch";
import "./ReaderSearchPage.scss";

export const SEARCH_RESULTS_PAGE_SIZE = 200;

export interface ReaderSearchResultItem {
  sentence: string;
}

interface ReaderSearchPageProps {
  visible: boolean;
  keyword: string;
  onKeywordChange: (value: string) => void;
  results: ReaderSearchResultItem[];
  isSearching?: boolean;
  bgColor: string;
  textColor: string;
  onSelectResult: (index: number) => void;
  onClose: () => void;
}

const ReaderSearchPage: React.FC<ReaderSearchPageProps> = ({
  visible,
  keyword,
  onKeywordChange,
  results,
  isSearching = false,
  bgColor,
  textColor,
  onSelectResult,
  onClose,
}) => {
  const [visibleCount, setVisibleCount] = useState(SEARCH_RESULTS_PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(SEARCH_RESULTS_PAGE_SIZE);
  }, [keyword, results]);

  if (!visible) return null;

  const visibleResults = results.slice(0, visibleCount);
  const hasMore = visibleCount < results.length;

  const metaLabel = isSearching
    ? "搜尋中…"
    : keyword.trim()
      ? results.length > 0
        ? hasMore
          ? `共 ${results.length} 筆結果（已顯示 ${visibleResults.length} 筆）`
          : `共 ${results.length} 筆結果`
        : "無結果"
      : "輸入關鍵字開始搜尋";

  return (
    <div
      className="reader-search-page"
      style={
        {
          "--reader-search-bg": bgColor,
          "--reader-search-text": textColor,
          backgroundColor: bgColor,
          color: textColor,
        } as React.CSSProperties
      }
      onClick={(e) => e.stopPropagation()}
    >
      <NavBar
        onBack={onClose}
        backArrow={
          <span className="reader-search-page__nav-action" aria-hidden="true">
            ←
          </span>
        }
        className="reader-search-page__header"
      >
        搜尋
      </NavBar>

      <div className="reader-search-page__input-wrap">
        <input
          className="reader-search-page__input"
          type="search"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="搜尋書內文字"
          autoFocus
        />
      </div>

      <div className="reader-search-page__meta">{metaLabel}</div>

      <div className="reader-search-page__list">
        {visibleResults.map((result, index) => {
          const keywordTrimmed = keyword.trim();
          const matchOffsets = keywordTrimmed
            ? findAllMatches(result.sentence, keywordTrimmed)
            : [];

          return (
            <button
              key={`${index}-${result.sentence.slice(0, 24)}`}
              type="button"
              className="reader-search-page__item"
              onClick={() => onSelectResult(index)}
            >
              {keywordTrimmed && matchOffsets.length > 0 ? (
                <HighlightText
                  text={result.sentence}
                  keyword={keywordTrimmed}
                  contentStart={0}
                  matchOffsets={matchOffsets}
                  activeMatchOffset={null}
                />
              ) : (
                result.sentence
              )}
            </button>
          );
        })}

        {hasMore && (
          <button
            type="button"
            className="reader-search-page__load-more"
            onClick={() =>
              setVisibleCount((count) =>
                Math.min(count + SEARCH_RESULTS_PAGE_SIZE, results.length),
              )
            }
          >
            載入更多結果（{visibleResults.length} / {results.length}）
          </button>
        )}
      </div>
    </div>
  );
};

export default ReaderSearchPage;
