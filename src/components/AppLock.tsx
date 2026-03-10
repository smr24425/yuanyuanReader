import React, { useState } from "react";
import { CenterPopup, Input, Toast, Button, Space } from "antd-mobile";
import { LockOutline } from "antd-mobile-icons";
import { getPasscodeEnabled, verifyPasscode } from "../utils/storage";

interface AppLockProps {
  children: React.ReactNode;
}

const AppLock: React.FC<AppLockProps> = ({ children }) => {
  const [isLocked, setIsLocked] = useState(getPasscodeEnabled());
  const [inputVal, setInputVal] = useState("");

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
          </Space>
        </div>
      </CenterPopup>

      {/* 只有解鎖後才會渲染真正的 BookList 內容 */}
      {!isLocked && children}
    </>
  );
};

export default AppLock;
