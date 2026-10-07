// Software-product master list for leads. `product` on a lead is one of these names
// (or null); `required_software` keeps the customer's own wording. Rules run in
// order — first keyword hit wins — so more specific products come first.
const PRODUCT_RULES = [
  ['Automobile',        /automobile|dealership|dealer|workshop|mahindra|bosch|\bcar\b|vehicle|garage|two wheeler|showroom|dms|delarship|maruti|honda/i],
  ['Courier & Logistics', /courier|shiprocket|shipping|cargo|logistic|transport|freight|shipment|parcel|\bcha\b/i],
  ['Quotation',         /quotation|upvc|alumin|window|costing|estimat/i],
  ['Tally & Accounting', /tally|busy software|sa4win|accounting|computax|xbrl|rojmel|wholesale|accountant|\berp\b|ledger|\bca\b|audit|payroll|inventory/i],
  ['Billing & GST',     /billing|gst|invoice|\bpos\b|retail|restaurant|supermarket|pharma|medical|medivision|optical|hotel|salon|clinic|hospital|shop/i],
  ['Label & Barcode',   /label|barcode|printer|scanner|\bsticker/i],
  ['Society & Property', /society|housing|property|mandap|real estate|rent|panchayat|parking/i],
  ['Finance & Banking', /patpedhi|patsanstha|banking|investment|finance|stock market|microfinance|micro finance|loan/i],
  ['Custom Software',   /custom|software design|application software|web ?site|mobile app|development|crm|chat|sms|whatsapp/i],
];

const PRODUCT_OPTIONS = [...PRODUCT_RULES.map(([name]) => name), 'Other'];

function categorizeProduct(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  for (const [name, re] of PRODUCT_RULES) if (re.test(t)) return name;
  return 'Other';
}

module.exports = { PRODUCT_OPTIONS, categorizeProduct };
