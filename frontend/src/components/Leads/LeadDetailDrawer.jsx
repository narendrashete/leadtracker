import { useEffect, useState } from 'react';
import { api } from '../../api';

const SOFTWARE_OPTIONS = ['Courier Software', 'ERP Accounts Software', 'Customised Software'];
const STATUS_OPTIONS = [
  'In-Process',
  'Customer is taking longer time to close',
  'Customer is closing in next week',
  'Closed with success',
  'Dropped enquiry',
];

export default function LeadDetailDrawer({ leadId, onClose, onSaved }) {
  const [lead, setLead] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('details'); // 'details' | 'followups'

  useEffect(() => {
    api.getLead(leadId).then(data => {
      setLead(data);
      setForm({ ...data });
    });
  }, [leadId]);

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateLead(leadId, form);
      onSaved();
    } catch {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 100,
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 520,
        background: 'var(--surface)',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        zIndex: 101,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{lead?.company_name || '…'}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{lead?.enquiry_id}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>✕ Close</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
          {['details', 'followups'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '10px 16px',
                border: 'none',
                background: 'transparent',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: tab === t ? 600 : 400,
                cursor: 'pointer',
                fontSize: 14,
                textTransform: 'capitalize',
              }}
            >
              {t === 'followups' ? `Follow-ups (${lead?.followups?.length ?? 0})` : 'Details'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 24, flex: 1 }}>
          {!form ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading…</div>
          ) : tab === 'details' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              <div className="form-group">
                <label>Enquiry ID</label>
                <input className="form-control" value={form.enquiry_id} readOnly
                  style={{ background: '#F8F9FA', color: 'var(--text-muted)' }} />
              </div>

              <div className="form-group">
                <label>Date</label>
                <input type="date" className="form-control" value={form.date} onChange={set('date')} />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Company Name</label>
                <input className="form-control" value={form.company_name} onChange={set('company_name')} />
              </div>

              <div className="form-group">
                <label>Contact Person</label>
                <input className="form-control" value={form.contact_person || ''} onChange={set('contact_person')} />
              </div>

              <div className="form-group">
                <label>Contact No.</label>
                <input className="form-control" value={form.contact_no || ''} onChange={set('contact_no')} />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Email</label>
                <input type="email" className="form-control" value={form.email || ''} onChange={set('email')} />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Required Software</label>
                <select className="form-control" value={form.required_software || ''} onChange={set('required_software')}>
                  {SOFTWARE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Customer Description</label>
                <textarea className="form-control" rows={3} value={form.customer_description || ''} onChange={set('customer_description')} />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>What We Committed to Customer</label>
                <textarea className="form-control" rows={3} value={form.committed_to_customer || ''} onChange={set('committed_to_customer')} />
              </div>

              <div className="form-group">
                <label>Next Follow-up Date</label>
                <input type="date" className="form-control" value={form.next_followup_date || ''} onChange={set('next_followup_date')} />
              </div>

              <div className="form-group">
                <label>Status</label>
                <select className="form-control" value={form.status} onChange={set('status')}>
                  {STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              </div>
            </div>
          ) : (
            <FollowupList lead={lead} />
          )}
        </div>
      </div>
    </>
  );
}

function FollowupList({ lead }) {
  const followups = lead?.followups || [];
  return (
    <div>
      {followups.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>
          No follow-ups recorded yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {followups.map(f => (
            <div key={f.id} style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: '12px 16px',
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)', marginBottom: 6 }}>
                📅 {f.followup_date}
              </div>
              <div style={{ color: 'var(--text)', fontSize: 14, lineHeight: 1.6 }}>
                {f.discussion}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
