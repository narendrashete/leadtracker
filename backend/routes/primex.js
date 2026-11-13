// PrimexERP2027 — ERP Expo 2027 workspace (4–6 Feb 2027). Mounted behind
// requireAuth. For now: the doables list and the plan/artifact links. Accounts,
// customer follow-ups, WhatsApp invites and walk-in capture come later.
const express = require('express');
const { query, run, runMany } = require('../db');
const router = express.Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Seed from the "PrimexERP – ERP Expo 2027 Readiness Plan" master timeline and
// post-expo follow-up. Each week's tasks are due on that week's last day.
// [phase, week, due_date, [[title, owner], …]]
const SEED = [
  ['Phase 1 – Plan', 'Week 1: 13–22 Nov – Kick-off', '2026-11-22', [
    ['Kick-off meeting with all 5; assign the owners for each workstream', 'Founder'],
    ['Get the exhibitor manual; list every deadline (fascia name, badges, power, furniture, catalogue entry, payment balance)', 'Ops'],
    ['Confirm stall number, size, shell or bare space, corner or inline, and the hall plan', 'Ops'],
    ['Approve the targets and the budget ceiling', 'Founder'],
    ['Fix the demo scope: the 3 demo stories and the modules to show', 'Founder + Product'],
    ['Create a shared folder and a WhatsApp group for the expo team', 'Ops'],
  ]],
  ['Phase 1 – Plan', 'Week 2: 23–29 Nov – Positioning and research', '2026-11-29', [
    ['Write the one-line positioning and 3 proof points for PrimexERP', 'Founder + Marketing'],
    ['Study competitors from the Jan and May 2026 editions: pricing, pitch, stall style', 'Marketing'],
    ['Build the target list: auto-component makers, job shops, traders (Bhosari, Chakan, Talawade, Ranjangaon, Hinjewadi)', 'Sales'],
    ['Get quotes from 3 stall designers or fabricators', 'Marketing'],
    ['List product gaps and bugs that would hurt the demo; plan the sprint', 'Product'],
  ]],
  ['Phase 1 – Plan', 'Week 3: 30 Nov – 6 Dec – Decisions', '2026-12-06', [
    ['Finalise stall designer; give the brief', 'Marketing'],
    ['Decide pricing packages and the expo-only offer', 'Founder'],
    ['Ask 3–5 happy customers for a testimonial, video quote or case study', 'Founder + Sales'],
    ['Ask the organiser about speaking slots, workshops, catalogue ads and visitor invite passes', 'Marketing'],
    ['Start the product sprint', 'Product'],
  ]],
  ['Phase 2 – Build', 'Week 4: 7–13 Dec', '2026-12-13', [
    ['Approve stall design, first round', 'Founder'],
    ['Write brochure and module-sheet copy', 'Marketing'],
    ['Set up the CRM lead form for stall use', 'Sales + Product'],
    ['Build the sample company data for the demo', 'Product'],
  ]],
  ['Phase 2 – Build', 'Week 5: 14–20 Dec', '2026-12-20', [
    ['Script and record the 60–90 second product video', 'Marketing'],
    ['Build the expo landing page with trial sign-up and meeting booking', 'Marketing'],
    ['Write the 30-second pitch, demo scripts and objection answers', 'Founder + Product'],
    ['Order branded T-shirts or shirts for 5', 'Ops'],
  ]],
  ['Phase 2 – Build', 'Week 6: 21–27 Dec', '2026-12-27', [
    ['Invite wave 1: email and WhatsApp to the full target list with stall number', 'Sales'],
    ['Start calling to book meetings; aim for 10 booked by 31 Dec', 'Sales'],
    ['Finalise giveaways and order them', 'Ops'],
    ['Brochure and standee design, first draft', 'Marketing'],
  ]],
  ['Phase 2 – Build', 'Week 7: 28 Dec – 3 Jan', '2027-01-03', [
    ['Internal demo walkthrough #1; record what breaks', 'Product'],
    ['Book hardware: 2 large screens, laptops, tablets, 2 internet backups', 'Ops'],
    ['Weekly countdown posts on LinkedIn and WhatsApp status begin', 'Marketing'],
  ]],
  ['Phase 3 – Promote and rehearse', 'Week 8: 4–10 Jan', '2027-01-10', [
    ['Final print files to the printer: brochures, pricing card, standees, visiting cards', 'Marketing'],
    ['Submit fascia name, badge names and catalogue entry to the organiser', 'Ops'],
    ['Partner outreach: invite CA firms, Tally resellers and consultants to the stall', 'Founder'],
    ['Calling continues; aim for 20 meetings booked', 'Sales'],
  ]],
  ['Phase 3 – Promote and rehearse', 'Week 9: 11–17 Jan', '2027-01-17', [
    ['Demo code freeze on 15 Jan; only critical fixes after this', 'Product'],
    ['Invite wave 2 with a "book your 20-minute slot" link', 'Sales'],
    ['Pitch practice: everyone gives the 30-second pitch and the 5-minute demo', 'All'],
    ['Send a press note to local media and industry associations', 'Marketing'],
  ]],
  ['Phase 3 – Promote and rehearse', 'Week 10: 18–24 Jan', '2027-01-24', [
    ['Visit the venue (EFY Expo 21–23 Jan): hall flow, lighting, mobile signal, parking', 'Ops + Founder'],
    ['Collect printed material and check every piece', 'Marketing'],
    ['Role-play difficult visitors: price objections, "we use Tally", competitor comparisons', 'All'],
    ['Aim for 30 meetings booked', 'Sales'],
  ]],
  ['Phase 3 – Promote and rehearse', 'Week 11: 25–31 Jan', '2027-01-31', [
    ['Full dress rehearsal on 29 Jan: mock stall, uniforms, timed demos, lead capture on tablets', 'All'],
    ['Invite wave 3: reminder to all, personal calls to booked meetings', 'Sales'],
    ['Confirm fabricator build-up time, power load, furniture list', 'Ops'],
    ['Print the shift roster and the daily lead-count sheet', 'Ops'],
    ['Aim for 40 meetings booked', 'Sales'],
  ]],
  ['Phase 4 – Set up and run', '1 – 6 Feb', null, [
    ['Pack everything using the packing checklist; WhatsApp "see you at Stall __" to all booked meetings', 'Ops + Sales', '2027-02-01'],
    ['Final demo reset and full backup; charge all devices', 'Product', '2027-02-02'],
    ['Build-up day: stall handover, test screens, internet, power, demos; take photos', 'All', '2027-02-03'],
    ['Run the show using the stall playbook (4–6 Feb)', 'All', '2027-02-06'],
    ['Dismantle, count leads, team dinner', 'All', '2027-02-06'],
  ]],
  ['Phase 5 – Post-expo follow-up', '7 Feb – 8 Mar', null, [
    ['Same-day WhatsApp thank-you with brochure and trial link to every lead', 'Sales', '2027-02-06'],
    ['Clean up the leads; assign every A and B lead to a named person', 'Sales + Founder', '2027-02-08'],
    ['Call all A leads; book on-site demos or factory visits', 'Founder + Sales', '2027-02-09'],
    ['Email and WhatsApp B leads with a case study; offer a demo slot', 'Marketing + Sales', '2027-02-15'],
    ['LinkedIn post: thank-you, photos, highlights', 'Marketing', '2027-02-15'],
    ['Run 25 detailed demos and process studies', 'Product + Founder', '2027-02-20'],
    ['Review meeting: leads, demos, pipeline value, cost per lead, lessons learned', 'All', '2027-02-20'],
    ['Send proposals with the expo offer and its 31 Mar deadline', 'Founder', '2027-02-28'],
    ['Decide whether to book the next edition and what to change', 'Founder', '2027-03-08'],
  ]],
];

