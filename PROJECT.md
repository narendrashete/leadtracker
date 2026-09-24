# PROJECT.md — Lead Tracker

Live state of the project. Stable rules/patterns/conventions live in `CLAUDE.md` instead —
don't duplicate them here. Update this file at the end of every coding session.

## Project Overview
Sales-pipeline web app for one company's admin/marketing team: capture leads, log follow-ups,
view a Kanban-style pipeline board, and pull CSV reports. Single Node/Express process serves
both the API and the built React SPA.

## Current Development Phase
Live in production, single-tenant, actively used. Not in active feature development as of
this entry — most recent work was a UI redesign pass (corporate card layout) and adding
address/city/state to leads.

## Completed Features
- Auth: username/password login, PBKDF2 hashes, bearer-token sessions, admin/user roles,
  master `admin` account protected from reset/delete.
- Pipeline Board: 4 derived columns (Leads Received / Followed / Converted / Dropped).
- New Lead form: server-generated `ENQ-YYYY-NNN` enquiry IDs, company/contact fields, address
  with city/state autocomplete (sourced from existing lead data, no master-data table).
- Lead Detail Drawer: view/edit any lead, view its follow-up history, corporate card layout.
- Follow-ups: add dated discussion entries against a lead.
- Reports: status pie chart (hover breakdown) + date-range table with CSV export.
- Admin: user management (add / reset password / delete), admin-only.
- Visitors: server-side page-view counting for the public pages and the app itself, with an
  admin-only screen showing today's figures, a 7/30/90-day trend, and a per-page breakdown.
- Aarti Sangrah: a Marathi aarti reader (18 aartis) hosted by the same Express process at
  `/aartisangrah`, reachable from the sidebar. Standalone single HTML file — no API, no
  tables, no auth. See `CLAUDE.md` → Aarti Sangrah.
- PrimeGem: a colourful interactive soft-body toy (twist/stretch/press/pull/push) hosted by
  the same Express process at `/kinetic-gem` (path keeps the old name — installed phones
  launch it), reachable from the sidebar. Standalone single
  HTML file, own canvas-2D physics/renderer — no API, no tables, no auth. See `CLAUDE.md` →
  PrimeGem. Also installable and fully offline at `/kinetic-gem/app` (Add to Home Screen on
  Android/iOS) — the same file with PWA tags injected, not a forked copy.

## Features In Progress
- **Aarti audio playback** — the player is live, and which aartis have one is driven by the
  contents of `aartisangrah/audio/`: drop `NN-name.mp3` and aarti NN grows a player.
  Three recordings are in (aartis 1, 4 and 5), cut from the one supplied file. The
  remaining sixteen are still to come.
  The supplied MP3 is a rough cut (4:50, and it still contains two aartis), kept deliberately
  until the behaviour is signed off. Next: replace that file with a clean cut, then add the
  remaining recordings — each needs only its MP3 in `aartisangrah/audio/` plus an `audio`
  field on its entry. Worth deciding before then whether ~19 MP3s belong in git (this one is
  3.9 MB) or on the server outside the repo.

## Pending Features
None currently tracked — see Future Ideas for unscoped possibilities.

## Current Sprint
None — no active sprint/task board for this project.

## Architecture Overview
Single Express process serves `/api/*` and the built React SPA (`frontend/dist`) on one port.
sql.js (WASM SQLite) holds the DB in memory and flushes the full file to disk on every write.
See `CLAUDE.md` → Architecture for the diagram; this section tracks only deviations from it,
and there are none currently.

## Database Schema Summary
Three tables, no foreign-key enforcement beyond an unchecked `REFERENCES`, no indexes beyond
the implicit primary keys, no views/triggers/stored procedures (sql.js/SQLite feature set used
minimally by design).

