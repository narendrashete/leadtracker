# CLAUDE.md — Lead Tracker

Project-specific guidance. General workspace rules live in `D:\Claude_workspace\CLAUDE.md`.

## What this is
Sales-pipeline app. Node/Express serves the built React app **and** the API on one port (3001). SQLite via **sql.js** (pure JS/WASM — chosen because `better-sqlite3` native compilation fails behind the corporate SSL cert). See `README.md` for full feature list.

## Stack constraints
- **Never add packages that need native compilation** (node-gyp) — they fail on this machine's network. Prefer pure-JS / WASM.
- All DB access goes through `backend/db.js` helpers `query()` / `run()`. They `sanitize()` params (undefined→null) because **sql.js throws on binding `undefined`**. Do not call `_db.run` / `stmt.bind` directly with raw request fields.
- Data is a single file `backend/leads.db`, rewritten in full on every `save()`. It is git-ignored and excluded from the distributable zip. Never overwrite it on the server during redeploys.

## Auth model
- Username/password, PBKDF2 hashes in the `users` table. Sessions are **in-memory Bearer tokens** (reset on restart), managed in `backend/auth.js`.
- `/api/auth` is public; everything else needs `requireAuth`; `/api/users` needs `requireAdmin`.
- Master account `admin` / `Prime@#2026` cannot be reset or deleted (enforced in `routes/users.js`).

## Pipeline column logic (don't duplicate — reuse)
Derived, not stored: Dropped enquiry→Dropped · Closed with success→Converted · else ≥1 follow-up→Followed · else→Leads Received.

## Verifying UI changes
Run the app and check live (per workspace rules). `cd frontend && npm run dev` for hot reload, or `node backend/server.js` to test the production build on :3001. Rebuild (`npm run build`) before packaging/deploying.

## Production
Deployed at `https://leadtracker.primecomputers.co.in` — Ubuntu VPS (Hostinger), app cloned at `/opt/leadtracker`, run under PM2 as system user `leadtracker` (PM2 app name `leadtracker`, systemd unit `pm2-leadtracker.service`), nginx reverse-proxying to `localhost:3002` with a Let's Encrypt cert. Server access is via Hostinger hPanel → VPS → Terminal (browser console), not SSH. Update flow (run as the `leadtracker` user):
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
