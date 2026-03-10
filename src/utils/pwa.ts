import { registerSW } from "virtual:pwa-register";
import { Dialog } from "antd-mobile";

export const updateSW = registerSW({
  onNeedRefresh() {
    Dialog.confirm({
      content: "發現新版本，是否立即更新？",
      confirmText: "立即更新",
      onConfirm: () => updateSW(true),
    });
  },
  onOfflineReady() {
    console.log("App 已可離線使用");
  },
});
