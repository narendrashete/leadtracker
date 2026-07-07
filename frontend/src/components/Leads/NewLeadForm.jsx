import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api';
import Section from '../Section';

const SOFTWARE_OPTIONS = ['Courier Software', 'ERP Accounts Software', 'Customised Software'];
const STATUS_OPTIONS = [
  'In-Process',
  'Customer is taking longer time to close',
  'Customer is closing in next week',
  'Closed with success',
  'Dropped enquiry',
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function NewLeadForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    enquiry_id: '',
    date: today(),
    company_name: '',
    contact_person: '',
    contact_no: '',
    email: '',
    required_software: SOFTWARE_OPTIONS[0],
    customer_description: '',
    committed_to_customer: '',
    next_followup_date: '',
    status: STATUS_OPTIONS[0],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.nextEnquiryId().then(({ enquiry_id }) => {
      setForm(f => ({ ...f, enquiry_id }));
    });
  }, []);

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.company_name.trim()) { setError('Company Name is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await api.createLead(form);
      navigate('/board');
    } catch (err) {
      setError(err?.message ? `Failed to save lead: ${err.message}` : 'Failed to save lead. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <h1 className="page-title">New Lead</h1>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <Section icon="🧾" title="Lead information">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>Enquiry ID</label>
                <input className="form-control" value={form.enquiry_id} readOnly
                  style={{ background: '#F8F9FA', color: 'var(--text-muted)', fontWeight: 600 }} />
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" className="form-control" value={form.date} onChange={set('date')} />
              </div>
            </div>
          </Section>

          <Section icon="🏢" title="Company details">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label>Company Name *</label>
                <input className="form-control" placeholder="Enter company name" value={form.company_name} onChange={set('company_name')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label>Contact Person</label>
                  <input className="form-control" placeholder="Full name" value={form.contact_person} onChange={set('contact_person')} />
                </div>
                <div className="form-group">
                  <label>Contact No.</label>
                  <input className="form-control" placeholder="Phone number" value={form.contact_no} onChange={set('contact_no')} />
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" className="form-control" placeholder="email@example.com" value={form.email} onChange={set('email')} />
              </div>
            </div>
          </Section>

          <Section icon="📋" title="Requirement">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label>Required Software</label>
                <select className="form-control" value={form.required_software} onChange={set('required_software')}>
                  {SOFTWARE_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Customer Description</label>
                <textarea className="form-control" placeholder="Describe the customer's requirements…"
                  value={form.customer_description} onChange={set('customer_description')} rows={4} />
              </div>
              <div className="form-group">
                <label>What We Committed to Customer</label>
                <textarea className="form-control" placeholder="What was promised to the customer…"
                  value={form.committed_to_customer} onChange={set('committed_to_customer')} rows={3} />
              </div>
            </div>
          </Section>

          <Section icon="🚩" title="Follow-up and status">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>Next Follow-up Date</label>
                <input type="date" className="form-control" value={form.next_followup_date} onChange={set('next_followup_date')} />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select className="form-control" value={form.status} onChange={set('status')}>
                  {STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </Section>

        </div>

        {error && (
          <div style={{ color: 'var(--danger)', marginTop: 16, fontSize: 13 }}>{error}</div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Lead'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/board')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
