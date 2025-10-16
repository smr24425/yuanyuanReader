// src/App.tsx
import BookList from "./components/BookList";
import { SafeArea } from "antd-mobile";

const App = () => (
  <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
    <SafeArea position="top" />
    <BookList />
    <footer
      style={{
        background: "#f7f7f7",
        textAlign: "center",
        padding: 16,
        color: "#000",
        fontSize: 12,
      }}
    >
      © {new Date().getFullYear()} smr24425. All rights reserved.
    </footer>
    <SafeArea position="bottom" />
  </div>
);

export default App;
