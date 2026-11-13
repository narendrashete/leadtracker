import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api';

// ERP Expo 2027 — Auto Cluster Exhibition Centre, Chinchwad, 4–6 Feb 2027.
const SHOW_START = '2027-02-04';
const OWNER_TAGS = ['Founder', 'Product', 'Marketing', 'Sales', 'Ops', 'All'];

// Sections still to be built, in the order they'll be needed.
const COMING = [
  { icon: '💰', title: 'Exhibition accounts', text: 'Budget heads, quotes, payments made and pending, petty cash for the show.' },
  { icon: '📞', title: 'Customer follow-ups', text: 'Customers and prospects to call before and after the show, with next-step dates.' },
  { icon: '💬', title: 'WhatsApp invites', text: 'Event invite messages to customers — the three invite waves, who got which.' },
  { icon: '🧑‍💼', title: 'Walk-in visitors', text: 'Capture visitors at the stall: name, mobile, email, company, industry, notes.' },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(s, n) {
  const d = new Date(s + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtDate(s) {
  if (!s) return '';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function PrimexERP2027() {
  const today = todayStr();
  const daysToGo = Math.round((new Date(SHOW_START + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000);

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>PrimexERP2027</h1>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            ERP Expo 2027 · Thu 4 – Sat 6 Feb 2027 · Auto Cluster Exhibition Centre, Chinchwad
          </div>
        </div>
        <div className="card" style={{ padding: '10px 18px', textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>
            {daysToGo > 0 ? daysToGo : daysToGo === 0 ? 'Today' : '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {daysToGo > 0 ? 'days to the show' : daysToGo === 0 ? 'show opens' : 'show is over'}
          </div>
        </div>
      </div>

      <Links />
      <Doables today={today} />

      <h2 style={sectionHead}>Coming next</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12 }}>
        {COMING.map(c => (
          <div key={c.title} className="card" style={{ padding: 16, opacity: 0.85 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{c.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{c.title}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45 }}>{c.text}</div>
            <span className="badge badge-amber" style={{ marginTop: 10 }}>To be built</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Plan docs / artifacts ────────────────────────────────────────────────────
function Links() {
  const [links, setLinks] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', url: '', note: '' });
  const [error, setError] = useState('');

  useEffect(() => { api.getPrimexLinks().then(setLinks).catch(e => setError(e.message)); }, []);

  async function add(e) {
    e.preventDefault();
    setError('');
    try {
      const row = await api.addPrimexLink(form);
      setLinks([...links, row]);
      setForm({ title: '', url: '', note: '' });
      setAdding(false);
    } catch (err) { setError(err.message); }
  }

  async function remove(l) {
    if (!window.confirm(`Remove the link "${l.title}" from this page?\n\nThe document itself is not touched.`)) return;
    try { await api.deletePrimexLink(l.id); setLinks(links.filter(x => x.id !== l.id)); }
    catch (err) { setError(err.message); }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={sectionHead}>Plan &amp; artifacts</h2>
        {!adding && <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>+ Add link</button>}
      </div>
      {error && <ErrorBox msg={error} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {links.map(l => (
          <div key={l.id} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 22 }}>📄</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{l.title}</div>
              {l.note && <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{l.note}</div>}
            </div>
            <a className="btn btn-primary btn-sm" href={l.url} target="_blank" rel="noopener noreferrer">Open</a>
            <button className="btn btn-sm" onClick={() => remove(l)} title="Remove link" style={iconBtn}>✕</button>
          </div>
        ))}
        {adding && (
          <form onSubmit={add} className="card" style={{ padding: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input autoFocus placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ ...input, flex: '1 1 200px' }} />
            <input placeholder="https://…" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} style={{ ...input, flex: '2 1 280px' }} />
            <input placeholder="Note (optional)" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} style={{ ...input, flex: '1 1 100%' }} />
            <button type="submit" className="btn btn-primary btn-sm">Save</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(false)}>Cancel</button>
          </form>
        )}
      </div>
    </>
  );
}

// ── Doables ──────────────────────────────────────────────────────────────────
function Doables({ today }) {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [show, setShow] = useState('open');   // open | all | done
  const [owner, setOwner] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.getPrimexTodos().then(setTodos).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const weekEnd = addDays(today, 7);
  const isOverdue = t => !t.done && t.due_date && t.due_date < today;
  const stats = useMemo(() => ({
    total: todos.length,
    done: todos.filter(t => t.done).length,
    overdue: todos.filter(isOverdue).length,
    thisWeek: todos.filter(t => !t.done && t.due_date && t.due_date >= today && t.due_date <= weekEnd).length,
  }), [todos, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const phases = useMemo(() => {
    const visible = todos.filter(t =>
      (show === 'all' || (show === 'done' ? t.done : !t.done)) &&
      (!owner || (t.owner || '').includes(owner)));
    const map = new Map();
    for (const t of visible) {
      if (!map.has(t.phase)) map.set(t.phase, new Map());
      const weeks = map.get(t.phase);
      const wk = t.week || '';
      if (!weeks.has(wk)) weeks.set(wk, []);
      weeks.get(wk).push(t);
    }
    return map;
  }, [todos, show, owner]);

  const phaseNames = [...new Set(todos.map(t => t.phase))];

  async function toggle(t) {
    try {
      const row = await api.updatePrimexTodo(t.id, { done: !t.done });
      setTodos(todos.map(x => (x.id === t.id ? row : x)));
    } catch (e) { setError(e.message); }
  }

  async function remove(t) {
    if (!window.confirm(`Delete this task?\n\n${t.title}`)) return;
    try { await api.deletePrimexTodo(t.id); setTodos(todos.filter(x => x.id !== t.id)); }
    catch (e) { setError(e.message); }
  }

  async function added() {
    // Re-read so the new task sits at its sort position within its phase.
    setTodos(await api.getPrimexTodos());
    setAdding(false);
    setShow('open');
  }

  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={sectionHead}>Doables</h2>
        {!adding && <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ Add task</button>}
      </div>
      {error && <ErrorBox msg={error} />}

      <div className="card" style={{ padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <Stat value={`${stats.done}/${stats.total}`} label="done" />
          <Stat value={stats.overdue} label="overdue" color={stats.overdue ? 'var(--danger)' : undefined} />
          <Stat value={stats.thisWeek} label="due in next 7 days" color={stats.thisWeek ? 'var(--warning)' : undefined} />
          <div style={{ flex: '1 1 200px' }}>
            <div style={{ height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--success)', transition: 'width .3s' }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{pct}% complete</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          {[['open', 'Open'], ['all', 'All'], ['done', 'Done']].map(([k, l]) => (
            <button key={k} className={`btn btn-sm ${show === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShow(k)}>{l}</button>
          ))}
          <select value={owner} onChange={e => setOwner(e.target.value)} style={{ ...input, width: 'auto', padding: '5px 10px', fontSize: 13 }}>
            <option value="">Everyone</option>
            {OWNER_TAGS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {adding && <AddTask phases={phaseNames} onCancel={() => setAdding(false)} onAdded={added} />}

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 30, textAlign: 'center' }}>Loading…</div>
      ) : phases.size === 0 ? (
        <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
          {show === 'done' ? 'Nothing ticked off yet.' : 'Nothing open here. 🎉'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...phases].map(([phase, weeks]) => (
            <div key={phase} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '10px 16px', background: 'var(--accent-light)', fontWeight: 700, fontSize: 14, color: '#1D4ED8' }}>
                {phase}
              </div>
              {[...weeks].map(([week, items]) => (
                <div key={week} style={{ padding: '8px 16px 10px' }}>
                  {week && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3, margin: '6px 0' }}>{week}</div>}
                  {items.map(t => (
                    <TaskRow key={t.id} t={t} overdue={isOverdue(t)} onToggle={() => toggle(t)} onDelete={() => remove(t)} />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function TaskRow({ t, overdue, onToggle, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0', borderTop: '1px solid var(--border)' }}>
      <input type="checkbox" checked={!!t.done} onChange={onToggle} style={{ marginTop: 3, width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--text-muted)' : 'var(--text)' }}>
          {t.title}
        </div>
        {!!t.done && t.done_at && (
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
            Done {fmtDate(t.done_at)}{t.done_by ? ` by ${t.done_by}` : ''}
          </div>
        )}
      </div>
      {t.owner && <span className="badge badge-sky" style={{ flexShrink: 0 }}>{t.owner}</span>}
      {t.due_date && (
        <span className={`badge ${overdue ? 'badge-red' : 'badge-blue'}`} style={{ flexShrink: 0, minWidth: 58, justifyContent: 'center' }}>
          {overdue ? '⚠ ' : ''}{fmtDate(t.due_date)}
        </span>
      )}
      <button className="btn btn-sm" onClick={onDelete} title="Delete task" style={iconBtn}>✕</button>
    </div>
  );
}

function AddTask({ phases, onCancel, onAdded }) {
  const [form, setForm] = useState({ title: '', phase: phases[0] || 'Other', owner: '', due_date: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try { await api.addPrimexTodo(form); await onAdded(); }
    catch (err) { setError(err.message); setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="card" style={{ padding: 14, marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {error && <div style={{ flex: '1 1 100%' }}><ErrorBox msg={error} /></div>}
      <input autoFocus placeholder="What needs doing?" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ ...input, flex: '1 1 100%' }} />
      <select value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })} style={{ ...input, flex: '1 1 200px' }}>
        {phases.map(p => <option key={p}>{p}</option>)}
        {!phases.includes('Other') && <option>Other</option>}
      </select>
      <input list="primex-owners" placeholder="Owner" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} style={{ ...input, flex: '1 1 140px' }} />
      <datalist id="primex-owners">{OWNER_TAGS.map(o => <option key={o} value={o} />)}</datalist>
      <input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} style={{ ...input, flex: '0 1 160px' }} />
      <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Adding…' : 'Add'}</button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
    </form>
  );
}

function Stat({ value, label, color }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--text)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
    </div>
  );
}

function ErrorBox({ msg }) {
  return (
    <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
      {msg}
    </div>
  );
}

const sectionHead = { fontSize: 16, fontWeight: 700, margin: '26px 0 12px', color: 'var(--text)' };
const iconBtn = { background: 'transparent', color: 'var(--text-muted)', padding: '2px 8px', flexShrink: 0 };
const input = {
  width: '100%', padding: '8px 11px', fontSize: 14,
  border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)',
};
