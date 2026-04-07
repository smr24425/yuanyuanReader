import React, { useState } from "react";
import { List, Switch, Dialog, Toast, Input } from "antd-mobile";
import { LockOutline, EditSOutline } from "antd-mobile-icons";
import {
  getPasscodeEnabled,
  setPasscodeEnabled,
  getAppPasscode,
  setAppPasscode,
  removePasscode,
  getTabSwipeLocked,
  setTabSwipeLocked,
  setWebAuthnId,
  getBiometricEnabled,
} from "../../../utils/storage";
import { isWebAuthnAvailable, registerBiometric } from "../../../utils/webauthn";

const PasscodeSetting: React.FC = () => {
  // 從儲存層讀取初始狀態
  const [isPasscode, setIsPasscode] = useState<boolean>(getPasscodeEnabled());
  const [isBiometric, setIsBiometric] = useState<boolean>(getBiometricEnabled());
  const [isTabSwipeLocked, setIsTabSwipeLocked] = useState<boolean>(getTabSwipeLocked());

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
            inputMode="numeric" // 彈出數字鍵盤
            pattern="[0-9]*" // 額外確保 iOS 彈出純數字鍵盤
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
        Toast.show({ icon: "success", content: "密碼設定成功" });
        onSuccess?.();
      },
      onCancel: () => {
        onCancel?.();
      },
    });
  };

  const handleBiometricToggle = async (val: boolean) => {
    if (val) {
      if (isWebAuthnAvailable()) {
        const wantBio = await Dialog.confirm({
          title: "啟用快速解鎖",
          content: "是否要同時綁定 Face ID 或 Touch ID 進行快速解鎖？",
          confirmText: "啟用",
          cancelText: "不用了",
          onConfirm: () => {
            setIsBiometric(val);
          }
        });
        if (wantBio) {
          const credentialId = await registerBiometric();
          if (credentialId) {
            setWebAuthnId(credentialId);
            Toast.show({ icon: "success", content: "快速解鎖綁定成功" });
          } else {
            Toast.show({ icon: "fail", content: "綁定失敗或被取消" });
            setIsBiometric(false);
          }
        }
      } else {
        Toast.show({ icon: "fail", content: "不支援生物鎖" });
      }
      return
    }
    setIsBiometric(val);
  }

  /**
   * 處理開關切換
   */
  const handleToggle = (val: boolean) => {
    // 如果想開啟但「從未設定過」密碼，強制先設定
    if (val && !getAppPasscode()) {
      showSetPasscodeDialog(
        () => {
          setPasscodeEnabled(true);
          setIsPasscode(true);
        },
        () => {
          // 如果取消設定密碼，開關保持關閉
          setIsPasscode(false);
        },
      );
      return;
    }

    // 正常切換
    setPasscodeEnabled(val);
    setIsPasscode(val);
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
            checked={isPasscode}
            onChange={handleToggle}
            style={{
              "--height": "24px",
              "--width": "42px",
            }}
          />
        }
        description={isPasscode ? "App 啟動時需驗證" : "目前未受保護"}
      >
        密碼鎖
      </List.Item>

      {isPasscode && (
        <List.Item
          prefix={<EditSOutline />}
          onClick={() => showSetPasscodeDialog()}
          clickable
        >
          修改存取密碼
        </List.Item>
      )}

      <List.Item
        prefix={<LockOutline />}
        extra={
          <Switch
            checked={isBiometric}
            onChange={handleBiometricToggle}
            style={{
              "--height": "24px",
              "--width": "42px",
            }}
          />
        }
        description={isBiometric ? "App 啟動時需驗證" : "目前未受保護"}
      >
        生物鎖
      </List.Item>

      <List.Item
        extra={
          <Switch
            checked={isTabSwipeLocked}
            onChange={(val) => {
              setTabSwipeLocked(val);
              setIsTabSwipeLocked(val);
            }}
            style={{
              "--height": "24px",
              "--width": "42px",
            }}
          />
        }
        description="鎖定後無法透過滑動手勢切換書庫分頁"
      >
        鎖定書庫滑動切換
      </List.Item>
    </List>
  );
};

export default PasscodeSetting;
