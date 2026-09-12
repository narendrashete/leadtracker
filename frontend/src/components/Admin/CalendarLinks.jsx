import { useEffect, useState } from 'react';
import { api } from '../../api';

const PALETTE = ['#E4572E', '#2E86AB', '#5E8C3F', '#8E5BD8', '#D9A404', '#C42A67'];

function fullLink(share_path) {
  return `${window.location.origin}${share_path}`;
}

export default function CalendarLinks() {
  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError]     = useState('');

  async function load() {
    try {
      setGroups(await api.getCalendarGroups());
      setError('');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Calendar Links</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ New Group</button>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 0, marginBottom: 24, maxWidth: 620 }}>
        Each group has its own link. Send a group's link only to that group — it opens
        their calendar and nothing else, and they can add their own friends to it.
      </p>

      {error && <ErrorBox msg={error} />}

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading…</div>
      ) : groups.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No groups yet. Create one to get a link you can share.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {groups.map(g => <GroupCard key={g.group_key} group={g} onChanged={load} />)}
        </div>
      )}

      {showAdd && (
        <AddGroupModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}

function GroupCard({ group, onChanged }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy]     = useState(false);
  const link = fullLink(group.share_path);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link:', link);
    }
  }

  async function rotate() {
    if (!window.confirm(
      `Create a new link for ${group.name_en}?\n\nThe current link stops working immediately, ` +
      `so everyone in the group will need the new one. Their names and marked dates are kept.`
    )) return;
    setBusy(true);
    try { await api.rotateCalendarLink(group.group_key); await onChanged(); }
    catch (e) { window.alert(e.message); }
    setBusy(false);
  }

  async function remove() {
    if (!window.confirm(
      `Delete the group ${group.name_en}?\n\nIts ${group.member_count} friend(s) and ` +
      `${group.mark_count} marked date(s) are deleted too. This cannot be undone.`
    )) return;
    setBusy(true);
    try { await api.deleteCalendarGroup(group.group_key); await onChanged(); }
    catch (e) { window.alert(e.message); }
    setBusy(false);
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{group.name_en}</div>
        {group.name_mr && (
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{group.name_mr}</div>
        )}
        <div style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12 }}>
          {group.member_count} friend{group.member_count === 1 ? '' : 's'} · {group.mark_count} date{group.mark_count === 1 ? '' : 's'} blocked
        </div>
      </div>

      {group.member_names.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {group.member_names.map((n, i) => (
            <span key={n + i} className="badge badge-sky">{n}</span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
        <input
          readOnly
          value={link}
          onFocus={e => e.target.select()}
          style={{
            flex: '1 1 320px', minWidth: 0, padding: '8px 10px', fontSize: 13,
            border: '1px solid var(--border)', borderRadius: 8,
            background: 'var(--bg)', color: 'var(--text)', fontFamily: 'monospace',
          }}
        />
        <button className="btn btn-primary btn-sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <a className="btn btn-secondary btn-sm" href={link} target="_blank" rel="noreferrer">Open</a>
        <button className="btn btn-ghost btn-sm" onClick={rotate} disabled={busy}>New link</button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={remove}
          disabled={busy}
          style={{ color: '#B91C1C' }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function AddGroupModal({ onClose, onSaved }) {
  const [form, setForm]     = useState({ name_en: '', name_mr: '', first_member: '', first_color: PALETTE[0] });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createCalendarGroup(form);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 200 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(460px, calc(100vw - 32px))', background: 'var(--surface)', borderRadius: 14,
        boxShadow: '0 8px 40px rgba(0,0,0,0.2)', zIndex: 201, padding: 28,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>New Group</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
          Add the first friend now — they need a name to pick when they open the link.
          They can add the rest of the group themselves.
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <ErrorBox msg={error} />}

          <Field label="Group name">
            <input
              autoFocus
              value={form.name_en}
              onChange={e => setForm({ ...form, name_en: e.target.value })}
              placeholder="e.g. Cricket Gang"
              style={input}
            />
          </Field>

          <Field label="Group name in Marathi (optional)">
            <input
              value={form.name_mr}
              onChange={e => setForm({ ...form, name_mr: e.target.value })}
              placeholder="ऐच्छिक"
              style={input}
            />
          </Field>

          <Field label="First friend">
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={form.first_member}
                onChange={e => setForm({ ...form, first_member: e.target.value })}
                placeholder="Their name"
                style={{ ...input, flex: 1 }}
              />
              <input
                type="color"
                value={form.first_color}
                onChange={e => setForm({ ...form, first_color: e.target.value })}
                title="Their colour on the calendar"
                style={{ width: 46, height: 38, padding: 2, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer' }}
              />
            </div>
          </Field>

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Group'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </label>
  );
}

function ErrorBox({ msg }) {
  return (
    <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
      {msg}
    </div>
  );
}

const input = {
  width: '100%', padding: '9px 12px', fontSize: 14,
  border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--surface)', color: 'var(--text)',
};
