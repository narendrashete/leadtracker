const express = require('express');
const { query, run } = require('../db');
const router = express.Router();

router.get('/', (req, res) => {
  const { lead_id } = req.query;
  if (!lead_id) return res.status(400).json({ error: 'lead_id required' });
  const rows = query(
    'SELECT * FROM followups WHERE lead_id = ? ORDER BY followup_date DESC',
    [lead_id]
  );
  res.json(rows);
});

router.post('/', (req, res) => {
  const { lead_id, followup_date, discussion } = req.body;
  const id = run(
    'INSERT INTO followups (lead_id, followup_date, discussion) VALUES (?,?,?)',
    [lead_id, followup_date, discussion]
  );
  const rows = query('SELECT * FROM followups WHERE id = ?', [id]);
  res.status(201).json(rows[0]);
});

module.exports = router;
