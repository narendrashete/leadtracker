import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as store from './lib/store.js';
import { importPdf } from './lib/importPdf.js';
import { ageFrom, fmtHeight, fmtIncome, derive, EDU_LEVELS } from './lib/parse.js';
import { RangeField, PlaceFilter, Chip } from './components/Filters.jsx';
import ProfileDialog from './components/ProfileDialog.jsx';
import Photo from './components/Photo.jsx';
import { Icon } from './components/Icon.jsx';

const LS_KEY = 'rishta.filters.v1';
const loadLS = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {};
  } catch {
    return {};
  }
};
const saveLS = (v) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

// "New" is per device: which profiles THIS browser has opened. In the shared
// album, one person opening a profile must not take it off everyone's New list.
const SEEN_KEY = 'rishta.seen.v1';
const loadSeen = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY)) || []);
  } catch {
    return new Set();
  }
};
const saveSeen = (set) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
};

const DEFAULT = {
  q: '',
  age: null,
  natives: [],
  locations: [],
  income: null,
  edu: [],
  eduText: '',
  height: null,
  weight: null,
  includeUnknown: true,
  tab: 'all',
  sort: 'age-asc',
};


function bounds(list, fn, floor, ceil) {
  const v = list.map(fn).filter((x) => x != null && !isNaN(x));
  if (!v.length) return [floor, ceil];
  return [Math.max(floor, Math.min(...v)), Math.min(ceil, Math.max(...v))];
}

