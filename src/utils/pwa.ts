import { registerSW } from "virtual:pwa-register";
import { Dialog } from "antd-mobile";

export const showUpdateDialog = (): void => {
  Dialog.show({
    title: "版本更新",
    content: "發現新版本，自動進行更新。",
    actions: [
      {
        key: "confirm",
        text: "確認",
      },
    ],
    onAction: (action) => {
      if (action.key === "confirm") {
        updateSW(true);
      }
    },
    closeOnMaskClick: false,
  });
};

export const updateSW = registerSW({
  onNeedRefresh: () => {
    showUpdateDialog();
  },
});
