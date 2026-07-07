import { useEffect, useState } from 'react';
import { api } from '../../api';
import AddFollowupModal from './AddFollowupModal';

const STATUS_BADGE = {
  'In-Process': 'badge-blue',
  'Customer is taking longer time to close': 'badge-amber',
  'Customer is closing in next week': 'badge-sky',
  'Closed with success': 'badge-green',
  'Dropped enquiry': 'badge-red',
};

const SOFTWARE_SHORT = {
  'Courier Software': 'Courier',
  'ERP Accounts Software': 'ERP',
  'Customised Software': 'Custom',
};

export default function FollowupScreen() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [followupsMap, setFollowupsMap] = useState({});

  async function load() {
    const data = await api.getLeads();
    setLeads(data.filter(l => l.status !== 'Dropped enquiry'));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleExpand(lead) {
    if (expandedId === lead.id) { setExpandedId(null); return; }
    setExpandedId(lead.id);
    if (!followupsMap[lead.id]) {
      const data = await api.getFollowups(lead.id);
      setFollowupsMap(m => ({ ...m, [lead.id]: data }));
    }
  }

  function handleFollowupSaved() {
    setSelectedLead(null);
    // refresh followups for this lead
    if (expandedId) {
      api.getFollowups(expandedId).then(data => {
        setFollowupsMap(m => ({ ...m, [expandedId]: data }));
      });
    }
    load();
  }

  return (
    <div className="page">
      <h1 className="page-title">Follow-ups</h1>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading…</div>
      ) : leads.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          No active leads to follow up on.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {leads.map(lead => (
            <div key={lead.id} className="card">
              {/* Lead row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 18px',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{lead.company_name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
                    {lead.enquiry_id}
                    {lead.contact_person && ` · ${lead.contact_person}`}
                    {lead.required_software && ` · ${SOFTWARE_SHORT[lead.required_software] || lead.required_software}`}
                  </div>
                </div>

                <span className={`badge ${STATUS_BADGE[lead.status] || 'badge-blue'}`} style={{ flexShrink: 0 }}>
                  {lead.status}
                </span>

                {lead.next_followup_date && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>
                    📅 {lead.next_followup_date}
                  </div>
                )}

                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setSelectedLead(lead)}
                  style={{ flexShrink: 0 }}
                >
                  + Follow-up
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => toggleExpand(lead)}
                  style={{ flexShrink: 0 }}
                >
                  {expandedId === lead.id ? '▲ Hide' : `▼ History (${lead.followup_count})`}
                </button>
              </div>

              {/* Followup history */}
              {expandedId === lead.id && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '14px 18px 18px' }}>
                  {!followupsMap[lead.id] ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
                  ) : followupsMap[lead.id].length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No follow-ups yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {followupsMap[lead.id].map(f => (
                        <div key={f.id} style={{
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: '10px 14px',
                        }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)', marginBottom: 4 }}>
                            📅 {f.followup_date}
                          </div>
                          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>
                            {f.discussion}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedLead && (
        <AddFollowupModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onSaved={handleFollowupSaved}
        />
      )}
    </div>
  );
}
