// src/App.tsx
import AppLock from "./components/AppLock";
import BookList from "./pages/BookList/BookList";

const App = () => (
  <>
    <AppLock>
      <BookList />
    </AppLock>
  </>
);

export default App;
