import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Toast,
  ProgressBar,
  Dialog,
  NavBar,
  Badge,
  Popup,
  List,
  Tabs,
  Swiper,
} from "antd-mobile";
import type { SwiperRef } from "antd-mobile/es/components/swiper";
import { db, type Book } from "../../db/indexedDB";
import { parseChapters } from "../../utils/txtParser";
import { readFileWithEncodingFallback } from "../../utils/readFileWithEncodingFallback";
import ePub from "epubjs";
import {
  AddOutline,
  CloseOutline,
  CheckOutline,
  SetOutline,
  MessageOutline,
} from "antd-mobile-icons";
import "./BookList.scss";
import Reader from "../Reader/Reader";
import EpubReader from "../Reader/EpubReader";
import BookEditor from "../BookEditor/BookEditor";
import { FiEdit, FiTrash2, FiShare2 } from "react-icons/fi";
import { downloadTxT } from "../../utils/common";
import PasscodeSetting from "./Setting/PasscodeSetting";
import CheckVersion from "./Setting/CheckVersion";
import Footer from "../../components/Footer";
import { getTabSwipeLocked } from "../../utils/storage";

const LONG_PRESS_MS = 500;

const tabItems = [
  { key: "txt", title: "TXT" },
  { key: "epub", title: "EPUB" },
];

