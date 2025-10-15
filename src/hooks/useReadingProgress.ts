import { useEffect, useState } from "react";

export function useReadingProgress(
  containerRef: React.RefObject<HTMLElement | null>
) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const calc = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const denom = Math.max(1, scrollHeight - clientHeight); // 避免除以 0
      const raw = (scrollTop / denom) * 100;
      const atBottom = scrollHeight - (scrollTop + clientHeight) <= 2; // 容忍 2px
      setProgress(atBottom ? 100 : Math.max(0, Math.min(100, raw)));
    };

    el.addEventListener("scroll", calc, { passive: true });

    const ro = new ResizeObserver(calc);
    ro.observe(el);

    // 圖片/字型載入造成高度變化
    const onLoad = () => calc();
    window.addEventListener("load", onLoad);

    // 已載入的 <img> 不會觸發 load，再保險掃一遍
    Array.from(el.querySelectorAll("img")).forEach((img) => {
      if (!img.complete) {
        img.addEventListener("load", calc, { once: true });
        img.addEventListener("error", calc, { once: true });
      }
    });

    // 初始計算
    calc();

    return () => {
      el.removeEventListener("scroll", calc);
      ro.disconnect();
      window.removeEventListener("load", onLoad);
    };
  }, [containerRef]);

  return progress; // 0~100
}
