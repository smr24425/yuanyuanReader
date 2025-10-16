import React, { useEffect, useRef, useState, useMemo } from "react";
import { Toast, ProgressBar, Dialog, NavBar, Badge, Popup } from "antd-mobile";
import { db, type Book } from "../../db/indexedDB";
import { parseChapters } from "../../utils/txtParser";
import { readFileWithEncodingFallback } from "../../utils/readFileWithEncodingFallback";
import { AddOutline, CloseOutline, CheckOutline } from "antd-mobile-icons";
import "./BookList.scss";
import Reader from "../Reader/Reader";
import BookEditor from "../BookEditor/BookEditor";
import { FiEdit, FiTrash2, FiShare2 } from "react-icons/fi";
import { downloadTxT } from "../../utils/common";

const LONG_PRESS_MS = 500;

const BookList: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pressTimer, setPressTimer] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [activeBookId, setActiveBookId] = useState<number | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editBookId, setEditBookId] = useState<number | null>(null);

  const loadBooks = async () => {
    const allBooks = await db.books.toCollection().sortBy("lookedAt");
    allBooks.reverse();
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
        lookedAt: Date.now(),
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
      typeof book.progressPx === "number"
    ) {
      return Math.min(
        100,
        Math.round((book.progressPx / book.totalScrollablePx) * 100)
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

      {/* ===== 底部刪除列（選取模式顯示） ===== */}
      {selectMode && (
        <div className="bottom-action-bar">
          {selectedIds.size === 1 && (
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

          {selectedIds.size === 1 && (
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
        position="right" // 這裡設成 right，從右側滑入
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

      {/* 編輯書籍的彈窗 */}
      <Popup
        visible={editModalOpen}
        onMaskClick={() => setEditModalOpen(false)}
        onClose={() => setEditModalOpen(false)}
        destroyOnClose
        showCloseButton={false}
        bodyStyle={{
          height: "100vh",
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
              loadBooks(); // 儲存後刷新書籍列表
              exitSelectMode(); // 離開選取模式
            }}
          />
        )}
      </Popup>
    </div>
  );
};

export default BookList;
