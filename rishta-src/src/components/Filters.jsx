import { useState } from 'react';
import { Icon } from './Icon.jsx';

export function Chip({ on, count, onClick, children }) {
  return (
    <button type="button" className={'chip' + (on ? ' on' : '') + (count === 0 && !on ? ' dim' : '')} onClick={onClick} aria-pressed={!!on}>
      {children}
      {count != null && <span className="chip-n">{count}</span>}
    </button>
  );
}

// Dual-thumb range built from two native range inputs
export function RangeField({ id, label, unit, bounds, value, onChange, fmt }) {
  const [lo, hi] = value;
  const [min, max] = bounds;
  const span = Math.max(1, max - min);
  const pct = (v) => ((v - min) / span) * 100;
  const changed = lo > min || hi < max;
  return (
    <div className="range">
      <div className="flabel">
        <label htmlFor={id + '-lo'}>{label}</label>
        <span className="flabel-unit">{unit}</span>
        {changed && (
          <button className="link small" onClick={() => onChange(null)}>
            Reset
          </button>
        )}
      </div>
      <div className="range-values">
        <output className="rv">{fmt(lo, false)}</output>
        <span className="rv-dash" />
        <output className="rv">{fmt(hi, true)}</output>
      </div>
      <div className="range-track">
        <div className="range-fill" style={{ left: pct(lo) + '%', right: 100 - pct(hi) + '%' }} />
        <input
          id={id + '-lo'}
          type="range"
          min={min}
          max={max}
          step={1}
          value={lo}
          aria-label={`${label} minimum`}
          onChange={(e) => onChange([Math.min(+e.target.value, hi), hi])}
        />
        <input
          id={id + '-hi'}
          type="range"
          min={min}
          max={max}
          step={1}
          value={hi}
          aria-label={`${label} maximum`}
          onChange={(e) => onChange([lo, Math.max(+e.target.value, lo)])}
        />
      </div>
    </div>
  );
}

export function PlaceFilter({ id, label, hint, options, selected, onChange }) {
  const [q, setQ] = useState('');
  const [all, setAll] = useState(false);
  const ql = q.trim().toLowerCase();
  let opts = options.filter(([v]) => !selected.includes(v));
  if (ql) opts = opts.filter(([v]) => v.toLowerCase().includes(ql));
  const shown = all || ql ? opts : opts.slice(0, 8);
  const toggle = (v) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <section className="fgroup">
      <div className="flabel">
        <label htmlFor={id}>{label}</label>
        {hint && <span className="flabel-unit">{hint}</span>}
        {selected.length > 0 && (
          <button className="link small" onClick={() => onChange([])}>
            Reset
          </button>
        )}
      </div>
      {selected.length > 0 && (
        <div className="chips">
          {selected.map((v) => (
            <button key={v} className="chip on" onClick={() => toggle(v)} aria-label={`Remove ${v}`}>
              {v}
              <Icon name="x" />
            </button>
          ))}
        </div>
      )}
      <div className="mini-search">
        <Icon name="search" />
        <input id={id} className="input" placeholder={`Find a place`} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="chips">
        {shown.map(([v, n]) => (
          <button key={v} className="chip" onClick={() => toggle(v)}>
            {v}
            <span className="chip-n">{n}</span>
          </button>
        ))}
        {!ql && opts.length > 8 && (
          <button className="link small" onClick={() => setAll(!all)}>
            {all ? 'Show fewer' : `+${opts.length - 8} more`}
          </button>
        )}
        {ql && shown.length === 0 && <span className="muted small">No place matches “{q}”.</span>}
      </div>
    </section>
  );
}