**leads**
| column | type | notes |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| enquiry_id | TEXT UNIQUE NOT NULL | `ENQ-YYYY-NNN`, server-generated |
| date | TEXT NOT NULL | |
| company_name | TEXT NOT NULL | only required field on create |
| contact_person, contact_no, email | TEXT | |
| address, city, state | TEXT | added post-launch, nullable (backfills via ALTER TABLE) |
| required_software, customer_description, committed_to_customer | TEXT | |
| next_followup_date | TEXT | |
| status | TEXT NOT NULL DEFAULT 'In-Process' | drives pipeline column, see `CLAUDE.md` |
| created_at | TEXT NOT NULL DEFAULT now | |

**followups**
| column | type | notes |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| lead_id | INTEGER NOT NULL REFERENCES leads(id) | |
| followup_date | TEXT NOT NULL | |
| discussion | TEXT | |
| created_at | TEXT NOT NULL DEFAULT now | |

**users**
| column | type | notes |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| username | TEXT UNIQUE NOT NULL COLLATE NOCASE | |
| password_hash | TEXT NOT NULL | `salt:pbkdf2hash` |
| role | TEXT NOT NULL DEFAULT 'user' | `admin` \| `user` |
| created_at | TEXT NOT NULL DEFAULT now | |

**Migration history:** additive-only, applied automatically on `getDb()` startup —
`address`/`city`/`state` columns added to `leads` (guarded `ALTER TABLE`, tolerant of already
existing). No separate migration files/framework.

## API Inventory
Base path `/api`. All responses JSON; errors are `{ error }` with a 4xx/5xx status.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | /auth/login | public | `{ username, password }` → `{ token, user }` |
| POST | /auth/logout | user | invalidates the bearer token |
| GET | /auth/me | user | returns `req.user` |
| GET | /leads | user | all leads + `followup_count`, newest first |
| POST | /leads | user | creates a lead; only `company_name` required |
| GET | /leads/next-enquiry-id | user | preview of the next `ENQ-YYYY-NNN` |
| GET | /leads/meta/locations | user | distinct `{ cities, states }` for autocomplete |
| GET | /leads/:id | user | lead + its follow-ups |
| PUT | /leads/:id | user | full-record update |
| GET | /followups?lead_id= | user | follow-ups for a lead |
| POST | /followups | user | add a follow-up |
| GET | /users | admin | list users (no password hashes) |
| POST | /users | admin | create a `user`-role account |
| PUT | /users/:id/reset-password | admin | blocked for `admin`-role target |
| DELETE | /users/:id | admin | blocked for `admin`-role target |

No API versioning (single unversioned `/api` surface) — appropriate at current scope.

## Frontend Pages
Routes defined in `frontend/src/App.jsx`, gated by `AuthContext`:
| Path | Component | Access |
|---|---|---|
| /board | PipelineBoard | any logged-in user |
| /new-lead | NewLeadForm | any logged-in user |
| /followups | FollowupScreen | any logged-in user |
| /reports | Reports | any logged-in user |
| /users | UserManagement | admin only |
| / and unknown paths | redirect → /board | — |
| (logged out) | LoginPage | — |

## Reusable Components
- `Layout/Sidebar` — persistent nav shell.
- `Board/BoardColumn`, `Board/LeadCard` — pipeline board building blocks.
- `Leads/LeadDetailDrawer` — slide-over edit view, reused from the board and (indirectly)
  anywhere a lead needs inspecting.
- `Followups/AddFollowupModal` — modal for logging a follow-up.
- `Reports/StatusPieChart`, `Reports/DetailedReport` — report building blocks.

## Business Rules
- Pipeline column is derived, not stored (see `CLAUDE.md` → Pipeline Column Logic).
- Enquiry IDs are sequential per calendar year, server-generated with collision retry.
- Only `company_name` is required to create a lead; everything else is optional.
- Master `admin` account can never be reset or deleted, enforced server-side.
- City/state autocomplete has no master-data table — it's sourced from distinct values
  already present in `leads`.

## Integrations
None. No third-party APIs, no email/SMS, no payment provider, no analytics/telemetry.

## Environment Variables
| Var | Required | Default | Purpose |
|---|---|---|---|
| PORT | no | 3001 | Express listen port |
| ADMIN_SEED_PASSWORD | recommended in prod | `admin123` (dev-only, warns on console) | initial `admin` account password on first DB creation |