const BookList: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pressTimer, setPressTimer] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [readerOpen, setReaderOpen] = useState(false);
  const [activeBookId, setActiveBookId] = useState<number | null>(null);
  const [activeBookType, setActiveBookType] = useState<"txt" | "epub">("txt");

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editBookId, setEditBookId] = useState<number | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const [activeTabKey, setActiveTabKey] = useState("txt");
  const swiperRef = useRef<SwiperRef>(null);

  const [isSwipeLocked, setIsSwipeLocked] = useState(getTabSwipeLocked());

  const loadBooks = async () => {
    const allBooks = await db.books.toCollection().sortBy("lookedAt");
    allBooks.reverse();
    setBooks(allBooks as Book[]);
  };

  useEffect(() => {
    loadBooks();
  }, []);

  // === Header 狀態 ===
  const currentTabBooks = useMemo(() => {
    return books.filter((b) => (activeTabKey === "epub" ? b.type === "epub" : b.type !== "epub"));
  }, [books, activeTabKey]);

  const allSelectableIds = useMemo(
    () =>
      currentTabBooks
        .map((b) => b.id!)
        .filter((id): id is number => typeof id === "number"),
    [currentTabBooks]
  );

  const isAllSelected =
    allSelectableIds.length > 0 &&
    allSelectableIds.every((id) => selectedIds.has(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allSelectableIds));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  // === 上傳 ===
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (file.name.toLowerCase().endsWith(".epub")) {
        const arrayBuffer = await file.arrayBuffer();
        const title = file.name.replace(/\.epub$/i, "");

        let coverBase64 = "";
        let locationsStr = "";

        const toastHandler = Toast.show({
          icon: "loading",
          content: "解析電子書進度與書封中...",
          duration: 0,
          maskClickable: false,
        });

        try {
          const epubBook = ePub(arrayBuffer);
          await epubBook.ready;

          const coverUrl = await epubBook.coverUrl();
          if (coverUrl) {
            const res = await fetch(coverUrl);
            const blob = await res.blob();
            coverBase64 = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          }

          // Generate locations
          await epubBook.locations.generate(500);
          locationsStr = JSON.stringify(epubBook.locations.save());

          epubBook.destroy();
        } catch (e) {
          console.warn("解析 EPUB 發生錯誤", e);
        } finally {
          toastHandler.close();
        }

        await db.books.add({
          title,
          content: "",
          chapters: [],
          type: "epub",
          fileData: arrayBuffer,
          cover: coverBase64,
          locationsDB: locationsStr,
          percent: 0,
          totalScrollablePx: 0,
          progressPx: 0,
          lookedAt: Date.now(),
        });
        Toast.show({ content: "EPUB 上傳成功", icon: "success" });
        setActiveTabKey("epub");
        swiperRef.current?.swipeTo(1);
      } else {
        const text = await readFileWithEncodingFallback(file);
        const title = file.name.replace(/\.txt$/i, "");
        const chapters = parseChapters(text);

        await db.books.add({
          title,
          content: text,
          type: "txt",
          percent: 0,
          totalScrollablePx: 0,
          progressPx: 0,
          chapters,
          lookedAt: Date.now(),
        });
        Toast.show({ content: "TXT 上傳成功", icon: "success" });
        setActiveTabKey("txt");
        swiperRef.current?.swipeTo(0);
      }

      await loadBooks();
    } catch (err) {
      console.error("上傳錯誤", err);
      Toast.show({ content: "讀取檔案失敗", icon: "fail" });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // === 刪除 ===
  const handleDelete = async () => {
    if (selectedIds.size === 0) {
      Toast.show({ content: "請先選取要刪除的書籍" });
      return;
    }
    const count = selectedIds.size;
    const result = await Dialog.confirm({
      content: `確定刪除選取的 ${count} 本書嗎？刪除後無法復原。`,
      confirmText: "刪除",
      cancelText: "取消",
    });
    if (!result) return;

    try {
      await db.books.bulkDelete(Array.from(selectedIds));
      Toast.show({ content: "刪除完成", icon: "success" });
      await loadBooks();
      exitSelectMode();
    } catch (e) {
      console.error(e);
      Toast.show({ content: "刪除失敗", icon: "fail" });
    }
  };

  // === 卡片互動（短按/長按） ===
  const startPressTimer = (bookId?: number) => {
    if (!bookId) return;
    const timer = window.setTimeout(() => {
      setSelectMode(true);
      setSelectedIds((prev) => new Set(prev).add(bookId));
    }, LONG_PRESS_MS);
    setPressTimer(timer);
  };

  const clearPressTimer = () => {
    if (pressTimer) {
      window.clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  const handleTouchMove = () => {
    clearPressTimer();
  };

  const openReader = (book: Book) => {
    setActiveBookId(book.id!);
    setActiveBookType(book.type === "epub" ? "epub" : "txt");
    setReaderOpen(true);
  };
  const closeReader = () => {
    setReaderOpen(false);
  };

  const onCardClick = (book: Book) => {
    if (selectMode) {
      if (!book.id && book.id !== 0) return;
      const next = new Set(selectedIds);
      if (next.has(book.id!)) next.delete(book.id!);
      else next.add(book.id!);
      setSelectedIds(next);
    } else {
      openReader(book);
    }
  };

  // === 百分比顯示（優先用 percent） ===
  const calcPercent = (book: Book) => {
    if (typeof book.percent === "number") {
      return Math.max(0, Math.min(100, Math.round(book.percent)));
    }
    if (
      typeof book.totalScrollablePx === "number" &&
      book.totalScrollablePx > 0 &&
      typeof book.progressPx === "number"
    ) {
      return Math.min(
        100,
        Math.round((book.progressPx / book.totalScrollablePx) * 100),
      );
    }
    return 0;
  };

  const renderBookGrid = (bookList: Book[]) => (
    <div className="book-grid">
      {bookList.map((book) => {
        const readPercent = calcPercent(book);
        const checked = book.id ? selectedIds.has(book.id) : false;

        return (
          <div
            key={book.id}
            className={`book-card ${selectMode ? "select-mode" : ""} ${checked ? "selected" : ""
              }`}
            onClick={() => onCardClick(book)}
            onMouseDown={() => startPressTimer(book.id)}
            onMouseUp={clearPressTimer}
            onMouseLeave={clearPressTimer}
            onTouchStart={() => startPressTimer(book.id)}
            onTouchMove={handleTouchMove}
            onTouchEnd={clearPressTimer}
          >
            {selectMode && (
              <Badge
                content={checked ? <CheckOutline /> : null}
                color={checked ? "var(--adm-color-primary)" : "#d9d9d9"}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              />
            )}

            {book.type === "epub" && book.cover ? (
              <div className="book-cover">
                <img src={book.cover} alt={book.title} />
              </div>
            ) : (
              <div className="book-title">{book.title}</div>
            )}

            <div className="book-progress">
              <ProgressBar
                percent={readPercent}
                style={{ "--track-width": "4px" }}
              />
              <span>{`已閱讀 ${readPercent}%`}</span>
              {book.lookedAt && (
                <div className="book-looked-at">
                  {new Date(book.lookedAt).toLocaleString("zh-TW", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className="book-list-container"
      style={{ paddingBottom: selectMode ? 56 : 0, display: "flex", flexDirection: "column", height: "100dvh" }}
    >
      {/* ===== Header ===== */}
      {!selectMode ? (
        <NavBar
          backIcon={false}
          left={
            <span
              role="button"
              onClick={() => setSettingsVisible(true)}
              style={{ fontSize: 22, display: "flex", alignItems: "center" }}
            >
              <SetOutline />
            </span>
          }
          right={
            <>
              <span
                role="button"
                aria-label="上傳書籍"
                onClick={() => fileInputRef.current?.click()}
                style={{ display: "inline-flex", alignItems: "center" }}
              >
                <AddOutline fontSize={22} />
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.epub"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </>
          }
        >
          📚 我的書庫
        </NavBar>
      ) : (
        <NavBar
          backIcon={false}
          left={
            <span
              role="button"
              onClick={exitSelectMode}
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <CloseOutline fontSize={20} />
            </span>
          }
          right={
            <span
              role="button"
              onClick={toggleSelectAll}
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <CheckOutline />
              {isAllSelected ? "取消全選" : "全選"}
            </span>
          }
        >
          已選 {selectedIds.size}
        </NavBar>
      )}

      {/* ===== Tabs & Swiper ===== */}
      <Tabs
        activeKey={activeTabKey}
        onChange={(key) => {
          setActiveTabKey(key);
          swiperRef.current?.swipeTo(tabItems.findIndex((t) => t.key === key));
          exitSelectMode();
        }}
      >
        {tabItems.map((item) => (
          <Tabs.Tab title={item.title} key={item.key} />
        ))}
      </Tabs>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Swiper
          direction="horizontal"
          indicator={() => null}
          ref={swiperRef}
          defaultIndex={0}
          allowTouchMove={!isSwipeLocked}
          onIndexChange={(index) => {
            setActiveTabKey(tabItems[index].key);
            exitSelectMode();
          }}
          style={{ height: '100%' }}
        >
          <Swiper.Item style={{ overflowY: 'auto' }}>
            {renderBookGrid(books.filter((b) => b.type !== "epub"))}
          </Swiper.Item>
          <Swiper.Item style={{ overflowY: 'auto' }}>
            {renderBookGrid(books.filter((b) => b.type === "epub"))}
          </Swiper.Item>
        </Swiper>
      </div>

      <Footer />

      {/* ===== 底部刪除列（選取模式顯示） ===== */}
      {selectMode && (
        <div className="bottom-action-bar" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {selectedIds.size === 1 && activeTabKey === "txt" && (
            <button
              className="action-btn edit-btn"
              onClick={() => {
                const onlyId = Array.from(selectedIds)[0];
                setEditBookId(onlyId);
                setEditModalOpen(true);
              }}
              aria-label="編輯"
            >
              <FiEdit />
              <span>編輯</span>
            </button>
          )}

          {selectedIds.size === 1 && activeTabKey === "txt" && (
            <button
              className="action-btn share-btn"
              onClick={() => {
                if (selectedIds.size === 0) {
                  Toast.show({ content: "請先選取要分享的書籍" });
                  return;
                }
                const selectedId = Array.from(selectedIds)[0];
                const book = books.find((b) => b.id === selectedId);

                if (!book) {
                  Toast.show({ content: "找不到書籍", icon: "fail" });
                  return;
                }
                downloadTxT(book.title, book.content);
                Toast.show({ content: "分享成功", icon: "success" });
              }}
              aria-label="分享"
            >
              <FiShare2 />
              <span>分享</span>
            </button>
          )}

          <button
            className="action-btn delete-btn"
            onClick={handleDelete}
            aria-label="刪除"
          >
            <FiTrash2 />
            <span>刪除</span>
          </button>
        </div>
      )}

      <Popup
        position="right"
        visible={readerOpen}
        onMaskClick={closeReader}
        onClose={closeReader}
        disableBodyScroll={false}
        bodyStyle={{
          height: "100dvh",
          width: "100vw",
          padding: 0,
          background: "#fff",
        }}
        maskStyle={{ background: "rgba(0,0,0,0.45)" }}
        destroyOnClose
      >
        {activeBookId != null && activeBookType === "epub" && (
          <EpubReader
            bookId={activeBookId}
            onClose={() => {
              closeReader();
              loadBooks();
            }}
          />
        )}
        {activeBookId != null && activeBookType === "txt" && (
          <Reader
            bookId={activeBookId}
            onClose={() => {
              closeReader();
              loadBooks();
            }}
          />
        )}
      </Popup>

      {/* 編輯書籍的彈窗 */}
      <Popup
        visible={editModalOpen}
        onMaskClick={() => setEditModalOpen(false)}
        onClose={() => setEditModalOpen(false)}
        destroyOnClose
        showCloseButton={false}
        disableBodyScroll={false}
        bodyStyle={{
          height: "100dvh",
          width: "100vw",
          padding: 0,
          background: "#fff",
        }}
      >
        {editBookId != null && (
          <BookEditor
            bookId={editBookId}
            onClose={() => {
              setEditModalOpen(false);
              setEditBookId(null);
              loadBooks();
              exitSelectMode();
            }}
          />
        )}
      </Popup>

      <Popup
        visible={settingsVisible}
        onMaskClick={() => {
          setSettingsVisible(false);
          setIsSwipeLocked(getTabSwipeLocked());
        }}
        onClose={() => {
          setSettingsVisible(false);
          setIsSwipeLocked(getTabSwipeLocked());
        }}
        className="setting-popup"
        bodyStyle={{
          borderTopLeftRadius: "12px",
          borderTopRightRadius: "12px",
          height: "80vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#f7f7f7",
        }}
      >
        <NavBar
          backArrow={false}
          right={
            <CloseOutline
              onClick={() => setSettingsVisible(false)}
              style={{
                fontSize: 20,
                color: "#fff",
                padding: "4px",
                borderRadius: "50%",
                background: "#000",
              }}
            />
          }
          style={{
            borderBottom: "1px solid #f0f0f0",
            textAlign: "center",
            fontWeight: "bold",
          }}
        >
          設定
        </NavBar>

        <List>
          <CheckVersion />
          <List.Item
            prefix={<MessageOutline />}
            onClick={() => {
              const subject = encodeURIComponent("淵淵閱讀 - 問題反饋");
              const body = encodeURIComponent(
                "\n\n---\n裝置資訊: " + navigator.userAgent,
              );
              window.location.href = `mailto:smr24425@gmail.com?subject=${subject}&body=${body}`;
            }}
            clickable
          >
            問題反饋
          </List.Item>
        </List>

        <PasscodeSetting />

        <List>
          <List.Item extra={`v${"1.0.0"}`}>
            當前版本
          </List.Item>
        </List>
      </Popup>
    </div>
  );
};

export default BookList;
