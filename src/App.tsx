// src/App.tsx
import BookList from "./components/BookList";
import { SafeArea } from "antd-mobile";

const App = () => (
  <>
    <SafeArea position="top" />
    <BookList />
    <SafeArea position="bottom" />
  </>
);

export default App;
