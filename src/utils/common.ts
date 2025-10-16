export const downloadTxT = (title: string, content: string) => {
  const blob = new Blob([`📖 ${title}\n\n${content}`], {
    type: "text/plain;charset=utf-8",
  });

  const safeTitle = title.replace(/[\\/:*?"<>|]/g, "_");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${safeTitle}-${timestamp}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};
