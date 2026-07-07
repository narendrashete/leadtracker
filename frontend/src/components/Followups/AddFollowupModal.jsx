import { useState } from 'react';
import { api } from '../../api';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AddFollowupModal({ lead, onClose, onSaved }) {
  const [form, setForm] = useState({ followup_date: today(), discussion: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.discussion.trim()) { setError('Please enter discussion notes.'); return; }
    setSaving(true);
    try {
      await api.createFollowup({ lead_id: lead.id, ...form });
      onSaved();
    } catch {
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200 }}
      />
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 480,
        background: 'var(--surface)',
        borderRadius: 14,
        boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
        zIndex: 201,
        padding: 28,
      }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Add Follow-up</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
          {lead.company_name} · {lead.enquiry_id}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label>Follow-up Date</label>
            <input type="date" className="form-control" value={form.followup_date}
              onChange={e => setForm(f => ({ ...f, followup_date: e.target.value }))} />
          </div>

          <div className="form-group">
            <label>Discussion / Notes</label>
            <textarea className="form-control" rows={5}
              placeholder="What was discussed with the customer…"
              value={form.discussion}
              onChange={e => setForm(f => ({ ...f, discussion: e.target.value }))}
            />
          </div>

          {error && <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Follow-up'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </>
  );
}