export default function App() {
  const [profiles, setProfiles] = useState(null);
  // Never reopen on the New tab: it only makes sense right after an import.
  const [f, setF] = useState(() => {
    const v = { ...DEFAULT, ...loadLS() };
    if (v.tab === 'new') v.tab = 'all';
    return v;
  });
  const [seen, setSeen] = useState(loadSeen);
  // Profiles opened since the tab was last changed stay in the list, so a
  // profile doesn't vanish from under you the moment you close it.
  const [keep, setKeep] = useState(() => new Set());
  const isNew = (p) => p.status === 'new' && !seen.has(p.id);
  const [progress, setProgress] = useState(null);
  const [toast, setToast] = useState('');
  const [openId, setOpenId] = useState(null);
  const [drawer, setDrawer] = useState(false);
  const [manage, setManage] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  const reload = useCallback(async () => {
    const all = await store.loadAll();
    all.forEach((p) => {
      derive(p);
      p.age = ageFrom(p.dob);
    });
    setProfiles(all);
  }, []);
  useEffect(() => {
    reload()
      .then(() => !store.isShared() && store.persist())
      .catch((e) => {
        setProfiles((p) => p || []);
        setToast(`Couldn't load the album: ${e.message}`);
      });
    // Shared album: pick up what other family members imported or starred.
    const onVis = () => document.visibilityState === 'visible' && store.isShared() && reload().catch(() => {});
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [reload]);
  useEffect(() => saveLS(f), [f]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const set = (patch) => {
    if (patch.tab !== undefined) setKeep(new Set());
    setF((o) => ({ ...o, ...patch }));
  };

  async function handleFiles(files) {
    const pdfs = [...files].filter((x) => /pdf$/i.test(x.type) || /\.pdf$/i.test(x.name));
    if (!pdfs.length) {
      setToast('Choose a PDF file of profiles.');
      return;
    }
    let tA = 0, tU = 0;
    for (const file of pdfs) {
      setProgress({ name: file.name, done: 0, total: 1, added: 0, updated: 0 });
      try {
        const r = await importPdf(file, (p) => setProgress({ name: file.name, ...p }));
        tA += r.added;
        tU += r.updated;
      } catch (e) {
        console.error(e);
        setToast(`Couldn't finish ${file.name}: ${e.message}`);
      }
    }
    setProgress(null);
    await reload();
    if (tA || tU) setToast(`${tA} new profile${tA === 1 ? '' : 's'} added, ${tU} already in your album updated.`);
    if (tA) set({ tab: 'new' });
  }

  async function updateProfile(p, patch) {
    const rec = { ...p, ...patch };
    delete rec.age;
    derive(rec);
    rec.age = ageFrom(rec.dob);
    setProfiles((list) => list.map((x) => (x.id === rec.id ? rec : x)));
    try {
      await store.patchProfile(p, patch);
    } catch (e) {
      setProfiles((list) => list.map((x) => (x.id === p.id ? p : x)));
      setToast(`Couldn't save that change: ${e.message}`);
    }
  }

  // ---------- derived lists ----------
  const list = profiles || [];
  const B = useMemo(
    () => ({
      age: bounds(list, (p) => p.age, 18, 70),
      income: [0, Math.min(60, Math.ceil(bounds(list, (p) => p.incomeL, 0, 60)[1] || 30))],
      height: bounds(list, (p) => p.heightIn, 52, 80),
      weight: bounds(list, (p) => p.weightKg, 35, 130),
    }),
    [list]
  );
  const rng = (key) => {
    const v = f[key];
    const b = B[key];
    if (!v) return b;
    return [Math.max(b[0], Math.min(v[0], b[1])), Math.min(b[1], Math.max(v[1], b[0]))];
  };
  const active = (key) => {
    const r = rng(key);
    return r[0] > B[key][0] || r[1] < B[key][1];
  };

  const counts = useMemo(() => {
    const c = { all: 0, new: 0, shortlist: 0, hidden: 0 };
    for (const p of list) {
      if (p.status === 'hidden') c.hidden++;
      else {
        c.all++;
        if (isNew(p)) c.new++;
        if (p.status === 'shortlist') c.shortlist++;
      }
    }
    return c;
  }, [list, seen]); // eslint-disable-line

  const tabbed = useMemo(
    () =>
      list.filter((p) =>
        keep.has(p.id) ||
        (f.tab === 'hidden'
          ? p.status === 'hidden'
          : p.status !== 'hidden' &&
            (f.tab === 'all' || (f.tab === 'new' ? isNew(p) : p.status === f.tab)))
      ),
    [list, f.tab, seen, keep] // eslint-disable-line
  );

  const matches = (p, skip) => {
    const inR = (key, val) => {
      if (skip === key || !active(key)) return true;
      if (val == null) return f.includeUnknown;
      const [lo, hi] = rng(key);
      return val >= lo && (val <= hi || hi >= B[key][1]);
    };
    if (!inR('age', p.age)) return false;
    if (skip !== 'natives' && f.natives.length && !f.natives.includes(p.nativeNorm)) {
      if (!(f.includeUnknown && !p.nativeNorm)) return false;
    }
    if (skip !== 'locations' && f.locations.length && !f.locations.includes(p.locationNorm)) {
      if (!(f.includeUnknown && !p.locationNorm)) return false;
    }
    if (!inR('income', p.incomeL)) return false;
    if (skip !== 'edu' && f.edu.length && !p.eduTags.some((t) => f.edu.includes(t))) {
      if (!(f.includeUnknown && !p.eduTags.length)) return false;
    }
    if (f.eduText.trim()) {
      const terms = f.eduText.toLowerCase().split(/[,]+/).map((s) => s.trim()).filter(Boolean);
      const e = (p.fields.education || '').toLowerCase();
      if (!terms.some((t) => e.includes(t))) return false;
    }
    if (!inR('height', p.heightIn)) return false;
    if (!inR('weight', p.weightKg)) return false;
    if (f.q.trim()) {
      const hay = [p.name, p.header, p.code, ...Object.values(p.fields), p.note].join(' ').toLowerCase();
      if (!f.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  };

  const results = useMemo(() => {
    const r = tabbed.filter((p) => matches(p));
    const key = {
      'age-asc': (p) => p.age ?? 999,
      'age-desc': (p) => -(p.age ?? -999),
      'income-desc': (p) => -(p.incomeL ?? -1),
      'height-desc': (p) => -(p.heightIn ?? 0),
      newest: (p) => -(Date.parse(p.listedOn || p.firstSeen) || 0),
      page: (p) => p.page + (Date.parse(p.firstSeen) || 0) / 1e3,
    }[f.sort] || ((p) => p.age);
    return r.sort((a, b) => key(a) - key(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabbed, f, B]);

  const facet = (field, skip) => {
    const m = new Map();
    for (const p of tabbed) {
      if (!matches(p, skip)) continue;
      const v = p[field];
      if (v) m.set(v, (m.get(v) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const nativeFacet = useMemo(() => facet('nativeNorm', 'natives'), [tabbed, f, B]); // eslint-disable-line
  const locFacet = useMemo(() => facet('locationNorm', 'locations'), [tabbed, f, B]); // eslint-disable-line
  const eduFacet = useMemo(() => {
    const m = new Map();
    for (const p of tabbed) if (matches(p, 'edu')) p.eduTags.forEach((t) => m.set(t, (m.get(t) || 0) + 1));
    return m;
  }, [tabbed, f, B]); // eslint-disable-line

  const activeCount =
    ['age', 'income', 'height', 'weight'].filter(active).length +
    (f.natives.length ? 1 : 0) + (f.locations.length ? 1 : 0) + (f.edu.length || f.eduText ? 1 : 0);

  const resetFilters = () =>
    set({ age: null, natives: [], locations: [], income: null, edu: [], eduText: '', height: null, weight: null, q: '' });

  const openIdx = results.findIndex((p) => p.id === openId);
  const openP = openId ? list.find((p) => p.id === openId) : null;

  function openProfile(p) {
    setOpenId(p.id);
    setKeep((k) => (k.has(p.id) ? k : new Set(k).add(p.id)));
    if (!seen.has(p.id)) {
      const next = new Set(seen).add(p.id);
      setSeen(next);
      saveSeen(next);
    }
  }
  const step = (d) => {
    const n = results[openIdx + d];
    if (n) openProfile(n);
  };

  // ---------- render ----------
  const filters = (
    <div className="filters">
      <div className="filters-head">
        <h2>Filters</h2>
        {activeCount > 0 && (
          <button className="link" onClick={resetFilters}>
            Clear all
          </button>
        )}
      </div>

      <section className="fgroup fgroup-lead">
        <RangeField
          id="f-age"
          label="Age"
          unit="yrs"
          bounds={B.age}
          value={rng('age')}
          onChange={(v) => set({ age: v })}
          fmt={(v) => v}
        />
        <div className="presets">
          {[[21, 25], [25, 28], [28, 32], [32, 36], [36, 45]].map(([a, b]) => (
            <Chip key={a} on={rng('age')[0] === a && rng('age')[1] === b} onClick={() => set({ age: [a, b] })}>
              {a}–{b}
            </Chip>
          ))}
        </div>
      </section>

      <PlaceFilter
        id="f-native"
        label="Native place"
        hint="Gaav"
        options={nativeFacet}
        selected={f.natives}
        onChange={(v) => set({ natives: v })}
      />
      <PlaceFilter
        id="f-loc"
        label="Job / current location"
        options={locFacet}
        selected={f.locations}
        onChange={(v) => set({ locations: v })}
      />

      <section className="fgroup">
        <RangeField
          id="f-income"
          label="Salary package"
          unit="₹ Lakh / yr"
          bounds={B.income}
          value={rng('income')}
          onChange={(v) => set({ income: v })}
          fmt={(v, isMax) => (isMax && v >= B.income[1] ? `${v}+` : v)}
        />
      </section>

      <section className="fgroup">
        <div className="flabel">
          <span>Education</span>
        </div>
        <div className="chips">
          {EDU_LEVELS.map(([name]) => (
            <Chip
              key={name}
              on={f.edu.includes(name)}
              count={eduFacet.get(name) || 0}
              onClick={() =>
                set({ edu: f.edu.includes(name) ? f.edu.filter((x) => x !== name) : [...f.edu, name] })
              }
            >
              {name}
            </Chip>
          ))}
        </div>
        <input
          id="f-edutext"
          className="input"
          placeholder="Keyword, e.g. MBA, IT, civil"
          value={f.eduText}
          onChange={(e) => set({ eduText: e.target.value })}
        />
      </section>

      <section className="fgroup">
        <RangeField
          id="f-height"
          label="Height"
          unit="ft·in"
          bounds={B.height}
          value={rng('height')}
          onChange={(v) => set({ height: v })}
          fmt={(v) => fmtHeight(v)}
        />
      </section>
      <section className="fgroup">
        <RangeField
          id="f-weight"
          label="Weight"
          unit="kg"
          bounds={B.weight}
          value={rng('weight')}
          onChange={(v) => set({ weight: v })}
          fmt={(v) => v}
        />
      </section>

      <label className="toggle" htmlFor="f-unknown">
        <input
          id="f-unknown"
          type="checkbox"
          checked={f.includeUnknown}
          onChange={(e) => set({ includeUnknown: e.target.checked })}
        />
        <span>Keep profiles that don't state a filtered value</span>
      </label>
    </div>
  );

  const chipsActive = [];
  if (active('age')) chipsActive.push(['Age ' + rng('age').join('–'), () => set({ age: null })]);
  f.natives.forEach((n) => chipsActive.push([`Native: ${n}`, () => set({ natives: f.natives.filter((x) => x !== n) })]));
  f.locations.forEach((n) => chipsActive.push([`Location: ${n}`, () => set({ locations: f.locations.filter((x) => x !== n) })]));
  if (active('income')) {
    const [a, b] = rng('income');
    chipsActive.push([b >= B.income[1] ? `₹${a} L+` : `₹${a}–${b} L`, () => set({ income: null })]);
  }
  f.edu.forEach((n) => chipsActive.push([n, () => set({ edu: f.edu.filter((x) => x !== n) })]));
  if (f.eduText) chipsActive.push([`“${f.eduText}”`, () => set({ eduText: '' })]);
  if (active('height')) chipsActive.push([`Height ${rng('height').map(fmtHeight).join('–')}`, () => set({ height: null })]);
  if (active('weight')) chipsActive.push([`Weight ${rng('weight').join('–')} kg`, () => set({ weight: null })]);

  return (
    <div
      className={'app' + (dragging ? ' is-dragging' : '')}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Icon name="knot" />
          </span>
          <div>
            <h1>Rishta Album</h1>
            <p className="brand-sub">
              {profiles == null
                ? 'Loading…'
                : `${counts.all} profiles · ${counts.shortlist} shortlisted${store.isShared() ? ' · shared' : ''}`}
            </p>
          </div>
        </div>
        <div className="search">
          <Icon name="search" />
          <input
            id="q"
            type="search"
            placeholder="Search name, job, company, rashi…"
            value={f.q}
            onChange={(e) => set({ q: e.target.value })}
          />
        </div>
        <div className="top-actions">
          <button className="btn ghost" onClick={() => setManage(true)} aria-label="Manage imports">
            <Icon name="stack" />
            <span className="hide-sm">Imports</span>
          </button>
          <button className="btn primary" onClick={() => fileRef.current.click()}>
            <Icon name="upload" />
            <span>Import PDF</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            hidden
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
      </header>

      {profiles && profiles.length === 0 ? (
        <Empty onPick={() => fileRef.current.click()} />
      ) : (
        <div className="layout">
          <aside className="sidebar">{filters}</aside>
          <main className="main">
            <div className="toolbar">
              <nav className="tabs" aria-label="Lists">
                {[
                  ['all', 'All'],
                  ['new', 'New'],
                  ['shortlist', 'Shortlisted'],
                  ['hidden', 'Hidden'],
                ].map(([k, l]) => (
                  <button key={k} className={'tab' + (f.tab === k ? ' on' : '')} onClick={() => set({ tab: k })}>
                    {l}
                    <span className="tab-n">{counts[k]}</span>
                  </button>
                ))}
              </nav>
              <div className="toolbar-right">
                <button className="btn ghost show-sm" onClick={() => setDrawer(true)}>
                  <Icon name="sliders" />
                  Filters{activeCount ? ` · ${activeCount}` : ''}
                </button>
                <label className="sort" htmlFor="sort">
                  <span className="hide-sm">Sort</span>
                  <select id="sort" value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
                    <option value="age-asc">Age: youngest first</option>
                    <option value="age-desc">Age: oldest first</option>
                    <option value="income-desc">Salary: highest first</option>
                    <option value="height-desc">Height: tallest first</option>
                    <option value="newest">Recently listed</option>
                    <option value="page">PDF order</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="resultline">
              <strong>{results.length}</strong>
              <span> of {tabbed.length} match</span>
              {f.q.trim() && f.tab !== 'all' && (
                <button className="link small" onClick={() => set({ tab: 'all' })}>
                  Search all profiles
                </button>
              )}
              {chipsActive.map(([label, fn]) => (
                <button key={label} className="achip" onClick={fn} aria-label={`Remove ${label}`}>
                  {label}
                  <Icon name="x" />
                </button>
              ))}
            </div>

            {results.length === 0 && profiles && (
              <div className="noresults">
                <p>No profiles match these filters.</p>
                {activeCount > 0 && (
                  <button className="btn ghost" onClick={resetFilters}>
                    Clear filters
                  </button>
                )}
              </div>
            )}

            <div className="grid">
              {results.map((p) => (
                <Card
                  key={p.id}
                  p={p}
                  isNew={isNew(p)}
                  onOpen={() => openProfile(p)}
                  onStar={() => updateProfile(p, { status: p.status === 'shortlist' ? 'seen' : 'shortlist' })}
                />
              ))}
            </div>
          </main>
        </div>
      )}

      {drawer && (
        <div className="drawer-wrap" onClick={(e) => e.target === e.currentTarget && setDrawer(false)}>
          <div className="drawer" role="dialog" aria-label="Filters">
            {filters}
            <div className="drawer-foot">
              <button className="btn primary block" onClick={() => setDrawer(false)}>
                Show {results.length} profiles
              </button>
            </div>
          </div>
        </div>
      )}

      {openP && (
        <ProfileDialog
          p={openP}
          index={openIdx}
          total={results.length}
          onClose={() => setOpenId(null)}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onUpdate={(patch) => updateProfile(openP, patch)}
        />
      )}

      {manage && <ManageDialog onClose={() => setManage(false)} onCleared={reload} profiles={list} />}

      {progress && (
        <div className="progress-wrap" role="status">
          <div className="progress-card">
            <p className="progress-title">Reading {progress.name}</p>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            <p className="progress-meta">
              Page {progress.done} of {progress.total} · {progress.added} new · {progress.updated} updated
            </p>
            <p className="progress-hint">Keep this tab open. Large lists take a minute or two.</p>
          </div>
        </div>
      )}
      {dragging && (
        <div className="dropzone-overlay">
          <div>
            <Icon name="upload" />
            <p>Drop the PDF to add its profiles</p>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function Card({ p, isNew, onOpen, onStar }) {
  const job = p.fields.job || '';
  return (
    <article className={'card' + (p.status === 'shortlist' ? ' is-star' : '')}>
      <button className="card-hit" onClick={onOpen} aria-label={`Open ${p.name}`}>
        <div className="card-photo">
          <Photo id={p.id} alt={p.name} />
          {isNew && <span className="badge-new">New</span>}
          <span className="card-age">
            {p.age ?? '—'}
            {p.dob?.approx && p.age ? '~' : ''}
            <small>yrs</small>
          </span>
        </div>
        <div className="card-body">
          <h3 className="card-name">{p.name}</h3>
          <p className="card-facts">
            <span>{fmtHeight(p.heightIn)}</span>
            {p.weightKg && <span>{p.weightKg} kg</span>}
            {p.fields.rashi && <span className="clip">{p.fields.rashi}</span>}
          </p>
          {p.fields.education && <p className="card-line clip2">{p.fields.education}</p>}
          {job && <p className="card-line muted clip2">{job}</p>}
          <div className="card-foot">
            <span className={'income' + (p.incomeL == null ? ' none' : '')}>
              {p.incomeL == null ? 'Salary n/a' : `${fmtIncome(p.incomeL)}/yr`}
            </span>
            <span className="places" title={`Native: ${p.fields.native || '—'} · Lives: ${p.locationRaw || '—'}`}>
              <Icon name="pin" />
              <span className="clip">
                {p.nativeNorm || '—'}
                {p.locationNorm && p.locationNorm !== p.nativeNorm ? ` → ${p.locationNorm}` : ''}
              </span>
            </span>
          </div>
        </div>
      </button>
      <button
        className="star"
        onClick={onStar}
        aria-pressed={p.status === 'shortlist'}
        aria-label={p.status === 'shortlist' ? 'Remove from shortlist' : 'Add to shortlist'}
      >
        <Icon name={p.status === 'shortlist' ? 'star-fill' : 'star'} />
      </button>
    </article>
  );
}

function Empty({ onPick }) {
  return (
    <div className="empty">
      <div className="empty-copy">
        <p className="eyebrow">Your private biodata album</p>
        <h2>Turn each profile PDF into a browsable album.</h2>
        <p>
          Import the vadhu-var list PDF you receive. Every page becomes a profile card with its photo, age, height,
          education, salary and native place, ready to filter. Import new lists whenever they arrive; profiles you
          already have are updated, not duplicated.
        </p>
        <button className="btn primary lg" onClick={onPick}>
          <Icon name="upload" /> Import a PDF
        </button>
        <p className="muted small">
          {store.isShared()
            ? 'Or drop the file anywhere on this page. Imported profiles, shortlists and notes are shared with everyone who opens this link.'
            : 'Or drop the file anywhere on this page. Everything stays in this browser.'}
        </p>
      </div>
      <div className="empty-sample" aria-label="Example card">
        <span className="sample-tag">Example</span>
        <article className="card">
          <div className="card-hit">
            <div className="card-photo sample-photo">
              <Icon name="person" />
              <span className="card-age">
                29<small>yrs</small>
              </span>
            </div>
            <div className="card-body">
              <h3 className="card-name">Surname</h3>
              <p className="card-facts">
                <span>5'8"</span>
                <span>65 kg</span>
                <span>Mithun</span>
              </p>
              <p className="card-line">B.E. Computer, MBA</p>
              <p className="card-line muted">Software Engineer</p>
              <div className="card-foot">
                <span className="income">₹12 L/yr</span>
                <span className="places">
                  <Icon name="pin" />
                  <span>Ratnagiri → Pune</span>
                </span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}

function ManageDialog({ onClose, onCleared, profiles }) {
  const [imports, setImports] = useState([]);
  const [usage, setUsage] = useState(0);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    store.listImports().then(setImports).catch(() => {});
    if (!store.isShared()) store.storageEstimate().then(setUsage);
  }, []);
  return (
    <div className="modal-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal small-modal" role="dialog" aria-label="Imports">
        <div className="modal-head">
          <h2>Imported lists</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <p className="muted">
          {store.isShared()
            ? `${profiles.length} profiles, shared with everyone who opens this link.`
            : `${profiles.length} profiles stored in this browser${usage ? ` · ${(usage / 1048576).toFixed(0)} MB used` : ''}.`}
        </p>
        <ul className="imports">
          {imports.length === 0 && <li className="muted">No imports yet.</li>}
          {imports.map((i) => (
            <li key={i.id}>
              <div>
                <strong>{i.title || i.name}</strong>
                <span className="muted small">
                  {i.name} · {new Date(i.at).toLocaleString()}
                </span>
              </div>
              <span className="small">
                +{i.added} new · {i.updated} updated
              </span>
            </li>
          ))}
        </ul>
        {!store.isShared() && <div className="danger-zone">
          {!confirm ? (
            <button className="btn ghost danger" onClick={() => setConfirm(true)}>
              Delete all profiles
            </button>
          ) : (
            <div className="confirm-row">
              <span>Delete every profile, photo, shortlist and note?</span>
              <button className="btn ghost" onClick={() => setConfirm(false)}>
                Keep
              </button>
              <button
                className="btn danger-solid"
                onClick={async () => {
                  await store.clearLocal();
                  await onCleared();
                  onClose();
                }}
              >
                Delete all
              </button>
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}
