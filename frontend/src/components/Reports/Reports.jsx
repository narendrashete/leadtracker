import { useEffect, useState } from 'react';
import { api } from '../../api';
import StatusPieChart from './StatusPieChart';
import DetailedReport from './DetailedReport';

export default function Reports() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getLeads()
      .then(setLeads)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <h1 className="page-title">Reports</h1>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Report 1 — Pie chart */}
          <section className="card" style={{ padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              Pipeline Status Distribution
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
              Share of leads in each pipeline stage. Hover a slice to see the detailed status breakdown.
            </div>
            <StatusPieChart leads={leads} />
          </section>

          {/* Report 2 — Detailed period report */}
          <section className="card" style={{ padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
              Detailed Leads Report
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
              Leads serviced within a selected period. Use the date filters and download the table as CSV.
            </div>
            <DetailedReport leads={leads} />
          </section>

        </div>
      )}
    </div>
  );
}
