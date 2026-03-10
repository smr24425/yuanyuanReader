import { registerSW } from "virtual:pwa-register";
import { Dialog } from "antd-mobile";

export const updateSW = registerSW({
  // 設定為手動立即更新，而非自動。這能防止背景靜默更新。
  immediate: false,

  onNeedRefresh() {
    Dialog.confirm({
      title: "版本更新",
      content: "發現新版本，是否立即更新？",
      confirmText: "更新",
      cancelText: "稍後",
      onConfirm: () => {
        updateSW(true);
      },
      onCancel: () => {
        console.log("使用者選擇延遲更新");
      },
    });
  },
});
