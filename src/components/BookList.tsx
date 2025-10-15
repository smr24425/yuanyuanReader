import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Toast,
  ProgressBar,
  Dialog,
  NavBar,
  Checkbox,
  Badge,
  Popup,
} from "antd-mobile";
import { useNavigate } from "react-router-dom";
import { db } from "../db/indexedDB";
import { parseChapters } from "../utils/txtParser";
import { readFileWithEncodingFallback } from "../utils/readFileWithEncodingFallback";
import {
  AddOutline,
  DeleteOutline,
  CloseOutline,
  CheckOutline,
} from "antd-mobile-icons";
import "./BookList.css";
import Reader from "./Reader";

interface Book {
  id?: number;
  title: string;
  content: string;
  // 舊欄位（像素）：仍保留相容
  progress?: number;
  // 新欄位（建議 Reader.tsx onScroll 持續寫入）
  percent?: number; // 0~100
  totalScrollablePx?: number;
  progressPx?: number;
  chapters: { title: string; index: number }[];
}

const LONG_PRESS_MS = 500;

const BookList: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pressTimer, setPressTimer] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [activeBookId, setActiveBookId] = useState<number | null>(null);

  const loadBooks = async () => {
    const allBooks = await db.books.toArray();
    setBooks(allBooks as Book[]);
  };

  useEffect(() => {
    loadBooks();
  }, []);

  // === Header 狀態 ===
  const allSelectableIds = useMemo(
    () =>
      books
        .map((b) => b.id!)
        .filter((id): id is number => typeof id === "number"),
    [books]
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
      const text = await readFileWithEncodingFallback(file);
      const title = file.name.replace(/\.txt$/i, "");
      const chapters = parseChapters(text);

      await db.books.add({
        title,
        content: text,
        // 初始化新欄位（首頁用 percent 顯示）
        percent: 0,
        totalScrollablePx: 0,
        progressPx: 0,
        chapters,
      });

      Toast.show({ content: "書籍上傳成功", icon: "success" });
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
    // 設定計時器：超過 LONG_PRESS_MS → 進入選取模式並勾選該本
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

  // 替代 navigate 的行為
  const openReader = (bookId: number) => {
    setActiveBookId(bookId);
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
      openReader(book.id!); // ★ 不再 navigate
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
      typeof book.progress === "number"
    ) {
      return Math.min(
        100,
        Math.round((book.progress / book.totalScrollablePx) * 100)
      );
    }
    return 0;
  };

  return (
    <div
      className="book-list-container"
      style={{ paddingBottom: selectMode ? 56 : 0 }}
    >
      {/* ===== Header ===== */}
      {!selectMode ? (
        <NavBar
          backArrow={false}
          right={
            <>
              {/* 上傳 icon */}
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
                accept=".txt"
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
          backArrow={<CloseOutline fontSize={20} />}
          onBack={exitSelectMode}
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

      {/* ===== Grid ===== */}
      <div className="book-grid">
        {books.map((book) => {
          const readPercent = calcPercent(book);
          const checked = book.id ? selectedIds.has(book.id) : false;

          return (
            <div
              key={book.id}
              className={`book-card ${selectMode ? "select-mode" : ""} ${
                checked ? "selected" : ""
              }`}
              onClick={() => onCardClick(book)}
              onMouseDown={() => startPressTimer(book.id)}
              onMouseUp={clearPressTimer}
              onMouseLeave={clearPressTimer}
              onTouchStart={() => startPressTimer(book.id)}
              onTouchEnd={clearPressTimer}
            >
              {/* 右上角勾選徽章（選取模式顯示） */}
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

              <div className="book-title">{book.title}</div>
              <div className="book-progress">
                <ProgressBar
                  percent={readPercent}
                  style={{ "--track-width": "4px" }}
                />
                <span>{`已閱讀 ${readPercent}%`}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== 底部刪除列（選取模式顯示） ===== */}
      {selectMode && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            height: 56,
            background: "#fff",
            borderTop: "1px solid #eee",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            zIndex: 10,
            color: "red",
          }}
          onClick={handleDelete}
          role="button"
          aria-label="刪除"
        >
          <DeleteOutline fontSize={20} color="red" />
          <span>刪除</span>
        </div>
      )}

      <Popup
        visible={readerOpen}
        onMaskClick={closeReader}
        onClose={closeReader}
        // 全屏
        bodyStyle={{
          height: "100vh",
          width: "100vw",
          padding: 0,
          background: "#fff",
        }}
        maskStyle={{ background: "rgba(0,0,0,0.45)" }}
        destroyOnClose
      >
        {activeBookId != null && (
          <Reader
            bookId={activeBookId}
            onClose={() => {
              closeReader();
              loadBooks();
            }}
          />
        )}
      </Popup>
    </div>
  );
};

export default BookList;
