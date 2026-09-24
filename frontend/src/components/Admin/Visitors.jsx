import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';

// Categorical slots 1 and 2 of the validated palette. Checked against a white
// card surface: CVD ΔE 24.7, normal-vision ΔE 33.6, both clear of the floors.
const VISITORS = '#2a78d6';
const VIEWS    = '#eb6834';

const RANGES = [
  { days: 7,  label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

const fmtDay   = d => { const [, m, dd] = d.split('-'); return `${dd}/${m}`; };
const fmtLong  = d => new Date(d + 'T00:00:00')
  .toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function Visitors() {
  const [days, setDays]       = useState(30);
  const [data, setData]       = useState(null);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    let live = true;
    setLoading(true);
    api.getStats(days)
      .then(d => { if (live) { setData(d); setError(''); } })
      .catch(e => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [days]);

  return (
    <div className="page">
      <h1 className="page-title" style={{ margin: '0 0 6px' }}>Visitors</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: '0 0 24px', maxWidth: '62ch' }}>
        Page views and daily visitors across the public pages and this app.
        Counted on the server, so ad blockers and private browsing do not hide anyone.
      </p>

      {error && (
        <div className="card" style={{ padding: 16, color: '#B42318', fontSize: 14 }}>{error}</div>
      )}

      {loading && !data ? (
        <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading…</div>
      ) : data && (
        <>
          <KpiRow data={data} />

          <div className="card" style={{ padding: 20, marginTop: 20 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, flexWrap: 'wrap', marginBottom: 16,
            }}>
              <Legend />
              <div style={{ display: 'flex', gap: 6 }}>
                {RANGES.map(r => (
                  <button
                    key={r.days}
                    onClick={() => setDays(r.days)}
                    style={{
                      padding: '6px 12px', fontSize: 13, borderRadius: 7, cursor: 'pointer',
                      border: `1px solid ${days === r.days ? '#2563EB' : 'var(--border)'}`,
                      background: days === r.days ? '#EFF6FF' : '#fff',
                      color: days === r.days ? '#1D4ED8' : 'var(--text-muted)',
                      fontWeight: days === r.days ? 600 : 400,
                    }}
                  >{r.label}</button>
                ))}
              </div>
            </div>

            <TrendChart series={data.daily} />

            <button
              onClick={() => setShowTable(v => !v)}
              style={{
                marginTop: 14, background: 'none', border: 'none', padding: 0,
                color: '#2563EB', fontSize: 13, cursor: 'pointer',
              }}
            >{showTable ? 'Hide the numbers' : 'Show the numbers'}</button>

            {showTable && <DailyTable series={data.daily} />}
          </div>

          <PageBreakdown pages={data.pages} days={days} />

          {data.navratri && (
            <PageBreakdown
              title="Shete Parivar Navratri — pages"
              note="aartisangrah counts every Aarti Sangrah online reader, not only those from the Navratri site"
              pages={data.navratri} days={days}
            />
          )}
        </>
      )}
    </div>
  );
}

function KpiRow({ data }) {
  const tiles = [
    { label: 'Visitors today',  value: data.today.visitors, hue: VISITORS },
    { label: 'Views today',     value: data.today.views,    hue: VIEWS },
    { label: `Visitors · ${data.period.days}d`, value: data.period.visitor_days, hue: VISITORS,
      note: 'summed per day' },
    { label: `Views · ${data.period.days}d`,    value: data.period.views,        hue: VIEWS },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
      {tiles.map(t => (
        <div key={t.label} className="card" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: t.hue, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t.label}</span>
          </div>
          <div style={{
            fontSize: 30, fontWeight: 700, color: '#1E293B', marginTop: 6,
            fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
          }}>{t.value.toLocaleString()}</div>
          {t.note && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t.note}</div>}
        </div>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)' }}>
      {[['Visitors', VISITORS], ['Views', VIEWS]].map(([label, hue]) => (
        <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 3, borderRadius: 2, background: hue }} />
          {label}
        </span>
      ))}
    </div>
  );
}

/* Two lines on one axis — both are counts of the same kind, so a second scale
   would be a lie. Hovering snaps a crosshair to the nearest day. */
