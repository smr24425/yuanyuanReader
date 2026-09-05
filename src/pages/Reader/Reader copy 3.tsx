import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { NavBar, Toast } from "antd-mobile";
import { db } from "../../db/indexedDB";
import ChapterMenu from "../../components/ChapterMenu";
import { useReadingProgress } from "../../hooks/useReadingProgress";
import {
  getReaderFontSize,
  setReaderFontSize,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  clamp as clampFromStorage,
  getReaderBgColor,
  getReaderTextColor,
} from "../../utils/storage";
import "./Reader.scss";
import ReaderFooterBgColor from "./ReaderFooterBgColor";
import ReaderSearchPage from "../../components/ReaderSearchPage/ReaderSearchPage";
import {
  buildTextSearchResults,
  findParagraphIndex,
  type TextSearchResult,
} from "../../utils/textSearch";
import { parseParagraphs } from "../../utils/parseParagraphs";
import { FiHeadphones, FiSearch } from "react-icons/fi";
import { BsStopCircle } from "react-icons/bs";

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

const VIEWPORT_HEIGHT = window.innerHeight - 44;
const BUFFER = 3;

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

function updateThemeColor(color: string) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", color);
}

const createBackgroundAudio = () => {
  const sampleRate = 44100;
  const duration = 10;
  const numSamples = sampleRate * duration;

  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // WAV header
  writeString(0, "RIFF");
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, "WAVE");

  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  writeString(36, "data");
  view.setUint32(40, numSamples * 2, true);

  // 極低音量 1000Hz sine wave
  const volume = 0.00001;
  const frequency = 1000;

  for (let i = 0; i < numSamples; i++) {
    const sample =
      Math.sin((2 * Math.PI * frequency * i) / sampleRate) * volume;

    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  return new Blob([buffer], {
    type: "audio/wav",
  });
};

