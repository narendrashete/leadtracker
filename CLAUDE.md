# CLAUDE.md — Lead Tracker

Project-specific guidance. General workspace rules live in `D:\Claude_workspace\CLAUDE.md`.
Live project state (features, bugs, in-progress work, change log) lives in `PROJECT.md` — keep
both in sync when you finish a session.

## Project Vision
Single-tenant sales-pipeline tool for one company's admin/marketing team: capture leads, log
follow-ups, see pipeline status at a glance, export reports. Optimized for a small user count
(a handful of staff accounts) and zero-ops deployment, not multi-tenant SaaS scale.

## Architecture
One Node/Express process serves both the REST API (`/api/*`) and the built React SPA
(`frontend/dist`) on a single port. No separate web server, no reverse proxy in dev. SQLite
persistence via sql.js, held entirely in memory and flushed to a single file on every write.
No queue, no cache layer, no background jobs.

```
Browser (React SPA, Vite build)
   │  fetch() with Bearer token
   ▼
Express (backend/server.js)
   ├── /api/auth      (public)
   ├── /api/calendar  (public — per-group share-code gated)
   ├── /api/calendar-admin (requireAuth + requireAdmin)
   ├── /api/leads     (requireAuth)
   ├── /api/followups (requireAuth)
   ├── /api/users     (requireAuth + requireAdmin)
   ├── /calendar/<group-code>  (public — serves mokla-divas/index.html)
   ├── /aartisangrah  (public — serves aartisangrah/index.html verbatim, no API)
   ├── /aartisangrah/audio/*  (public — static MP3 recordings, Range-capable)
   └── static frontend/dist + SPA fallback
   │
   ▼
backend/db.js  →  sql.js (WASM SQLite, in-memory) → leads.db (flushed on every write)
```

## Technology Stack
- **Frontend:** React 18 + Vite 5, React Router 6. No CSS framework — plain CSS / inline
  styles with CSS variables for theme colors (`--text-muted` etc.). No state management
  library — `AuthContext` (React Context) is the only shared state.
