const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getDb, query } = require('./db');
const { requireAuth } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

const FRONTEND_DIST = path.resolve(__dirname, '..', 'frontend', 'dist');
const CALENDAR_PAGE = path.resolve(__dirname, '..', 'mokla-divas', 'index.html');

getDb().then(() => {
  const leadsRouter    = require('./routes/leads');
  const followupsRouter = require('./routes/followups');
  const authRouter     = require('./routes/auth');
  const usersRouter    = require('./routes/users');
  const calendarRouter = require('./routes/calendar');
  const calendarAdminRouter = require('./routes/calendarAdmin');

  // Public: auth endpoints
  app.use('/api/auth', authRouter);

  // Public: shared availability calendar. Deliberately unauthenticated — the
  // share code in the path is the gate, so friends need no account. It touches
  // only the calendar_* tables, never lead or user data.
  app.use('/api/calendar', calendarRouter);

  // Protected: creating groups and reading their share links is admin-only, and
  // deliberately lives outside /api/calendar so the public surface can never
  // hand out a code.
  app.use('/api/calendar-admin', calendarAdminRouter);

  // Protected: all other API routes require a valid session
  app.use('/api/leads',     requireAuth, leadsRouter);
  app.use('/api/followups', requireAuth, followupsRouter);
  app.use('/api/users',     usersRouter); // users router applies requireAuth + requireAdmin itself

  // Anything under /api that matched no route above is a 404 in JSON. Without
  // this it falls through to the SPA fallback and answers 200 with React's HTML,
  // which no API client can make sense of.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // JSON error handler
  app.use('/api', (err, req, res, next) => {
    console.error('API ERROR:', err && (err.stack || err.message || String(err)));
    res.status(500).json({ error: (err && err.message) || String(err) });
  });

  // The calendar page itself, told at serve time which API to talk to. Must sit
  // ahead of the SPA fallback or the React app would swallow the URL.
  app.get('/calendar/:code', (req, res) => {
    const code = req.params.code;
    if (query('SELECT id FROM calendar_groups WHERE share_code = ?', [code]).length === 0) {
      return res.status(404).type('text/plain').send('Unknown calendar link.');
    }
    fs.readFile(CALENDAR_PAGE, 'utf8', (err, html) => {
      if (err) return res.status(500).type('text/plain').send('Calendar page missing.');
      const boot = `<script>window.__CAL__=${JSON.stringify({ api: '/api/calendar/' + code })};</script>`;
      res.type('html').send('<!doctype html><html><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        boot + '</head><body>' + html + '</body></html>');
    });
  });

  // Serve built React app
  app.use(express.static(FRONTEND_DIST));

  // React client-side routing fallback
  app.use((req, res) => {
    res.sendFile('index.html', { root: FRONTEND_DIST }, (err) => {
      if (err) res.status(500).send('Could not serve app.');
    });
  });

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log('');
    console.log('  ✅  Lead Tracker is running!');
    console.log('');
    console.log(`  Open in browser: http://localhost:${PORT}`);
    const groups = query(
      'SELECT name_en, share_code FROM calendar_groups ORDER BY sort_order, id'
    );
    if (groups.length) {
      console.log('');
      console.log('  Calendar links (one per group — manage them under Calendar Links):');
      for (const g of groups) {
        console.log(`    ${g.name_en}: /calendar/${g.share_code}`);
      }
    }
    console.log('');
    console.log('  Keep this window open while using the app.');
    console.log('  Close this window to stop the app.');
    console.log('');
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