No `.env` file is checked in or required for local dev; `.env` is git-ignored for future use.

## Configuration
No config files beyond `frontend/vite.config.js` (build) and `frontend/eslint.config.js`
(lint rules, not enforced in a build gate). No feature flags.

## Deployment Status
Live at `https://leadtracker.primecomputers.co.in`. See `CLAUDE.md` → Deployment Notes for
the full update procedure. Current known-good state: last deployed change was the
address/city/state field addition + corporate card layout redesign (commits `a15131a`,
`1337d82`, `4b9541d`).

## Known Bugs
None currently tracked.

## Known Limitations
- Sessions are in-memory: every restart/`pm2 reload` logs all users out.
- No automated tests.
- No pagination on `/leads` or `/followups` — fine at current data volume, would need
  revisiting if lead count grows into the tens of thousands.
- No password-strength or rate-limiting on login.

## Technical Debt
None flagged beyond the limitations above; codebase is small and current with its own
conventions.

## Performance Improvements
None planned — not a bottleneck at current scale (see `CLAUDE.md` → Performance Rules).

## Recent Refactoring
- Lead detail drawer and New Lead form redesigned to a shared corporate card-based layout
  (commits `4b9541d`, `1337d82`).

## Upcoming Tasks
None currently queued.

## Future Ideas
Unscoped, not committed to — do not build without an explicit ask:
- Rate limiting / lockout on login.
- Persistent (DB- or Redis-backed) sessions surviving restarts.
- Automated test coverage for route handlers.

## Change Log
- **2026-09-24** — Visitors screen: added a "Shete Parivar Navratri — pages" breakdown
  (Members List, aartisangrah, Navratri History, gallery, devbasavane). The four sub-pages
  are now counted by a small middleware ahead of the `/shetenavratri` static mount
  (`SHETE_COUNTED` in `server.js`); counts start from this deploy. The aartisangrah row is
  the existing Aarti Sangrah online count (tinyurl.com/aartibook redirects there), so it
  includes readers from every source, not only the Navratri site.
