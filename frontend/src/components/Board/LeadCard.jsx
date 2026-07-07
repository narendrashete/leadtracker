const STATUS_BADGE = {
  'In-Process': 'badge-blue',
  'Customer is taking longer time to close': 'badge-amber',
  'Customer is closing in next week': 'badge-sky',
  'Closed with success': 'badge-green',
  'Dropped enquiry': 'badge-red',
};

const STATUS_LABEL = {
  'In-Process': 'In Process',
  'Customer is taking longer time to close': 'Taking Longer',
  'Customer is closing in next week': 'Closing Soon',
  'Closed with success': 'Closed ✓',
  'Dropped enquiry': 'Dropped',
};

const SOFTWARE_LABEL = {
  'Courier Software': 'Courier',
  'ERP Accounts Software': 'ERP / Accounts',
  'Customised Software': 'Custom',
};

export default function LeadCard({ lead, onClick }) {
  return (
    <div
      className="card"
      onClick={() => onClick(lead)}
      style={{
        padding: '14px 16px',
        cursor: 'pointer',
        transition: 'box-shadow 0.15s, transform 0.1s',
        marginBottom: 10,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.12)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = '';
        e.currentTarget.style.transform = '';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', lineHeight: 1.3 }}>
          {lead.company_name}
        </div>
        <span className={`badge ${STATUS_BADGE[lead.status] || 'badge-blue'}`} style={{ flexShrink: 0 }}>
          {STATUS_LABEL[lead.status] || lead.status}
        </span>
      </div>

      {lead.contact_person && (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 6 }}>
          👤 {lead.contact_person}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        {lead.required_software && (
          <span style={{
            background: 'var(--accent-light)',
            color: 'var(--accent)',
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 500,
          }}>
            {SOFTWARE_LABEL[lead.required_software] || lead.required_software}
          </span>
        )}
        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 'auto' }}>
          {lead.enquiry_id}
        </div>
      </div>

      {lead.next_followup_date && (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>
          📅 Next: {lead.next_followup_date}
        </div>
      )}

      {lead.followup_count > 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
          💬 {lead.followup_count} follow-up{lead.followup_count > 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
