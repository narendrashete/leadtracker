import { useState } from 'react';

const STATUS_BADGE = {
  'In-Process': 'badge-blue',
  'Customer is taking longer time to close': 'badge-amber',
  'Customer is closing in next week': 'badge-sky',
  'Closed with success': 'badge-green',
  'Dropped enquiry': 'badge-red',
};

const COLUMNS = [
  { key: 'enquiry_id', label: 'Enquiry ID' },
  { key: 'date', label: 'Date' },
  { key: 'company_name', label: 'Company' },
  { key: 'contact_person', label: 'Contact Person' },
  { key: 'contact_no', label: 'Contact No.' },
  { key: 'email', label: 'Email' },
  { key: 'required_software', label: 'Required Software' },
  { key: 'status', label: 'Status' },
  { key: 'next_followup_date', label: 'Next Follow-up' },
  { key: 'followup_count', label: 'Follow-ups' },
];

function toCSV(rows) {
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = COLUMNS.map(c => escape(c.label)).join(',');
  const lines = rows.map(r => COLUMNS.map(c => escape(r[c.key])).join(','));
  return [header, ...lines].join('\r\n');
}

function downloadCSV(rows, from, to) {
  const csv = '﻿' + toCSV(rows); // BOM for Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const range = (from || to) ? `_${from || 'start'}_to_${to || 'end'}` : '';
  a.href = url;
  a.download = `leads-report${range}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DetailedReport({ leads }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filtered = leads.filter(l => {
    if (from && l.date < from) return false;
    if (to && l.date > to) return false;
    return true;
  });

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div className="form-group">
          <label>From Date</label>
          <input type="date" className="form-control" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 170 }} />
        </div>
        <div className="form-group">
          <label>To Date</label>
          <input type="date" className="form-control" value={to} onChange={e => setTo(e.target.value)} style={{ width: 170 }} />
        </div>
        {(from || to) && (
          <button className="btn btn-secondary" onClick={() => { setFrom(''); setTo(''); }}>
            Clear
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" onClick={() => downloadCSV(filtered, from, to)} disabled={filtered.length === 0}>
          ⬇ Download CSV
        </button>
      </div>

      <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>
        Showing <strong>{filtered.length}</strong> lead{filtered.length !== 1 ? 's' : ''}
        {(from || to) && ` serviced between ${from || 'start'} and ${to || 'today'}`}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              {COLUMNS.map(c => (
                <th key={c.key} style={{
                  textAlign: 'left', padding: '10px 14px',
                  fontWeight: 600, color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No leads in this period.
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => (
                <tr key={r.id} style={{ background: i % 2 ? 'var(--bg)' : 'var(--surface)' }}>
                  <td style={cellStyle}>{r.enquiry_id}</td>
                  <td style={cellStyle}>{r.date}</td>
                  <td style={{ ...cellStyle, fontWeight: 600 }}>{r.company_name}</td>
                  <td style={cellStyle}>{r.contact_person}</td>
                  <td style={cellStyle}>{r.contact_no}</td>
                  <td style={cellStyle}>{r.email}</td>
                  <td style={cellStyle}>{r.required_software}</td>
                  <td style={cellStyle}>
                    <span className={`badge ${STATUS_BADGE[r.status] || 'badge-blue'}`}>{r.status}</span>
                  </td>
                  <td style={cellStyle}>{r.next_followup_date}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{r.followup_count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cellStyle = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
  whiteSpace: 'nowrap',
  color: 'var(--text)',
};
