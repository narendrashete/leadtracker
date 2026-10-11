import { useEffect, useState } from 'react';
import Photo, { useImage } from './Photo.jsx';
import { Icon } from './Icon.jsx';
import { fmtHeight, fmtIncome } from '../lib/parse.js';

const LABEL = {
  maritalStatus: 'Marital status', dob: 'Date of birth', birthTime: 'Birth time', birthPlace: 'Birth place',
  rashi: 'Rashi', manglik: 'Manglik', nakshatra: 'Nakshatra', gan: 'Gan', bloodGroup: 'Blood group',
  height: 'Height', weight: 'Weight', complexion: 'Complexion', education: 'Education', job: 'Job / business',
  income: 'Income', currentLocation: 'Lives / works in', familyResidence: 'Family residence',
  motherTongue: 'Mother tongue', caste: 'Caste', food: 'Food', native: 'Native place',
  expectedIncome: 'Expected income', expectedLocation: 'Expected location', expectation: 'Expectations',
  hobby: 'Hobbies', family: 'Family', otherCaste: 'Other castes', note: 'Other',
};
const labelOf = (k) => LABEL[k.replace(/_\d+$/, '')] || 'Other';

const EDITABLE = ['dob', 'height', 'weight', 'education', 'job', 'income', 'native', 'currentLocation', 'familyResidence'];

const SECTIONS = [
  ['Education & work', ['education', 'job', 'income']],
  ['Places', ['native', 'currentLocation', 'familyResidence', 'birthPlace']],
  ['Horoscope', ['dob', 'birthTime', 'rashi', 'manglik', 'nakshatra', 'gan', 'bloodGroup']],
  ['Family & background', ['maritalStatus', 'caste', 'motherTongue', 'food', 'family', 'complexion']],
  ['Looking for', ['expectation', 'expectedLocation', 'expectedIncome', 'otherCaste']],
  ['Interests', ['hobby']],
];

