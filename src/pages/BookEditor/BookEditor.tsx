import React, { useEffect, useRef, useState } from "react";
import { NavBar, Toast } from "antd-mobile";
import { CloseOutline, CheckOutline } from "antd-mobile-icons";
import "./BookEditor.scss";
import { db } from "../../db/indexedDB";
import { findAllMatches } from "../../utils/textSearch";

interface BookEditorProps {
  bookId: number;
  onClose: () => void;
}

const BookEditor: React.FC<BookEditorProps> = ({ bookId, onClose }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [searchIndices, setSearchIndices] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  // 讀取書籍
  useEffect(() => {
    (async () => {
      const book = await db.books.get(bookId);
      const bookContent = await db.bookContents.get(bookId);
      if (book) {
        setTitle(book.title);
        setContent(bookContent?.content || "");
      }
    })();
  }, [bookId]);

  // 儲存按鈕
  const handleSave = async () => {
    await db.books.update(bookId, { title, updatedAt: Date.now() });
    await db.bookContents.update(bookId, { content });
    Toast.show({ content: "保存成功", icon: "success" });
  };

  // 搜尋邏輯
  useEffect(() => {
    if (!searchKeyword) {
      setSearchIndices([]);
      setCurrentIndex(-1);
      return;
    }
    const indices = findAllMatches(content, searchKeyword);
    setSearchIndices(indices);
    setCurrentIndex(indices.length > 0 ? 0 : -1);
  }, [searchKeyword, content]);

  const focusCurrentResult = (index: number) => {
    const pos = searchIndices[index];
    if (!textareaRef.current) return;

    textareaRef.current.focus();
    textareaRef.current.setSelectionRange(pos, pos + searchKeyword.length);

    requestAnimationFrame(() => {
      const textarea = textareaRef.current!;
      const beforeText = content.slice(0, pos);
      const lineCount = beforeText.split("\n").length;
      const lineHeight = 24;
      const targetScrollTop =
        (lineCount - 1) * lineHeight - textarea.clientHeight / 2;
      textarea.scrollTop = targetScrollTop > 0 ? targetScrollTop : 0;
    });
  };

  // 下一個搜尋結果
  const goNext = () => {
    if (searchIndices.length === 0) return;
    setCurrentIndex((prev) => {
      const nextIndex = (prev + 1) % searchIndices.length;
      focusCurrentResult(nextIndex); // ✅ 加在這裡
      return nextIndex;
    });
  };

  // 上一個搜尋結果
  const goPrev = () => {
    if (searchIndices.length === 0) return;
    setCurrentIndex((prev) => {
      const nextIndex =
        (prev - 1 + searchIndices.length) % searchIndices.length;
      focusCurrentResult(nextIndex); // ✅ 加在這裡
      return nextIndex;
    });
  };

  // 一鍵全部替換
  const handleReplaceAll = () => {
    if (!searchKeyword) {
      Toast.show({ content: "請先輸入搜尋關鍵字" });
      return;
    }
    if (searchIndices.length === 0) {
      Toast.show({ content: "找不到可替換的文字" });
      return;
    }
    // 使用正規表達式替換所有搜尋關鍵字（全局）
    const regex = new RegExp(
      searchKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "g",
    );
    const newContent = content.replace(regex, replaceText);
    setContent(newContent);
    // 重置搜尋
    setSearchIndices([]);
    setCurrentIndex(-1);
    Toast.show({ content: `已全部替換成 "${replaceText}"`, icon: "success" });
  };

  return (
    <div className="book-editor">
      <NavBar
        backArrow={<CloseOutline fontSize={20} />}
        onBack={onClose}
        right={
          <CheckOutline fontSize={20} role="button" onClick={handleSave} />
        }
      >
        編輯書籍
      </NavBar>

      <div className="title-input-wrapper">
        <input
          className="title-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="輸入書名"
        />
      </div>

      {/* 搜尋欄位 */}
      <div className="search-replace-wrapper">
        <div className="search-wrapper">
          <input
            className="search-input"
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="搜尋文字"
          />
          <div className="search-buttons">
            <button onClick={goPrev} disabled={searchIndices.length === 0}>
              ↑
            </button>
            <button onClick={goNext} disabled={searchIndices.length === 0}>
              ↓
            </button>
          </div>
        </div>

        {/* 新增替換欄位 */}
        <input
          className="replace-input"
          type="text"
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          placeholder="替換文字"
        />
        <button
          className="replace-all-btn"
          onClick={handleReplaceAll}
          disabled={searchIndices.length === 0 || !replaceText}
        >
          一鍵替換全部
        </button>
      </div>

      <textarea
        ref={textareaRef}
        className="content-textarea"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
};

export default BookEditor;
