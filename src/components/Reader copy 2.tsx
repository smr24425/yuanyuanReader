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

const AVG_CHAR_WIDTH_PX = 14; // 字體預設大小，會可調整
const VIEWPORT_HEIGHT = window.innerHeight - 44; // NavBar 高度估算
const BUFFER = 3;

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

const Reader: React.FC<ReaderProps> = ({ bookId, onClose }) => {
  // 讀取書籍資料
  const [book, setBook] = useState<Book | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // UI 顯示控制（header/footer）
  const [showUI, setShowUI] = useState(false);

  // 字體大小（px），會影響行高
  const [fontSize, setFontSize] = useState(AVG_CHAR_WIDTH_PX);

  // 根據字體大小計算行高，約 1.7 倍字體大小
  const lineHeight = useMemo(() => Math.round(fontSize * 1.7), [fontSize]);

  // === TTS: 朗讀狀態與控制
  const [isReading, setIsReading] = useState(false);
  const [readingIndex, setReadingIndex] = useState<number | null>(null);
  const isReadingRef = useRef(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 讀取書籍資料
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

  // 拆段（先按章節切，再把章節內容以「空行」切成段落）
  // 這樣 paragraphs 就是每個「段落」，朗讀與高亮才能精準到段，不會吃整章
  const paragraphs = useMemo(() => {
    if (!book) return [] as { text: string; chapterIndex: number | null }[];

    const text = book.content;
    const chapters = (book.chapters ?? [])
      .slice()
      .sort((a, b) => a.index - b.index);

    // 無章節：整本以空行切段
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

      // 以空行切成段落；若你的來源不是空行分段，可改規則
      const blocks = slice
        .split(/\n\s*\n+/g)
        .flatMap((sec) => sec.split(/\n+/g)) // 可選：把大段再按單行切小段
        .map((s) => s.trim())
        .filter(Boolean);

      for (const b of blocks) {
        paras.push({ text: b, chapterIndex: i });
      }
    }
    return paras;
  }, [book]);

  // 取得容器寬度
  useEffect(() => {
    if (!containerRef.current) return;
    setContainerWidth(containerRef.current.clientWidth || 300);
  }, [book]);

  // 估算段落高度，字體大小和行高會影響
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

  // 每段落高度陣列
  const paraHeights = useMemo(() => {
    return paragraphs.map((p) => estimateParaHeight(p.text, containerWidth));
  }, [paragraphs, containerWidth, fontSize, lineHeight]);

  // 段落 offset 位置
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

  // 可見區段開始與結束 index，加入 BUFFER 範圍
  const startIndex = Math.max(
    0,
    paraOffsets.findIndex((offset) => offset > scrollTop) - BUFFER
  );
  const endIndex = Math.min(
    paragraphs.length,
    paraOffsets.findIndex((offset) => offset > scrollTop + VIEWPORT_HEIGHT) +
      BUFFER
  );

  // 還原上次進度
  useEffect(() => {
    if (!book || !containerRef.current) return;
    const pos = book.progressPx ?? 0;
    containerRef.current.scrollTop = pos;
    setScrollTop(pos);
  }, [book]);

  // 寫回進度（節流使用 requestAnimationFrame）
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

  // 點擊切換 header/footer 顯示狀態
  const toggleUI = useCallback(() => {
    setShowUI((v) => !v);
  }, []);

  // 跳轉章節 → 對應該章節的「第一個段落」
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

  // 以「目前章節索引」來決定前後章
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

  // 卸載前保存進度
  useEffect(() => {
    return () => {
      void writeProgressNow();
      // === TTS: 離開時取消朗讀
      try {
        window.speechSynthesis?.cancel();
      } catch {}
    };
  }, [writeProgressNow]);

  // 讀取進度百分比顯示
  const progressForDisplay = useReadingProgress(containerRef);

  // 目前所在章節索引：以「目前可見段落」回推其 chapterIndex
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

  const currentChapterTitle =
    book?.chapters?.[currentChapterIndex]?.title ?? "無章節";

  // === TTS: 從畫面第一行找到「目前所在段落」index
  const findParagraphAtScroll = useCallback(
    (pos: number) => {
      if (paraOffsets.length === 0) return 0;
      // 找到第一個 offset+height 大於 pos 的段落
      const idx = paraOffsets.findIndex((off, i) => {
        const h = paraHeights[i] ?? 0;
        return pos < off + h;
      });
      if (idx === -1) return paragraphs.length - 1;
      return idx;
    },
    [paraOffsets, paraHeights, paragraphs.length]
  );

  // === TTS 面板 & 控制
  const [showTtsPanel, setShowTtsPanel] = useState(false); // 彈窗開關
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

  // === TTS: 將很長的文字切塊，避免瀏覽器單次 Utterance 長度限制
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

  // === TTS: 真正朗讀某段
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
        // 空段落就直接下一段
        setReadingIndex(idx + 1);
        speakParagraph(idx + 1);
        return;
      }

      // 高亮目前段落 & 自動捲到段落頂端
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
          // 本段讀完 → 讀下一段
          const next = idx + 1;
          setReadingIndex(next);
          speakParagraph(next);
          return;
        }

        const utter = new SpeechSynthesisUtterance(chunks[c]);
        currentUtteranceRef.current = utter;
        // 你可以依需求調整語速/音量/音色
        utter.rate = 4;
        utter.pitch = 1.0;
        // 若內容以中文為主，可預設 zh-TW；若是英文書，可改成 en-US
        utter.lang = "zh-TW";

        utter.onend = () => {
          c += 1;
          speakNextChunk();
        };
        utter.onerror = () => {
          // 發生錯誤時嘗試跳過本 chunk
          c += 1;
          speakNextChunk();
        };

        try {
          window.speechSynthesis.speak(utter);
        } catch {
          // 若裝置不支援 speechSynthesis
          setIsReading(false);
          setReadingIndex(null);
          Toast.show({ content: "此裝置不支援語音朗讀", icon: "fail" });
        }
      };

      speakNextChunk();
    },
    [paragraphs, paraOffsets]
  );

  // === TTS: 開始朗讀（從畫面第一個可見「段落」開始）
  const startReadingFromScreenTop = useCallback(() => {
    setShowTtsPanel(true); // 開啟朗讀彈窗
    setIsPaused(false); // 確保不是暫停狀態
    if (!paragraphs.length) return;
    try {
      window.speechSynthesis.cancel(); // 重置
    } catch {}
    const startIdx = findParagraphAtScroll(
      containerRef.current?.scrollTop ?? 0
    );
    isReadingRef.current = true;
    setIsReading(true);
    setReadingIndex(startIdx);
    speakParagraph(startIdx);
  }, [paragraphs.length, findParagraphAtScroll, speakParagraph]);

  // === TTS: 停止朗讀
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

  const speakFast = (text: string, rate: number = 2.0) => {
    const segments = text
      .split(/(?<=[。？！!?；;])/)
      .map((s) => s.trim())
      .filter(Boolean);
    let delay = 0;

    const selectedVoice = speechSynthesis
      .getVoices()
      .find((v) => v.lang === "zh-TW");

    for (let segment of segments) {
      const utter = new SpeechSynthesisUtterance(segment);
      utter.rate = Math.min(rate, 2); // API 限制最大 2
      utter.voice = selectedVoice ?? null;
      utter.pitch = 1;
      utter.volume = 1;

      setTimeout(() => {
        window.speechSynthesis.speak(utter);
      }, delay);

      delay += 150; // 控制每段的間隔（可調）
    }
  };

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
      {/* header */}
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
      {/* 章節目錄 */}
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

      {/* 閱讀內容容器 */}
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
            const isActive = readingIndex === index; // === TTS: 高亮目前朗讀段
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
            e.stopPropagation(); // 不讓事件冒泡給外層，避免觸發 toggleUI
          }}
        >
          {/* 進度調節器 */}
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

          {/* 字體大小調整器 */}
          <div className="reader-footer__font-size">
            <button
              onClick={() => setFontSize((size) => Math.max(10, size - 1))}
            >
              A-
            </button>
            <span>{fontSize}px</span>
            <button
              onClick={() => setFontSize((size) => Math.min(24, size + 1))}
            >
              A+
            </button>
          </div>
        </footer>
      )}

      {/* 目錄開啟按鈕 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(true);
        }}
        style={{
          position: "fixed",
          right: 16,
          bottom: 24,
          background: "#6658CA",
          color: "#fff",
          borderRadius: 999,
          padding: "10px 14px",
          border: 0,
          cursor: "pointer",
          zIndex: 10,
          userSelect: "none",
        }}
      >
        目錄（{Math.round(progressForDisplay)}%）
      </button>

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

      {/* === TTS：彈窗（語速 + 暫停/繼續/停止/從本頁開始） */}
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