const SEED_LINKS = [
  ['PrimexERP – ERP Expo 2027 Readiness Plan', 'https://claude.ai/artifact/RArrjMgmaNsAHCsrXnwcqn',
   'Goals, team roles, master timeline, demo stories, stall playbook, follow-up, budget, packing list'],
];

router.seed = function seed() {
  if (query('SELECT id FROM primex_todos LIMIT 1').length === 0) {
    const rows = [];
    let order = 0;
    for (const [phase, week, due, items] of SEED) {
      for (const [title, owner, itemDue] of items) {
        rows.push([phase, week, title, owner, itemDue || due, (order += 10)]);
      }
    }
    runMany(
      'INSERT INTO primex_todos (phase, week, title, owner, due_date, sort_order) VALUES (?,?,?,?,?,?)',
      rows
    );
  }
  if (query('SELECT id FROM primex_links LIMIT 1').length === 0) {
    runMany('INSERT INTO primex_links (title, url, note) VALUES (?,?,?)', SEED_LINKS);
  }
};

// ── Doables ────────────────────────────────────────────────────────────────
router.get('/todos', (req, res) => {
  res.json(query('SELECT * FROM primex_todos ORDER BY sort_order, id'));
});

router.post('/todos', (req, res, next) => {
  try {
    const title = clean(req.body.title, 300);
    const phase = clean(req.body.phase, 80) || 'Other';
    const owner = clean(req.body.owner, 80) || null;
    const due = DATE_RE.test(req.body.due_date || '') ? req.body.due_date : null;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    // New tasks land at the end of their phase.
    const last = query('SELECT MAX(sort_order) AS m FROM primex_todos WHERE phase = ?', [phase])[0];
    const sort = last && last.m != null ? last.m + 1 : 100000;
    const id = run(
      'INSERT INTO primex_todos (phase, week, title, owner, due_date, sort_order) VALUES (?,?,?,?,?,?)',
      [phase, null, title, owner, due, sort]
    );
    res.status(201).json(query('SELECT * FROM primex_todos WHERE id = ?', [id])[0]);
  } catch (e) { next(e); }
});

