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
- Aarti Sangrah: a Marathi aarti reader (18 aartis) hosted by the same Express process at
  `/aartisangrah`, reachable from the sidebar. Standalone single HTML file — no API, no
  tables, no auth. See `CLAUDE.md` → Aarti Sangrah.

## Features In Progress
None currently.

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
