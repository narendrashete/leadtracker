const express = require('express');
const { query, run } = require('../db');
const router = express.Router();

// Compute the next ENQ-YYYY-NNN id from existing rows. Scans all ids for the
// year and takes max counter, so it is not fooled by id-vs-counter ordering.
function computeNextEnquiryId() {
  const year = new Date().getFullYear();
  const rows = query(
    `SELECT enquiry_id FROM leads WHERE enquiry_id LIKE ?`,
    [`ENQ-${year}-%`]
  );
  let max = 0;
  for (const r of rows) {
    const n = parseInt((r.enquiry_id || '').split('-')[2], 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return `ENQ-${year}-${String(max + 1).padStart(3, '0')}`;
}

router.get('/next-enquiry-id', (req, res) => {
  res.json({ enquiry_id: computeNextEnquiryId() });
});

// Distinct city/state values seen so far, for autocomplete on the lead forms.
// No separate master-data table — the list is derived from existing leads.
router.get('/meta/locations', (req, res) => {
  const cities = query(
    `SELECT DISTINCT city FROM leads WHERE city IS NOT NULL AND trim(city) != '' ORDER BY city COLLATE NOCASE`
  ).map(r => r.city);
  const states = query(
    `SELECT DISTINCT state FROM leads WHERE state IS NOT NULL AND trim(state) != '' ORDER BY state COLLATE NOCASE`
  ).map(r => r.state);
  res.json({ cities, states });
});

router.get('/', (req, res) => {
  const leads = query(`
    SELECT l.*, COUNT(f.id) AS followup_count
    FROM leads l
    LEFT JOIN followups f ON f.lead_id = l.id
    GROUP BY l.id
    ORDER BY l.id DESC
  `);
  res.json(leads);
});

router.post('/', (req, res, next) => {
  try {
    const {
      date, company_name, contact_person, contact_no, email,
      address, city, state,
      required_software, customer_description, committed_to_customer,
      next_followup_date, status
    } = req.body;

    if (!company_name || !company_name.trim()) {
      return res.status(400).json({ error: 'Company Name is required' });
    }

    // Always generate the id server-side so a blank/duplicate value from the
    // browser can never break the save. Retry a couple of times if a
    // concurrent insert grabbed the same number.
    const safeDate = date || new Date().toISOString().slice(0, 10);
    const safeStatus = status || 'In-Process';

    let id, lastErr;
    for (let attempt = 0; attempt < 5; attempt++) {
      const enquiry_id = computeNextEnquiryId();
      try {
        id = run(
          `INSERT INTO leads
            (enquiry_id, date, company_name, contact_person, contact_no, email,
             address, city, state,
             required_software, customer_description, committed_to_customer,
             next_followup_date, status)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [enquiry_id, safeDate, company_name, contact_person, contact_no, email,
           address, city, state,
           required_software, customer_description, committed_to_customer,
           next_followup_date, safeStatus]
        );
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (!/UNIQUE/i.test(e.message)) throw e; // only retry on id collision
      }
    }
    if (lastErr) throw lastErr;

    const rows = query('SELECT * FROM leads WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.get('/:id', (req, res) => {
  const rows = query('SELECT * FROM leads WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const followups = query(
    'SELECT * FROM followups WHERE lead_id = ? ORDER BY followup_date DESC',
    [req.params.id]
  );
  res.json({ ...rows[0], followups });
});

router.put('/:id', (req, res, next) => {
  try {
    const existing = query('SELECT id FROM leads WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });

    const {
      date, company_name, contact_person, contact_no, email,
      address, city, state,
      required_software, customer_description, committed_to_customer,
      next_followup_date, status
    } = req.body;

    run(
      `UPDATE leads SET
        date=?, company_name=?, contact_person=?, contact_no=?, email=?,
        address=?, city=?, state=?,
        required_software=?, customer_description=?, committed_to_customer=?,
        next_followup_date=?, status=?
       WHERE id=?`,
      [date, company_name, contact_person, contact_no, email,
       address, city, state,
       required_software, customer_description, committed_to_customer,
       next_followup_date, status, req.params.id]
    );

    const rows = query('SELECT * FROM leads WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { next(err); }
});

module.exports = router;
