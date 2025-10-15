import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { NavBar, Toast } from "antd-mobile";
import { db } from "../db/indexedDB";
import ChapterMenu from "./ChapterMenu";
import { useReadingProgress } from "../hooks/useReadingProgress";
import {
  getReaderFontSize,
  setReaderFontSize,
  DEFAULT_FONT_SIZE,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  clamp as clampFromStorage,
} from "../utils/storage";
import "./reader.css";

interface Chapter {
  title: string;
  index: number;
}
interface Book {
  id: number;
  title: string;
  content: string;
  chapters: Chapter[];
  progressPx?: number;
  percent?: number;
}
interface ReaderProps {
  bookId: number;
  onClose: () => void;
}

const AVG_CHAR_WIDTH_PX = DEFAULT_FONT_SIZE;
const VIEWPORT_HEIGHT = window.innerHeight - 44;
const BUFFER = 3;

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

const Reader: React.FC<ReaderProps> = ({ bookId, onClose }) => {
  const [book, setBook] = useState<Book | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [showUI, setShowUI] = useState(false);

  const [fontSize, setFontSize] = useState<number>(() => getReaderFontSize());
  const lineHeight = useMemo(() => Math.round(fontSize * 1.7), [fontSize]);

  useEffect(() => {
    setReaderFontSize(fontSize);
  }, [fontSize]);

  const [isReading, setIsReading] = useState(false);
  const [readingIndex, setReadingIndex] = useState<number | null>(null);
  const isReadingRef = useRef(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const b = (await db.books.get(Number(bookId))) as Book | undefined;
      if (!mounted) return;
      if (!b) {
        Toast.show({ content: "找不到書籍資料", icon: "fail" });
        onClose();
        return;
      }
      setBook(b);
    })();
    return () => {
      mounted = false;
    };
  }, [bookId, onClose]);

  const paragraphs = useMemo(() => {
    if (!book) return [] as { text: string; chapterIndex: number | null }[];

    const text = book.content;
    const chapters = (book.chapters ?? [])
      .slice()
      .sort((a, b) => a.index - b.index);

    if (chapters.length === 0) {
      return text
        .split(/\n\s*\n+/g)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => ({ text: t, chapterIndex: null }));
    }

    const paras: { text: string; chapterIndex: number | null }[] = [];
    for (let i = 0; i < chapters.length; i++) {
      const start = chapters[i].index;
      const end = i + 1 < chapters.length ? chapters[i + 1].index : text.length;
      const slice = text.slice(start, end);

      const blocks = slice
        .split(/\n\s*\n+/g)
        .flatMap((sec) => sec.split(/\n+/g))
        .map((s) => s.trim())
        .filter(Boolean);

      for (const b of blocks) {
        paras.push({ text: b, chapterIndex: i });
      }
    }
    return paras;
  }, [book]);

  useEffect(() => {
    if (!containerRef.current) return;
    setContainerWidth(containerRef.current.clientWidth || 300);
  }, [book]);

  function estimateParaHeight(text: string, width: number) {
    if (!width) return lineHeight;
    const lines = text.split("\n");
    const totalLines = lines.reduce((acc, line) => {
      const cleanedLine = line.replace(/\s+/g, " ");
      const lineCharCount = cleanedLine.length;
      const estimatedLineCount = Math.ceil(
        (lineCharCount * (fontSize + 1.15)) / width
      );
      return acc + (estimatedLineCount || 1);
    }, 0);
    return totalLines * lineHeight + 16;
  }

  const paraHeights = useMemo(
    () => paragraphs.map((p) => estimateParaHeight(p.text, containerWidth)),
    [paragraphs, containerWidth, fontSize, lineHeight]
  );

  const paraOffsets = useMemo(() => {
    const offsets: number[] = [];
    let acc = 0;
    for (let h of paraHeights) {
      offsets.push(acc);
      acc += h;
    }
    return offsets;
  }, [paraHeights]);

  const totalHeight = paraHeights.reduce((sum, h) => sum + h, 0);

  const startIndex = Math.max(
    0,
    paraOffsets.findIndex((offset) => offset > scrollTop) - BUFFER
  );
  const endIndex = Math.min(
    paragraphs.length,
    paraOffsets.findIndex((offset) => offset > scrollTop + VIEWPORT_HEIGHT) +
      BUFFER
  );

  useEffect(() => {
    if (!book || !containerRef.current) return;
    const pos = book.progressPx ?? 0;
    containerRef.current.scrollTop = pos;
    setScrollTop(pos);
  }, [book]);

  const rafRef = useRef<number | null>(null);
  const writeProgressNow = useCallback(async () => {
    if (!book || !containerRef.current) return;
    const el = containerRef.current;
    const denom = Math.max(1, el.scrollHeight - el.clientHeight);
    const percent = Math.round(clamp((el.scrollTop / denom) * 100, 0, 100));
    await db.books.update(book.id, { progressPx: el.scrollTop, percent });
  }, [book?.id]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        void writeProgressNow();
      });
    },
    [writeProgressNow]
  );

  const toggleUI = useCallback(() => {
    setShowUI((v) => !v);
  }, []);

  const goToChapter = useCallback(
    (chapterIndex: number) => {
      if (!containerRef.current) return;
      setShowMenu(false);
      const firstParaIdxInChapter = paragraphs.findIndex(
        (p) => p.chapterIndex === chapterIndex
      );
      const offset =
        firstParaIdxInChapter >= 0
          ? paraOffsets[firstParaIdxInChapter] ?? 0
          : 0;
      containerRef.current.scrollTop = offset;
      setScrollTop(offset);
      requestAnimationFrame(() => {
        void writeProgressNow();
      });
    },
    [paragraphs, paraOffsets, writeProgressNow]
  );

  const currentChapterIndex = useMemo(() => {
    if (!book || paraOffsets.length === 0) return -1;
    const idx = (() => {
      for (let i = paraOffsets.length - 1; i >= 0; i--) {
        if (scrollTop >= paraOffsets[i]) return i;
      }
      return 0;
    })();
    return paragraphs[idx]?.chapterIndex ?? -1;
  }, [scrollTop, paraOffsets, paragraphs, book]);

  const goToPrevChapter = () => {
    if (!book || !book.chapters || book.chapters.length === 0) return;
    const cur = Math.max(0, currentChapterIndex ?? 0);
    const prevIndex = Math.max(0, cur - 1);
    goToChapter(prevIndex);
  };

  const goToNextChapter = () => {
    if (!book || !book.chapters || book.chapters.length === 0) return;
    const cur = Math.max(0, currentChapterIndex ?? 0);
    const nextIndex = Math.min(book.chapters.length - 1, cur + 1);
    goToChapter(nextIndex);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!containerRef.current) return;
    const val = Number(e.target.value);
    const scrollHeight =
      containerRef.current.scrollHeight - containerRef.current.clientHeight;
    const newScrollTop = (val / 100) * scrollHeight;
    containerRef.current.scrollTop = newScrollTop;
    setScrollTop(newScrollTop);
    void writeProgressNow();
  };

  useEffect(() => {
    return () => {
      void writeProgressNow();
      try {
        window.speechSynthesis?.cancel();
      } catch {}
    };
  }, [writeProgressNow]);

  const progressForDisplay = useReadingProgress(containerRef);

  const currentChapterTitle =
    book?.chapters?.[currentChapterIndex]?.title ?? "無章節";

  const findParagraphAtScroll = useCallback(
    (pos: number) => {
      if (paraOffsets.length === 0) return 0;
      const idx = paraOffsets.findIndex((off, i) => {
        const h = paraHeights[i] ?? 0;
        return pos < off + h;
      });
      if (idx === -1) return paragraphs.length - 1;
      return idx;
    },
    [paraOffsets, paraHeights, paragraphs.length]
  );

  const [showTtsPanel, setShowTtsPanel] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const pauseReading = useCallback(() => {
    try {
      window.speechSynthesis.pause();
      setIsPaused(true);
    } catch {}
  }, []);

  const resumeReading = useCallback(() => {
    try {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } catch {}
  }, []);

  const chunkText = (text: string, maxLen = 180) => {
    const parts: string[] = [];
    const sentences = text.replace(/\s+/g, " ").split(/(?<=[。！？!?；;．.])/);
    for (const s of sentences) {
      if (s.length <= maxLen) {
        if (s.trim()) parts.push(s.trim());
      } else {
        let i = 0;
        while (i < s.length) {
          parts.push(s.slice(i, i + maxLen));
          i += maxLen;
        }
      }
    }
    return parts;
  };

  const speakParagraph = useCallback(
    (idx: number) => {
      if (!isReadingRef.current) return;
      if (idx < 0 || idx >= paragraphs.length) {
        setIsReading(false);
        setReadingIndex(null);
        return;
      }

      const raw = paragraphs[idx].text?.trim() ?? "";
      if (!raw) {
        setReadingIndex(idx + 1);
        speakParagraph(idx + 1);
        return;
      }

      setReadingIndex(idx);
      if (containerRef.current) {
        containerRef.current.scrollTo({
          top: paraOffsets[idx] ?? 0,
          behavior: "smooth",
        });
      }

      const chunks = chunkText(raw);
      let c = 0;

      const speakNextChunk = () => {
        if (!isReadingRef.current) return;
        if (c >= chunks.length) {
          const next = idx + 1;
          setReadingIndex(next);
          speakParagraph(next);
          return;
        }

        const utter = new SpeechSynthesisUtterance(chunks[c]);
        currentUtteranceRef.current = utter;
        utter.rate = 4;
        utter.pitch = 1.0;
        utter.lang = "zh-TW";

        utter.onend = () => {
          c += 1;
          speakNextChunk();
        };
        utter.onerror = () => {
          c += 1;
          speakNextChunk();
        };

        try {
          window.speechSynthesis.speak(utter);
        } catch {
          setIsReading(false);
          setReadingIndex(null);
          Toast.show({ content: "此裝置不支援語音朗讀", icon: "fail" });
        }
      };

      speakNextChunk();
    },
    [paragraphs, paraOffsets]
  );

  const startReadingFromScreenTop = useCallback(() => {
    setShowTtsPanel(true);
    setIsPaused(false);
    if (!paragraphs.length) return;
    try {
      window.speechSynthesis.cancel();
    } catch {}
    const startIdx = findParagraphAtScroll(
      containerRef.current?.scrollTop ?? 0
    );
    isReadingRef.current = true;
    setIsReading(true);
    setReadingIndex(startIdx);
    speakParagraph(startIdx);
  }, [paragraphs.length, findParagraphAtScroll, speakParagraph]);

  const stopReading = useCallback(() => {
    isReadingRef.current = false;
    setIsReading(false);
    setIsPaused(false);
    try {
      if (currentUtteranceRef.current) {
        currentUtteranceRef.current.onend = null;
      }
      window.speechSynthesis.cancel();
    } catch {}
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#fff",
        display: "flex",
        flexDirection: "column",
        overscrollBehavior: "contain",
        touchAction: "pan-y",
        userSelect: "none",
      }}
      className="aaa"
      onClick={toggleUI}
    >
      {showUI && (
        <NavBar
          onBack={onClose}
          className="reader-header"
          backArrow={<span style={{ color: "#fff" }}>←</span>}
          right={
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(true);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                fontSize: 24,
                cursor: "pointer",
                padding: 4,
              }}
              aria-label="目錄"
            >
              ☰
            </button>
          }
        >
          閱讀
        </NavBar>
      )}

      <ChapterMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        chapters={book?.chapters || []}
        onSelect={(index) => {
          goToChapter(index);
          setShowMenu(false);
        }}
        currentChapterIndex={currentChapterIndex}
      />

      <div className="reader-current-chapter">{currentChapterTitle}</div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
          position: "relative",
          userSelect: "text",
          fontSize: fontSize,
          lineHeight: `${lineHeight}px`,
        }}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          {paragraphs.slice(startIndex, endIndex).map((para, i) => {
            const index = startIndex + i;
            const top = paraOffsets[index];
            const isActive = readingIndex === index;
            return (
              <div
                key={index}
                className={isActive ? "reader-para reading" : "reader-para"}
                style={{
                  position: "absolute",
                  top,
                  width: "100%",
                  whiteSpace: "pre-line",
                  lineHeight: `${lineHeight}px`,
                  padding: "0 16px",
                  fontSize: fontSize,
                  transition: "background-color 0.2s, color 0.2s",
                  backgroundColor: isActive ? "#fff7cc" : undefined,
                  boxShadow: isActive
                    ? "inset 0 0 0 2px rgba(255,215,0,.35)"
                    : undefined,
                }}
              >
                {para.chapterIndex !== null && (
                  <span
                    id={`ch-i-${para.chapterIndex}`}
                    style={{ display: "block", height: 1, marginTop: -1 }}
                    aria-hidden="true"
                  />
                )}
                {para.text}
              </div>
            );
          })}
        </div>
      </div>

      {/* 進度百分比顯示 */}
      <div className="reader-progress-display">
        {Math.round(progressForDisplay)}%
      </div>

      {/* footer */}
      {showUI && (
        <footer
          className="reader-footer"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <div className="reader-footer__progress">
            <button onClick={goToPrevChapter}>上一章</button>

            <input
              type="range"
              min={0}
              max={100}
              value={progressForDisplay}
              onChange={handleProgressChange}
            />

            <button onClick={goToNextChapter}>下一章</button>
          </div>

          <div className="reader-footer__font-size">
            <button
              onClick={() =>
                setFontSize((size) =>
                  clampFromStorage(size - 1, MIN_FONT_SIZE, MAX_FONT_SIZE)
                )
              }
            >
              A-
            </button>
            <span>{fontSize}px</span>
            <button
              onClick={() =>
                setFontSize((size) =>
                  clampFromStorage(size + 1, MIN_FONT_SIZE, MAX_FONT_SIZE)
                )
              }
            >
              A+
            </button>
          </div>
        </footer>
      )}

      {/* === TTS：右下角入口（開啟朗讀面板） */}
      <div
        style={{
          position: "fixed",
          right: 16,
          bottom: 84,
          display: "flex",
          gap: 8,
          zIndex: 11,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="reader-tts-btn"
          onClick={() => setShowTtsPanel(true)}
        >
          🔈 朗讀控制
        </button>
      </div>

      {/* === TTS：彈窗（暫停/繼續/停止/從本頁開始） */}
      {showTtsPanel && (
        <div className="tts-modal" onClick={(e) => e.stopPropagation()}>
          <div
            className="tts-modal__mask"
            onClick={() => setShowTtsPanel(false)}
          />
          <div className="tts-modal__panel">
            <div className="tts-modal__header">
              <div>朗讀控制</div>
              <button
                className="tts-modal__close"
                onClick={() => setShowTtsPanel(false)}
                aria-label="關閉"
              >
                ×
              </button>
            </div>

            <div className="tts-modal__content">
              <div className="tts-row tts-actions">
                {!isReading ? (
                  <button
                    className="reader-tts-btn"
                    onClick={(e) => {
                      startReadingFromScreenTop();
                      e.stopPropagation();
                    }}
                  >
                    ▶ 從本頁開始
                  </button>
                ) : (
                  <>
                    {!isPaused ? (
                      <button className="reader-tts-btn" onClick={pauseReading}>
                        ⏸ 暫停
                      </button>
                    ) : (
                      <button
                        className="reader-tts-btn"
                        onClick={resumeReading}
                      >
                        ⏯ 繼續
                      </button>
                    )}
                    <button
                      className="reader-tts-btn stop"
                      onClick={stopReading}
                    >
                      ■ 停止
                    </button>
                  </>
                )}
              </div>

              <div className="tts-hint">
                朗讀中的段落會自動高亮並平滑捲動至該段。
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reader;
