export default function Section({ icon, title, children }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>{title}
      </div>
      {children}
    </div>
  );
}
