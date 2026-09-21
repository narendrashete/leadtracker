(function () {
  const TOKEN_KEY = 'lt_token'; // shared with the Lead Tracker SPA — an admin already
                                 // logged in there on this browser is logged in here too.

  const loginView = document.getElementById('loginView');
  const adminView = document.getElementById('adminView');
  const loginMsg = document.getElementById('loginMsg');

  function token() { return localStorage.getItem(TOKEN_KEY); }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, opts.headers, { Authorization: 'Bearer ' + token() });
    return fetch(path, opts).then(function (r) {
      if (r.status === 401) { showLogin('Session expired. Please log in again.'); throw new Error('unauthorized'); }
      return r.json().then(function (body) { return { ok: r.ok, status: r.status, body: body }; });
    });
  }

  function showLogin(msg) {
    localStorage.removeItem(TOKEN_KEY);
    loginView.style.display = 'block';
    adminView.style.display = 'none';
    if (msg) { loginMsg.textContent = msg; loginMsg.className = 'form-msg error'; }
  }

  function showAdmin() {
    loginView.style.display = 'none';
    adminView.style.display = 'block';
    loadAll();
  }

  document.getElementById('loginBtn').addEventListener('click', function () {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;
    if (!username || !password) {
      loginMsg.textContent = 'Username and password required.';
      loginMsg.className = 'form-msg error';
      return;
    }
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, password: password }),
    })
      .then(function (r) { return r.json().then(function (body) { return { ok: r.ok, body: body }; }); })
      .then(function (res) {
        if (!res.ok) {
          loginMsg.textContent = res.body.error || 'Login failed.';
          loginMsg.className = 'form-msg error';
          return;
        }
        if (res.body.user.role !== 'admin') {
          loginMsg.textContent = 'This account is not an admin.';
          loginMsg.className = 'form-msg error';
          return;
        }
        localStorage.setItem(TOKEN_KEY, res.body.token);
        showAdmin();
      })
      .catch(function () {
        loginMsg.textContent = 'Network error.';
        loginMsg.className = 'form-msg error';
      });
  });

  // ---- Tabs ----
  document.querySelectorAll('.admin-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.admin-tab').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('galleryTab').style.display = tab === 'gallery' ? 'block' : 'none';
      document.getElementById('membersTab').style.display = tab === 'members' ? 'block' : 'none';
      document.getElementById('rosterTab').style.display = tab === 'roster' ? 'block' : 'none';
      if (tab === 'roster') loadRoster();
    });
  });

  function escapeHtml(s) {
    return (s || '').toString().replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- Gallery pending ----
  const galleryList = document.getElementById('galleryList');
  const galleryEmpty = document.getElementById('galleryEmpty');
  const galleryCount = document.getElementById('galleryCount');
  const gallerySelectAll = document.getElementById('gallerySelectAll');
  const galleryBulkBtn = document.getElementById('galleryBulkApprove');

  function loadGalleryPending() {
    api('/api/shete-admin/gallery/pending').then(function (res) {
      galleryList.innerHTML = '';
      const rows = res.body || [];
      galleryCount.textContent = rows.length || '';
      galleryEmpty.style.display = rows.length ? 'none' : 'block';
      gallerySelectAll.checked = false;
      rows.forEach(function (r) {
        const card = document.createElement('div');
        card.className = 'request-card';
        card.innerHTML =
          '<input type="checkbox" class="g-check" value="' + r.id + '">' +
          '<img class="request-thumb g-thumb" src="' + r.url + '" data-caption="' + escapeHtml(r.caption) + ' — ' + r.year + '">' +
          '<div class="request-info">' +
            '<div class="rtitle">' + escapeHtml(r.caption) + '</div>' +
            '<div class="rmeta">वर्ष: ' + r.year + ' · ' + r.mobile + ' · ' + r.createdAt + '</div>' +
          '</div>' +
          '<div class="request-btns">' +
            '<button class="btn-approve" data-id="' + r.id + '">मंजूर</button>' +
            '<button class="btn-reject" data-id="' + r.id + '">नाकारा</button>' +
          '</div>';
        galleryList.appendChild(card);
      });
    });
  }

  galleryList.addEventListener('click', function (e) {
    if (e.target.classList.contains('g-thumb')) {
      openPreview(e.target.src, e.target.dataset.caption);
    } else if (e.target.classList.contains('btn-approve')) {
      api('/api/shete-admin/gallery/' + e.target.dataset.id + '/approve', { method: 'POST' }).then(loadGalleryPending);
    } else if (e.target.classList.contains('btn-reject')) {
      api('/api/shete-admin/gallery/' + e.target.dataset.id + '/reject', { method: 'POST' }).then(loadGalleryPending);
    }
  });

  gallerySelectAll.addEventListener('change', function () {
    document.querySelectorAll('.g-check').forEach(function (c) { c.checked = gallerySelectAll.checked; });
  });

  galleryBulkBtn.addEventListener('click', function () {
    const ids = Array.from(document.querySelectorAll('.g-check:checked')).map(function (c) { return Number(c.value); });
    if (!ids.length) return;
    galleryBulkBtn.disabled = true;
    api('/api/shete-admin/gallery/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ids }),
    }).then(function () {
      galleryBulkBtn.disabled = false;
      loadGalleryPending();
    });
  });

  // ---- Member pending ----
  const membersList = document.getElementById('membersList');
  const membersEmpty = document.getElementById('membersEmpty');
  const membersCount = document.getElementById('membersCount');
  const membersSelectAll = document.getElementById('membersSelectAll');
  const membersBulkBtn = document.getElementById('membersBulkApprove');

  function loadMembersPending() {
    api('/api/shete-admin/members/pending').then(function (res) {
      membersList.innerHTML = '';
      const rows = res.body || [];
      membersCount.textContent = rows.length || '';
      membersEmpty.style.display = rows.length ? 'none' : 'block';
      membersSelectAll.checked = false;
      rows.forEach(function (r) {
        const card = document.createElement('div');
        card.className = 'request-card';
        card.innerHTML =
          '<input type="checkbox" class="m-check" value="' + r.id + '">' +
          '<div class="request-info">' +
            '<div class="rtitle">' + escapeHtml(r.name) + '</div>' +
            '<div class="rmeta">📍 ' + escapeHtml(r.village) + ' · ' + r.mobile + ' · ' + r.createdAt + '</div>' +
          '</div>' +
          '<div class="request-btns">' +
            '<button class="btn-approve" data-id="' + r.id + '">मंजूर</button>' +
            '<button class="btn-reject" data-id="' + r.id + '">नाकारा</button>' +
          '</div>';
        membersList.appendChild(card);
      });
    });
  }

  membersList.addEventListener('click', function (e) {
    if (e.target.classList.contains('btn-approve')) {
      api('/api/shete-admin/members/' + e.target.dataset.id + '/approve', { method: 'POST' }).then(loadMembersPending);
    } else if (e.target.classList.contains('btn-reject')) {
      api('/api/shete-admin/members/' + e.target.dataset.id + '/reject', { method: 'POST' }).then(loadMembersPending);
    }
  });

  membersSelectAll.addEventListener('change', function () {
    document.querySelectorAll('.m-check').forEach(function (c) { c.checked = membersSelectAll.checked; });
  });

  membersBulkBtn.addEventListener('click', function () {
    const ids = Array.from(document.querySelectorAll('.m-check:checked')).map(function (c) { return Number(c.value); });
    if (!ids.length) return;
    membersBulkBtn.disabled = true;
    api('/api/shete-admin/members/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ids }),
    }).then(function () {
      membersBulkBtn.disabled = false;
      loadMembersPending();
    });
  });

  // ---- Roster (edit existing members) ----
  const rosterList = document.getElementById('rosterList');
  const rosterSearch = document.getElementById('rosterSearch');
  let ROSTER = [];

  function normalize(s) { return (s || '').toString().toLowerCase().trim(); }

  function filterRoster(q) {
    q = normalize(q);
    if (!q) return ROSTER;
    return ROSTER.filter(function (m) {
      return normalize(m.name).includes(q) || normalize(m.nameEn).includes(q) ||
        normalize(m.village).includes(q) || normalize(m.villageEn).includes(q) ||
        m.mobile.includes(q);
    });
  }

  function rosterCard(m) {
    const card = document.createElement('div');
    card.className = 'roster-card';
    card.dataset.id = m.id;
    card.innerHTML =
      '<div class="roster-row">' +
        '<div class="roster-fields">' +
          '<label>नाव (मराठी)<input type="text" class="r-name" value="' + escapeHtml(m.name) + '"></label>' +
          '<label>Name (English)<input type="text" class="r-nameEn" value="' + escapeHtml(m.nameEn) + '"></label>' +
        '</div>' +
        '<div class="roster-fields">' +
          '<label>गाव (मराठी)<input type="text" class="r-village" value="' + escapeHtml(m.village) + '"></label>' +
          '<label>Village (English)<input type="text" class="r-villageEn" value="' + escapeHtml(m.villageEn) + '"></label>' +
        '</div>' +
      '</div>' +
      '<label>मोबाईल<input type="text" class="r-mobile" value="' + escapeHtml(m.mobile) + '" maxlength="10"></label>' +
      '<div class="roster-msg"></div>' +
      '<div class="roster-actions"><button class="btn-save">जतन करा</button></div>';
    return card;
  }

  function renderRoster(list) {
    rosterList.innerHTML = '';
    const frag = document.createDocumentFragment();
    list.forEach(function (m) { frag.appendChild(rosterCard(m)); });
    rosterList.appendChild(frag);
  }

  function loadRoster() {
    api('/api/shete-admin/members').then(function (res) {
      ROSTER = res.body || [];
      renderRoster(filterRoster(rosterSearch.value));
    });
  }

  rosterSearch.addEventListener('input', function () {
    renderRoster(filterRoster(rosterSearch.value));
  });

  rosterList.addEventListener('click', function (e) {
    if (!e.target.classList.contains('btn-save')) return;
    const card = e.target.closest('.roster-card');
    const id = card.dataset.id;
    const msgEl = card.querySelector('.roster-msg');
    const payload = {
      name: card.querySelector('.r-name').value.trim(),
      nameEn: card.querySelector('.r-nameEn').value.trim(),
      village: card.querySelector('.r-village').value.trim(),
      villageEn: card.querySelector('.r-villageEn').value.trim(),
      mobile: card.querySelector('.r-mobile').value.trim(),
    };
    e.target.disabled = true;
    msgEl.textContent = '';
    msgEl.className = 'roster-msg';
    api('/api/shete-admin/members/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (res) {
      e.target.disabled = false;
      if (!res.ok) {
        msgEl.textContent = res.body.error || 'जतन करता आले नाही.';
        msgEl.className = 'roster-msg error';
        return;
      }
      msgEl.textContent = 'जतन झाले — वेबसाइटवर लगेच दिसेल.';
      msgEl.className = 'roster-msg success';
      const idx = ROSTER.findIndex(function (m) { return String(m.id) === String(id); });
      if (idx !== -1) ROSTER[idx] = Object.assign({}, ROSTER[idx], payload);
    });
  });

  // ---- Preview modal ----
  const previewOverlay = document.getElementById('previewOverlay');
  const previewImg = document.getElementById('previewImg');
  const previewCaption = document.getElementById('previewCaption');
  function openPreview(src, caption) {
    previewImg.src = src;
    previewCaption.textContent = caption;
    previewOverlay.classList.add('open');
  }
  document.getElementById('previewClose').addEventListener('click', function () {
    previewOverlay.classList.remove('open');
  });
  previewOverlay.addEventListener('click', function (e) {
    if (e.target === previewOverlay) previewOverlay.classList.remove('open');
  });

  function loadAll() {
    loadGalleryPending();
    loadMembersPending();
  }

  // ---- Boot ----
  if (token()) {
    api('/api/auth/me').then(function (res) {
      if (res.ok && res.body.role === 'admin') showAdmin();
      else showLogin();
    }).catch(function () { /* showLogin already called by api() on 401 */ });
  } else {
    showLogin();
  }
})();