function TrendChart({ series }) {
  const [hover, setHover] = useState(null);
  const W = 760, H = 240, PAD = { t: 14, r: 16, b: 26, l: 40 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const { max, ticks } = useMemo(() => {
    const peak = Math.max(1, ...series.map(d => Math.max(d.views, d.visitors)));
    const step = Math.max(1, Math.ceil(peak / 4 / 5) * 5);
    const top = step * 4;
    return { max: top, ticks: [0, step, step * 2, step * 3, top] };
  }, [series]);

  const x = i => PAD.l + (series.length === 1 ? plotW / 2 : (i / (series.length - 1)) * plotW);
  const y = v => PAD.t + plotH - (v / max) * plotH;
  const path = key => series.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join(' ');

  const last = series[series.length - 1];
  const labelStep = Math.ceil(series.length / 8);

  return (
    <div style={{ position: 'relative', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', minWidth: 420 }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={e => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - PAD.l) / plotW) * (series.length - 1));
          setHover(i >= 0 && i < series.length ? i : null);
        }}
      >
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#E8EDF3" strokeWidth="1" />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{t}</text>
          </g>
        ))}
        {/* Ticks are counted back from the newest day, so the last label always
            lands on a tick instead of colliding with the one before it. */}
        {series.map((d, i) => (series.length - 1 - i) % labelStep === 0 && (
          <text key={d.day} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#94A3B8">
            {fmtDay(d.day)}
          </text>
        ))}

        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + plotH} stroke="#CBD5E1" strokeWidth="1" />
        )}

        <path d={path('views')}    fill="none" stroke={VIEWS}    strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={path('visitors')} fill="none" stroke={VISITORS} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {hover !== null && ['views', 'visitors'].map(k => (
          <circle key={k} cx={x(hover)} cy={y(series[hover][k])} r="4.5"
                  fill={k === 'views' ? VIEWS : VISITORS} stroke="#fff" strokeWidth="2" />
        ))}

        {/* the newest point is the one worth naming, so it is labelled directly */}
        {last && [['views', VIEWS], ['visitors', VISITORS]].map(([k, hue]) => (
          <circle key={k} cx={x(series.length - 1)} cy={y(last[k])} r="3.5" fill={hue} stroke="#fff" strokeWidth="1.5" />
        ))}
      </svg>

      {hover !== null && (
        <div style={{
          position: 'absolute', top: 0,
          left: `${(x(hover) / W) * 100}%`, transform: 'translateX(-50%)',
          background: '#1E293B', color: '#fff', borderRadius: 8, padding: '8px 11px',
          fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap', lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>{fmtLong(series[hover].day)}</div>
          <div>{series[hover].visitors} visitors</div>
          <div>{series[hover].views} views</div>
        </div>
      )}
    </div>
  );
}

function DailyTable({ series }) {
  const rows = [...series].reverse().filter(d => d.views > 0);
  return (
    <div style={{ marginTop: 12, maxHeight: 300, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {['Day', 'Visitors', 'Views'].map((h, i) => (
              <th key={h} style={{
                textAlign: i ? 'right' : 'left', padding: '7px 10px', position: 'sticky', top: 0,
                background: 'var(--bg)', color: 'var(--text-muted)', fontWeight: 600,
                borderBottom: '1px solid var(--border)',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={3} style={{ padding: 16, color: 'var(--text-muted)', textAlign: 'center' }}>
              No visits recorded yet.
            </td></tr>
          ) : rows.map(d => (
            <tr key={d.day}>
              <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)' }}>{fmtLong(d.day)}</td>
              <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.visitors}</td>
              <td style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{d.views}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PageBreakdown({ pages, days, title = 'Which page', note }) {
  const peak = Math.max(1, ...pages.map(p => p.views));
  return (
    <div className="card" style={{ padding: 20, marginTop: 20 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1E293B', margin: '0 0 4px' }}>{title}</h2>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Last {days} days{note && ` · ${note}`}
      </div>
      {pages.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Nothing recorded yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {pages.map(p => (
            <div key={p.page}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                <span style={{ color: '#1E293B' }}>{p.label}</span>
                <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {p.views.toLocaleString()} views · {p.visitors.toLocaleString()} visitors
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: '#EEF2F7', overflow: 'hidden' }}>
                <div style={{ width: `${(p.views / peak) * 100}%`, height: '100%', borderRadius: 4, background: VIEWS }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