const Reader: React.FC<ReaderProps> = ({ bookId, onClose }) => {
  const [book, setBook] = useState<Book | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [showUI, setShowUI] = useState(false);

  const [fontSize, setFontSize] = useState<number>(() => getReaderFontSize());
  const [bgColor, setBgColor] = useState(getReaderBgColor());
  const [textColor, setTextColor] = useState(getReaderTextColor());

  const lineHeight = useMemo(() => Math.round(fontSize * 1.7), [fontSize]);

  useEffect(() => {
    setReaderFontSize(fontSize);
  }, [fontSize]);

  const [isReading, setIsReading] = useState(false);
  const [readingIndex, setReadingIndex] = useState<number | null>(null);
  const isReadingRef = useRef(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioSrc, setAudioSrc] = useState<string>("");

  useEffect(() => {
    const blob = createBackgroundAudio();
    const url = URL.createObjectURL(blob);

    setAudioSrc(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, []);

  const [showSearchPage, setShowSearchPage] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<TextSearchResult[]>([]);

  // 監聽 localStorage 更新（如果你想監控外部改變，可以加事件listener）
  useEffect(() => {
    function onStorageChange(e: StorageEvent) {
      if (e.key === "reader.bgColor") {
        setBgColor(e.newValue || "#000000");
      } else if (e.key === "reader.textColor") {
        setTextColor(e.newValue || "#ffffff");
      }
    }
    window.addEventListener("storage", onStorageChange);
    return () => window.removeEventListener("storage", onStorageChange);
  }, []);

  useEffect(() => {
    updateThemeColor(bgColor);
  }, [bgColor]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const b = await db.books.get(Number(bookId));
      if (!mounted) return;
      if (!b) {
        Toast.show({ content: "找不到書籍資料", icon: "fail" });
        onClose();
        return;
      }
      const contentData = await db.bookContents.get(Number(bookId));
      if (!mounted) return;
      setBook({ ...b, content: contentData?.content || "" } as unknown as Book);
    })();
    return () => {
      mounted = false;
    };
  }, [bookId, onClose]);

  useEffect(() => {
    if (!bookId) return;
    db.books.update(bookId, {
      lookedAt: Date.now(),
    });
  }, [bookId]);

  const paragraphs = useMemo(() => {
    if (!book) return [];
    return parseParagraphs(book.content, book.chapters ?? []);
  }, [book]);

  useEffect(() => {
    if (!containerRef.current) return;
    setContainerWidth(containerRef.current.clientWidth - 16 || 300);
  }, [book]);

  function estimateParaHeight(text: string, width: number) {
    if (!width) return lineHeight;
    const lines = text.split("\n");
    const totalLines = lines.reduce((acc, line) => {
      const cleanedLine = line.replace(/\s+/g, " ");
      const lineCharCount = cleanedLine.length;
      const estimatedLineCount = Math.ceil(
        (lineCharCount * (fontSize + 1.15)) / width,
      );
      return acc + (estimatedLineCount || 1);
    }, 0);
    return totalLines * lineHeight + 16;
  }

  const paraHeights = useMemo(
    () => paragraphs.map((p) => estimateParaHeight(p.text, containerWidth)),
    [paragraphs, containerWidth, fontSize, lineHeight],
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

  const startIndex = useMemo(() => {
    const firstVisibleIdx = paraOffsets.findIndex(
      (offset) => offset > scrollTop,
    );
    const idx =
      firstVisibleIdx === -1 ? paragraphs.length - 1 : firstVisibleIdx;
    return Math.max(0, idx - BUFFER);
  }, [paraOffsets, scrollTop, paragraphs.length]);

  const endIndex = useMemo(() => {
    const lastVisibleIdx = paraOffsets.findIndex(
      (offset) => offset > scrollTop + VIEWPORT_HEIGHT,
    );
    return lastVisibleIdx === -1
      ? paragraphs.length
      : Math.min(paragraphs.length, lastVisibleIdx + BUFFER);
  }, [paraOffsets, scrollTop, paragraphs.length]);

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
    [writeProgressNow],
  );

  const toggleUI = useCallback(() => {
    setShowUI((v) => !v);
  }, []);

  const goToChapter = useCallback(
    (chapterIndex: number) => {
      if (!containerRef.current) return;
      setShowMenu(false);
      const firstParaIdxInChapter = paragraphs.findIndex(
        (p) => p.chapterIndex === chapterIndex,
      );
      const offset =
        firstParaIdxInChapter >= 0
          ? (paraOffsets[firstParaIdxInChapter] ?? 0)
          : 0;
      containerRef.current.scrollTop = offset;
      setScrollTop(offset);
      requestAnimationFrame(() => {
        void writeProgressNow();
      });
    },
    [paragraphs, paraOffsets, writeProgressNow],
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
    [paraOffsets, paraHeights, paragraphs.length],
  );

  const chunkText = (text: string, maxLen = 180) => {
    const parts: string[] = [];

    // 1. 移除或替換省略號
    // \.{3,} 匹配三個或更多的英文句點
    // [。]{2,} 匹配兩個或更多的大陸/台灣式全形句號
    // \s+ 順便清理多餘空白
    const cleanedText = text
      .replace(/\.{2,}/g, "") // 移除兩個以上的 ..
      .replace(/。{2,}/g, "") // 移除兩個以上的 。。
      .replace(/…+/g, "") // 移除中英文省略號 …
      .replace(/\s+/g, " ");

    // 2. 依照標點符號切割句子
    const sentences = cleanedText.split(/(?<=[。！？!?；;．.])/);

    for (const s of sentences) {
      const trimmed = s.trim();
      if (!trimmed) continue;

      if (trimmed.length <= maxLen) {
        parts.push(trimmed);
      } else {
        // 超過長度則強制分段
        let i = 0;
        while (i < trimmed.length) {
          parts.push(trimmed.slice(i, i + maxLen));
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
    [paragraphs, paraOffsets],
  );

  const startReadingFromScreenTop = useCallback(() => {
    if (!paragraphs.length) return;
    try {
      window.speechSynthesis.cancel();
    } catch {}
    const startIdx = findParagraphAtScroll(
      containerRef.current?.scrollTop ?? 0,
    );
    isReadingRef.current = true;
    setIsReading(true);
    setReadingIndex(startIdx);
    speakParagraph(startIdx);
  }, [paragraphs.length, findParagraphAtScroll, speakParagraph]);

  const stopReading = useCallback(() => {
    isReadingRef.current = false;
    setIsReading(false);
    setReadingIndex(null);
    try {
      if (currentUtteranceRef.current) {
        currentUtteranceRef.current.onend = null;
      }
      window.speechSynthesis.cancel();
    } catch {}
  }, []);

  const goToPreviousReadingChapter = useCallback(() => {
    if (!book?.chapters?.length) return;

    // 先立刻停止目前這一章的 TTS
    isReadingRef.current = false;

    try {
      window.speechSynthesis.cancel();
    } catch {}

    // 使用原本的上一章功能
    goToPrevChapter();

    const prevChapter = Math.max(0, currentChapterIndex - 1);

    const paraIdx = paragraphs.findIndex((p) => p.chapterIndex === prevChapter);

    if (paraIdx < 0) return;

    // 開始新的章節朗讀
    isReadingRef.current = true;
    setIsReading(true);
    setReadingIndex(paraIdx);

    speakParagraph(paraIdx);
  }, [book?.chapters?.length, currentChapterIndex, paragraphs, speakParagraph]);

  const goToNextReadingChapter = useCallback(() => {
    if (!book?.chapters?.length) return;

    // 先立刻停止目前這一章的 TTS
    isReadingRef.current = false;

    try {
      window.speechSynthesis.cancel();
    } catch {}

    // 使用原本的下一章功能
    goToNextChapter();

    const nextChapter = Math.min(
      book.chapters.length - 1,
      currentChapterIndex + 1,
    );

    const paraIdx = paragraphs.findIndex((p) => p.chapterIndex === nextChapter);

    if (paraIdx < 0) return;

    // 開始新的章節朗讀
    isReadingRef.current = true;
    setIsReading(true);
    setReadingIndex(paraIdx);

    speakParagraph(paraIdx);
  }, [book?.chapters?.length, currentChapterIndex, paragraphs, speakParagraph]);

  const setupMediaSession = useCallback(() => {
    if (!("mediaSession" in navigator)) {
      console.log("❌ MediaSession 不支援");
      return;
    }

    console.log("🎛️ setup MediaSession");

    navigator.mediaSession.metadata = new MediaMetadata({
      title: book?.title ?? "聽書",
      artist: "聽書",
      album: "閱讀",
    });

    try {
      // navigator.mediaSession.setActionHandler("play", () => {
      //   console.log("🎛️ MediaSession PLAY");

      //   const audio = audioRef.current;

      //   audio?.play().catch((error) => {
      //     console.error("MediaSession audio play failed:", error);
      //   });

      //   try {
      //     window.speechSynthesis.resume();
      //   } catch {}

      //   isReadingRef.current = true;
      //   setIsReading(true);
      // });
      navigator.mediaSession.setActionHandler("play", () => {
        const audio = audioRef.current;

        isReadingRef.current = true;
        setIsReading(true);

        if (audio) {
          audio.play().catch(() => {});
        }

        try {
          window.speechSynthesis.resume();
        } catch {}

        // 如果 TTS 已經完全停止，重新從目前段落開始
        if (
          readingIndex != null &&
          window.speechSynthesis.speaking === false &&
          window.speechSynthesis.pending === false
        ) {
          speakParagraph(readingIndex);
        }

        navigator.mediaSession.playbackState = "playing";
      });
    } catch (error) {
      console.error("MediaSession play handler failed:", error);
    }

    try {
      navigator.mediaSession.setActionHandler("pause", () => {
        console.log("🎛️ MediaSession PAUSE");

        const audio = audioRef.current;

        audio?.pause();

        try {
          window.speechSynthesis.pause();
        } catch {}

        setIsReading(false);
      });
    } catch (error) {
      console.error("MediaSession pause handler failed:", error);
    }

    try {
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        console.log("🎛️ MediaSession PREVIOUS");
        goToPreviousReadingChapter();
      });
    } catch (error) {
      console.error("MediaSession previous handler failed:", error);
    }

    try {
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        console.log("🎛️ MediaSession NEXT");
        goToNextReadingChapter();
      });
    } catch (error) {
      console.error("MediaSession next handler failed:", error);
    }

    navigator.mediaSession.playbackState = "playing";
  }, [book?.title, goToPreviousReadingChapter, goToNextReadingChapter]);

  const startAudioReading = useCallback(() => {
    if (!paragraphs.length) return;

    const audio = audioRef.current;

    if (!audio) {
      console.error("找不到 audio");
      return;
    }

    const startIdx = findParagraphAtScroll(
      containerRef.current?.scrollTop ?? 0,
    );

    isReadingRef.current = true;
    setIsReading(true);
    setReadingIndex(startIdx);

    // 先建立 MediaSession
    setupMediaSession();

    // Audio Session
    if ("audioSession" in navigator) {
      try {
        (navigator as any).audioSession.type = "playback";
      } catch (error) {
        console.log("audioSession 設定失敗", error);
      }
    }

    // 播放背景音訊
    audio
      .play()
      .then(() => {
        if ("mediaSession" in navigator) {
          navigator.mediaSession.playbackState = "playing";
        }
      })
      .catch(() => {});

    // 開始 TTS
    speakParagraph(startIdx);
  }, [
    paragraphs.length,
    findParagraphAtScroll,
    speakParagraph,
    setupMediaSession,
  ]);

  const stopAudioReading = useCallback(() => {
    isReadingRef.current = false;
    setIsReading(false);
    setReadingIndex(null);

    try {
      window.speechSynthesis.cancel();
    } catch {}

    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "none";
    }
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!book || readingIndex == null) return;

    const chapterIndex = paragraphs[readingIndex]?.chapterIndex ?? 0;
    const chapterTitle = book.chapters?.[chapterIndex]?.title ?? "閱讀";

    navigator.mediaSession.metadata = new MediaMetadata({
      title: chapterTitle,
      artist: book.title,
      album: "聽書",
    });

    try {
      navigator.mediaSession.setActionHandler("play", () => {
        const audio = audioRef.current;

        audio?.play().catch(() => {});

        try {
          window.speechSynthesis.resume();
        } catch {}

        isReadingRef.current = true;
        setIsReading(true);
      });
    } catch {}

    try {
      navigator.mediaSession.setActionHandler("pause", () => {
        const audio = audioRef.current;

        audio?.pause();

        try {
          window.speechSynthesis.pause();
        } catch {}

        setIsReading(false);
      });
    } catch {}

    try {
      navigator.mediaSession.setActionHandler("previoustrack", () => {
        goToPreviousReadingChapter();
      });
    } catch {}

    try {
      navigator.mediaSession.setActionHandler("nexttrack", () => {
        goToNextReadingChapter();
      });
    } catch {}

    navigator.mediaSession.playbackState = isReading ? "playing" : "paused";
  }, [
    book,
    paragraphs,
    readingIndex,
    isReading,
    goToPreviousReadingChapter,
    goToNextReadingChapter,
  ]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isReadingRef.current) return;
      if (!audio.duration) return;

      if (audio.currentTime >= audio.duration - 0.15) {
        audio.currentTime = 0;
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedKeyword(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!debouncedKeyword || !book) {
      setSearchResults([]);
      return;
    }
    setSearchResults(buildTextSearchResults(book.content, debouncedKeyword));
  }, [debouncedKeyword, book?.content]);

  const openSearchPage = useCallback(() => {
    stopReading();
    setShowSearchPage(true);
  }, [stopReading]);

  const closeSearchPage = useCallback(() => {
    setShowSearchPage(false);
  }, []);

  const handleSelectSearchResult = useCallback(
    (index: number) => {
      const result = searchResults[index];
      if (!result || !containerRef.current) return;
      stopReading();
      const paraIdx = findParagraphIndex(paragraphs, result.offset);
      const top = paraOffsets[paraIdx] ?? 0;
      containerRef.current.scrollTop = top;
      setScrollTop(top);
      setShowSearchPage(false);
    },
    [searchResults, paragraphs, paraOffsets, stopReading],
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        // background: "#fff",
        display: "flex",
        flexDirection: "column",
        overscrollBehavior: "contain",
        touchAction: "pan-y",
        userSelect: "none",
        backgroundColor: bgColor,
        color: textColor,
      }}
      onClick={toggleUI}
    >
      <NavBar
        onBack={onClose}
        className={`reader-header ${showUI ? "open" : "close"}`}
        backArrow={
          <span className="reader-header__nav-action" aria-hidden="true">
            ←
          </span>
        }
        right={
          !showSearchPage ? (
            <button
              type="button"
              className="reader-header__nav-action"
              aria-label="搜尋"
              onClick={(e) => {
                e.stopPropagation();
                openSearchPage();
              }}
            >
              <FiSearch />
            </button>
          ) : null
        }
      >
        閱讀
      </NavBar>

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

      <ReaderSearchPage
        visible={showSearchPage}
        keyword={searchInput}
        onKeywordChange={setSearchInput}
        results={searchResults}
        bgColor={bgColor}
        textColor={textColor}
        onSelectResult={handleSelectSearchResult}
        onClose={closeSearchPage}
        totalLength={book?.content?.length || 1}
      />

      <div className="reader-current-chapter">{currentChapterTitle}</div>

      <div
        ref={containerRef}
        className="reader-scroll-container"
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
      <footer
        className={`reader-footer  ${showUI ? "open" : "close"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
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

        <div className="system-and-chapter">
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
          <div className="system">
            <button
              onClick={() =>
                setFontSize((size) =>
                  clampFromStorage(size - 1, MIN_FONT_SIZE, MAX_FONT_SIZE),
                )
              }
            >
              A-
            </button>
            <span>{fontSize}px</span>
            <button
              onClick={() =>
                setFontSize((size) =>
                  clampFromStorage(size + 1, MIN_FONT_SIZE, MAX_FONT_SIZE),
                )
              }
            >
              A+
            </button>

            {/* 新增背景顏色控制 */}
            <ReaderFooterBgColor
              bgColor={bgColor}
              textColor={textColor}
              onChange={(
                newBg: React.SetStateAction<string>,
                newText: React.SetStateAction<string>,
              ) => {
                setBgColor(newBg);
                setTextColor(newText);
              }}
            />
          </div>
        </div>
      </footer>

      {/* === TTS：右下角入口（開啟朗讀面板） */}
      {showUI && (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 126,
            display: "flex",
            zIndex: 11,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {!isReading ? (
            <div
              className="reader-tts-btn"
              onClick={() => {
                startAudioReading();
              }}
            >
              <FiHeadphones />
            </div>
          ) : (
            <div
              className="reader-tts-btn"
              onClick={() => {
                stopAudioReading();
              }}
            >
              <BsStopCircle />
            </div>
          )}
        </div>
      )}
      <audio ref={audioRef} src={audioSrc} preload="auto" playsInline loop />
    </div>
  );
};

export default Reader;
