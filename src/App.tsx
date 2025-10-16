// src/App.tsx
import Footer from "./components/footer";
import BookList from "./pages/BookList/BookList";
import { SafeArea } from "antd-mobile";

const App = () => (
  <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
    <SafeArea position="top" />
    <BookList />
    <Footer />
    <SafeArea position="bottom" />
  </div>
);

export default App;
