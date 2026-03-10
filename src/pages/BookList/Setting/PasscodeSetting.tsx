import React, { useState } from "react";
import { List, Switch, Dialog, Toast, Input } from "antd-mobile";
import { LockOutline, EditSOutline } from "antd-mobile-icons";
import {
  getPasscodeEnabled,
  setPasscodeEnabled,
  getAppPasscode,
  setAppPasscode,
  removePasscode,
} from "../../../utils/storage";

const PasscodeSetting: React.FC = () => {
  // 從儲存層讀取初始狀態
  const [isEnabled, setIsEnabled] = useState<boolean>(getPasscodeEnabled());
  const [hasPasscode, setHasPasscode] = useState<boolean>(!!getAppPasscode());

  /**
   * 彈出密碼設定對話框
   * @param onSuccess 成功設定後的回調
   * @param onCancel 取消設定後的回調
   */
  const showSetPasscodeDialog = (
    onSuccess?: () => void,
    onCancel?: () => void,
  ) => {
    let tempPasscode = "";

    Dialog.confirm({
      title: "設定 4 位數密碼",
      content: (
        <div style={{ padding: "10px 0" }}>
          <Input
            type="password"
            placeholder="請輸入數字密碼"
            clearable
            maxLength={4}
            onChange={(val) => {
              tempPasscode = val;
            }}
            style={{
              "--font-size": "24px",
              textAlign: "center",
              borderBottom: "2px solid #eee",
              paddingBottom: "8px",
            }}
          />
          <div
            style={{
              color: "#999",
              fontSize: "12px",
              marginTop: "12px",
              textAlign: "center",
            }}
          >
            設定後，重新進入 App 需驗證此密碼
          </div>
        </div>
      ),
      onConfirm: async () => {
        if (tempPasscode.length < 4) {
          Toast.show("密碼必須為 4 位數");
          return Promise.reject(); // 阻止 Dialog 關閉
        }
        setAppPasscode(tempPasscode);
        setHasPasscode(true);
        Toast.show({ icon: "success", content: "設定成功" });
        onSuccess?.();
      },
      onCancel: () => {
        onCancel?.();
      },
    });
  };

  /**
   * 處理開關切換
   */
  const handleToggle = (val: boolean) => {
    // 如果想開啟但「從未設定過」密碼，強制先設定
    if (val && !getAppPasscode()) {
      showSetPasscodeDialog(
        () => {
          setPasscodeEnabled(true);
          setIsEnabled(true);
        },
        () => {
          // 如果取消設定密碼，開關保持關閉
          setIsEnabled(false);
        },
      );
      return;
    }

    // 正常切換
    setPasscodeEnabled(val);
    setIsEnabled(val);
    if (val) {
      Toast.show({ content: "已啟用密碼保護", icon: "success" });
    } else {
      removePasscode();
    }
  };

  return (
    <List>
      <List.Item
        prefix={<LockOutline />}
        extra={
          <Switch
            checked={isEnabled}
            onChange={handleToggle}
            style={{
              "--height": "24px",
              "--width": "42px",
            }}
          />
        }
        description={isEnabled ? "App 啟動時需驗證" : "目前未受保護"}
      >
        密碼保護
      </List.Item>

      {isEnabled && (
        <List.Item
          prefix={<EditSOutline />}
          onClick={() => showSetPasscodeDialog()}
          clickable
        >
          修改存取密碼
        </List.Item>
      )}
    </List>
  );
};

export default PasscodeSetting;
