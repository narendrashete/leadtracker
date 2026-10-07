import { useEffect, useState } from 'react';
import { api } from '../../api';
import BoardColumn from './BoardColumn';
import LeadDetailDrawer from '../Leads/LeadDetailDrawer';
import { SOURCE_OPTIONS } from '../../leadSources';

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
  const [products, setProducts] = useState([]);
  const [sourceFilter, setSourceFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');

  async function load() {
    try {
      const data = await api.getLeads();
      setLeads(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); api.getProducts().then(setProducts); }, []);

  const filtered = leads.filter(l =>
    (!sourceFilter || l.source === sourceFilter) && (!productFilter || l.product === productFilter));
  const sortedLeads = [...filtered].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col] = sortedLeads.filter(l => getColumn(l) === col);
    return acc;
  }, {});

  return (
    <div className="page" style={{ padding: '28px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 className="page-title" style={{ margin: 0 }}>Pipeline Board</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select className="form-control" style={{ width: 'auto' }} value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}>
            <option value="">All sources</option>
            {SOURCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <select className="form-control" style={{ width: 'auto' }} value={productFilter}
            onChange={e => setProductFilter(e.target.value)}>
            <option value="">All software products</option>
            {products.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>
            {sourceFilter || productFilter
              ? `${filtered.length} / ${leads.length} leads`
              : `${leads.length} total lead${leads.length !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', overflowX: 'auto' }}>
          {COLUMNS.map(col => (
            <BoardColumn
              key={`${col}|${sourceFilter}|${productFilter}`}
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