export default function ProfileDialog({ p, index, total, onClose, onPrev, onNext, onUpdate }) {
  const [showPage, setShowPage] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [note, setNote] = useState(p.note || '');
  const [copied, setCopied] = useState('');
  const pageUrl = useImage(`page:${p.id}`);

  useEffect(() => {
    setNote(p.note || '');
    setEditing(false);
    setShowPage(false);
  }, [p.id]); // eslint-disable-line

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input,textarea,select')) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, onPrev, onNext]);

  const r = p.fields;
  const used = new Set(SECTIONS.flatMap(([, k]) => k).concat(['height', 'weight']));
  const others = Object.keys(r).filter((k) => !used.has(k.replace(/_\d+$/, '')) && r[k]);
  const dobText = p.dob && !p.dob.approx
    ? new Date(p.dob.y, p.dob.m - 1, p.dob.d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  const copy = async (txt) => {
    try {
      await navigator.clipboard.writeText(txt);
      setCopied(txt);
      setTimeout(() => setCopied(''), 1600);
    } catch {
      /* selection fallback: number is selectable text */
    }
  };

  const startEdit = () => {
    setDraft(Object.fromEntries(EDITABLE.map((k) => [k, r[k] || ''])));
    setEditing(true);
  };
  const saveEdit = () => {
    const edits = { ...(p.edits || {}) };
    for (const k of EDITABLE) {
      if ((draft[k] || '') !== (p.raw[k] || '')) edits[k] = draft[k];
      else delete edits[k];
    }
    onUpdate({ edits });
    setEditing(false);
  };

  const stats = [
    ['Age', p.age != null ? `${p.age}${p.dob?.approx ? '~' : ''}` : '—', p.dob?.approx ? 'from birth year' : dobText],
    ['Height', fmtHeight(p.heightIn), p.heightIn ? `${Math.round(p.heightIn * 2.54)} cm` : null],
    ['Weight', p.weightKg ? `${p.weightKg} kg` : '—'],
    ['Salary', p.incomeL != null ? fmtIncome(p.incomeL) : '—', p.incomeL != null ? 'per year' : null],
  ];

  return (
    <div className="modal-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal profile" role="dialog" aria-label={`Profile of ${p.name}`}>
        <div className="modal-head">
          <div className="pager">
            <button className="icon-btn" onClick={onPrev} disabled={index <= 0} aria-label="Previous profile">
              <Icon name="left" />
            </button>
            <span className="small muted tnum">
              {index >= 0 ? `${index + 1} / ${total}` : ''}
            </span>
            <button className="icon-btn" onClick={onNext} disabled={index < 0 || index >= total - 1} aria-label="Next profile">
              <Icon name="right" />
            </button>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>

        <div className="profile-grid">
          <div className="profile-media">
            <div className="profile-photo">
              {showPage && pageUrl ? <img src={pageUrl} alt={`Original page for ${p.name}`} /> : <Photo id={p.id} alt={p.name} />}
            </div>
            <div className="media-actions">
              <button className={'btn ghost' + (showPage ? ' on' : '')} onClick={() => setShowPage(!showPage)}>
                <Icon name="doc" />
                {showPage ? 'Show photo' : 'Original page'}
              </button>
            </div>
            <p className="muted small src">
              {p.source} · page {p.page}
              {p.listedOn && <> · listed {new Date(p.listedOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
            </p>
          </div>

          <div className="profile-info">
            <p className="eyebrow">{p.code || p.header}</p>
            <h2 className="profile-name">{p.name}</h2>
            {p.nameLine && p.nameLine !== p.name && <p className="muted">{p.nameLine}</p>}

            <div className="actions">
              <button
                className={'btn ' + (p.status === 'shortlist' ? 'primary' : 'ghost')}
                onClick={() => onUpdate({ status: p.status === 'shortlist' ? 'seen' : 'shortlist' })}
                aria-pressed={p.status === 'shortlist'}
              >
                <Icon name={p.status === 'shortlist' ? 'star-fill' : 'star'} />
                {p.status === 'shortlist' ? 'Shortlisted' : 'Shortlist'}
              </button>
              <button
                className="btn ghost"
                onClick={() => onUpdate({ status: p.status === 'hidden' ? 'seen' : 'hidden' })}
              >
                <Icon name={p.status === 'hidden' ? 'eye' : 'eye-off'} />
                {p.status === 'hidden' ? 'Unhide' : 'Not interested'}
              </button>
              {!editing && (
                <button className="btn ghost" onClick={startEdit}>
                  <Icon name="edit" />
                  Fix details
                </button>
              )}
            </div>

            <dl className="stats">
              {stats.map(([k, v, sub]) => (
                <div key={k} className="stat">
                  <dt>{k}</dt>
                  <dd>
                    {v}
                    {sub && <small>{sub}</small>}
                  </dd>
                </div>
              ))}
            </dl>

            {editing ? (
              <div className="editbox">
                <p className="small muted">
                  Correct anything the PDF reader got wrong. Filters use these values. Write height as 5'6", income as
                  “12 lakh” or “40000 per month”.
                </p>
                <div className="editgrid">
                  {EDITABLE.map((k) => (
                    <label key={k} htmlFor={`ed-${k}`}>
                      <span>{labelOf(k)}</span>
                      <input
                        id={`ed-${k}`}
                        className="input"
                        value={draft[k]}
                        onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                      />
                    </label>
                  ))}
                </div>
                <div className="actions">
                  <button className="btn primary" onClick={saveEdit}>
                    Save changes
                  </button>
                  <button className="btn ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              SECTIONS.map(([title, keys]) => {
                const rows = keys.filter((k) => r[k]);
                if (!rows.length) return null;
                return (
                  <section key={title} className="psec">
                    <h3>{title}</h3>
                    <dl className="kv">
                      {rows.map((k) => (
                        <div key={k}>
                          <dt>{labelOf(k)}</dt>
                          <dd>{r[k]}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                );
              })
            )}

            {!editing && others.length > 0 && (
              <section className="psec">
                <h3>More details</h3>
                <dl className="kv">
                  {others.map((k) => (
                    <div key={k}>
                      <dt>{labelOf(k)}</dt>
                      <dd>{r[k]}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {p.phones?.length > 0 && (
              <section className="psec">
                <h3>Contact</h3>
                <div className="phones">
                  {p.phones.map((ph) => (
                    <div key={ph} className="phone">
                      <Icon name="phone" />
                      <span className="tnum sel">{ph.replace(/(\d{5})(\d{5})/, '$1 $2')}</span>
                      <button className="link small" onClick={() => copy(ph)}>
                        {copied === ph ? 'Copied' : 'Copy'}
                      </button>
                      <a
                        className="link small"
                        href={`https://wa.me/91${ph}?text=${encodeURIComponent(`Enquiry about profile ${p.code || p.header || p.name}`)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        WhatsApp
                      </a>
                    </div>
                  ))}
                </div>
                {p.code && <p className="small muted">Quote “{p.code}” when you enquire.</p>}
              </section>
            )}

            <section className="psec">
              <h3>
                <label htmlFor="note">My notes</label>
              </h3>
              <textarea
                id="note"
                className="input note"
                rows={3}
                placeholder="Called on…, family response, horoscope match…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => note !== (p.note || '') && onUpdate({ note })}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
