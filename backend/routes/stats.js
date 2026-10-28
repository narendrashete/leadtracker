const express = require('express');
const { query } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { todayLocal } = require('../analytics');

const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

// Friendly names for the pages we count. Anything not listed still appears,
// under its raw key, rather than being silently dropped.
const PAGE_LABELS = {
  aartisangrah:       'Aarti Sangrah — online',
  'aartisangrah-app': 'Aarti Sangrah — installed app',
  'kinetic-gem':      'PrimeGem — online',
  'kinetic-gem-app':  'PrimeGem — installed app',
  calendar:           'Mokla Divas calendar',
  shetenavratri:      'Shete Parivar Navratri',
  'shetenavratri-app': 'Shete Parivar Navratri — installed app',
  rishta:             'Rishta Album',
  'prime-api':        'Prime API Integration demo',
  primexai:           'PrimeXAI savings dashboard',
  thigdam:            'Thigdam photo album',
  kulgaon:            'Kulgaon member list',
  leadtracker:        'Lead Tracker app'
};

// The Shete Navratri site's own breakdown, in the order its dashboard shows
// them. Its sub-pages are listed here rather than in the main list above.
// "aartisangrah" counts only clicks on the dashboard's Aarti Sangrah button,
// which links to /aartisangrah?from=navratri (see server.js).
const NAVRATRI_PAGES = {
  'shetenavratri-members':     'Members List',
  'shetenavratri-aarti':       'aartisangrah',
  'shetenavratri-history':     'Navratri History',
  'shetenavratri-gallery':     'gallery',
  'shetenavratri-devbasavane': 'devbasavane',
  'shetenavratri-upcoming':    'Upcoming Event',
  'shetenavratri-familytree':  'Family tree — editor',
  'shetenavratri-tree':        'Family tree — viewer'
};

function daysBack(n) {
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  const p = v => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

router.get('/', (req, res, next) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    const from = daysBack(days);
    const today = todayLocal();

    // Visitors for a day are its rows; views are their counters summed.
    const daily = query(
      `SELECT day,
              COUNT(*)    AS visitors,
              SUM(views)  AS views
       FROM page_hits WHERE day >= ?
       GROUP BY day ORDER BY day`, [from]
    );

    const counted = query(
      `SELECT page,
              COUNT(*)   AS visitors,
              SUM(views) AS views
       FROM page_hits WHERE day >= ?
       GROUP BY page`, [from]
    );
    const byPage = Object.fromEntries(counted.map(r => [r.page, r]));

    // Every surface we can name is listed, even at zero. Grouping only over
    // recorded rows means a page nobody has opened yet vanishes from the
    // screen, and "no visits" then looks exactly like "counting is broken" —
    // which is how the installable apps read on the day they were split out.
    const pages = [
      ...Object.keys(PAGE_LABELS).map(page => ({
        page,
        label: PAGE_LABELS[page],
        visitors: (byPage[page] && byPage[page].visitors) || 0,
        views: (byPage[page] && byPage[page].views) || 0
      })),
      // A key recorded before it had a label still shows, under its raw name.
      ...counted.filter(r => !PAGE_LABELS[r.page] && !NAVRATRI_PAGES[r.page])
        .map(r => ({ ...r, label: r.page }))
    ].sort((a, b) => b.views - a.views || a.label.localeCompare(b.label));

    const navratri = Object.keys(NAVRATRI_PAGES).map(page => ({
      page,
      label: NAVRATRI_PAGES[page],
      visitors: (byPage[page] && byPage[page].visitors) || 0,
      views: (byPage[page] && byPage[page].views) || 0
    }));

    const byDay = Object.fromEntries(daily.map(r => [r.day, r]));
    const todayRow = byDay[today] || { visitors: 0, views: 0 };

    const allTime = query(
      `SELECT SUM(views) AS views, COUNT(*) AS visitor_days, MIN(day) AS first_day
       FROM page_hits`
    )[0] || {};

    // Fill the gaps so a quiet day is a zero on the chart, not a missing bar.
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = daysBack(i + 1);
      const row = byDay[day];
      series.push({ day, visitors: row ? row.visitors : 0, views: row ? row.views : 0 });
    }

    res.json({
      today: { day: today, visitors: todayRow.visitors || 0, views: todayRow.views || 0 },
      period: {
        days,
        from,
        // Named to be honest about what it is: the same person returning on
        // three days counts three times. Cross-day identity is not recoverable
        // by design — see analytics.js.
        visitor_days: daily.reduce((n, r) => n + r.visitors, 0),
        views: daily.reduce((n, r) => n + (r.views || 0), 0)
      },
      all_time: {
        views: allTime.views || 0,
        visitor_days: allTime.visitor_days || 0,
        first_day: allTime.first_day || null
      },
      daily: series,
      pages,
      navratri
    });
  } catch (err) {
    next(err);
  }
});

// Shete Navratri family trees: who has made one, how far along it is, and the
// change log behind it (shete_tree_log, written by routes/shete.js and
// routes/sheteAdmin.js). Not limited to the day range — trees are few.
function countPersons(node) {
  return 1 + (node.children || []).reduce((n, c) => n + countPersons(c), 0);
}

router.get('/trees', (req, res, next) => {
  try {
    const trees = query(
      `SELECT t.member_id AS memberId, t.owner_name AS ownerName, t.status, t.data,
              t.created_at AS createdAt, t.updated_at AS updatedAt, t.approved_at AS approvedAt,
              m.name, m.village, m.mobile
       FROM shete_family_trees t JOIN shete_members m ON m.id = t.member_id
       ORDER BY t.updated_at DESC`
    ).map(r => {
      let data = null;
      try { data = JSON.parse(r.data); } catch { /* unreadable tree: shown without counts */ }
      // Admin copies are owned by "Admin (<source> यांच्या वृक्षावरून कॉपी)".
      const copy = /^Admin \((.+) यांच्या वृक्षावरून कॉपी\)$/.exec(r.ownerName);
      return {
        memberId: r.memberId, name: r.name, village: r.village, mobile: r.mobile,
        filledBy: copy ? null : r.ownerName, copiedFrom: copy ? copy[1] : null,
        status: r.status, persons: data ? countPersons(data) : 0, root: data ? data.name : '',
        // NULL for trees made before created_at existed (see db.js).
        createdAt: r.createdAt, updatedAt: r.updatedAt, approvedAt: r.approvedAt
      };
    });

    const log = query(
      `SELECT l.member_id AS memberId, l.action, l.by_name AS byName, l.via, l.persons, l.note, l.at,
              m.name
       FROM shete_tree_log l LEFT JOIN shete_members m ON m.id = l.member_id
       ORDER BY l.id DESC LIMIT 100`
    );

    res.json({ trees, log });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
