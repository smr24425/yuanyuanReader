import React, { useEffect, useRef, useState, useCallback } from "react";
import { NavBar, Toast } from "antd-mobile";
import ePub, { Book as EpubBook, Rendition } from "epubjs";
import { db } from "../../db/indexedDB";
import ChapterMenu from "../../components/ChapterMenu";
import {
  getReaderFontSize,
  setReaderFontSize,
  clamp,
  MIN_FONT_SIZE,
  MAX_FONT_SIZE,
  getReaderBgColor,
  getReaderTextColor,
} from "../../utils/storage";
import "./Reader.scss"; // 共用 Reader 樣式
import ReaderFooterBgColor from "./ReaderFooterBgColor";

interface EpubReaderProps {
  bookId: number;
  onClose: () => void;
}

const EpubReader: React.FC<EpubReaderProps> = ({ bookId, onClose }) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [book, setBook] = useState<EpubBook | null>(null);
  const [rendition, setRendition] = useState<Rendition | null>(null);

  const [showUI, setShowUI] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const [fontSize, setFontSize] = useState<number>(() => getReaderFontSize());
  const [bgColor, setBgColor] = useState(getReaderBgColor());
  const [textColor, setTextColor] = useState(getReaderTextColor());

  const [chapters, setChapters] = useState<{ title: string; href: string; index: number }[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(-1);
  const [currentPercentage, setCurrentPercentage] = useState(0);

  // --- Theme Update ---
  useEffect(() => {
    setReaderFontSize(fontSize);
    if (rendition) {
      try {
        rendition.themes.fontSize(`${fontSize}px`);
      } catch (e) {
        // ignore errors if rendition views aren't fully ready
      }
    }
  }, [fontSize, rendition]);

  useEffect(() => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", bgColor);
  }, [bgColor]);

  const [touchStart, setTouchStart] = useState<number | null>(null);

  // --- Load Book ---
  useEffect(() => {
    let mounted = true;
    let epubBookInstance: EpubBook | null = null;

    (async () => {
      try {
        const dbBook = await db.books.get(bookId);
        if (!mounted) return;
        if (!dbBook || !dbBook.fileData) {
          Toast.show({ content: "找不到書籍檔案", icon: "fail" });
          onClose();
          return;
        }

        epubBookInstance = ePub(dbBook.fileData);
        setBook(epubBookInstance);

        epubBookInstance.ready.then(() => {
          if (!mounted) return;

          // 獲取目錄導覽
          epubBookInstance!.loaded.navigation.then((nav: any) => {
            if (!mounted) return;
            let idx = 0;
            const newChapters: { title: string; href: string; index: number }[] = [];
            nav.forEach((navItem: any) => {
              newChapters.push({ title: navItem.label, href: navItem.href, index: idx++ });
            });
            setChapters(newChapters);
          }).catch((err) => {
            console.warn("無法獲取 epub 目錄導覽", err);
          });
        });

      } catch (e) {
        console.error(e);
        Toast.show({ content: "讀取 EPUB 失敗", icon: "fail" });
      }
    })();
    return () => {
      mounted = false;
      // epubjs destroy 會在生成 location 到一半時拋出內部異常
      // 由於實例會隨元件解構被 GC，這裡跳過 destroy() 避免崩潰
    };
  }, [bookId, onClose]);

  useEffect(() => {
    if (book && viewerRef.current) {
      viewerRef.current.innerHTML = "";
      const newRendition = book.renderTo(viewerRef.current, {
        width: "100%",
        height: "100%",
        spread: "none",
        manager: "default",
        flow: "paginated",
        allowScriptedContent: true,
      });

      newRendition.hooks.content.register((contents: any) => {
        const doc = contents.document;
        // 抓取所有可能包含圖片資源的標籤
        const imgs = Array.from(doc.querySelectorAll('img, image')) as HTMLElement[];

        return Promise.all(
          imgs.map(async (img: any) => {
            // 1. 取得原始路徑
            const rawSrc = img.getAttribute('src') || img.getAttribute('xlink:href');

            // 跳過已處理過或外部鏈接
            if (!rawSrc || rawSrc.startsWith('blob:') || rawSrc.startsWith('http')) {
              return;
            }

            try {
              // 2. 修正路徑解析 (解決 Expected 1 arguments 錯誤)
              // 在新版 epubjs 中，直接傳入 rawSrc，它會相對於當前 section 解析
              const href = book.path.resolve(rawSrc);

              // 3. 從 archive 獲取資源 (強制轉為 any 避開 TS 類型錯誤)
              const archive = book.archive as any;

              // 嘗試獲取 Blob 數據
              let data: Blob | null = null;
              if (typeof archive.getBlob === 'function') {
                data = await archive.getBlob(href);
              } else {
                // 備用方案：手動從 get 獲取並轉為 Blob
                const rawData = await archive.get(href);
                if (rawData) {
                  data = new Blob([rawData]);
                }
              }

              if (data) {
                const url = URL.createObjectURL(data);
                // 4. 替換路徑
                if (img.tagName.toLowerCase() === 'img') {
                  img.src = url;
                } else {
                  img.setAttribute('xlink:href', url);
                }
              }
            } catch (err) {
              console.warn("圖片加載出錯:", rawSrc, err);
            }
          })
        ).then(() => {
          // 5. 確保樣式正確，防止圖片因為 CSS 隱藏
          contents.addStylesheetRules({
            "img": {
              "max-width": "100% !important",
              "height": "auto !important",
              "display": "inline-block !important",
              "visibility": "visible !important"
            },
            "image": {
              "max-width": "100% !important",
              "height": "auto !important"
            }
          });
        });
      });

      newRendition.on("relocated", (location: any) => {
        let newPercent: number | undefined = undefined;
        if (book.locations.length() > 0) {
          const percentVal = book.locations.percentageFromCfi(location.start.cfi);
          newPercent = Math.round(percentVal * 100);
          setCurrentPercentage(newPercent);
        }

        const updateData: any = {
          progressCfi: location.start.cfi,
          lookedAt: Date.now()
        };
        if (newPercent !== undefined) {
          updateData.percent = newPercent;
        }

        // Save progress to DB
        db.books.update(bookId, updateData);
      });

      db.books.get(bookId).then(dbBook => {
        if (dbBook?.percent) setCurrentPercentage(Math.round(dbBook.percent));

        // 1. 設定主題與樣式 (必須在 display 之前，以確保排版與字體大小正確，否則跳頁與進度條會不精準)
        newRendition.themes.register("custom", {
          body: { background: bgColor, color: textColor },
          img: { "max-width": "100% !important", "height": "auto !important" }
        });
        newRendition.themes.select("custom");
        try {
          newRendition.themes.fontSize(`${fontSize}px`);
        } catch (e) { }

        // 2. 如果資料庫中已有 locations 快取，載入它支援精準百分比判斷
        if (dbBook?.locationsDB && book.locations.length() === 0) {
          try {
            book.locations.load(JSON.parse(dbBook.locationsDB));
          } catch (e) {
            console.warn("無法載入 locations 快取", e);
          }
        }

        // 3. 處理降級備用的延遲背景生成 (當舊書沒有快取時)
        const runFallbackGenerate = () => {
          if (book.locations.length() === 0) {
            book.locations.generate(500).then(() => {
              if (newRendition.location && newRendition.location.start) {
                const p = book.locations.percentageFromCfi(newRendition.location.start.cfi);
                setCurrentPercentage(Math.round(p * 100));
              }
            }).catch(err => console.error("降級進度生成出錯:", err));
          }
        };

        // 4. 定義最後渲染完成後的設定
        const finalizeSetup = () => {
          setRendition(newRendition);
          runFallbackGenerate();
        };

        // 5. 執行首次跳轉與渲染
        if (dbBook?.progressCfi) {
          newRendition.display(dbBook.progressCfi).then(finalizeSetup).catch(() => newRendition.display().then(finalizeSetup));
        } else if (dbBook?.percent && dbBook.percent > 0) {
          if (book.locations.length() > 0) {
            const cfi = book.locations.cfiFromPercentage(dbBook.percent / 100);
            newRendition.display(cfi).then(finalizeSetup).catch(() => newRendition.display().then(finalizeSetup));
          } else {
            // 舊有未準備好或無快取的書籍，等待計算
            book.locations.generate(500).then(() => {
              const cfi = book.locations.cfiFromPercentage(dbBook.percent! / 100);
              newRendition.display(cfi).then(finalizeSetup).catch(() => newRendition.display().then(finalizeSetup));
            }).catch(() => {
              newRendition.display().then(finalizeSetup);
            });
          }
        } else {
          newRendition.display().then(finalizeSetup);
        }
      });

      return () => {
        try {
          newRendition.destroy();
        } catch (e) { }
      };
    }
  }, [book, bookId]); // Only run when book changes!

  // Update chapter index dynamically when percentage/location changes
  useEffect(() => {
    if (rendition && chapters.length > 0) {
      const updateChapter = (location: any) => {
        const chapter = chapters.findIndex(ch => location.start.href.includes(ch.href));
        if (chapter !== -1) setCurrentChapterIndex(chapter);
      };

      // We can directly calculate if we want, or listen:
      rendition.on("relocated", updateChapter);
      return () => {
        rendition.off("relocated", updateChapter);
      };
    }
  }, [rendition, chapters]);

  // Update themes safely
  useEffect(() => {
    if (rendition) {
      rendition.themes.register("custom", {
        body: {
          background: bgColor,
          color: textColor,
        },
        img: {
          "max-width": "100% !important",
          "height": "auto !important",
        },
        image: {
          "max-width": "100% !important",
          "height": "auto !important",
        }
      });
      rendition.themes.select("custom");
    }
  }, [bgColor, textColor, rendition]);

  const toggleUI = useCallback(() => {
    setShowUI((v) => !v);
  }, []);

  const goToPrevPage = () => {
    rendition?.prev();
  };

  const goToNextPage = () => {
    rendition?.next();
  };

  const [sliderValue, setSliderValue] = useState(0);

  useEffect(() => {
    setSliderValue(currentPercentage);
  }, [currentPercentage]);

  const displayDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSliderValue(val);

    if (displayDebounceRef.current) clearTimeout(displayDebounceRef.current);
    displayDebounceRef.current = setTimeout(() => {
      if (book && book.locations.length() > 0) {
        const cfi = book.locations.cfiFromPercentage(val / 100);
        rendition?.display(cfi);
      } else {
        Toast.show({ content: "正在生成進度，請稍候" });
      }
    }, 50);
  };

  const goToChapter = (href: string) => {
    rendition?.display(href);
    setShowMenu(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        overscrollBehavior: "none",
        backgroundColor: bgColor,
        color: textColor,
      }}
    >
      <NavBar
        onBack={onClose}
        className={`reader-header ${showUI ? "open" : "close"}`}
        backArrow={<span style={{ color: "#fff" }}>←</span>}
      >
        閱讀 EPUB
      </NavBar>

      {/* 目錄 */}
      <ChapterMenu
        visible={showMenu}
        onClose={() => setShowMenu(false)}
        chapters={chapters}
        onSelect={(index) => {
          goToChapter(chapters[index].href);
        }}
        currentChapterIndex={currentChapterIndex}
      />

      <div className="reader-current-chapter">
        {chapters[currentChapterIndex]?.title ?? "EPUB Book"}
      </div>

      {/* EPUB Viewer Container */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* Render Target */}
        <div
          ref={viewerRef}
          style={{ width: "100%", height: "100%" }}
        />

        {/* 觸控/點擊 三區塊遮罩 & 手勢滑動 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            display: "flex",
          }}
          onTouchStart={(e) => {
            setTouchStart(e.touches[0].clientX);
          }}
          onTouchEnd={(e) => {
            if (touchStart === null) return;
            const touchEnd = e.changedTouches[0].clientX;
            const diff = touchStart - touchEnd;
            if (diff > 50) {
              goToNextPage();
            } else if (diff < -50) {
              goToPrevPage();
            }
            setTouchStart(null);
          }}
        >
          <div
            style={{ width: "30%" }}
            onClick={(e) => {
              e.stopPropagation();
              goToPrevPage();
            }}
          />
          <div
            style={{ flex: 1 }}
            onClick={(e) => {
              e.stopPropagation();
              toggleUI();
            }}
          />
          <div
            style={{ width: "30%" }}
            onClick={(e) => {
              e.stopPropagation();
              goToNextPage();
            }}
          />
        </div>
      </div>

      <div className="reader-progress-display">
        {currentPercentage}%
      </div>

      {/* footer */}
      <footer
        className={`reader-footer ${showUI ? "open" : "close"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reader-footer__progress">
          <button onClick={goToPrevPage}>上一頁</button>

          <input
            type="range"
            min={0}
            max={100}
            value={sliderValue}
            onChange={handleSliderChange}
            style={{ flex: 1, margin: "0 10px" }}
          />

          <button onClick={goToNextPage}>下一頁</button>
        </div>

        <div className="system-and-chapter">
          <button
            onClick={() => setShowMenu(true)}
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
                  clamp(size - 1, MIN_FONT_SIZE, MAX_FONT_SIZE)
                )
              }
            >
              A-
            </button>
            <span>{fontSize}px</span>
            <button
              onClick={() =>
                setFontSize((size) =>
                  clamp(size + 1, MIN_FONT_SIZE, MAX_FONT_SIZE)
                )
              }
            >
              A+
            </button>

            <ReaderFooterBgColor
              bgColor={bgColor}
              textColor={textColor}
              onChange={(newBg, newText) => {
                setBgColor(newBg);
                setTextColor(newText);
              }}
            />
          </div>
        </div>
      </footer>
    </div>
  );
};

export default EpubReader;
