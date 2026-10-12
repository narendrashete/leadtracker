const express = require('express');
const { requireAdmin } = require('../auth');
const contacts = require('../contactsDb');
const db = require('../db');
const { insertLead } = require('./leads');
const router = express.Router();

const PAGE_SIZE = 50;
const NO_CATEGORY = '__none';

// Category and city lists with counts, for the filter dropdowns. Categories are
// stored comma-joined, so they are counted per distinct combination and split here.
// Held until the next import: it is a ~1s scan at 500k rows and only imports change it.
let metaCache = null;
router.get('/meta', (req, res) => {
  if (metaCache) return res.json(metaCache);
  const cats = new Map();
  for (const { category, n } of contacts.query('SELECT category, COUNT(*) AS n FROM contacts GROUP BY category')) {
    for (const c of category ? category.split(',') : [NO_CATEGORY]) cats.set(c, (cats.get(c) || 0) + n);
  }
  const cities = contacts.query(
    `SELECT city AS name, COUNT(*) AS count FROM contacts WHERE city IS NOT NULL GROUP BY city ORDER BY count DESC`
  );
  metaCache = {
    total: contacts.query('SELECT COUNT(*) AS n FROM contacts')[0].n,
    categories: [...cats].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    cities,
  };
  res.json(metaCache);
});

router.get('/', (req, res) => {
  const { q, category, city } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const where = [], params = [];
  if (q && q.trim()) {
    const like = `%${q.trim()}%`;
    where.push('(company_name LIKE ? OR phone LIKE ? OR email LIKE ?)');
    params.push(like, like, like);
  }
  if (category === NO_CATEGORY) where.push('category IS NULL');
  else if (category) { where.push("(',' || category || ',') LIKE ?"); params.push(`%,${category},%`); }
  if (city) { where.push('city = ?'); params.push(city); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = contacts.query(`SELECT COUNT(*) AS n FROM contacts ${w}`, params)[0].n;
  const rows = contacts.query(
    `SELECT * FROM contacts ${w} ORDER BY company_name LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`, params
  );

  // "Already a lead" is derived from the leads table by phone number, never stored
  // on the contact — a lead deleted or re-numbered later can't leave it stale.
  const phones = rows.map(r => r.phone).filter(Boolean);
  const leadByPhone = new Map(phones.length ? db.query(
    `SELECT id, enquiry_id, contact_no FROM leads WHERE contact_no IN (${phones.map(() => '?').join(',')})`, phones
  ).map(l => [l.contact_no, { id: l.id, enquiry_id: l.enquiry_id }]) : []);
  for (const r of rows) r.lead = leadByPhone.get(r.phone) || null;

  res.json({ total, page, page_size: PAGE_SIZE, rows });
});

router.post('/:id/convert', (req, res, next) => {
  try {
    const c = contacts.query('SELECT * FROM contacts WHERE id = ?', [req.params.id])[0];
    if (!c) return res.status(404).json({ error: 'Contact not found' });
    const existing = c.phone && db.query('SELECT enquiry_id FROM leads WHERE contact_no = ?', [c.phone])[0];
    if (existing) return res.status(409).json({ error: `Already a lead: ${existing.enquiry_id}` });
    res.status(201).json(insertLead({
      company_name: c.company_name,
      contact_no: c.phone,
      email: c.email,
      city: c.city,
      category: c.category ? c.category.split(',').join(', ') : null,
      source: c.source,
    }));
  } catch (err) { next(err); }
});

// Bulk import (admin). The browser parses the sheet and posts it in chunks small
// enough for nginx's default 1 MB body limit; re-sent rows are skipped by the
// (phone, company_name) unique index.
router.post('/import', requireAdmin, (req, res, next) => {
  try {
    const { source, rows } = req.body;
    if (!source || !Array.isArray(rows)) return res.status(400).json({ error: 'source and rows are required' });
    const clean = rows.filter(r => r && String(r.company_name || '').trim());
    const inserted = contacts.insertMany(clean, source);
    metaCache = null;
    res.json({ inserted, skipped: rows.length - inserted });
  } catch (err) { next(err); }
});

module.exports = router;
