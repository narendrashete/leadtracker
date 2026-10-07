import { useEffect, useRef, useState } from 'react';
import LeadCard from './LeadCard';

const PAGE_SIZE = 10;

const COLUMN_COLORS = {
  'Leads Received': { header: '#3B82F6', light: '#EFF6FF' },
  'Followed':       { header: '#8B5CF6', light: '#F5F3FF' },
  'Converted':      { header: '#16A34A', light: '#F0FDF4' },
  'Dropped':        { header: '#DC2626', light: '#FFF5F5' },
};

export default function BoardColumn({ title, leads, onCardClick }) {
  const colors = COLUMN_COLORS[title] || { header: '#64748B', light: '#F8FAFC' };
  const [visible, setVisible] = useState(PAGE_SIZE);
  const bodyRef = useRef(null);
  const sentinelRef = useRef(null);
  const hasMore = visible < leads.length;

  // Reveal the next page when the bottom of the column's scroll area comes into view.
  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(v => v + PAGE_SIZE); },
      { root: bodyRef.current, rootMargin: '120px' }
    );
    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [hasMore, visible]);

  return (
    <div style={{
      flex: '1 1 0',
      minWidth: 240,
      maxWidth: 320,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 14px',
        borderRadius: '10px 10px 0 0',
        background: colors.header,
        color: '#fff',
      }}>
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{title}</span>
        <span style={{
          background: 'rgba(255,255,255,0.25)',
          borderRadius: 12,
          padding: '1px 9px',
          fontSize: 12,
          fontWeight: 600,
        }}>
          {leads.length}
        </span>
      </div>

      <div ref={bodyRef} style={{
        maxHeight: 'calc(100vh - 190px)',
        overflowY: 'auto',
        background: colors.light,
        border: '1px solid var(--border)',
        borderTop: 'none',
        borderRadius: '0 0 10px 10px',
        padding: '12px 10px',
        flex: 1,
        minHeight: 120,
      }}>
        {leads.length === 0 ? (
          <div style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 13,
            padding: '24px 0',
          }}>
            No leads here
          </div>
        ) : (
          leads.slice(0, visible).map(lead => (
            <LeadCard key={lead.id} lead={lead} onClick={onCardClick} />
          ))
        )}
        {hasMore && (
          <div ref={sentinelRef}
            onClick={() => setVisible(v => v + PAGE_SIZE)}
            style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: '8px 0', cursor: 'pointer' }}>
            Showing {visible} of {leads.length} — scroll or click for more
          </div>
        )}
      </div>
    </div>
  );
}
