import writeExcelFile from 'write-excel-file/browser';

// Every field captured on the New Lead form, in form order.
const COLUMNS = [
  ['Enquiry ID', 'enquiry_id'],
  ['Date', 'date'],
  ['Source of Enquiry', 'source'],
  ['Company Name', 'company_name'],
  ['Contact Person', 'contact_person'],
  ['Contact No.', 'contact_no'],
  ['Email', 'email'],
  ['Address', 'address'],
  ['City', 'city'],
  ['State', 'state'],
  ['Software Product', 'product'],
  ['Requirement', 'required_software'],
  ['Customer Description', 'customer_description'],
  ['What We Committed to Customer', 'committed_to_customer'],
  ['Next Follow-up Date', 'next_followup_date'],
  ['Status', 'status'],
];

export async function exportLeadsToExcel(leads, name) {
  const header = COLUMNS.map(([label]) => ({ value: label, fontWeight: 'bold' }));
  const rows = leads.map(l => COLUMNS.map(([, key]) => (l[key] == null || l[key] === '' ? null : String(l[key]))));
  const day = new Date().toISOString().slice(0, 10);
  await writeExcelFile([header, ...rows], { columns: COLUMNS.map(() => ({ width: 22 })) })
    .toFile(`${name.replace(/\s+/g, '_')}_${day}.xlsx`);
}
