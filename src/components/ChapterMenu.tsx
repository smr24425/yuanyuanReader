import React, { useEffect } from "react";
import { Popup, List } from "antd-mobile";

export interface Chapter {
  title: string;
  index: number;
}

interface ChapterMenuProps {
  visible: boolean;
  onClose: () => void;
  chapters: Chapter[];
  onSelect: (index: number) => void;
  currentChapterIndex: number;
}

const ChapterMenu: React.FC<ChapterMenuProps> = ({
  visible,
  onClose,
  chapters,
  onSelect,
  currentChapterIndex,
}) => {
  useEffect(() => {
    requestAnimationFrame(() => {
      if (visible) {
        const el = document.getElementById(`ch-menu-${currentChapterIndex}`);
        if (el) {
          el.scrollIntoView({ behavior: "auto", block: "center" });
        }
      }
    });
  }, [visible, currentChapterIndex]);

  return (
    <Popup
      visible={visible}
      position="left"
      onMaskClick={onClose}
      bodyStyle={{ width: "70vw", height: "100vh", overflowY: "auto" }}
    >
      <List header="章節選單">
        {chapters.map((ch, i) => (
          <List.Item
            key={i}
            onClick={() => {
              onSelect(i);
              onClose();
            }}
            style={{
              color: i === currentChapterIndex ? "#1677ff" : undefined,
              fontWeight: i === currentChapterIndex ? "bold" : undefined,
            }}
          >
            {/* 外包一層 div 來加 id */}
            <div id={`ch-menu-${i}`}>{ch.title}</div>
          </List.Item>
        ))}
      </List>
    </Popup>
  );
};

export default ChapterMenu;
