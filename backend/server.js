const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { getDb, query } = require('./db');
const { requireAuth } = require('./auth');

const app = express();
// nginx sits in front in production, so the client address arrives in
// X-Forwarded-For. Without this every visitor would look like 127.0.0.1 and
// collapse into a single counted visitor. One hop: only nginx is trusted.
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

const FRONTEND_DIST = path.resolve(__dirname, '..', 'frontend', 'dist');
const CALENDAR_PAGE = path.resolve(__dirname, '..', 'mokla-divas', 'index.html');
const AARTI_PAGE    = path.resolve(__dirname, '..', 'aartisangrah', 'index.html');
const AARTI_AUDIO   = path.resolve(__dirname, '..', 'aartisangrah', 'audio');
const GEM_PAGE      = path.resolve(__dirname, '..', 'kinetic-gem', 'index.html');
const GEM_DIR       = path.resolve(__dirname, '..', 'kinetic-gem');
const SHETE_PAGE    = path.resolve(__dirname, '..', 'shetenavratri', 'index.html');
const SHETE_DIR     = path.resolve(__dirname, '..', 'shetenavratri');

getDb().then(() => {
  const leadsRouter    = require('./routes/leads');
  const followupsRouter = require('./routes/followups');
  const authRouter     = require('./routes/auth');
  const usersRouter    = require('./routes/users');
  const calendarRouter = require('./routes/calendar');
  const calendarAdminRouter = require('./routes/calendarAdmin');
  const statsRouter    = require('./routes/stats');
  const sheteRouter      = require('./routes/shete');
  const sheteAdminRouter = require('./routes/sheteAdmin');
  const { recordVisit } = require('./analytics');

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
  app.use('/api/stats',     statsRouter); // stats router applies requireAuth + requireAdmin itself

  // Public: Shete Parivar Navratri — member directory + photo gallery, both
  // gated by an admin queue. Unauthenticated on purpose, same as /api/calendar:
  // the site itself is open to anyone, submissions just land in a pending
  // table instead of going live.
  app.use('/api/shete', sheteRouter);
  // Protected: reviewing/approving those submissions. Deliberately a separate
  // mount from /api/shete, same split as /api/calendar-admin, so the public
  // surface can never approve its own requests.
  app.use('/api/shete-admin', sheteAdminRouter); // applies requireAuth + requireAdmin itself

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
    recordVisit(req, 'calendar');
    fs.readFile(CALENDAR_PAGE, 'utf8', (err, html) => {
      if (err) return res.status(500).type('text/plain').send('Calendar page missing.');
      const boot = `<script>window.__CAL__=${JSON.stringify({ api: '/api/calendar/' + code })};</script>`;
      res.type('html').send('<!doctype html><html><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        boot + '</head><body>' + html + '</body></html>');
    });
  });

  // Aarti recordings. The page embeds its images as data URIs, but an MP3 is
  // megabytes — inlining one would stall the first paint — so audio is the one
  // asset served as a real file. No max-age: the files get replaced while the
  // recordings are still being cut, and ETag revalidation keeps that honest.
  // express.static answers Range requests, which is what lets the player seek.
  // Which recordings exist. The page reads this and grows a player on each aarti
  // that has one, so adding audio is dropping a numbered file in the folder —
  // no code edit per aarti. Must sit AHEAD of the static mount, or a file
  // literally named manifest.json would shadow the route.
  app.get('/aartisangrah/audio/manifest.json', (req, res) => {
    fs.readdir(AARTI_AUDIO, (err, files) => {
      if (err) return res.json({});   // no folder yet is no recordings, not an error
      const byAarti = {};
      for (const name of (files || []).sort()) {
        if (!/\.mp3$/i.test(name)) continue;
        // A leading number names the aarti: 01-sukhkarta.mp3 is aarti 1. Sorted
        // above so a duplicate prefix resolves to the same file every time.
        const m = name.match(/^(\d{1,3})/);
        if (!m) continue;
        const n = String(parseInt(m[1], 10));
        if (!byAarti[n]) byAarti[n] = '/aartisangrah/audio/' + encodeURIComponent(name);
      }
      res.json(byAarti);
    });
  });

  app.use('/aartisangrah/audio', express.static(AARTI_AUDIO));
  app.use('/aartisangrah/audio', (req, res) => {
    // Without this a missing track would fall through to the SPA and arrive as
    // HTML with a 200, which an <audio> element can only report as a decode error.
    res.status(404).type('text/plain').send('Recording not found.');
  });

  // The offline app shell: manifest, service worker and home-screen icons.
  // index:false AND redirect:false so a bare '/aartisangrah' request falls
  // through to the plain-page route below instead of this middleware
  // 301-redirecting it to '/aartisangrah/' (serve-static's default behavior
  // for a directory-shaped path) — that redirect is what broke the existing
  // link the first time this mount was added; never regress that.
  app.use('/aartisangrah', express.static(path.resolve(__dirname, '..', 'aartisangrah'), {
    index: false,
    redirect: false,
    setHeaders: (res, filePath) => {
      // The service worker's own script must never be served from a stale
      // cache, or a new version can't be discovered until far later than
      // expected — the browser already re-checks it periodically, but a
      // long-lived proxy/CDN cache-control would defeat that.
      if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
    },
  }));

  // Aarti Sangrah — a standalone reader page sharing this process the way the
  // calendar page does, but with no API and no tables of its own: it is one
  // self-contained HTML file, so it is served verbatim. Public (there is nothing
  // private in it) and ahead of the SPA fallback, or React would swallow the URL.
  app.get('/aartisangrah', (req, res) => {
    recordVisit(req, 'aartisangrah');
    res.sendFile(AARTI_PAGE, (err) => {
      // A client that disconnects mid-transfer lands here with the headers
      // already sent — answering again throws ERR_HTTP_HEADERS_SENT, which is
      // uncaught and takes the whole process down with it. On a phone that is
      // just navigating away while the page is still downloading.
      if (err && !res.headersSent) {
        res.status(500).type('text/plain').send('Aarti Sangrah page missing.');
      }
    });
  });

  // The installable, offline-capable copy of Aarti Sangrah — a separate page
  // (app.html) at its own URL, kept apart from the plain /aartisangrah link
  // on purpose: that link is what people already have bookmarked/shared, and
  // it must keep behaving exactly as it always has. This one is meant to be
  // shared as its own link to whoever wants to "install" the reader (Add to
  // Home Screen) for offline use; its service worker is scoped to this path
  // only (see app.html), so it can never take over the plain page even on
  // the same phone.
  app.get('/aartisangrah/app', (req, res) => {
    // Its own key, so the Visitors screen can separate people reading online
    // from people taking the app offline. Note what this can and cannot see:
    // the service worker is cache-first, so once installed the app opens with
    // no request at all. This counts fetches of the page — the first open and
    // the worker's own precache of it — which is close to installs, not to how
    // often it is then read offline. That is unmeasurable by design.
    recordVisit(req, 'aartisangrah-app');
    const AARTI_APP_PAGE = path.resolve(__dirname, '..', 'aartisangrah', 'app.html');
    res.sendFile(AARTI_APP_PAGE, (err) => {
      if (err && !res.headersSent) {
        res.status(500).type('text/plain').send('Aarti Sangrah (app) page missing.');
      }
    });
  });

  // The PrimeGem offline app shell: manifest, service worker and
  // home-screen icons. index:false AND redirect:false for the same reason as
  // the Aarti mount above — without redirect:false, serve-static treats a bare
  // '/kinetic-gem' as a directory root and 301s it to '/kinetic-gem/', which
  // breaks the plain page.
  app.use('/kinetic-gem', express.static(GEM_DIR, {
    index: false,
    redirect: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache');
    },
  }));

  // PrimeGem — a colourful soft-body toy sharing this process the way the
  // calendar and Aarti Sangrah pages do, but with no API and no tables of its
  // own: one self-contained HTML file (canvas-2D physics + rendering, no
  // external libraries), so it is served verbatim. Public and ahead of the
  // SPA fallback, or React would swallow the URL.
  app.get('/kinetic-gem', (req, res) => {
    recordVisit(req, 'kinetic-gem');
    res.sendFile(GEM_PAGE, (err) => {
      // See the Aarti Sangrah route above: a client that disconnects mid-transfer
      // lands here with headers already sent, and answering again would crash
      // the process.
      if (err && !res.headersSent) {
        res.status(500).type('text/plain').send('PrimeGem page missing.');
      }
    });
  });

  // The installable, offline-capable copy, at its own URL so its service
  // worker can be scoped to this path alone and never intercept the plain
  // /kinetic-gem link above.
  //
  // Aarti Sangrah solves this with a second HTML file (app.html). This one
  // injects instead, the way the calendar route injects window.__CAL__,
  // because the gem is one 900-line physics file under active tuning: a
  // forked copy would drift from the original within a session or two, and
  // the only thing the installable version actually needs is a handful of
  // head tags. The plain route above still sends the file untouched.
  const GEM_APP_HEAD =
    '<link rel="manifest" href="/kinetic-gem/manifest.webmanifest">' +
    '<meta name="theme-color" content="#07070c">' +
    '<meta name="mobile-web-app-capable" content="yes">' +
    // iOS Safari ignores most of the manifest but honours these when the page
    // is added to the home screen, which is the only way to install on iOS.
    '<meta name="apple-mobile-web-app-capable" content="yes">' +
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">' +
    '<meta name="apple-mobile-web-app-title" content="PrimeGem">' +
    '<link rel="apple-touch-icon" href="/kinetic-gem/icons/apple-touch-icon-180.png">' +
    '<link rel="icon" href="/kinetic-gem/icons/icon-192.png">' +
    '<script>' +
    "if('serviceWorker' in navigator){window.addEventListener('load',function(){" +
    // The explicit scope is load-bearing: registering a worker that lives at
    // /kinetic-gem/sw.js would otherwise default to controlling everything
    // under /kinetic-gem/, and this must never reach the plain page.
    "navigator.serviceWorker.register('/kinetic-gem/sw.js',{scope:'/kinetic-gem/app'});" +
    '});}' +
    '</script>';

  app.get('/kinetic-gem/app', (req, res) => {
    // Same split as Aarti Sangrah above, and the same caveat about a
    // cache-first worker making repeat offline opens invisible.
    recordVisit(req, 'kinetic-gem-app');
    fs.readFile(GEM_PAGE, 'utf8', (err, html) => {
      if (err) return res.status(500).type('text/plain').send('PrimeGem page missing.');
      res.type('html').send(html.replace('</head>', GEM_APP_HEAD + '</head>'));
    });
  });

  // Shete Parivar Navratri — a public member directory + info site sharing this
  // process the way Aarti Sangrah and PrimeGem do: no API, no tables of its own,
  // plain static files (multiple pages + an assets/ folder, unlike those two's
  // single-file apps). index:false AND redirect:false for the same reason as the
  // other static mounts above — without redirect:false, serve-static treats a bare
  // '/shetenavratri' as a directory root and 301s it to '/shetenavratri/', which
  // breaks the plain link.
  //
  // The sub-pages are plain files served by the static mount below, so they are
  // counted here, just ahead of it — each gets its own key for the Navratri
  // breakdown on the Visitors screen (labels in routes/stats.js).
  const SHETE_COUNTED = {
    '/members.html':     'shetenavratri-members',
    '/history.html':     'shetenavratri-history',
    '/gallery.html':     'shetenavratri-gallery',
    '/devbasavane.html': 'shetenavratri-devbasavane',
  };
  app.use('/shetenavratri', (req, res, next) => {
    if (req.method === 'GET' && SHETE_COUNTED[req.path]) recordVisit(req, SHETE_COUNTED[req.path]);
    next();
  });
  app.use('/shetenavratri', express.static(SHETE_DIR, {
    index: false,
    redirect: false,
  }));

  app.get('/shetenavratri', (req, res) => {
    recordVisit(req, 'shetenavratri');
    res.sendFile(SHETE_PAGE, (err) => {
      // A client that disconnects mid-transfer lands here with headers already
      // sent — answering again would throw ERR_HTTP_HEADERS_SENT and crash the
      // process. See the Aarti Sangrah route above for the same guard.
      if (err && !res.headersSent) {
        res.status(500).type('text/plain').send('Shete Parivar Navratri page missing.');
      }
    });
  });

  // Serve built React app
  app.use(express.static(FRONTEND_DIST));

  // React client-side routing fallback
  app.use((req, res) => {
    // Only real page loads: a missing asset also lands here, and counting those
    // would turn one broken image into a second "visit".
    if (req.accepts('html')) recordVisit(req, 'leadtracker');
    res.sendFile('index.html', { root: FRONTEND_DIST }, (err) => {
      if (err && !res.headersSent) res.status(500).send('Could not serve app.');
    });
  });

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log('');
    console.log('  ✅  Lead Tracker is running!');
    console.log('');
    console.log(`  Open in browser: http://localhost:${PORT}`);
    console.log(`  Aarti Sangrah:   http://localhost:${PORT}/aartisangrah`);
    console.log(`  PrimeGem:        http://localhost:${PORT}/kinetic-gem`);
    console.log(`  PrimeGem app:    http://localhost:${PORT}/kinetic-gem/app  (installable)`);
    console.log(`  Shete Navratri:  http://localhost:${PORT}/shetenavratri`);
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
