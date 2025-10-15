import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

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
      injectRegister: "auto",
      registerType: "autoUpdate",
    }),
  ],
});
