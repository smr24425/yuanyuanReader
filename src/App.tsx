// src/App.tsx
import AppLock from "./components/AppLock";
import Footer from "./components/Footer";
import BookList from "./pages/BookList/BookList";
import { SafeArea } from "antd-mobile";

const App = () => (
  <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
    <AppLock>
      <SafeArea position="top" />
      <BookList />
      <Footer />
      <SafeArea position="bottom" />
    </AppLock>
  </div>
);

export default App;
