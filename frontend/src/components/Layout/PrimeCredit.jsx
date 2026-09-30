// Prime Computers logo (200x70 PNG), embedded so this file works on its own.
const PRIME_LOGO = "data:image/png;base64,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";

/** "Developed by Prime Computers" badge; the logo links to the company website. */
export function PrimeCredit() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "12px 16px",
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "currentColor",
          opacity: 0.6,
        }}
      >
        Developed by
      </span>
      <a
        href="https://www.primecomputers.co.in"
        target="_blank"
        rel="noopener noreferrer"
        title="Prime Computers"
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "4px 9px",
          borderRadius: 8,
          background: "#fff",
          border: "1px solid rgba(0, 0, 0, 0.1)",
        }}
      >
        <img src={PRIME_LOGO} alt="Prime Computers" style={{ display: "block", height: 16, width: "auto" }} />
      </a>
    </div>
  );
}
