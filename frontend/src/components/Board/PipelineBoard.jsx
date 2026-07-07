import { useEffect, useState } from 'react';
import { api } from '../../api';
import BoardColumn from './BoardColumn';
import LeadDetailDrawer from '../Leads/LeadDetailDrawer';

function getColumn(lead) {
  if (lead.status === 'Dropped enquiry') return 'Dropped';
  if (lead.status === 'Closed with success') return 'Converted';
  return lead.followup_count > 0 ? 'Followed' : 'Leads Received';
}

const COLUMNS = ['Leads Received', 'Followed', 'Converted', 'Dropped'];

export default function PipelineBoard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);

  async function load() {
    try {
      const data = await api.getLeads();
      setLeads(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col] = leads.filter(l => getColumn(l) === col);
    return acc;
  }, {});

  return (
    <div className="page" style={{ padding: '28px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Pipeline Board</h1>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          {leads.length} total lead{leads.length !== 1 ? 's' : ''}
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', overflowX: 'auto' }}>
          {COLUMNS.map(col => (
            <BoardColumn
              key={col}
              title={col}
              leads={grouped[col]}
              onCardClick={setSelectedLead}
            />
          ))}
        </div>
      )}

      {selectedLead && (
        <LeadDetailDrawer
          leadId={selectedLead.id}
          onClose={() => setSelectedLead(null)}
          onSaved={() => { setSelectedLead(null); load(); }}
        />
      )}
    </div>
  );
}
