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

  // Public: auth endpoints
  app.use('/api/auth', authRouter);

  // Public: shared availability calendar. Deliberately unauthenticated — the
  // share code in the path is the gate, so friends need no account. It touches
  // only the calendar_* tables, never lead or user data.
  app.use('/api/calendar', calendarRouter);

  // Protected: all other API routes require a valid session
  app.use('/api/leads',     requireAuth, leadsRouter);
  app.use('/api/followups', requireAuth, followupsRouter);
  app.use('/api/users',     usersRouter); // users router applies requireAuth + requireAdmin itself

  // JSON error handler
  app.use('/api', (err, req, res, next) => {
    console.error('API ERROR:', err && (err.stack || err.message || String(err)));
    res.status(500).json({ error: (err && err.message) || String(err) });
  });

  // The calendar page itself, told at serve time which API to talk to. Must sit
  // ahead of the SPA fallback or the React app would swallow the URL.
  app.get('/calendar/:code', (req, res) => {
    const code = req.params.code;
    if (query('SELECT id FROM calendar_spaces WHERE share_code = ?', [code]).length === 0) {
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
    const space = query('SELECT share_code FROM calendar_spaces LIMIT 1')[0];
    if (space) {
      console.log('');
      console.log(`  Shared calendar link: /calendar/${space.share_code}`);
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
