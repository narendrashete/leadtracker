import { useState } from 'react';

// Same column-derivation logic used by the Pipeline Board (kept local, board untouched)
function getColumn(lead) {
  if (lead.status === 'Dropped enquiry') return 'Dropped';
  if (lead.status === 'Closed with success') return 'Converted';
  return lead.followup_count > 0 ? 'Followed' : 'Leads Received';
}

const COLUMNS = ['Leads Received', 'Followed', 'Converted', 'Dropped'];

const COLUMN_COLORS = {
  'Leads Received': '#3B82F6',
  'Followed': '#8B5CF6',
  'Converted': '#16A34A',
  'Dropped': '#DC2626',
};

const STATUS_COLORS = {
  'In-Process': '#2563EB',
  'Customer is taking longer time to close': '#D97706',
  'Customer is closing in next week': '#0EA5E9',
  'Closed with success': '#16A34A',
  'Dropped enquiry': '#DC2626',
};

const ALL_STATUSES = Object.keys(STATUS_COLORS);

function polar(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polar(cx, cy, r, endAngle);
  const end = polar(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export default function StatusPieChart({ leads }) {
  const [hovered, setHovered] = useState(null); // column name
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  // Count leads per column + status breakdown per column
  const columnData = COLUMNS.map(col => {
    const inCol = leads.filter(l => getColumn(l) === col);
    const statusBreakdown = {};
    inCol.forEach(l => {
      statusBreakdown[l.status] = (statusBreakdown[l.status] || 0) + 1;
    });
    return { column: col, count: inCol.length, statusBreakdown };
  });

  const total = leads.length;
  const cx = 120, cy = 120, r = 110;

  // Build slices (skip empty columns)
  const slices = [];
  let angle = 0;
  columnData.forEach(d => {
    if (d.count === 0) return;
    const sweep = (d.count / total) * 360;
    slices.push({ ...d, startAngle: angle, endAngle: angle + sweep });
    angle += sweep;
  });

  const hoveredData = hovered ? columnData.find(d => d.column === hovered) : null;

  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
      {/* Pie */}
      <div
        style={{ position: 'relative', flexShrink: 0 }}
        onMouseMove={e => {
          const rect = e.currentTarget.getBoundingClientRect();
          setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
      >
        {total === 0 ? (
          <div style={{
            width: 240, height: 240, borderRadius: '50%',
            border: '2px dashed var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 13,
          }}>
            No data
          </div>
        ) : (
          <svg width={240} height={240} viewBox="0 0 240 240">
            {slices.length === 1 ? (
              // single column = full circle
              <circle
                cx={cx} cy={cy} r={r}
                fill={COLUMN_COLORS[slices[0].column]}
                stroke="#fff" strokeWidth={2}
                onMouseEnter={() => setHovered(slices[0].column)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
              />
            ) : (
              slices.map(s => (
                <path
                  key={s.column}
                  d={arcPath(cx, cy, r, s.startAngle, s.endAngle)}
                  fill={COLUMN_COLORS[s.column]}
                  stroke="#fff"
                  strokeWidth={2}
                  opacity={hovered && hovered !== s.column ? 0.45 : 1}
                  onMouseEnter={() => setHovered(s.column)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                />
              ))
            )}
          </svg>
        )}

        {/* Hover tooltip */}
        {hoveredData && (
          <div style={{
            position: 'absolute',
            left: mouse.x + 14,
            top: mouse.y + 8,
            background: '#1E293B',
            color: '#fff',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 12,
            minWidth: 220,
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
            pointerEvents: 'none',
            zIndex: 10,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
              {hoveredData.column}
            </div>
            <div style={{ color: '#94A3B8', marginBottom: 8 }}>
              {hoveredData.count} lead{hoveredData.count !== 1 ? 's' : ''} ·{' '}
              {total ? Math.round((hoveredData.count / total) * 100) : 0}% of total
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
              {ALL_STATUSES.filter(s => hoveredData.statusBreakdown[s]).map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: STATUS_COLORS[s], flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{s}</span>
                  <span style={{ fontWeight: 700 }}>{hoveredData.statusBreakdown[s]}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legend (columns) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 200 }}>
        {columnData.map(d => (
          <div
            key={d.column}
            onMouseEnter={() => setHovered(d.column)}
            onMouseLeave={() => setHovered(null)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '6px 10px', borderRadius: 8,
              background: hovered === d.column ? 'var(--bg)' : 'transparent',
              cursor: 'default',
            }}
          >
            <span style={{ width: 14, height: 14, borderRadius: 4, background: COLUMN_COLORS[d.column], flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{d.column}</span>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{d.count}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12, width: 38, textAlign: 'right' }}>
              {total ? Math.round((d.count / total) * 100) : 0}%
            </span>
          </div>
        ))}
        <div style={{
          borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 2,
          display: 'flex', justifyContent: 'space-between', fontWeight: 700,
        }}>
          <span>Total</span>
          <span>{total}</span>
        </div>
      </div>
    </div>
  );
}
