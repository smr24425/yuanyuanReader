// db/indexedDB.ts
import Dexie, { type Table } from "dexie";

export interface Book {
  id?: number;
  type?: "txt" | "epub";
  cover?: string; // base64 string or blob URL
  title: string;
  chapters: { title: string }[];
  progressPx?: number;
  totalScrollablePx?: number;
  percent?: number; // 0~100
  progressCfi?: string;
  updatedAt?: number;
  lookedAt: number;
}

export interface BookContent {
  bookId: number;
  content: string; // 用於 TXT
  fileData?: ArrayBuffer; // 用於 EPUB
  locationsDB?: string; // Cached JSON string of generated locations
}

class MyDB extends Dexie {
  books!: Table<Book, number>;
  bookContents!: Table<BookContent, number>;

  constructor() {
    super("mydb");
    // 版本升級：新增欄位不用變 index 定義即可寫入
    this.version(2)
      .stores({
        books: "++id,title", // 這裡的索引不必列出新欄位
      })
      .upgrade((tx) => {
        return tx
          .table("books")
          .toCollection()
          .modify((b: any) => {
            if (b.percent === undefined) b.percent = 0;
            if (b.lookedAt === undefined) b.lookedAt = 0;
          });
      });

    this.version(3).upgrade((tx) => {
      return tx
        .table("books")
        .toCollection()
        .modify((b: any) => {
          if (b.type === undefined) b.type = "txt";
        });
    });

    // 版本 4：拆分 bookContents
    this.version(4)
      .stores({
        books: "++id,title", // 保持不變
        bookContents: "bookId", // 新表以 bookId 作為 PK
      })
      .upgrade(async (tx) => {
        const booksArray = await tx.table("books").toArray();
        const bookContentsData = booksArray.map((b: any) => ({
          bookId: b.id,
          content: b.content || "",
          fileData: b.fileData,
          locationsDB: b.locationsDB,
        }));

        if (bookContentsData.length > 0) {
          await tx.table("bookContents").bulkPut(bookContentsData);
        }

        return tx.table("books").toCollection().modify((b: any) => {
          delete b.content;
          delete b.fileData;
          delete b.locationsDB;
        });
      });
  }
}

export const db = new MyDB();
