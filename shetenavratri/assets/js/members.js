(function () {
  const listEl = document.getElementById('memberList');
  const searchEl = document.getElementById('searchInput');
  const countEl = document.getElementById('resultCount');
  const noResultsEl = document.getElementById('noResults');
  const loadingEl = document.getElementById('loadingNote');

  let MEMBERS_DATA = [];

  function waLink(mobile) {
    return 'https://wa.me/91' + mobile;
  }
  function telLink(mobile) {
    return 'tel:+91' + mobile;
  }
  function escapeHtml(s) {
    return (s || '').toString().replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Official-style glyphs (white line-art) so buttons read clearly on their colored circles,
  // same pairing as the PrimeTT contacts page (PhoneOutlined + WhatsAppOutlined).
  const CALL_ICON =
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="#fff" aria-hidden="true"><path d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.61 21 3 13.39 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.24.2 2.45.57 3.57a1 1 0 0 1-.25 1.02l-2.2 2.2z"/></svg>';
  // Classic WhatsApp glyph: rounded speech-bubble outline with a phone handset inside,
  // matching the familiar app icon look.
  const WA_ICON =
    '<svg viewBox="0 0 32 32" width="20" height="20" fill="none" aria-hidden="true">' +
    '<path d="M16 6.5c-5.25 0-9.5 4.25-9.5 9.5 0 1.72.46 3.34 1.27 4.73L6.5 25.5l4.94-1.24A9.44 9.44 0 0 0 16 25.5c5.25 0 9.5-4.25 9.5-9.5S21.25 6.5 16 6.5z" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="M12.6 12.1c.2-.44.4-.45.6-.46.16 0 .34 0 .49 0 .16 0 .37-.06.58.44.2.5.7 1.7.76 1.83.06.13.1.28.02.46-.08.18-.13.28-.25.43-.13.15-.27.34-.39.46-.13.13-.26.27-.11.53.15.27.67 1.11 1.45 1.79.99.88 1.83 1.15 2.09 1.28.27.13.42.11.58-.07.16-.18.68-.79.86-1.06.18-.27.36-.22.6-.13.25.09 1.58.75 1.85.88.27.13.45.2.51.31.07.11.07.65-.16 1.28-.23.63-1.35 1.24-1.86 1.31-.5.08-1.03.15-2.9-.6-2.28-.92-3.79-2.98-3.98-3.24-.19-.27-1.5-2-1.5-3.82 0-1.82.98-2.71 1.33-3.1z" fill="#fff"/>' +
    '</svg>';

  function render(list) {
    listEl.innerHTML = '';
    if (list.length === 0) {
      noResultsEl.style.display = 'block';
      countEl.textContent = '';
      return;
    }
    noResultsEl.style.display = 'none';
    countEl.textContent = list.length + ' सभासद';

    const frag = document.createDocumentFragment();
    list.forEach(function (m) {
      const card = document.createElement('div');
      card.className = 'member-card';
      card.innerHTML =
        '<div class="sr">' + m.sr + '</div>' +
        '<div class="member-info">' +
          '<div class="mname">' + escapeHtml(m.name) + '</div>' +
          '<div class="mvillage">📍 ' + escapeHtml(m.village) + '</div>' +
          '<div class="mmobile">' + formatMobile(m.mobile) + '</div>' +
        '</div>' +
        '<div class="contact-actions">' +
          '<a class="call-btn" href="' + telLink(m.mobile) + '" aria-label="Call">' + CALL_ICON + '</a>' +
          '<a class="wa-btn" href="' + waLink(m.mobile) + '" target="_blank" rel="noopener" aria-label="WhatsApp">' + WA_ICON + '</a>' +
        '</div>';
      frag.appendChild(card);
    });
    listEl.appendChild(frag);
  }

  function formatMobile(m) {
    return m.slice(0, 5) + ' ' + m.slice(5);
  }

  function normalize(str) {
    return (str || '').toString().toLowerCase().trim();
  }

  function filterMembers(query) {
    const q = normalize(query);
    if (!q) return MEMBERS_DATA;
    return MEMBERS_DATA.filter(function (m) {
      return (
        normalize(m.name).includes(q) ||
        normalize(m.nameEn).includes(q) ||
        normalize(m.village).includes(q) ||
        normalize(m.villageEn).includes(q) ||
        m.mobile.includes(q) ||
        String(m.sr) === q
      );
    });
  }

  searchEl.addEventListener('input', function () {
    render(filterMembers(searchEl.value));
  });

  fetch('/api/shete/members/approved')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      MEMBERS_DATA = data;
      loadingEl.style.display = 'none';
      render(MEMBERS_DATA);
    })
    .catch(function () {
      loadingEl.textContent = 'सभासद यादी लोड करता आली नाही. कृपया पुन्हा प्रयत्न करा.';
    });

  // ---- Add-member request form ----
  const fab = document.getElementById('addMemberFab');
  const overlay = document.getElementById('addMemberOverlay');
  const form = document.getElementById('addMemberForm');
  const msgEl = document.getElementById('addMemberMsg');

  fab.addEventListener('click', function () {
    msgEl.textContent = '';
    msgEl.className = 'form-msg';
    form.reset();
    overlay.classList.add('open');
  });
  document.getElementById('addMemberClose').addEventListener('click', function () {
    overlay.classList.remove('open');
  });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) overlay.classList.remove('open');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const name = document.getElementById('mName').value.trim();
    const village = document.getElementById('mVillage').value.trim();
    const mobile = document.getElementById('mMobile').value.trim();

    if (!/^[0-9]{10}$/.test(mobile)) {
      msgEl.textContent = 'कृपया वैध १० अंकी मोबाईल क्रमांक टाका.';
      msgEl.className = 'form-msg error';
      return;
    }

    const submitBtn = form.querySelector('.form-submit');
    submitBtn.disabled = true;
    fetch('/api/shete/members/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, village: village, mobile: mobile }),
    })
      .then(function (r) { return r.json().then(function (body) { return { ok: r.ok, body: body }; }); })
      .then(function (res) {
        submitBtn.disabled = false;
        if (!res.ok) {
          msgEl.textContent = res.body.error || 'काहीतरी चूक झाली.';
          msgEl.className = 'form-msg error';
          return;
        }
        msgEl.textContent = res.body.message;
        msgEl.className = 'form-msg success';
        form.reset();
        setTimeout(function () { overlay.classList.remove('open'); }, 1800);
      })
      .catch(function () {
        submitBtn.disabled = false;
        msgEl.textContent = 'नेटवर्क समस्या. पुन्हा प्रयत्न करा.';
        msgEl.className = 'form-msg error';
      });
  });
})();
