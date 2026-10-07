import { useState } from 'react';
import { readSheet } from 'read-excel-file/browser';
import { api } from '../../api';

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function iso(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// IndiaMART's export shows relative dates: "11:29 AM" (today), "Yesterday",
// "22 May" (no year = the export's year) and "21 Apr'25". `ref` is the export date.
export function parseIndiaMartDate(text, ref) {
  const t = String(text || '').trim();
  if (/^\d{1,2}:\d{2}\s*[AP]M$/i.test(t)) return iso(ref.getFullYear(), ref.getMonth() + 1, ref.getDate());
  if (/^yesterday$/i.test(t)) {
    const y = new Date(ref); y.setDate(y.getDate() - 1);
    return iso(y.getFullYear(), y.getMonth() + 1, y.getDate());
  }
  const m = t.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*(?:'(\d{2}))?$/);
  if (!m || !MONTHS[m[2].toLowerCase()]) return null;
  return iso(m[3] ? 2000 + Number(m[3]) : ref.getFullYear(), MONTHS[m[2].toLowerCase()], Number(m[1]));
}

// Columns: software requirement | customer name | Mobile | Location | Date
export function toLead([requirement, name, mobile, location, date], ref) {
  const d = parseIndiaMartDate(date, ref);
  const contact = String(mobile || '').trim().replace(/^0+/, '');
  const req = String(requirement || '').trim();
  if (!d || !String(name || '').trim() || !contact) return null;
  return {
    date: d,
    company_name: String(name).trim(),
    contact_no: contact,
    city: String(location || '').trim(),
    required_software: req === '-' || req === 'Contacted' ? '' : req,
    customer_description: req === 'Contacted' ? 'IndiaMART status: Contacted' : '',
  };
}

export default function ImportLeads() {
  const [leads, setLeads] = useState(null);
  const [bad, setBad] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function onFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setMsg(''); setLeads(null);
    try {
      const [, ...rows] = await readSheet(file);
      const ref = new Date(file.lastModified);
      const parsed = rows.map(r => toLead(r, ref));
      setLeads(parsed.filter(Boolean));
      setBad(parsed.filter(x => !x).length);
    } catch (err) {
      setMsg(`Could not read file: ${err.message}`);
    }
  }

  async function doImport() {
    setBusy(true); setMsg('');
    try {
      const r = await api.importLeads({ source: 'IndiaMART', rows: leads });
      setMsg(`Imported ${r.imported} leads (${r.skipped} already present, skipped).`);
      setLeads(null);
    } catch (err) {
      setMsg(`Import failed: ${err.message}`);
    }
    setBusy(false);
  }

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <h1 className="page-title">Import Leads</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 620 }}>
        Upload the IndiaMART lead export (.xlsx). Leads land in <b>Leads Received</b> with
        source <b>IndiaMART</b> and the enquiry date from the sheet. Safe to re-run — leads
        already imported are skipped.
      </p>
      <input type="file" accept=".xlsx" onChange={onFile} />
      {leads && (
        <div style={{ marginTop: 20 }}>
          <div>{leads.length} leads ready{bad > 0 && `, ${bad} rows unreadable and will be skipped`}.</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, margin: '6px 0 14px' }}>
            Oldest {leads.reduce((a, l) => (l.date < a ? l.date : a), '9999')} · newest{' '}
            {leads.reduce((a, l) => (l.date > a ? l.date : a), '0000')}
          </div>
          <button className="btn btn-primary" disabled={busy} onClick={doImport}>
            {busy ? 'Importing…' : `Import ${leads.length} leads`}
          </button>
        </div>
      )}
      {msg && <div style={{ marginTop: 16, fontWeight: 600 }}>{msg}</div>}
    </div>
  );
}
