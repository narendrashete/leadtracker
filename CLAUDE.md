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
   ├── /api/leads     (requireAuth)
   ├── /api/followups (requireAuth)
   ├── /api/users     (requireAuth + requireAdmin)
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
  routes/               leads.js, followups.js, auth.js, users.js
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
    Admin/               UserManagement
    Layout/              Sidebar
  App.jsx               routes + auth gate
start.bat               local one-click launcher (runs the production build)
```

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
