// Shared by the public list (index.html) and the admin page (admin.html).
// Served on its own route rather than through a static mount of this folder,
// which would also serve the git-ignored members.json if it sits here.
(function () {
  const STATUS = {
    alive:  { mr: 'हयात', en: 'Alive' },
    dead:   { mr: 'मयत', en: 'Deceased' },
    double: { mr: 'डबल नाव', en: 'Duplicate' },
  };
  const GENDER = { M: 'पुरुष', F: 'स्त्री' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // fetch wrapper: JSON in and out, unwraps the server's { error } body.
  function api(url, opts) {
    opts = Object.assign({}, opts);
    if (opts.json !== undefined) {
      opts.method = opts.method || 'POST';
      opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers);
      opts.body = JSON.stringify(opts.json);
      delete opts.json;
    }
    return fetch(url, opts).then((r) => r.json().catch(() => ({})).then((body) => {
      if (!r.ok) {
        const err = new Error(body.error || 'काहीतरी चूक झाली.');
        err.status = r.status;
        throw err;
      }
      return body;
    }));
  }

  // ---- Search ----
  // Same idea as the Navratri members page (a Devanagari name + an English
  // transliteration per member), made forgiving: Marathi matching ignores the
  // short/long vowel difference (दिपक = दीपक), and English matching drops the
  // spellings people vary on (Sandeep = Sandip, Khadakbaan = Khadakban,
  // Ambawane = Ambavane, Khismatrao = Khismatrav). Every word typed must match.
  const DEV_DIGITS = '०१२३४५६७८९';
  const toAscii = (s) => String(s).replace(/[०-९]/g, (d) => DEV_DIGITS.indexOf(d));
  function devKey(s) {
    return String(s || '').replace(/[‌‍़.]/g, '')
      .replace(/ी/g, 'ि').replace(/ू/g, 'ु').replace(/ई/g, 'इ').replace(/ऊ/g, 'उ')
      .replace(/ँ/g, 'ं').replace(/ष/g, 'श').replace(/\s+/g, ' ');
  }
  function latKey(s) {
    return String(s || '').toLowerCase().replace(/ao\b/g, 'av').replace(/[^a-z]/g, '')
      .replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/x/g, 'ks').replace(/w/g, 'v')
      .replace(/ph/g, 'f').replace(/z/g, 'j').replace(/q/g, 'k')
      .replace(/[ah]/g, '').replace(/(.)\1+/g, '$1');
  }
  const isDev = (s) => /[ऀ-ॿ]/.test(s);

  function prepare(m) {
    m._dev = devKey(m.name);
    m._lat = String(m.nameEn || '').split(/\s+/).map(latKey);
    return m;
  }

  function matches(m, query) {
    const tokens = String(query || '').trim().split(/\s+/).filter(Boolean);
    return tokens.every((t) => {
      const digits = toAscii(t);
      if (/^\d+$/.test(digits)) return String(m.sr) === digits;
      if (isDev(t)) return m._dev.includes(devKey(t));
      // English matches from the start of a word, or "ambavane" would also
      // find every Chambavane.
      const k = latKey(t);
      return k ? m._lat.some((w) => w.startsWith(k)) : String(m.nameEn || '').toLowerCase().includes(t.toLowerCase());
    });
  }

  // "2026-10-28" → "28/10/2026"
  function fmtDate(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    return m ? (+m[3]) + '/' + (+m[2]) + '/' + m[1] : (s || '');
  }

  window.Kulgaon = { STATUS, GENDER, esc, api, prepare, matches, fmtDate, toAscii };
})();
