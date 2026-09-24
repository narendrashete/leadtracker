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
   ├── /api/stats     (requireAuth + requireAdmin — visitor counts)
   ├── /calendar/<group-code>  (public — serves mokla-divas/index.html)
   ├── /aartisangrah  (public — serves aartisangrah/index.html verbatim, no API)
   ├── /aartisangrah/app  (public — separate installable/offline copy, app.html)
   ├── /aartisangrah/audio/*  (public — static MP3 recordings, Range-capable)
   ├── /aartisangrah/{manifest.webmanifest,sw.js,icons/*}  (public — offline app shell)
   ├── /kinetic-gem   (public — serves kinetic-gem/index.html verbatim, no API)
   ├── /kinetic-gem/app  (public — same file + injected PWA tags, installable)
   ├── /kinetic-gem/{manifest.webmanifest,sw.js,icons/*}  (public — offline app shell)
   ├── /shetenavratri (public — serves shetenavratri/index.html + members/history/gallery
   │                   pages + assets/, no API, no build step)
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
                        calendarAdmin.js, stats.js
  analytics.js         records a page view; hashes the visitor, filters bots
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
    Admin/               UserManagement, CalendarLinks, Visitors
    Layout/              Sidebar
  App.jsx               routes + auth gate
mokla-divas/
  index.html           Mokla Divas — the shared availability calendar. One self-contained
                       file, no build step, no React. Served at /calendar/<share-code>.
aartisangrah/
  index.html           Aarti Sangrah — the Marathi aarti reader. One self-contained file,
                       no build step, no React, no API. Served at /aartisangrah.
  app.html             Same reader, kept as a separate file, for installable/offline use.
                       Served at /aartisangrah/app. See "Aarti Sangrah — offline app" below
                       for why this is a second file rather than a flag on index.html.
  manifest.webmanifest, sw.js, icons/   The offline app shell for app.html only.
  audio/               MP3 recordings, one per aarti that has one. The only part of
                       this app not inlined into the page. Served as static files.
kinetic-gem/
  index.html           PrimeGem — a colourful soft-body toy you twist, stretch, press,
                       pull and push into new shapes. One self-contained file, no build
                       step, no React, no API, no external libraries (its own canvas-2D
                       physics/renderer, not three.js — see "PrimeGem" below for why).
                       Folder/URL keep the old "kinetic-gem" name on purpose — see
                       that section; installed phones launch that exact path.
                       Served at /kinetic-gem, and at /kinetic-gem/app with PWA tags
                       injected — ONE file for both, unlike Aarti Sangrah's two.
  manifest.webmanifest, sw.js, icons/   The offline app shell for /kinetic-gem/app only.
shetenavratri/
  index.html            Shete Parivar Navratri — public family site: dashboard home,
                       plain HTML pages, no build step, no React, no API.
  members.html          सभासद यादी — 66-member directory (assets/js/members-data.js),
                       bilingual (Devanagari + English) search, Call/WhatsApp icon
                       buttons (tel:/wa.me), copy/right-click blocked on names & numbers.
  history.html          आत्तापर्यंतची नवरात्री झालेली यादी — placeholder, content pending.
  gallery.html           क्षणचित्रे — photo collage + modal viewer (mock placeholders
                       until real photos are supplied).
  assets/                css/js shared by all four pages.
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
- **A group of aartis can share a `section` + `sectionLabel` field** (see the नवरात्र आरती
  entries) to appear as one collapsed folder row in the अनुक्रमणिका (index modal) instead of
  as separate rows. Tapping the folder drills the modal into a numbered (1..n) sublist for
  just that section, with a "मुख्य यादीकडे परत" row to back out to the top-level list —
  `modalSection` (null = top level, else the section key) is the only state this adds.
  Grouped entries are still ordinary members of the flat `aartis` array otherwise: swipe,
  prev/next, the "n / count" page indicator, audio-manifest numbering and search
  (`matchScore`) all treat them exactly like any other aarti — a non-empty search query
  always shows a flat matching list, never the folder, since drilling in is for browsing, not
  for a targeted lookup. `renderPage()` adds a "← \<sectionLabel\> कडे परत" link above a
  grouped aarti's content (only when `a.section` is set) that calls `openModalSection()` to
  reopen the modal already drilled into that section. Reuse this field pair for any future
  set of aartis that belong under one named heading — don't invent a second grouping
  mechanism.
- **Recordings are discovered from the folder, not listed in the array.** `server.js` serves
  `/aartisangrah/audio/manifest.json` — the directory listing, keyed by the number each
  filename starts with (`07-vitthal.mp3` is aarti 7; a bare `7.mp3` works too). The page
  fetches it at load and sets `audio` on the matching entries, so **adding a recording is
  dropping a numbered MP3 into `aartisangrah/audio/`** — no code edit, no restart, since the
  route reads the directory per request. Files with no leading number, and non-MP3s, are
  ignored; a number past the end of the array is ignored too. If the fetch fails, no aarti
  gets a player — never a broken one. That route must stay AHEAD of the static mount, or a
  file literally named `manifest.json` would shadow it.
- **`aartisangrah/audio/archived/` is a local parking spot and is git-ignored.** Recordings
  that exist but have no aarti to belong to yet live there rather than in `audio/` itself, so
  they are neither committed nor deployed — they were shipping several MB to the server on
  every pull while being unreachable, since the manifest skips anything without a leading
  number. Nothing reads that folder: the manifest ignores it (a directory is not an `.mp3`),
  and a fresh clone will not have it at all. Move a file up into `audio/` with a number in
  front when its aarti is ready. Don't commit it back, and don't `git add -f` past the ignore.
- **`audio` on an entry is still what the player reads**, it is just written by the manifest
  at load rather than typed into the array. Hard-coding one would work but would then drift
  from the folder, so don't.
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

## Aarti Sangrah — offline app (app.html)
A second, separate copy of the reader — `aartisangrah/app.html`, served at `/aartisangrah/app`
— exists purely so people can install it (Add to Home Screen) and use it with no internet at
all. It is a deliberate fork of `index.html`, not a flag/query-param on it:
- **`index.html` must never gain a manifest link, meta tags, or a service-worker registration
  script.** The plain `/aartisangrah` link is what's already bookmarked and shared; a service
  worker registered from that page would start intercepting its requests for everyone who
  already uses it, which is exactly the regression this split exists to avoid. Any offline/PWA
  feature is added to `app.html` only.
- **The service worker registers with an explicit `{ scope: '/aartisangrah/app' }`.** Without
  that, registering `sw.js` (which lives at `/aartisangrah/sw.js`) would default to controlling
  everything under `/aartisangrah/`, including the plain page, on any device that happened to
  open both links. The explicit scope is the only thing standing between this feature and that
  regression — never drop it.
- **`manifest.webmanifest`, `sw.js`, and `icons/` are shared files** served by a static mount at
  `/aartisangrah` (`index: false, redirect: false` — see below), but only `app.html` references
  them. Keeping them shared (rather than duplicated) is fine precisely because nothing loads
  them unless it asks to.
- **`redirect: false` on that static mount is load-bearing.** `express.static` mounted at
  `/aartisangrah` treats a bare request for `/aartisangrah` as its own directory root and
  301-redirects to `/aartisangrah/` by default — which broke the plain page the first time this
  mount was added, before `redirect: false` was set. Any future static mount added under
  `/aartisangrah` needs the same option, or the plain page breaks again.
- **`sw.js`'s install step precaches every recording**, not just the page shell, by reading the
  same `/aartisangrah/audio/manifest.json` the page itself reads — so the offline app plays
  audio immediately after one online visit, not just after each track has been played once.
  Bump `CACHE_VERSION` in `sw.js` whenever `app.html`, an icon, or the audio set changes, or
  installed devices keep serving the old cached version.
- **`sw.js` is served with `Cache-Control: no-cache`** (set in the static mount's
  `setHeaders`) so the browser always re-checks it for updates rather than trusting a
  long-lived cache — the standard gotcha with service-worker files.
- Distribution model: there is no APK/IPA and nothing goes through an app store. The link
  `/aartisangrah/app` is shared directly (WhatsApp, etc.); the recipient uses their browser's
  own "Add to Home Screen" (Chrome on Android) or Share → "Add to Home Screen" (Safari on
  iOS — Chrome-on-iOS cannot install PWAs, since it's also WebKit-based but lacks that share
  action). The one online visit needed to install also downloads and caches the ~30 MB of
  recordings; after that it works indefinitely with no network.

## PrimeGem (interactive soft-body toy)
A fourth app sharing this repo and this Express process for hosting only, the same way Mokla
Divas and Aarti Sangrah do: no tables, no API, no accounts, one self-contained
`kinetic-gem/index.html` (markup, CSS and JS in one file).
- **The product is "PrimeGem"; the folder and URL are still `kinetic-gem`.** It shipped as
  "Kinetic Gem" and was installed on phones at `/kinetic-gem/app` before being renamed. The
  manifest's `start_url`/`scope` and the service worker's scope all point at that path, and an
  installed PWA keeps launching the URL it was installed with — so renaming the route would
  strand every installed copy at a dead link (offline included, since the worker's scope would
  no longer match). The user-visible name lives in `<title>`, the masthead `<h1>`, the manifest
  `name`/`short_name` and `apple-mobile-web-app-title`. Don't "tidy" the path to match the
  name without a migration plan and a reinstall. It renders a faceted, colourful
blob you twist, stretch, press, pull and push with the mouse/touch; after every gesture it
settles into a new shape rather than snapping back to a sphere, so it keeps looking different.
The intent is a tactile, screensaver-calm toy — no score, no timer, no notifications — as an
antidote to doom-scrolling, not another feed.
- **No three.js/WebGL — a hand-rolled canvas-2D rasteriser instead.** Consistent with this
  project's "no build step, no external dependency" rule for these standalone pages (Aarti
  Sangrah's only external request is Google Fonts; this page makes none at all). A geodesic
  icosphere at a modest subdivision level renders as flat-shaded triangles via
  `ctx.fill()`/painter's-algorithm depth sort — plenty fast for ~1300 faces at 60fps, and it
  means the page works completely offline with zero CDN dependency. Don't reach for a 3D
  library here without a real reason; this is not a case where "no build step" was accidental.
- **Physics is Position-Based Dynamics (PBD) on the icosphere's edges** (`EDGE_STIFFNESS`,
  a distance constraint per edge) **plus a per-vertex "shape memory" spring** pulling gently
  toward a remembered rest position (`restPos`, `GOAL_STIFFNESS`) **plus a volume/pressure
  term** (`targetVolume`, `PRESSURE_K`) that keeps it feeling inflated rather than collapsing
  when squeezed — the classic "squish here, bulge there" balloon behaviour.
- **No global rotation fit (shape matching) — deliberately.** The mesh is recentred to the
  origin every frame and the memory springs pull toward FIXED object-space directions, so a
  one-sided grab-and-move is itself just another elastic deformation the mesh resists, which
  is exactly what "twist" should feel like for a toy. Don't add a polar-decomposition/shape-
  matching step to "fix" whole-body spin; it isn't a bug, it's the design.
- **"Every action becomes a new shape" is plasticity, not randomness.** `restPos` (and
  `targetVolume`) drift a little toward wherever the gem currently sits every frame
  (`PLASTIC_RATE` / `VOLUME_PLASTIC_RATE`), so play leaves a lasting trace instead of fully
  springing back. A second, much slower drift (`REGULARIZE_RATE` / `VOLUME_REGULARIZE_RATE`)
  pulls `restPos` back toward the pristine sphere, so an abandoned gem self-heals over
  minutes instead of accumulating into an ugly shape forever. Reuse this two-rate
  plastic/regularize pattern for any future "remembers what you did, but not permanently"
  behaviour — don't invent a history/undo stack for it.
- **Interaction model** (`onPointerDown`/`onPointerMove`/`endPointer`, Pointer Events so
  mouse/touch/pen share one code path): dragging the gem grabs the nearest visible vertex and
  a soft-falloff neighbourhood around it (`INFLUENCE_RADIUS`) and drives it toward the
  pointer, projected onto a camera-facing plane at the grab depth — this alone gives
  pull/stretch. Scroll (desktop) moves that plane along the camera axis for
  press/pull-toward-viewer, and Shift+drag (desktop) twists the grabbed neighbourhood around
  the axis from the centre to the grab point (`grab.twistAngle`, `rotateAroundAxis`). **Two
  fingers do both at once**, the way a map handles pinch-and-rotate: the distance between them
  drives depth, their angle drives twist, read on every move. These were once separate touch
  modes picked by how far apart the fingers landed (>140px meant twist) — on a 390px-wide
  phone two fingers are never that far apart, so twist was simply unreachable; don't
  reintroduce a mode split here. Dragging empty space orbits the camera instead of grabbing —
  hit-testing picks the nearest on-screen, camera-facing vertex within `hitSlop`, and "no
  vertex within threshold" is what means "background."
- **Everything sized in screen pixels scales to the viewport** (`resize()`): `FOCAL` is derived
  from `projRadius` (≈26% of the smaller viewport axis) rather than being a constant, and
  `hitSlop` follows it. With a fixed focal length the gem was *wider than a phone screen* —
  clipped at both edges, with no background left to orbit-drag. Anything new that is measured
  in CSS pixels (the grounding shadow already is) belongs in that same derivation, not
  hardcoded. Distances in world units (`INFLUENCE_RADIUS`, `R0`) are viewport-independent by
  construction and must stay that way.
- **Touch needs three things the desktop path doesn't**, all easy to regress: the hint copy is
  swapped for touch-specific wording behind `(pointer: coarse)` (a phone has no wheel and no
  Shift key, so the desktop copy documents nothing it can do); `gesturestart`/`gesturechange`
  and a multi-touch `touchmove` are `preventDefault`ed, because **iOS Safari has ignored
  `user-scalable=no` since iOS 10** and would otherwise zoom the page instead of passing the
  two-finger gesture to the gem; and lifting one finger of a pinch re-anchors the grab
  (`grab.anchorShift`) so the gem doesn't snap across to the surviving finger.
- **Colour is baked to the mesh's rest topology, not the camera view** (`baseHue`, computed
  once from each vertex's original icosphere position), so the colour pattern visibly
  stretches and distorts WITH a deformation instead of just being a static paint job — a
  vertex that's been pulled out shows its true stretch through both shape and glow (the
  `stretch` term brightens/saturates a face whose current area exceeds its rest area). A slow
  global hue rotation (`hueShift`, time-based) keeps it cycling through the palette even at
  rest, and the camera auto-orbits after ~2s of no interaction — both exist so the "colourful"
  and "attractive" requirement holds even for someone just watching, not only touching.
- **Fixed-timestep sub-stepping** (`FIXED_DT`, `MAX_SUBSTEPS` in `tick()`) decouples the PBD
  solve from the display's actual frame rate, so the spring stiffness constants feel the same
  on a 60Hz or 120Hz screen. Velocity is derived from a substep's net positional change
  (`prePos` captured before integrate+solve, `vel = (pos-prePos)/dt` after) rather than
  accumulated from forces — standard PBD, and the reason the gem has any "bounce" at all after
  you let go: a constraint that only ever moves position, with nothing translating that into
  velocity, has no way to carry the motion into the next frame.
- **The "Developed by Prime Computers" credit is a link, and the logo is inlined** as a
  base64 PNG data URI like the Aarti Sangrah seal — the page must make zero external requests,
  both to stay self-contained and because the service worker precaches a fixed shell list that
  an external image would have to be added to. The logo sits on a light chip because the brand
  navy (`#1e1455`) is about 2.9:1 against this page's near-black ground, i.e. unreadable;
  recolouring someone's logo to fit a dark theme is not the fix. The credit deliberately does
  NOT fade with the instructions panel (`#hint.faded .panel` targets the panel only) — the
  hint is transient guidance, the attribution is not.
- No build step (it is not part of the Vite bundle), so a `git pull` + `pm2 reload` ships a
  change to the page itself.

## PrimeGem — installable app (/kinetic-gem/app)
Installable and fully offline (Add to Home Screen), the same distribution model as the Aarti
Sangrah app: no APK/IPA, no app store, just a link people install from their browser. It
solves the same problem the Aarti app does and obeys the same scope rule — but it is **one
file, not a fork**, and that difference is deliberate:
- **`/kinetic-gem/app` serves `index.html` with a handful of head tags injected**
  (`GEM_APP_HEAD` in `server.js`): manifest link, theme-color, the Apple meta tags iOS needs,
  and the service-worker registration. The plain `/kinetic-gem` route still `sendFile`s the
  same file untouched, so that link is byte-identical to what it always was.
- **Why injected rather than forked into an `app.html`.** Aarti Sangrah forked because its
  plain link was already bookmarked and circulated, so `index.html` could not be touched at
  all. Kinetic Gem had not shipped yet when this was added, so that constraint never applied
  — and the gem is one ~900-line physics file under active tuning, where two copies would
  drift within a session or two, while the installable version needs nothing but those head
  tags. The repo already had the pattern: the calendar route injects `window.__CAL__` the same
  way. **Don't "align" this with Aarti Sangrah by forking it** — that would trade a real
  maintenance cost for a consistency that buys nothing.
- **The service worker still registers with an explicit `{ scope: '/kinetic-gem/app' }`**, and
  this is as load-bearing here as it is there: `sw.js` lives at `/kinetic-gem/sw.js`, so
  without the explicit scope it would default to controlling everything under
  `/kinetic-gem/` — and the plain page would start being intercepted for anyone who opened
  both links. Verified: after installing the app, the plain page reports
  `navigator.serviceWorker.controller === null`. Never drop that option.
- **`redirect: false` on the static mount is the same trap as Aarti's**, and for the same
  reason: `express.static` mounted at `/kinetic-gem` would 301 a bare `/kinetic-gem` to
  `/kinetic-gem/` and break the plain page. `index: false` too.
- **`sw.js` is served with `Cache-Control: no-cache`** (the mount's `setHeaders`), the standard
  service-worker gotcha.
- **Bump `CACHE_VERSION` in `sw.js` whenever `index.html`, the manifest or an icon changes**,
  or installed devices keep serving the old version — `activate()` drops every older-versioned
  cache. This matters more here than for Aarti, because tuning a physics constant changes the
  same `index.html` the worker has cached.
- **The shell list IS the whole app.** The page makes no external requests at all — no fonts,
  no audio, no library — so `SHELL_URLS` (page + manifest + icons) is everything, and there is
  nothing to discover at install time the way Aarti's worker discovers recordings.
- **The icons are rendered from the gem's own code**, not drawn by hand: the generator reuses
  the icosphere build, hue mapping and shading so the icon is literally the thing it opens. It
  widens the hue mapping (one viewing angle would otherwise show only half the wheel), lifts
  the ambient floor (a moody shadow side is mud at 48px), keeps the lobing gentle and convex
  (a deeper dip makes the painter's-algorithm sort leak far-side faces as confetti), and
  recentres the deformed mesh (lobing moves the centroid, and a maskable icon is cropped about
  its centre). Regenerating means re-running that generator, not editing a PNG.

## Visitor Counting
Server-side, in `analytics.js`, recorded on the three public pages and on the SPA's own
HTML loads. Admin-only, shown on the **Visitors** screen.
- **`recordVisit(req, page)` is called from the route, not from the browser.** Nothing to
  block, and it works for readers with JS off. It is wrapped in try/catch and swallows its
  own errors: counting is never worth failing a page load over.
- **Every labelled page is listed, even at zero.** The breakdown groups over recorded rows,
  so a surface nobody has opened would vanish from the screen entirely — and "no visits"
  then looks exactly like "counting is broken", which is how the installable apps read on
  the day they were split out. `routes/stats.js` fills in a zero row for each key in
  `PAGE_LABELS`, so adding a label is also what makes a new surface visible before its first
  visit.
- **Each page surface gets its own key.** `aartisangrah` and `aartisangrah-app` are counted
  separately, as are `kinetic-gem` and `kinetic-gem-app`, so the Visitors screen can tell
  reading online from taking the app offline. Give any new surface its own key and a label in
  `PAGE_LABELS` (`routes/stats.js`) — an unlabelled key still shows, under its raw name.
- **What an `-app` count can and cannot mean.** Those service workers are cache-first, so
  once the app is installed, opening it makes no request at all. The number therefore counts
  *fetches of the app page* — the first open, plus the worker's own precache of that same URL
  during install — which approximates installs, not how often it is then read offline.
  Repeat offline use is unmeasurable by design, and one install typically shows as one
  visitor with two views. Don't relabel this as "offline readers".
- **The Navratri sub-pages are counted by a middleware ahead of the static mount**
  (`SHETE_COUNTED` in `server.js`), since `express.static` serves them with no route to hook.
  Their labels live in `NAVRATRI_PAGES` (`routes/stats.js`), returned as a separate
  `navratri` list for its own card, and kept out of the main page list. Its "aartisangrah"
  row is the global Aarti Sangrah online count — the dashboard button is a tinyurl that
  redirects to `/aartisangrah`, so clicks from the Navratri site can't be told apart.
- **`page_hits` holds one row per visitor per page per day**, with a `views` counter. Unique
  visitors for a day are that day's rows; views are their counters summed. The unique index
  on `(day, page, visitor)` is what makes a reload a view rather than a second visitor.
- **`visitor` is a hash, never an address.** `sha256(install_salt | date | ip | user-agent)`,
  truncated. The salt lives in `app_meta` and the date is part of the input, so the same
  phone hashes differently tomorrow and the two cannot be linked. **No IP is ever stored.**
- **Therefore "unique visitors" is a per-day figure and nothing else.** Summing days counts a
  daily returner once per day, so the period number is *visitor-days*, not people. The API
  field is literally named `visitor_days` and the screen labels it "summed per day" —
  don't quietly relabel either as "unique visitors".
- **Bots are filtered by two gates**: the user-agent must contain `Mozilla/` (scripts and
  scrapers mostly don't) and must not match the `BOTS` pattern (which catches the crawlers
  that do claim Mozilla, Googlebot and the WhatsApp/Facebook link previewers among them).
  Every paste of the aarti link into WhatsApp fetches the page, so without this the numbers
  would be inflated by sharing rather than reading.
- **`app.set('trust proxy', 1)` is required** for any of this to mean anything: nginx sits in
  front in production, so without it every visitor is `127.0.0.1` and collapses into one. One
  hop — only nginx is trusted. If nginx is ever reconfigured without
  `proxy_set_header X-Forwarded-For`, daily visitors will silently read 1.
- Each recorded view is a `run()`, and `run()` rewrites the whole DB file (see Database
  Rules). Fine at this scale; worth remembering if a link ever goes properly viral.

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
The calendar, Aarti Sangrah and PrimeGem pages need no build step (they are plain HTML, not
part of the Vite bundle), so a `git pull` + `pm2 reload` ships a change to any of them. Aarti
Sangrah is then live at `https://leadtracker.primecomputers.co.in/aartisangrah`, PrimeGem
at `https://leadtracker.primecomputers.co.in/kinetic-gem` (installable copy at
`/kinetic-gem/app`). Both installable apps cache themselves on the devices that installed
them, so shipping a change to either means bumping its `CACHE_VERSION` in the matching
`sw.js` — without that, installed phones keep serving the version they cached, however many
times you redeploy. The **Calendar Links** admin
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
- **A flex overlay that stacks a caption under an image needs `flex-direction:column`.**
  `.modal-overlay` (the Navratri gallery lightbox, and the admin preview that reuses its
  classes) is `display:flex`, so with the default row direction the `<img>` and
  `.modal-caption` are flex *siblings competing for width* — the caption gets only what the
  photo leaves, which on a phone is almost nothing, so it wrapped to one word per line down
  the right edge and ran off screen. It read as "the caption is sideways and cut". The close
  and nav buttons are `position:absolute`, so they gave no hint that the container was a row.
  Prevention: when a caption/label is meant to sit *below* media inside a flex container, set
  the direction explicitly rather than relying on the visual result at desktop width, and
  check it at 390px — at 1280px the row layout looks almost correct.

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
