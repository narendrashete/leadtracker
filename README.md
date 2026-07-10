# Lead Tracker

A sales-pipeline web app for an admin/marketing team to capture leads, track follow-ups, and view reports. Single Node process serves both the React UI and the REST API.

- **Live:** https://leadtracker.primecomputers.co.in
- **Stack:** React (Vite) · Node.js/Express · sql.js (pure-JS SQLite, single-file `leads.db`)

## Features
- **Pipeline Board** — 4 columns (Leads Received / Followed / Converted / Dropped), derived from lead status + follow-up count
- **New Lead** — auto Enquiry ID (`ENQ-YYYY-NNN`), company/contact fields, address with city/state autocomplete, required-software & status dropdowns
- **Lead Detail Drawer** — edit any lead, view its follow-up history
- **Follow-ups** — add dated discussion entries against non-dropped leads
- **Reports** — status pie chart (hover for breakdown) + date-range table with CSV export
- **Auth** — username/password login; roles `admin` and `user`. Admin manages users (add / reset password / delete). Master admin `admin` cannot be reset or deleted.

## Run locally (dev)
```
cd backend  && npm install && node server.js       # API + built UI on :3001
cd frontend && npm install && npm run dev           # Vite dev server on :5173 (hot reload)
```
Open http://localhost:5173 (dev) or http://localhost:3001 (serves the production build).
Default login: `admin` / `Prime@#2026`.

## Build for production
```
cd frontend && npm run build      # outputs frontend/dist
```
Express serves `frontend/dist` directly on port 3001 — no separate web server needed.

## Deployment (Ubuntu VPS + nginx + PM2)
The app is cloned at `/opt/leadtracker` on a Hostinger VPS and runs under PM2 (app name `leadtracker`) as a dedicated `leadtracker` system user, managed by systemd unit `pm2-leadtracker.service`. nginx reverse-proxies `leadtracker.primecomputers.co.in` to `localhost:3002` with a Let's Encrypt cert. Server access is via Hostinger hPanel's browser Terminal. Update flow (as the `leadtracker` user):
```
cd /opt/leadtracker && git pull
cd frontend && npm run build && cd ..
pm2 reload leadtracker
```

## Data & backup
All data lives in **`backend/leads.db`** (one file). Back it up regularly; it's git-ignored, so `git pull` on the server never touches or overwrites it.

## Project layout
```
backend/
  server.js            Express app — API + static frontend + SPA fallback
  db.js                sql.js init, query()/run() helpers (sanitize undefined→null), auto-save
  auth.js              session store + requireAuth/requireAdmin
  routes/              leads.js, followups.js, auth.js, users.js
frontend/src/
  api.js               fetch wrappers (adds Bearer token, surfaces server errors)
  context/AuthContext  frontend auth state
  components/          Board, Leads, Followups, Reports, Admin, Auth, Layout
start.bat              local one-click launcher
```
