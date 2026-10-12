import { useEffect, useState } from 'react';
import { readSheet } from 'read-excel-file/browser';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

const NO_CATEGORY = '__none';
const IMPORT_SOURCE = 'Internet';
const CHUNK = 2000; // keeps each request well under nginx's default 1 MB body limit

// Find each column by its header text, so a re-ordered or re-labelled export
// ("Companyt NAME", "EMAIL_ID") still lines up.
function mapColumns(header) {
  const find = re => header.findIndex(h => re.test(String(h || '')));
  return {
    company_name: find(/name|company/i),
    city: find(/city/i),
    phone: find(/phone|mobile|contact/i),
    email: find(/mail/i),
    category: find(/categ/i),
  };
}

function toContact(row, cols) {
  const cell = k => (cols[k] >= 0 ? String(row[cols[k]] ?? '').trim() : '');
  const company_name = cell('company_name');
  if (!company_name) return null;
  return {
    company_name,
    city: cell('city'),
    phone: cell('phone').replace(/\D/g, '').replace(/^0+/, ''),
    email: cell('email'),
    category: cell('category').split(',').map(s => s.trim()).filter(Boolean).join(','),
  };
}

const th = {
  textAlign: 'left', padding: '8px 10px', position: 'sticky', top: 0, background: 'var(--bg)',
  color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
};
const td = { padding: '8px 10px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' };

export default function Contacts() {
  const { user } = useAuth();
  const [meta, setMeta] = useState(null);
  const [filters, setFilters] = useState({ q: '', category: '', city: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [converting, setConverting] = useState(null);

  const loadMeta = () => api.getContactsMeta().then(setMeta).catch(e => setError(e.message));
  useEffect(() => { loadMeta(); }, []);

  useEffect(() => {
    let live = true;
    api.getContacts({ ...filters, page })
      .then(d => live && setData(d))
      .catch(e => live && setError(e.message));
    return () => { live = false; };
  }, [filters, page]);

  // Typing filters after a short pause, not per keystroke — each query scans the table.
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setFilters(f => ({ ...f, q: search })); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  function setFilter(k) {
    return e => { setPage(1); setFilters(f => ({ ...f, [k]: e.target.value })); };
  }

  async function convert(c) {
    setConverting(c.id); setError('');
    try {
      const lead = await api.convertContact(c.id);
      setData(d => ({ ...d, rows: d.rows.map(r => (r.id === c.id ? { ...r, lead } : r)) }));
    } catch (e) {
      setError(e.message);
    }
    setConverting(null);
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;

  return (
    <div className="page">
      <h1 className="page-title" style={{ margin: '0 0 6px' }}>Marketing Contacts</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 18px', maxWidth: 720 }}>
        Bulk contact lists for outreach, kept separate from the pipeline. Use <b>→ Lead</b> to move a
        contact onto the board once they show interest.
        {meta && <> {meta.total.toLocaleString('en-IN')} contacts in total.</>}
      </p>

      {user?.role === 'admin' && <ImportPanel onDone={() => { loadMeta(); setFilters(f => ({ ...f })); }} />}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <input className="form-control" style={{ maxWidth: 320 }} placeholder="Search name, phone or email"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-control" style={{ maxWidth: 280 }} value={filters.category} onChange={setFilter('category')}>
          <option value="">All categories</option>
          {meta?.categories.map(c => (
            <option key={c.name} value={c.name}>
              {c.name === NO_CATEGORY ? '(No category)' : c.name} — {c.count.toLocaleString('en-IN')}
            </option>
          ))}
        </select>
        <select className="form-control" style={{ maxWidth: 220 }} value={filters.city} onChange={setFilter('city')}>
          <option value="">All cities</option>
          {meta?.cities.map(c => (
            <option key={c.name} value={c.name}>{c.name} — {c.count.toLocaleString('en-IN')}</option>
          ))}
        </select>
      </div>

      {error && <div className="card" style={{ padding: 12, color: 'var(--danger)', fontSize: 14, marginBottom: 12 }}>{error}</div>}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>{['Company', 'City', 'Phone', 'Email', 'Category', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>
            ) : data.rows.length === 0 ? (
              <tr><td colSpan={6} style={{ ...td, textAlign: 'center', color: 'var(--text-muted)' }}>No contacts match.</td></tr>
            ) : data.rows.map(c => (
              <tr key={c.id}>
                <td style={{ ...td, fontWeight: 500 }}>{c.company_name}</td>
                <td style={td}>{c.city}</td>
                <td style={{ ...td, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{c.phone}</td>
                <td style={{ ...td, wordBreak: 'break-all' }}>{c.email}</td>
                <td style={td}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {c.category?.split(',').map(cat => <span key={cat} className="badge badge-sky">{cat}</span>)}
                  </div>
                </td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {c.lead ? (
                    <span className="badge badge-green">{c.lead.enquiry_id}</span>
                  ) : (
                    <button className="btn btn-ghost btn-sm" disabled={converting === c.id} onClick={() => convert(c)}>
                      {converting === c.id ? 'Adding…' : '→ Lead'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.total > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span>
            Page {page.toLocaleString('en-IN')} of {pages.toLocaleString('en-IN')} · {data.total.toLocaleString('en-IN')} contacts
          </span>
          <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

function ImportPanel({ onDone }) {
  const [rows, setRows] = useState(null);
  const [progress, setProgress] = useState(null);
  const [msg, setMsg] = useState('');

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setMsg('Reading file… (a large sheet can take a minute)'); setRows(null);
    try {
      const [header, ...body] = await readSheet(file);
      const cols = mapColumns(header);
      if (cols.company_name < 0 || cols.phone < 0) throw new Error('could not find the company name and phone columns');
      setRows(body.map(r => toContact(r, cols)).filter(Boolean));
      setMsg('');
    } catch (err) {
      setMsg(`Could not read file: ${err.message}`);
    }
  }

  async function doImport() {
    let inserted = 0, skipped = 0;
    setMsg('');
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        setProgress(i);
        const r = await api.importContacts({ source: IMPORT_SOURCE, rows: rows.slice(i, i + CHUNK) });
        inserted += r.inserted; skipped += r.skipped;
      }
      setMsg(`Imported ${inserted.toLocaleString('en-IN')} contacts (${skipped.toLocaleString('en-IN')} already present or blank, skipped).`);
      setRows(null);
      onDone();
    } catch (err) {
      setMsg(`Import stopped after ${inserted.toLocaleString('en-IN')} contacts: ${err.message}. Re-running is safe.`);
    }
    setProgress(null);
  }

  return (
    <div className="card" style={{ padding: 16, marginBottom: 18 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Import contacts (admin)</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 10 }}>
        Excel sheet with Company Name, City, Phone, Email and Category columns. Saved with source{' '}
        <b>{IMPORT_SOURCE}</b>. Safe to re-run — contacts already present are skipped.
      </div>
      <input type="file" accept=".xlsx" onChange={onFile} disabled={progress !== null} />
      {rows && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-primary" disabled={progress !== null} onClick={doImport}>
            {progress !== null
              ? `Importing… ${progress.toLocaleString('en-IN')} / ${rows.length.toLocaleString('en-IN')}`
              : `Import ${rows.length.toLocaleString('en-IN')} contacts`}
          </button>
        </div>
      )}
      {msg && <div style={{ marginTop: 10, fontWeight: 600, fontSize: 13 }}>{msg}</div>}
    </div>
  );
}