- **2026-09-22** — Extended PrimeGem's "Developed by Prime Computers" credit (clickable logo
  linking to `https://www.primecomputers.co.in`, inlined as the same base64 PNG data URI so
  no page gains an external request) to Aarti Sangrah and the Navratri site. Aarti Sangrah:
  added a `.credit-row` under the masthead's `.sub` line in both `index.html` and `app.html`
  (kept identical, per that section's fork rule), with a light chip behind the logo — the
  brand navy is unreadable straight on the maroon masthead gradient, the same fix the gem
  credit already uses for its near-black background. Navratri: added a `.footer-credit` row
  under `index.html`'s existing `©` footer note, styled in `assets/css/style.css`; the site's
  cream background is already light enough that the logo needed no chip. Not added to
  `members.html`/`history.html`/`gallery.html` — the homepage footer is the site's one
  attribution spot, same as the single credit on PrimeGem's page.
- **2026-09-22** — Fixed the Navratri gallery photo caption, which appeared as a narrow sideways
  column clipped at the right edge of the lightbox. `.modal-overlay` is `display:flex` with the
  default row direction, so the photo and `.modal-caption` were flex siblings sharing the width
  and the caption got whatever the photo did not take. Set `flex-direction:column` so the
  caption stacks under the photo, trimmed the image to `max-height:76vh` to leave room for it,
  and gave the caption `line-height:1.5`, `max-width:min(90vw,640px)`, `padding:0 60px` (clear
  of the nav arrows) and `flex-shrink:0`. CSS only — `gallery.js` still builds the text as
  `caption — year`. `admin.html`'s `#previewOverlay` reuses the same classes, so it is fixed
  too. Verified in Chromium at 390px and 1280px, with both a short and a two-line caption.
- **2026-09-22** — Moved the Navratri history list from a static JS array to a new
  `shete_history` DB table (id, name, village, year — nullable village/year for entries like
  sr 31 that have no recorded detail yet), one-time seeded from the same 31-entry transcription
  as the previous static version. Added `GET /api/shete/history` (public, ordered by year with
  nulls last) and, in `sheteAdmin.js`, `GET/POST /history` + `PATCH/DELETE /history/:id` behind
  requireAuth+requireAdmin. `history.html`/`history.js` now fetch live instead of shipping the
  data in the JS file. New "इतिहास यादी" tab in `/shetenavratri/admin.html` lets the admin add a
  new year, edit an existing entry, or delete one — same live-edit pattern as the सभासद यादी
  संपादन tab added the same day. No request/approval queue here (unlike members/gallery) since
  this is the admin's own record, not something friends submit.
- **2026-09-22** — Filled in the `history.html` (आत्तापर्यंतची नवरात्री झालेली यादी) placeholder
  with the actual record: 31 entries (यजमान + वर्ष + गाव), transcribed from a supplied register
  PDF, 1991–2020 plus one pending entry (sr 31, year/village not yet supplied). Static data
  array in a new `assets/js/history.js` (no DB table, no API — same "plain HTML, no build
  step" pattern as the rest of this page and gallery.html), with a search box matching
  members.html's, filtering by name/village/year. Superseded the same day by the DB-backed
  version above. Replaced the unused `.history-card`/`.year-list`/`.year-item` placeholder CSS
  with `.history-list`/`.history-item` styled like `.member-card`.
- **2026-09-21** — Added a "सभासद यादी संपादन" (roster edit) tab to the Shete Navratri admin
  page (`/shetenavratri/admin.html`, shared login with the Lead Tracker admin account). Until
  now the admin queue only approved/rejected *new* member requests
  (`routes/sheteAdmin.js`); there was no way to correct a name or mobile number already in
  `shete_members` short of a manual DB edit. Added `GET /api/shete-admin/members` (full
  roster) and `PATCH /api/shete-admin/members/:id` (update name/name_en/village/village_en/
  mobile, with mobile-uniqueness and format checks), both behind the existing
  requireAuth+requireAdmin router. `members.html` already reads the live `shete_members` table
  via `/api/shete/members/approved`, so a save in the new tab appears on the public page
  immediately — no redeploy needed.
- **2026-09-21** — Moved the two unnumbered recordings (आरती सप्रेम जय जय विठ्ठल, जय देव जय देव
  दत्त अवधूता) out of `aartisangrah/audio/` into a git-ignored `audio/archived/`. They had no
  matching aarti, so the manifest could never surface them, yet 7.3 MB shipped on every pull.
  They stay local until they are numbered; the copies are recoverable from history either way.
- **2026-09-16** — The Visitors breakdown now lists every labelled page even at zero. It
  previously grouped only over recorded rows, so the newly split installable-app surfaces
  were absent until someone opened them — indistinguishable from the counter being broken.
- **2026-09-16** — Split the Visitors breakdown so the online reader and the installable app
  are counted separately (`aartisangrah` vs `aartisangrah-app`, and the same for PrimeGem);
  both previously recorded under one key and collapsed into a single bar. The `-app` figure
  approximates installs rather than offline readers — the service worker is cache-first, so
  opens after installation never reach the server. Hits recorded before this change stay
  under the online key and cannot be separated retroactively.
- **2026-09-16** — Renamed the toy from "Kinetic Gem" to **PrimeGem** and branded it: new
  `<title>`, masthead, manifest `name`/`short_name` and `apple-mobile-web-app-title` (so the
  home-screen label changes too), plus a "Developed by Prime Computers" credit on the page
  linking to `https://www.primecomputers.co.in`, with the logo inlined as a base64 PNG data
  URI so the page still makes zero external requests. `CACHE_VERSION` bumped to `gem-v2` —
  without that, already-installed phones would keep showing the old name. **The folder and
  URL stay `kinetic-gem`**: the app was installed at `/kinetic-gem/app`, and the manifest
  `start_url`/`scope` and the service-worker scope all point there, so renaming the path
  would strand every installed copy.
- **2026-09-16** — Made Kinetic Gem installable and fully offline at `/kinetic-gem/app`
  (`manifest.webmanifest`, `sw.js`, `icons/`), same Add-to-Home-Screen distribution as the
  Aarti Sangrah app. Unlike that one it is **not** a forked second HTML file: the route serves
  the same `index.html` with PWA head tags injected, the way the calendar route injects
  `window.__CAL__`, because the gem is one physics file under active tuning and two copies
  would drift. Service worker scoped explicitly to `/kinetic-gem/app`, so the plain
  `/kinetic-gem` link is never intercepted (verified: `controller === null` there). Icons are
  rendered from the gem's own renderer. Verified at iPhone viewport: worker registers, shell
  caches, and an offline reload still renders and deforms under touch.
- **2026-09-16** — Made Kinetic Gem work properly on a phone. Three real bugs: the gem was
  sized with a fixed pixel focal length, so on a 390px-wide screen it was *wider than the
  viewport* (clipped at both edges, no background left to orbit-drag) — `FOCAL` and the grab
  threshold are now derived from the viewport on resize; the two-finger press/twist gestures
  were separate modes chosen by how far apart the fingers landed, making twist unreachable on
  a phone, and now run simultaneously like a map's pinch-and-rotate; and iOS Safari would have
  zoomed the page instead of passing the gesture through, since it ignores `user-scalable=no`.
  Also re-anchors the grab when one finger of a pinch lifts, and shows touch-specific hint
  copy. Verified at iPhone viewport with touch emulation: 60fps idle and dragging.
- **2026-09-16** — Added Kinetic Gem, a colourful soft-body toy you twist, stretch, press,
  pull and push into new shapes with the mouse or touch: `kinetic-gem/index.html` (one
  self-contained file — canvas-2D PBD physics + rasteriser, no three.js/WebGL, no external
  libraries) and a public `/kinetic-gem` route in `server.js` serving it verbatim ahead of the
  SPA fallback, plus a **Kinetic Gem** sidebar entry (plain `<a target="_blank">`, same
  pattern as Aarti Sangrah). No API, no tables, no auth — shares the repo and Express process
  for hosting only. See `CLAUDE.md` → Kinetic Gem for the physics/interaction design.
- **2026-09-15** — Added an installable, fully-offline copy of Aarti Sangrah at
  `/aartisangrah/app` (`aartisangrah/app.html`, `manifest.webmanifest`, `sw.js`, `icons/`) for
  distributing the reader directly to family/friends without an app store — "Add to Home
  Screen" on Android or iOS installs it, and its service worker precaches the page and every
  recording (~30 MB) on first visit so it needs no internet after that. Deliberately a separate
  file from `index.html`, not a flag on it: the existing `/aartisangrah` link had to keep
  behaving exactly as it does today for people already using it, so nothing PWA-related
  (manifest link, meta tags, service-worker registration) was added there, and the service
  worker registers with an explicit scope so it can never take control of that page even on a
  device that has both links open. Caught and fixed a real bug in testing: the static mount
  added to serve the manifest/icons/`sw.js` was 301-redirecting the plain `/aartisangrah` link
  before `redirect: false` was added — see the Aarti Sangrah — offline app section of
  CLAUDE.md for the full explanation and the invariants any future change here must preserve.
- **2026-09-15** — Aarti Sangrah content update: swapped aarti 9 (साईबाबा) for
  श्री संत गजानन महाराजांची आरती and removed its recording (no matching audio supplied);
  inserted हनुमान आरती as new aarti 11, pushing घालिन लोटांगण/मंत्रपुष्पांजली/उत्सवी प्रार्थना
  down one slot each, with its recording renamed to lead with `11-`. Added a **नवरात्र आरती**
  section — आरती जगदंबेची, खंडोबाची आरती, आरती मैराळाची, जोगवा, फुलवरा — as aartis 15-19.
  This is the first grouped section in the reader: entries carry a `section` +
  `sectionLabel` field, the अनुक्रमणिका (index modal) collapses same-section entries into one
  folder row and drills into a numbered (1..n) sublist with a "मुख्य यादीकडे परत" row to back
  out, and each grouped aarti's page shows a "← \<section\> कडे परत" link that reopens the
  modal straight into that drilled view. Search still matches grouped entries directly and
  bypasses the folder view, since a targeted lookup shouldn't require browsing. Swipe/prev-next
  and the page-turn numbering stay fully linear across all 19 entries — grouping is purely an
  index/modal concept, not a second navigation mode. All recordings renumbered to keep the
  `NN-name.mp3` prefix aligned with each entry's new array position (see the Aarti Sangrah
  section of CLAUDE.md for the manifest-matching rule this depends on).
- **2026-09-15** — Split the supplied recording into its three aartis and shipped them:
  सुखकर्ता (1, 1:24), लवथवती विक्राळा (4, 1:58) and दुर्गे दुर्घट भारी (5, 1:26). Cut without
  re-encoding, at the quietest point near each stated boundary rather than at the stated
  second, so no word is clipped and each track opens with a short lead-in.
- **2026-09-15** — Recordings are now discovered from `aartisangrah/audio/` via a
  `manifest.json` route instead of being hard-coded per aarti: a file whose name starts with
  the aarti's number becomes that page's track, so adding audio is dropping a file in the
  folder. No code edit and no restart needed.
- **2026-09-14** — Added visitor counting and a **Visitors** admin screen: daily unique
  visitors and page views for Aarti Sangrah, the calendar and the Lead Tracker app itself.
  Counted server-side in `analytics.js` (new `page_hits` and `app_meta` tables, new admin-only
  `/api/stats`), with the visitor identified by a daily-rotating salted hash rather than a
  stored address — so uniqueness is meaningful within a day and deliberately not across days.
  Bots and link-preview fetchers are excluded. `trust proxy` set so the real client address
  survives nginx.
- **2026-09-14** — Fixed scrolling being dead on every aarti page, a regression from the seek
  bar. `.player` was left unclosed, so `.page-content` parsed as a child of
  `.page-title-wrap` instead of `.page-card` and lost the flex context its `flex:1` +
  `overflow-y:auto` depend on. Pages looked right at the top and simply would not scroll.
- **2026-09-14** — Added a draggable seek bar to the aarti player, and fixed a crash it
  uncovered. The bar is a native range input showing elapsed and total time; it knows the
  duration before playback because the `<audio>` element is now built with
  `preload='metadata'` when the page renders, so a listener can drag to a starting point and
  then press play. Dragging previews and releasing commits, to avoid a range request per
  pixel. **Crash fix:** both `res.sendFile` callbacks in `server.js` answered again after a
  client disconnected mid-transfer, throwing an uncaught `ERR_HTTP_HEADERS_SENT` that killed
  the process and logged every Lead Tracker user out; they now check `res.headersSent`.
- **2026-09-14** — Added a mini audio player to the Aarti Sangrah reader, wired to aarti 1
  only for now. Play buffers and starts the recording, swapping the play button for pause and
  stop while music notes drift upward beside them; pause holds the position, stop returns to
  the initial play-only state. Recordings are served as static files at `/aartisangrah/audio`
  (Range-capable, so seeking works) rather than inlined, unlike the page's images.
- **2026-09-13** — Added an animated Ganpati puja medallion to the left of the Aarti Sangrah
  masthead, balancing the शेटे परिवार seal on the right: a 180px looping GIF (idol, burning
  agarbatti, rising smoke) drawn as an SVG scene and rendered frame by frame, embedded as a
  data URI. Frames are delta-encoded against each other, which kept it to 51 KB; the page is
  now ~160 KB.
- **2026-09-13** — Added a 19th Aarti Sangrah page, **उत्सवी प्रार्थना**: ten named shlokas
  (घालीन लोटांगण through धर्माच्या करिता) in recitation order on one page. Introduced a `## `
  prefix convention in `body` for sub-headings so each shloka gets its own title and a gold
  separating rule. Four of the ten also exist as standalone pages in different wordings
  (13, 14, 15) — kept deliberately, since this page is the sequence read start to finish.
- **2026-09-13** — Tapping the masthead seal now opens it enlarged and centred, so the
  family name and वाडा line can actually be read. The embedded artwork was re-cut at 360px /
  192 colours to stand up to that size; the lightbox borrows the masthead image's `src` so
  the data URI still appears only once. Closes on a tap anywhere, the × button, or Escape.
- **2026-09-13** — Added the शेटे परिवार family seal to the Aarti Sangrah masthead, top right.
  Embedded as a base64 PNG data URI (the page is one self-contained file), cut from the
  supplied artwork along its scalloped edge with a transparent surround so it blends into the
  masthead gradient — which also removed the white screenshot strip along the top and the
  stray lavender sparkle at the bottom. Absolutely positioned, so the centred title does not
  shift.
- **2026-09-13** — Hosted the Aarti Sangrah reader in this app: added
  `aartisangrah/index.html` (one self-contained file, 18 aartis, index sheet + Devanagari and
  transliteration search) and a public `/aartisangrah` route in `server.js` serving it
  verbatim ahead of the SPA fallback, plus an **Aarti Sangrah** sidebar entry — a plain
  `<a target="_blank">`, since the page is not a React route. No API, no tables, no auth: it
  shares the repo and the Express process for hosting only, with no coupling to leads,
  follow-ups, users, or the calendar. The startup banner now prints its URL.
- **2026-09-12** — Added a second kind of mark so friends can say a date *suits* them, not
  only that they are busy: `calendar_marks.mark_kind` (`busy` | `prefer`, additive column,
  kind-aware unique index replacing the old one). Each friend who prefers a date adds a
  yellow dot to it; when every friend in the group has, the dots and the cell border turn
  fluorescent green and the date is listed above the free-day count. The two kinds are
  mutually exclusive per friend per date. The day sheet now lists who prefers the date and
  who can't make it, with a toggle for each.
- **2026-09-10** — Gave every calendar group its own share link, so a friend sees only their
  own group: `calendar_groups.share_code` (additive column, backfilled — the first group
  inherits the old install-wide code so a circulated link keeps working), the public API
  rescoped to the one group its code resolves to, group creation moved behind a new
  admin-only `/api/calendar-admin`, and a **Calendar Links** page added to the SPA for
  creating groups and copying, rotating or deleting their links. Unmatched `/api/*` paths now
  return `404 {error}` instead of falling through to the SPA's HTML with a 200.
- **2026-09-09** — Self-hosted the shared calendar so the link is public: new public
  `/api/calendar` routes and a `/calendar/<share-code>` page route in the Express app, with
  `calendar_spaces` / `calendar_groups` / `calendar_marks` tables added to `leads.db`. The
  share code is printed at startup. The page detects whether it is running on the server or
  as a Claude Artifact and uses the matching store.
- **2026-09-09** — Fixed marks being dropped after the first one in the calendar page:
  snapshot data from the Artifact store is frozen, and it was being mutated in place.
- **2026-09-09** — Added `mokla-divas/index.html`: a standalone shared availability calendar
  for the Funda and Thigdam friend groups (English/Marathi, one page, no backend — published
  as a Claude Artifact whose `db` capability holds the shared marks). Not part of the Lead
  Tracker app; it shares the repo only for storage and has no coupling to `backend/` or
  `frontend/`.
- **2026-07-15** — Pipeline Board cards now show enquiry date and city; board sorts leads by
  enquiry date descending (newest first) before grouping into columns.
- **2026-07-13** — Documentation Steward process adopted: created `PROJECT.md`, expanded
  `CLAUDE.md` with full section set (no code changes this session).
- **a15131a** — Added address, city, and state fields to leads, with autocomplete sourced
  from existing data.
- **1337d82** — Applied corporate card layout to the New Lead page.
- **4b9541d** — Redesigned the lead detail drawer with a corporate card-based layout.
- **4b8e718** — Corrected deployment docs: real production is Ubuntu/nginx/PM2 (Hostinger
  VPS via hPanel console), not the previously-documented Windows/IIS/NSSM setup.
- **3c8daa8** — Initial commit: Lead Tracker app (React/Vite frontend, Express/sql.js
  backend, auth, pipeline board, follow-ups, reports, admin user management).
