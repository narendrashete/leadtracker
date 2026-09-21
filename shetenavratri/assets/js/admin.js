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
