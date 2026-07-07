const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./db');
const { requireAuth } = require('./auth');

const app = express();
app.use(cors());
app.use(express.json());

const FRONTEND_DIST = path.resolve(__dirname, '..', 'frontend', 'dist');

getDb().then(() => {
  const leadsRouter    = require('./routes/leads');
  const followupsRouter = require('./routes/followups');
  const authRouter     = require('./routes/auth');
  const usersRouter    = require('./routes/users');

  // Public: auth endpoints
  app.use('/api/auth', authRouter);

  // Protected: all other API routes require a valid session
  app.use('/api/leads',     requireAuth, leadsRouter);
  app.use('/api/followups', requireAuth, followupsRouter);
  app.use('/api/users',     usersRouter); // users router applies requireAuth + requireAdmin itself

  // JSON error handler
  app.use('/api', (err, req, res, next) => {
    console.error('API ERROR:', err && (err.stack || err.message || String(err)));
    res.status(500).json({ error: (err && err.message) || String(err) });
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
    console.log('');
    console.log('  Keep this window open while using the app.');
    console.log('  Close this window to stop the app.');
    console.log('');
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