router.patch('/todos/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const row = query('SELECT * FROM primex_todos WHERE id = ?', [id])[0];
    if (!row) return res.status(404).json({ error: 'Task not found' });
    const b = req.body;
    const next_ = { ...row };
    if ('done' in b) {
      next_.done = b.done ? 1 : 0;
      next_.done_at = b.done ? new Date().toISOString().slice(0, 10) : null;
      next_.done_by = b.done ? req.user.username : null;
    }
    if ('title' in b) {
      const t = clean(b.title, 300);
      if (!t) return res.status(400).json({ error: 'Title is required' });
      next_.title = t;
    }
    if ('owner' in b) next_.owner = clean(b.owner, 80) || null;
    if ('due_date' in b) next_.due_date = DATE_RE.test(b.due_date || '') ? b.due_date : null;
    run(
      'UPDATE primex_todos SET title=?, owner=?, due_date=?, done=?, done_at=?, done_by=? WHERE id=?',
      [next_.title, next_.owner, next_.due_date, next_.done, next_.done_at, next_.done_by, id]
    );
    res.json(query('SELECT * FROM primex_todos WHERE id = ?', [id])[0]);
  } catch (e) { next(e); }
});

router.delete('/todos/:id', (req, res, next) => {
  try {
    run('DELETE FROM primex_todos WHERE id = ?', [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Plan docs / artifacts ──────────────────────────────────────────────────
router.get('/links', (req, res) => {
  res.json(query('SELECT * FROM primex_links ORDER BY id'));
});

router.post('/links', (req, res, next) => {
  try {
    const title = clean(req.body.title, 200);
    const url = clean(req.body.url, 1000);
    const note = clean(req.body.note, 300) || null;
    if (!title || !/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'A title and a full http(s) link are required' });
    }
    const id = run('INSERT INTO primex_links (title, url, note) VALUES (?,?,?)', [title, url, note]);
    res.status(201).json(query('SELECT * FROM primex_links WHERE id = ?', [id])[0]);
  } catch (e) { next(e); }
});

router.delete('/links/:id', (req, res, next) => {
  try {
    run('DELETE FROM primex_links WHERE id = ?', [Number(req.params.id)]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
