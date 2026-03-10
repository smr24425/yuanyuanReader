import React from "react";
import { List, Toast, Dialog } from "antd-mobile";
import { LoopOutline } from "antd-mobile-icons";
import { updateSW } from "../../../utils/pwa";

const CheckVersion: React.FC = () => {
  const handleCheckUpdate = async () => {
    const handler = Toast.show({
      icon: "loading",
      content: "檢查更新中...",
      duration: 0,
      maskClickable: false,
    });

    try {
      await updateSW();

      await new Promise((resolve) => setTimeout(resolve, 800));

      const registration = await navigator.serviceWorker.getRegistration();
      handler.close();

      if (registration?.waiting) {
        Dialog.confirm({
          title: "版本更新",
          content: "發現新版本，是否立即更新？",
          confirmText: "更新",
          cancelText: "稍後",
          onConfirm: () => {
            updateSW(true);
          },
          onCancel: () => {
            console.log("取消更新");
          },
        });
      } else {
        Toast.show({
          content: "目前已是最新版本",
          icon: "success",
        });
      }
    } catch (error) {
      handler.close();
      Toast.show({
        content: "檢查失敗，請稍後再試",
        icon: "fail",
      });
    }
  };

  return (
    <List.Item prefix={<LoopOutline />} onClick={handleCheckUpdate} clickable>
      檢查更新
    </List.Item>
  );
};

export default CheckVersion;
