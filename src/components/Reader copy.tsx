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
import "./Reader.css";

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

  // 拆段（依章節 index 切割）
  const paragraphs = useMemo(() => {
    if (!book) return [];
    const text = book.content;
    const chapters = (book.chapters ?? [])
      .slice()
      .sort((a, b) => a.index - b.index);
    if (chapters.length === 0) return [{ text, chapterIndex: null }];
    const paras: { text: string; chapterIndex: number | null }[] = [];
    for (let i = 0; i < chapters.length; i++) {
      const start = chapters[i].index;
      const end = i + 1 < chapters.length ? chapters[i + 1].index : text.length;
      paras.push({ text: text.slice(start, end), chapterIndex: i });
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

  // 跳轉章節
  const goToChapter = useCallback(
    (chapterIndex: number) => {
      if (!containerRef.current) return;
      setShowMenu(false);
      const offset = paraOffsets[chapterIndex] ?? 0;
      containerRef.current.scrollTop = offset;
      setScrollTop(offset);
      requestAnimationFrame(() => {
        void writeProgressNow();
      });
    },
    [paraOffsets, writeProgressNow]
  );

  const goToPrevChapter = () => {
    if (!book || !book.chapters || book.chapters.length === 0) return;
    // 目前章節 index 估算
    const currentScroll = containerRef.current?.scrollTop ?? 0;
    let curIndex =
      paraOffsets.findIndex((offset) => offset > currentScroll) - 1;
    curIndex = clamp(curIndex, 0, book.chapters.length - 1);
    const prevIndex = Math.max(0, curIndex - 1);
    goToChapter(prevIndex);
  };

  const goToNextChapter = () => {
    if (!book || !book.chapters || book.chapters.length === 0) return;
    const currentScroll = containerRef.current?.scrollTop ?? 0;
    let curIndex =
      paraOffsets.findIndex((offset) => offset > currentScroll) - 1;
    curIndex = clamp(curIndex, 0, book.chapters.length - 1);
    const nextIndex = Math.min(book.chapters.length - 1, curIndex + 1);
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
    };
  }, [writeProgressNow]);

  // 讀取進度百分比顯示
  const progressForDisplay = useReadingProgress(containerRef);
  const currentChapterIndex = useMemo(() => {
    if (!book || paraOffsets.length === 0) return -1;
    // 找到目前scrollTop在哪個區間
    for (let i = paraOffsets.length - 1; i >= 0; i--) {
      if (scrollTop >= paraOffsets[i]) return i;
    }
    return 0;
  }, [scrollTop, paraOffsets, book]);

  const currentChapterTitle =
    book?.chapters?.[currentChapterIndex]?.title ?? "無章節";

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
        {/* 章節標題 */}
        <div style={{ height: totalHeight, position: "relative" }}>
          {paragraphs.slice(startIndex, endIndex).map((para, i) => {
            const index = startIndex + i;
            const top = paraOffsets[index];
            return (
              <div
                key={index}
                style={{
                  position: "absolute",
                  top,
                  width: "100%",
                  whiteSpace: "pre-line",
                  lineHeight: `${lineHeight}px`,
                  padding: "0 16px",
                  fontSize: fontSize,
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
    </div>
  );
};

export default Reader;
