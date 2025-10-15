// db/indexedDB.ts
import Dexie, { type Table } from "dexie";

export interface Book {
  id?: number;
  title: string;
  content: string;
  chapters: { title: string }[];
  progressPx?: number;
  totalScrollablePx?: number;
  percent?: number; // 0~100
  updatedAt?: number;
}

class MyDB extends Dexie {
  books!: Table<Book, number>;
  constructor() {
    super("mydb");

    // 舊版…
    // this.version(1).stores({ books: '++id,title' });

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
          });
      });
  }
}

export const db = new MyDB();
