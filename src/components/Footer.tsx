const Footer: React.FC = () => {
  return (
    <footer
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        background: "#f7f7f7",
        textAlign: "center",
        padding: 12,
        color: "#000",
        fontSize: 12,
      }}
    >
      <div>v{__APP_VERSION__}</div>
      <div>© {new Date().getFullYear()} smr24425. All rights reserved.</div>
    </footer>
  );
};

export default Footer;
