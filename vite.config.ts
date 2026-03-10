import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import packageJson from "./package.json";

// https://vite.dev/config/
export default defineConfig({
  base: "/yuanyuanReader/", //repo name
  plugins: [
    react(),
    VitePWA({
      manifestFilename: "site.webmanifest",
      manifest: {
        name: "淵淵閱讀",
        short_name: "淵淵閱讀",
        theme_color: "#fff",
        background_color: "#000",
        display: "standalone",
        start_url: "/yuanyuanReader/",
      },
      injectRegister: null,
      registerType: "prompt",
      workbox: {
        // 核心設定：禁止新 SW 自動跳過等待與接管頁面
        skipWaiting: false,
        clientsClaim: false,
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
  },
});
