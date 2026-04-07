import React, { useState, useEffect, useRef } from "react";
import { CenterPopup, Input, Toast, Button, Space } from "antd-mobile";
import { LockOutline, ScanCodeOutline } from "antd-mobile-icons";
import { getPasscodeEnabled, verifyPasscode, getWebAuthnId } from "../utils/storage";
import { verifyBiometric } from "../utils/webauthn";

interface AppLockProps {
  children: React.ReactNode;
}

const AppLock: React.FC<AppLockProps> = ({ children }) => {
  const [isLocked, setIsLocked] = useState(getPasscodeEnabled());
  const [inputVal, setInputVal] = useState("");
  const bioAttempted = useRef(false);
  const webAuthnId = getWebAuthnId();

  const handleBiometricUnlock = async () => {
    if (webAuthnId) {
      const valid = await verifyBiometric(webAuthnId);
      if (valid) {
        setIsLocked(false);
        Toast.show({ icon: "success", content: "快速解鎖成功" });
      } else {
        Toast.show({ icon: "fail", content: "辨識失敗，請輸入密碼" });
      }
    }
  };

  useEffect(() => {
    if (isLocked && webAuthnId && !bioAttempted.current) {
      bioAttempted.current = true;
      handleBiometricUnlock();
    }
  }, [isLocked, webAuthnId]);

  // 如果根本沒啟動密碼保護，直接過關
  if (!isLocked) {
    return <>{children}</>;
  }

  const handleVerify = () => {
    if (verifyPasscode(inputVal)) {
      setIsLocked(false);
      Toast.show({ icon: "success", content: "驗證成功" });
    } else {
      Toast.show({ icon: "fail", content: "密碼錯誤" });
      setInputVal("");
    }
  };

  return (
    <>
      {/* 當鎖定時，顯示一個無法關閉的全螢幕彈窗 */}
      <CenterPopup
        visible={isLocked}
        // maskClosable={false}
        bodyStyle={{
          width: "80vw",
          padding: "24px",
          borderRadius: "16px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Space direction="vertical" align="center" block>
            <LockOutline
              style={{ fontSize: 48, color: "var(--adm-color-primary)" }}
            />
            <div
              style={{ fontSize: "18px", fontWeight: "bold", margin: "10px 0" }}
            >
              淵淵閱讀 - 安全驗證
            </div>
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="請輸入 4 位數密碼"
              value={inputVal}
              onChange={setInputVal}
              maxLength={4}
              style={{
                "--font-size": "24px",
                textAlign: "center",
                borderBottom: "2px solid #eee",
                margin: "20px 0",
              }}
              onEnterPress={handleVerify}
            />
            <Button
              block
              onClick={handleVerify}
              style={{ borderRadius: "8px" }}
            >
              進入書庫
            </Button>
            {webAuthnId && (
              <Button
                block
                fill="none"
                color="primary"
                onClick={handleBiometricUnlock}
                style={{ borderRadius: "8px", marginTop: "8px" }}
              >
                <ScanCodeOutline style={{ marginRight: 6 }} />
                使用 Face ID / Touch ID 解鎖
              </Button>
            )}
          </Space>
        </div>
      </CenterPopup>

      {/* 只有解鎖後才會渲染真正的 BookList 內容 */}
      {!isLocked && children}
    </>
  );
};

export default AppLock;