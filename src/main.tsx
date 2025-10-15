import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import "antd-mobile/es/global"; // antd-mobile 全局樣式
import { unstableSetRender } from "antd-mobile";
import { registerSW } from "virtual:pwa-register";
registerSW(); // 啟動自動註冊的 service worker

unstableSetRender((node, container: any) => {
  container._reactRoot ||= createRoot(container);
  const root = container._reactRoot;
  root.render(node);
  return async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    root.unmount();
  };
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
