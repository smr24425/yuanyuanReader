import React, { useEffect, useState } from "react";

interface ReaderFooterBgColorProps {
  bgColor: string;
  textColor: string;
  onChange: (bgColor: string, textColor: string) => void;
}

const ReaderFooterBgColor: React.FC<ReaderFooterBgColorProps> = ({
  bgColor,
  textColor,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempBg, setTempBg] = useState(bgColor);
  const [tempText, setTempText] = useState(textColor);

  useEffect(() => {
    setTempBg(bgColor);
    setTempText(textColor);
  }, [bgColor, textColor]);

  const PRESET_COLORS = [
    { bg: "#000000", text: "#ffffff", label: "黑底白字" },
    { bg: "#ffffff", text: "#000000", label: "白底黑字" },
    { bg: "#FAF3E0", text: "#333333", label: "淺米底深灰字" },
  ];

  function onSelectPreset(preset: (typeof PRESET_COLORS)[0]) {
    setTempBg(preset.bg);
    setTempText(preset.text);
  }

  function onConfirm() {
    onChange(tempBg, tempText);
    setIsOpen(false);
  }

  return (
    <>
      <div className="reader-footer__bg-color">
        <div
          className="color-preview"
          style={{
            backgroundColor: bgColor,
            color: textColor,
            width: 80,
            height: 26,
            borderColor: "1px solid",
          }}
          onClick={() => setIsOpen(true)}
          title="點擊自訂背景與文字顏色"
        >
          A
        </div>
      </div>

      {isOpen && (
        <div
          className="color-picker-modal"
          onClick={() => setIsOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="modal-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="背景與文字顏色設定"
            style={{
              backgroundColor: "#fff",
              color: "#222", // 確保文字是深色的
              borderRadius: 16,
              padding: 24,
              width: "min(560px, 90vw)",
              boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
              fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 16, fontWeight: "600" }}>
              選擇背景與文字顏色
            </h3>

            <div
              className="preset-colors"
              style={{
                display: "flex",
                gap: 12,
                marginBottom: 24,
              }}
            >
              {PRESET_COLORS.map((preset) => (
                <div
                  key={preset.label}
                  className={`preset ${
                    tempBg === preset.bg && tempText === preset.text
                      ? "selected"
                      : ""
                  }`}
                  style={{
                    backgroundColor: preset.bg,
                    color: preset.text,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontWeight: "bold",
                    userSelect: "none",
                    width: 50,
                    height: 50,
                    borderRadius: 8,
                    cursor: "pointer",
                    border:
                      tempBg === preset.bg && tempText === preset.text
                        ? "3px solid #6658CA"
                        : "1px solid #ccc",
                  }}
                  onClick={() => onSelectPreset(preset)}
                  title={preset.label}
                >
                  A
                </div>
              ))}
            </div>

            <div
              className="custom-inputs"
              style={{
                display: "flex",
                gap: 24,
                marginBottom: 24,
                alignItems: "center",
              }}
            >
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontSize: 14,
                  color: "#444",
                }}
              >
                背景顏色
                <input
                  type="color"
                  value={tempBg}
                  onChange={(e) => setTempBg(e.target.value)}
                  style={{ marginTop: 6, cursor: "pointer" }}
                />
              </label>

              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontSize: 14,
                  color: "#444",
                }}
              >
                文字顏色
                <input
                  type="color"
                  value={tempText}
                  onChange={(e) => setTempText(e.target.value)}
                  style={{ marginTop: 6, cursor: "pointer" }}
                />
              </label>
            </div>

            <div
              className="actions"
              style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}
            >
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  padding: "6px 12px",
                  fontSize: 14,
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                  color: "#666",
                }}
              >
                取消
              </button>
              <button
                onClick={onConfirm}
                style={{
                  padding: "6px 12px",
                  fontSize: 14,
                  borderRadius: 6,
                  border: "none",
                  backgroundColor: "#6658CA",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                確定
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReaderFooterBgColor;