- **Backend:** Node.js + Express 5.
- **Database:** sql.js (pure JS/WASM SQLite) — see [Database Rules](#database-rules) for why.
- **Auth:** hand-rolled PBKDF2 + in-memory bearer sessions — no JWT, no external auth provider.
- No test runner, no linter enforced in CI (ESLint config exists in `frontend/` but isn't
  wired into a build gate).

## Folder Structure
```
backend/
  server.js            Express app — API mount, static frontend, SPA fallback, error handler
  db.js                sql.js init/schema, query()/run() helpers, save-on-write, admin seed
  auth.js              in-memory session store + requireAuth/requireAdmin middleware
  routes/               leads.js, followups.js, auth.js, users.js, calendar.js,
                        calendarAdmin.js
  leads.db             the entire database (git-ignored)
frontend/src/
  api.js               fetch wrapper — adds Bearer token, unwraps { error } bodies, 401→login
  context/AuthContext   login/logout/me, persists token to localStorage
  components/
    Auth/               LoginPage
    Board/               PipelineBoard, BoardColumn, LeadCard
    Leads/               NewLeadForm, LeadDetailDrawer
    Followups/           FollowupScreen, AddFollowupModal
    Reports/             Reports, StatusPieChart, DetailedReport
    Admin/               UserManagement, CalendarLinks
    Layout/              Sidebar
  App.jsx               routes + auth gate
mokla-divas/
  index.html           Mokla Divas — the shared availability calendar. One self-contained
                       file, no build step, no React. Served at /calendar/<share-code>.
aartisangrah/
  index.html           Aarti Sangrah — the Marathi aarti reader. One self-contained file,
                       no build step, no React, no API. Served at /aartisangrah.
  audio/               MP3 recordings, one per aarti that has one. The only part of
                       this app not inlined into the page. Served as static files.
start.bat               local one-click launcher (runs the production build)
```

## Mokla Divas (shared availability calendar)
A second, unrelated app that shares this repo and this Express process for storage only. It
has no coupling to leads, follow-ups, or users, and nothing in the Lead Tracker SPA links to
it. Friends open `/calendar/<group-code>`, pick their name from a combo, and mark dates two ways:
**busy** (can't make it — paints their colour into the cell) and **prefer** (this date suits
me for the picnic/event — adds a yellow dot). Dates with no colour are open for the group;
once every friend in the group has preferred a date its dots and its border turn fluorescent
green, which is the answer the group is looking for.
- **Two mark kinds, one table.** `calendar_marks.mark_kind` is `'busy'` or `'prefer'`. They
  are mutually exclusive for a given friend and date — writing one clears the other, in the
  route and in the page — because being unavailable and preferring the same date is
  nonsense. The unique index covers `mark_kind`, so a friend can hold one mark of each kind
  and no duplicates. `POST /api/calendar/<code>/marks` takes `{date, member_id, kind, on}`;
  the older `{busy: true}` shape is still accepted.
- **Unanimous is computed, never stored** (`allPrefer()` in the page): preferred count equals
  the group's current member count. Adding a friend therefore un-greens a date and removing
  one can green it — correct, and the reason not to cache it.
- **One share code per GROUP, and that is the isolation boundary.** A code resolves to
  exactly one group; everything in `routes/calendar.js` is scoped to `req.calGroup`. A
  friend holding one group's link cannot see another group's existence, name, members, or
  marks. There is deliberately NO route on the public surface that lists groups — do not
  add one. Rotating a group's code (admin) invalidates its old link at once.
- **Admin vs friends.** Only an admin creates or deletes groups, and only an admin can see
  the links — via `routes/calendarAdmin.js` (requireAuth + requireAdmin) and the
  **Calendar Links** page in the SPA. Friends manage only their own group's roster, through
  `PUT /api/calendar/<code>/members`. A group is always created with its first friend,
  because a group with no members is a link nobody can pick a name on.
- **Deliberately unauthenticated** on the public half: no accounts, because the point is
  that friends without logins can use it. `routes/calendar.js` therefore validates
  everything itself: date/month/key formats by regex, colours as hex, names trimmed and
  length-capped, member ids re-derived server-side rather than trusted, six friends per
  group, fifty groups per install.
- **Tables:** `calendar_groups` (roster as a JSON `members` column, plus its own
  `share_code`), `calendar_marks` (one row per group + date + friend + kind). `calendar_spaces` is
  vestigial — it held the original install-wide code and now only donates that code to the
  first group on migration, so a link already circulated keeps working. Don't build on it.
  The unique indexes on `calendar_marks` and `calendar_groups.share_code` are integrity
  constraints, not performance indexes.
- Every group's link is printed at startup — `pm2 logs leadtracker` shows them — and the
  Calendar Links page is the everyday way to read, copy, rotate them.
- The page is also published as a Claude Artifact, where it talks to that runtime's document
  store instead. One file serves both: `server.js` injects `window.__CAL__` when it serves
  the page, and the page uses the REST API when that is present. Keep both paths working
  when editing it — it has no build step, so edit `mokla-divas/index.html` directly.
- The `api.js` rule below is about the React SPA. This page cannot import it (it is not part
  of the Vite build), so it has its own three-line `fetch` wrapper that unwraps `{ error }`
  the same way. The **Calendar Links** admin page IS part of the SPA and uses `api.js`
  normally.
- Served from a group link the page runs in single-group mode (`SINGLE_GROUP`): the group
  picker becomes a plain label and the manage sheet offers friends only, no group creation.
  In Artifact mode there are no per-link codes, so it keeps the group dropdown.

## Aarti Sangrah (Marathi aarti reader)
A third app sharing this repo and this Express process — and, unlike Mokla Divas, sharing
nothing else: no tables, no API, no share codes, no accounts. `aartisangrah/index.html` is one
self-contained file (markup, CSS, and the aarti texts as a `const aartis` array in a single
inline `<script>`); the only external request it makes is Google Fonts. It is a phone-shaped
reader: one aarti per page, swipe/arrow navigation, an अनुक्रम index sheet, and a search box
matching both Devanagari titles and the Latin `keywords` field on each entry.
- **Served verbatim** at `/aartisangrah` by `server.js` — `res.sendFile`, no wrapper and no
  injected boot script, because it is a complete HTML document (Mokla Divas is a fragment,
  which is why that route wraps it). The route sits ahead of the static/SPA handlers or the
  React fallback would answer the URL with the SPA's HTML.
- **Public, like the calendar page** — there is nothing private in it, so it is not behind
  `requireAuth`. It is reachable to anyone with the URL, by design.
- **The sidebar entry is a plain `<a>`, not a `NavLink`** (`Sidebar.jsx`), because the target
  is not a React route; it opens in a new tab so the board keeps its place. Adding a React
  route for it would be wrong — there is no React component to route to.
- **To add or edit an aarti**, edit the `aartis` array in the file directly. Each entry is
  `{ title, tag, keywords, body }`, where `body` is an array of verses (one string per verse,
  `\n` between lines) and `keywords` is the Latin transliteration used for search. The page
  numbering (`n / <count>`) and the index sheet are both derived from the array — nothing to
  keep in sync by hand.
- **A body string starting with `## ` renders as a sub-heading**, not a verse — `renderPage()`
  emits `<h3 class="shlok-head">` for it, styled with a gold rule above so it separates what
  comes after from what came before. It exists for pages that collect several separately-named
  prayers under one title (उत्सवी प्रार्थना, page 19, holds ten), and the rule is suppressed on
  the first heading. A normal single-prayer page needs none of this.
- **Some prayers appear on more than one page, in different wordings** — घालीन लोटांगण, सदा
  सर्वदा, ज्या ज्या ठिकाणी and मोरया मोरया each exist both standalone and inside उत्सवी
  प्रार्थना, which is the festive recitation order read start to finish. That duplication is
  intentional; don't "deduplicate" it without asking.
- **The Shete family seal in the masthead** is a base64 PNG data URI, not a file in the repo
  — the page has to stay one self-contained file, and it is not part of the Vite build, so it
  cannot reference an asset path. That data URI is most of the file's size. It was cut from
  the supplied artwork along the scalloped gold edge with a transparent surround, so it sits
  on the masthead gradient with no visible box. It is stored at 360px / 192 colours (~25 KB)
  — sized for the lightbox, not the masthead, which just downscales it to 46px. Tapping it
  opens that same image enlarged and centred (`#sealOverlay`); the lightbox copies its `src`
  from the masthead `<img>` at first open rather than embedding the artwork twice, so there
  is exactly one data URI in the file. Replacing the seal means regenerating that one data
  URI, not editing markup. A tap anywhere on the overlay closes it — the × is an affordance,
  not the only exit — so nothing inside it should stop click propagation.
- **The animated Ganpati medallion at the masthead's left** is a second data URI, a 180px
  GIF (~51 KB) drawn for this page rather than sourced: the idol on a lotus with an agarbatti
  beside it, five smoke strands rising in turn off a flickering ember over a 1.8s loop, and
  transparent outside the disc so it sits on the maroon gradient. It mirrors the seal's
  absolute positioning so neither badge shifts the centred title. Its source is not in the
  repo — it was generated from an SVG scene rendered frame by frame, so editing it means
  redrawing and re-embedding, the same as the seal. Note the two data URIs are what make this
  file ~160 KB; keep that in mind before adding a third.
- **Audio is the one asset NOT inlined.** Images are data URIs, but an MP3 is megabytes —
  inlining one would stall the first paint and bloat every page load for readers who never
  press play. Recordings live in `aartisangrah/audio/` and are served by a static mount at
  `/aartisangrah/audio`, which also answers Range requests (that is what lets the player
  seek). A second handler returns a plain-text 404 for a missing track, so it can't fall
  through to the SPA and arrive as HTML with a 200 — an `<audio>` element can only report
  that as a decode error. The mount sets no max-age: recordings get replaced while they are
  still being cut, and ETag revalidation keeps a reload honest.
- **An aarti gets a player only if its entry carries an `audio` field** — an absolute path
  like `/aartisangrah/audio/01-sukhkarta.mp3`, absolute so it resolves the same whether the
  reader arrived at `/aartisangrah` or `/aartisangrah/`. Add the field and the MP3 to give
  any aarti a player; leave it off and the controls never render. Only aarti 1 has one today
  (see `PROJECT.md` — the rest of the recordings are still being cut).
- **The seek bar is a native `<input type="range">`** — drag, touch and arrow keys come for
  free, where a div-and-pointer-maths slider would reinvent all three. Its fill is a gradient
  driven by a `--p` custom property on WebKit (Firefox uses `::-moz-range-progress`). Two
  rules keep it honest: dragging only *previews* (`input`) and releasing *commits*
  (`change`), because seeking on every input event fires a range request per pixel of travel;
  and `showTime()` returns early while `scrubbing`, or each `timeupdate` would yank the thumb
  back to the playhead mid-gesture.
- **The `<audio>` element is built when a page with a recording renders, not on first play**,
  with `preload='metadata'`. The seek bar is meaningless without a duration, and the header
  costs a few KB against the megabytes a full preload would pull. The trade is one small
  request per visit to an aarti that has audio, whether or not anyone presses play.
- **The player's state is explicit** (`playerState`: idle / buffering / playing / paused),
  not inferred from the `<audio>` element, because a `pause` event fires for both pausing and
  stopping and the two must leave different buttons on screen. Turning the page always calls
  `stopAudio()`: the controls live on the page, so audio left running elsewhere would have
  nothing to stop it.
- No build step (it is not part of the Vite bundle), so a `git pull` + `pm2 reload` ships a
  change to the page itself, and to the recordings.

## Coding Standards
- Functional React components with hooks only — no class components.
- Routes are thin: validate → call `db.js` query()/run() → shape response. Business logic
  (like the pipeline-column derivation) belongs in a named function, not inlined in JSX or SQL.
- Keep route handlers wrapped in try/catch that calls `next(err)` so the shared JSON error
  handler in `server.js` returns a consistent `{ error }` body.

## Naming Conventions
- DB columns and JSON fields: `snake_case` (`company_name`, `next_followup_date`).
- JS variables/functions: `camelCase`. React components: `PascalCase` files matching the
  component name.
- Enquiry IDs: `ENQ-YYYY-NNN`, server-generated, sequential per calendar year (see
  `computeNextEnquiryId` in `routes/leads.js`).

## Database Rules
- **Why sql.js:** `better-sqlite3` (native, node-gyp) fails to compile behind this machine's
  corporate SSL cert. sql.js is pure JS/WASM and always installs cleanly. **Never add a
  package that needs native compilation** — prefer pure-JS/WASM alternatives.
- All DB access goes through `backend/db.js` `query()` / `run()`. They call `sanitize()`
  (undefined → null) on every param because **sql.js throws on binding `undefined`**. Never
  call `_db.run` / `stmt.bind` directly with raw request-body fields.
- The whole DB is one file, `backend/leads.db`, rewritten in full on every `run()` via
  `save()` (export the in-memory DB → write buffer to disk). There is no WAL, no migrations
  framework — schema changes are additive `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD
  COLUMN` guarded with try/catch in `getDb()` (see the address/city/state columns for the
  pattern). Never write a destructive migration (DROP/RENAME COLUMN) without a manual backup
  step, since there's no rollback path.
- `leads.db` is git-ignored and excluded from the distributable zip. **Never overwrite it on
  the server during redeploy** — `git pull` never touches it, so no manual file copying is
  needed or wanted.

## API Standards
- All endpoints are under `/api`, JSON in and out, `Authorization: Bearer <token>` for
  everything except `POST /api/auth/login`.
- Errors are always `{ error: "<message>" }` with a 4xx/5xx status — never a bare string or
  HTML. The frontend `api.js` `request()` helper unwraps this uniformly; don't bypass it with
  raw `fetch()` in components.
- A 401 from any endpoint clears the stored token and hard-redirects to `/` (see `api.js`) —
  don't add per-component 401 handling.

## UI Standards
- Layout is a fixed `Sidebar` + routed main content (`App.jsx`). New top-level features get a
  new route + sidebar entry, not a modal bolted onto an existing page.
- Use the existing card-based corporate layout style (see `LeadDetailDrawer`, `NewLeadForm`)
  for new forms/detail views rather than introducing a new visual style.
- Theme colors go through CSS variables (`var(--text-muted)`, etc.) already defined in
  `App.css` / `index.css` — don't hardcode hex colors in components when a variable exists.

## Security Rules
- Passwords: PBKDF2 (100k iterations, SHA-512, random 16-byte salt) via `hashPassword` /
  `verifyPassword` in `db.js`. Never store or log plaintext passwords.
- Sessions are opaque random tokens (`crypto.randomBytes(32)`) held in an in-memory `Map` —
  they reset on server restart (acceptable for this app's scale; not a bug).
- The master `admin` account (username `admin`) can never be reset or deleted — enforced
  server-side in `routes/users.js`, not just hidden in the UI. Preserve this invariant in any
  user-management change.
- The calendar API at `/api/calendar` is public by design and must stay scoped to the
  `calendar_*` tables, and to the single group its share code resolves to. Never widen it to
  read or write leads, follow-ups, or users; never add an endpoint there that lists groups or
  returns a share code — knowing a code is what grants access to that group. Anything that
  hands out codes belongs in `/api/calendar-admin`, behind requireAuth + requireAdmin.
- `ADMIN_SEED_PASSWORD` env var seeds the initial admin password on first run; if unset it
  falls back to a dev-only default (`admin123`) with a console warning — production must set
  this env var (or rotate the password immediately after first deploy).

## Performance Rules
- Not a concern at current scale (single company, low lead volume) — the whole DB is loaded
  into memory and full-exported on every write. Don't add caching, pagination, or indexes
  speculatively; revisit only if `leads.db` or request volume grows enough to matter.

## Error Handling
- Backend: route handlers that can throw are wrapped in try/catch → `next(err)` → the shared
  `/api` error middleware in `server.js` logs the stack and returns `500 { error }`. Handlers
  that can't throw (simple synchronous queries) may skip the wrapper.
- Frontend: `api.js`'s `request()` throws `Error(message)` from the server's `{ error }` body;
  components catch it and render inline, no global error boundary/toast system exists yet.

## Logging
- `console.error('API ERROR:', ...)` in the shared error handler is the only structured
  logging. No log files, no log levels, no external logging service. PM2 captures stdout/
  stderr in production (`pm2 logs leadtracker`).

## Testing Standards
- No automated tests exist (`backend/package.json`'s `test` script is a stub). Verification is
  manual: run the app and exercise the change in the browser (per workspace rules) before
  calling a UI task done.

## Deployment Notes
Deployed at `https://leadtracker.primecomputers.co.in` — Ubuntu VPS (Hostinger), app cloned at
`/opt/leadtracker`, run under PM2 as system user `leadtracker` (PM2 app name `leadtracker`,
systemd unit `pm2-leadtracker.service`), nginx reverse-proxying to `localhost:3002` with a
Let's Encrypt cert. Server access is via Hostinger hPanel → VPS → Terminal (browser console),
not SSH. Update flow (run as the `leadtracker` user):
```
su - leadtracker -c "
export PM2_HOME=/home/leadtracker/.pm2
cd /opt/leadtracker
git pull
cd frontend && npm run build && cd ..
pm2 reload leadtracker
"
```
`git pull` never touches `backend/leads.db` (it's git-ignored) — no manual file copying needed.
The calendar and Aarti Sangrah pages need no build step (they are plain HTML, not part of
the Vite bundle), so a `git pull` + `pm2 reload` ships a change to either. Aarti Sangrah is
then live at `https://leadtracker.primecomputers.co.in/aartisangrah`. The **Calendar Links** admin
page is React, so any change touching `frontend/src` still needs the `npm run build` step
above. To find the calendar links after a
deploy, open **Calendar Links** in the app, or run `pm2 logs leadtracker --lines 40` and look
for the `Calendar links` block, which lists one line per group. `CALENDAR_SHARE_CODE` only
seeds the very first group's code on a fresh database; every later group gets a random one.

## Pipeline Column Logic (don't duplicate — reuse)
Derived, never stored, in `getColumn()` (`frontend/src/components/Board/PipelineBoard.jsx`):
Dropped enquiry → **Dropped** · Closed with success → **Converted** · else ≥1 follow-up →
**Followed** · else → **Leads Received**. If any other screen needs this, import/reuse this
function rather than reimplementing the rule.

## Coding Do's
- Do add new DB columns as nullable `ALTER TABLE ... ADD COLUMN`, guarded try/catch, so
  existing `leads.db` files upgrade in place (see address/city/state precedent).
- Do generate IDs (enquiry IDs, etc.) server-side with retry-on-collision, never trust a
  client-supplied ID.
- Do route all SQL through `query()`/`run()` in `db.js`.

## Coding Don'ts
- Don't add packages requiring native compilation (node-gyp).
- Don't call `_db.run`/`stmt.bind` directly, bypassing `sanitize()`.
- Don't add multi-tenant, multi-currency, or role types beyond `admin`/`user` — nothing in
  the current product needs them.
- Don't create extra markdown files beyond `README.md`, `CLAUDE.md`, `PROJECT.md`.

## Lessons Learned
- **`.page-content` must be a direct child of `.page-card`**, not of `.page-title-wrap`. The
  card is the flex column; the content pane relies on `flex:1` + `overflow-y:auto` against it
  to become the scrolling region. Nested one level deeper, inside the `flex-shrink:0` title
  wrap, both declarations stop meaning anything: the pane grows to fit its text, the shell's
  `overflow:hidden` clips it, and **every page silently loses scrolling** while still looking
  correct at the top. This shipped once, from adding a row inside the title wrap and reusing
  the player's closing `</div>` for it, leaving `.player` unclosed. Prevention: after any
  markup surgery in the page card, check `pageContent.parentElement.className` is
  `page-card`, and scroll a long aarti (page 19) before calling it done.
- **`res.sendFile`'s callback fires on client disconnect, with the headers already sent.**
  Answering again there (`res.status(...).send(...)`) throws `ERR_HTTP_HEADERS_SENT`, which
  nothing catches, so the process exits — taking Lead Tracker down with whatever page was
  being served and logging every user out, since sessions are in memory. On a phone the
  trigger is mundane: navigating away while a page is still downloading. Both `sendFile`
  callbacks in `server.js` now guard with `if (err && !res.headersSent)`. Prevention: any
  `sendFile`/`sendfile` completion callback must check `res.headersSent` before it writes.
- **sql.js throws on `undefined` bind params** (unlike better-sqlite3, which silently accepts
  it). Root cause: destructuring `req.body` fields that are optional in a form gives
  `undefined`, not `null`, when the field is absent. Fix: `sanitize()` in `db.js` coerces
  every param. Prevention: always insert/update through `query()`/`run()`, never the raw
  sql.js API. See `[[reference_sqljs_undefined_bind]]` in project memory.
- **Prod is Ubuntu/nginx/PM2, not Windows/IIS/NSSM.** Earlier docs assumed a Windows deploy
  target before the real hosting choice was made; this caused a documentation/reality
  mismatch that was corrected in commit `4b8e718`. Prevention: this file's Deployment Notes
  section is the source of truth — verify against it before writing new deploy docs.

## Known Technical Constraints
- No native-module packages (node-gyp fails on this machine's network/cert setup).
- No migrations framework — schema changes must be additive and self-guarding.
- Sessions are in-memory — every server restart (including `pm2 reload`) logs all users out.
- Single-file DB — no concurrent-write scaling story; fine for current single-company usage.

## AI Agent Behaviour Rules
- Follow `D:\Claude_workspace\CLAUDE.md` for workspace-wide defaults (autonomous execution,
  no speculative abstractions, verify UI changes live).
- Treat this file and `PROJECT.md` as living documents: after any coding session that adds a
  feature, changes the schema, changes an API/route, or changes architecture, update both
  files before considering the task done (see `PROJECT.md`'s Change Log for the running
  history — append an entry there rather than narrating history in this file).
- Don't duplicate temporary/in-flight project state here — that belongs in `PROJECT.md`.

## Reusable Design Patterns
- **Server-generated sequential ID with retry-on-collision** — `computeNextEnquiryId()` +
  the retry loop in `POST /api/leads`. Reuse this pattern for any future user-facing sequence
  ID.
- **Additive, self-guarding schema migration** — `CREATE TABLE IF NOT EXISTS` plus a
  try/catch `ALTER TABLE ADD COLUMN` loop in `getDb()`. Reuse for any new column.
- **Derived board/status columns** — compute display grouping from existing fields
  (`getColumn()`) instead of adding a redundant stored "column" field that can drift out of
  sync.

## Preferred Libraries
- HTTP: `express`. CORS: `cors`. DB: `sql.js`. Frontend routing: `react-router-dom`. No UI
  component library, no CSS-in-JS library, no state management library — keep it that way
  unless a real need (not a hypothetical one) appears.

## Common Mistakes to Avoid
- Forgetting to rebuild the frontend (`npm run build`) before testing the production server
  on :3001 — Vite dev server (`:5173`) and the Express-served build are different artifacts.
- Passing `req.body` fields straight into a raw sql.js call instead of through `db.js`
  (reintroduces the `undefined` bind crash).
- Adding a stored "pipeline column" field instead of deriving it — breaks the single source
  of truth described above.
