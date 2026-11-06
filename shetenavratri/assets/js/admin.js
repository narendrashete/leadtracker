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
      document.getElementById('approvedTab').style.display = tab === 'approved' ? 'block' : 'none';
      document.getElementById('membersTab').style.display = tab === 'members' ? 'block' : 'none';
      document.getElementById('rosterTab').style.display = tab === 'roster' ? 'block' : 'none';
      document.getElementById('historyTab').style.display = tab === 'history' ? 'block' : 'none';
      document.getElementById('treesTab').style.display = tab === 'trees' ? 'block' : 'none';
      document.getElementById('uniqueTab').style.display = tab === 'unique' ? 'block' : 'none';
      document.getElementById('waTab').style.display = tab === 'wa' ? 'block' : 'none';
      document.getElementById('linksTab').style.display = tab === 'links' ? 'block' : 'none';
      document.getElementById('donationsTab').style.display = tab === 'donations' ? 'block' : 'none';
      if (tab === 'donations') loadDonationLists();
      if (tab === 'links') loadLinks();
      if (tab === 'approved') loadGalleryApproved();
      if (tab === 'roster') loadRoster();
      if (tab === 'history') loadHistoryAdmin();
      if (tab === 'trees') loadTrees();
      if (tab === 'unique') loadUnique();
      if (tab === 'wa') loadWa();
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

  // ---- Approved photos: year correction ----
  const approvedList = document.getElementById('approvedList');
  const approvedSelectAll = document.getElementById('approvedSelectAll');
  const approvedYearInput = document.getElementById('approvedYear');
  const approvedSetBtn = document.getElementById('approvedSetYear');

  function loadGalleryApproved() {
    api('/api/shete-admin/gallery/approved').then(function (res) {
      approvedList.innerHTML = '';
      approvedSelectAll.checked = false;
      (res.body || []).forEach(function (r) {
        const card = document.createElement('div');
        card.className = 'request-card';
        card.innerHTML =
          '<input type="checkbox" class="a-check" value="' + r.id + '">' +
          '<img class="request-thumb g-thumb" src="' + r.url + '" data-caption="' + escapeHtml(r.caption) + ' — ' + r.year + '">' +
          '<div class="request-info">' +
            '<div class="rtitle">' + escapeHtml(r.name || r.caption) + '</div>' +
            '<div class="rmeta">' + escapeHtml(r.village || '') + ' · वर्ष: <b>' + r.year + '</b></div>' +
          '</div>' +
          '<div class="request-btns">' +
            '<input type="number" class="a-year" min="1990" value="' + r.year + '" style="width:80px;padding:6px;">' +
            '<button class="btn-approve a-save" data-id="' + r.id + '">बदला</button>' +
            '<button class="btn-reject a-delete" data-id="' + r.id + '">काढून टाका</button>' +
          '</div>';
        approvedList.appendChild(card);
      });
    });
  }

  function setYear(ids, year) {
    return api('/api/shete-admin/gallery/set-year', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: ids, year: year }),
    }).then(function (res) {
      if (!res.ok) alert(res.body.error || 'Failed');
      loadGalleryApproved();
    });
  }

  approvedList.addEventListener('click', function (e) {
    if (e.target.classList.contains('g-thumb')) {
      openPreview(e.target.src, e.target.dataset.caption);
    } else if (e.target.classList.contains('a-save')) {
      const yr = e.target.closest('.request-card').querySelector('.a-year').value;
      setYear([Number(e.target.dataset.id)], Number(yr));
    } else if (e.target.classList.contains('a-delete')) {
      if (!confirm('हा फोटो कायमचा काढून टाकायचा?')) return;
      e.target.disabled = true;
      api('/api/shete-admin/gallery/' + e.target.dataset.id, { method: 'DELETE' }).then(function (res) {
        if (!res.ok) {
          e.target.disabled = false;
          alert(res.body.error || 'काढता आले नाही.');
          return;
        }
        loadGalleryApproved();
      });
    }
  });
  approvedSelectAll.addEventListener('change', function () {
    document.querySelectorAll('.a-check').forEach(function (c) { c.checked = approvedSelectAll.checked; });
  });
  approvedSetBtn.addEventListener('click', function () {
    const ids = Array.from(document.querySelectorAll('.a-check:checked')).map(function (c) { return Number(c.value); });
    if (!ids.length || !approvedYearInput.value) return;
    setYear(ids, Number(approvedYearInput.value));
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
            '<div class="rmeta">📍 ' + escapeHtml(r.village) + ' · ' + r.mobile +
              (r.altMobile ? ' · पर्यायी ' + r.altMobile : '') + ' · ' + r.createdAt + '</div>' +
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
        m.mobile.includes(q) || (m.altMobile || '').includes(q);
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
      '<div class="roster-row"><div class="roster-fields">' +
        '<label>WhatsApp / मोबाईल<input type="text" class="r-mobile" value="' + escapeHtml(m.mobile) + '" maxlength="10"></label>' +
        '<label>पर्यायी (Calling)<input type="text" class="r-altMobile" value="' + escapeHtml(m.altMobile) + '" maxlength="10" placeholder="ऐच्छिक"></label>' +
      '</div></div>' +
      '<div class="roster-msg"></div>' +
      '<div class="roster-actions">' +
        '<button class="btn-delete">काढून टाका</button>' +
        '<button class="btn-save">जतन करा</button>' +
      '</div>';
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
    if (!e.target.classList.contains('btn-save') && !e.target.classList.contains('btn-delete')) return;
    const card = e.target.closest('.roster-card');
    const id = card.dataset.id;
    const msgEl = card.querySelector('.roster-msg');

    if (e.target.classList.contains('btn-delete')) {
      const name = card.querySelector('.r-name').value.trim();
      if (!confirm('"' + name + '" यांना सभासद यादीतून कायमचे काढून टाकायचे?')) return;
      e.target.disabled = true;
      api('/api/shete-admin/members/' + id, { method: 'DELETE' }).then(function (res) {
        if (!res.ok) {
          e.target.disabled = false;
          msgEl.textContent = res.body.error || 'काढता आले नाही.';
          msgEl.className = 'roster-msg error';
          return;
        }
        ROSTER = ROSTER.filter(function (m) { return String(m.id) !== String(id); });
        card.remove();
      });
      return;
    }

    const payload = {
      name: card.querySelector('.r-name').value.trim(),
      nameEn: card.querySelector('.r-nameEn').value.trim(),
      village: card.querySelector('.r-village').value.trim(),
      villageEn: card.querySelector('.r-villageEn').value.trim(),
      mobile: card.querySelector('.r-mobile').value.trim(),
      altMobile: card.querySelector('.r-altMobile').value.trim(),
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

  // ---- History (add/edit/delete Navratri list) ----
  const historyAdminList = document.getElementById('historyAdminList');
  const historyAdminSearch = document.getElementById('historyAdminSearch');
  let HISTORY_ADMIN = [];

  function filterHistoryAdmin(q) {
    q = normalize(q);
    if (!q) return HISTORY_ADMIN;
    return HISTORY_ADMIN.filter(function (h) {
      return normalize(h.name).includes(q) || normalize(h.village).includes(q) ||
        String(h.year || '').includes(q);
    });
  }

  function historyCard(h) {
    const card = document.createElement('div');
    card.className = 'roster-card';
    card.dataset.id = h.id;
    card.innerHTML =
      '<div class="roster-row">' +
        '<div class="roster-fields">' +
          '<label>यजमानाचे नाव<input type="text" class="h-name" value="' + escapeHtml(h.name) + '"></label>' +
        '</div>' +
        '<div class="roster-fields">' +
          '<label>गाव<input type="text" class="h-village" value="' + escapeHtml(h.village) + '"></label>' +
        '</div>' +
      '</div>' +
      '<label>वर्ष<input type="text" class="h-year" value="' + (h.year || '') + '" maxlength="4"></label>' +
      '<div class="roster-msg"></div>' +
      '<div class="roster-actions">' +
        '<button class="btn-delete">काढून टाका</button>' +
        '<button class="btn-save">जतन करा</button>' +
      '</div>';
    return card;
  }

  function renderHistoryAdmin(list) {
    historyAdminList.innerHTML = '';
    const frag = document.createDocumentFragment();
    list.forEach(function (h) { frag.appendChild(historyCard(h)); });
    historyAdminList.appendChild(frag);
  }

  function loadHistoryAdmin() {
    api('/api/shete-admin/history').then(function (res) {
      HISTORY_ADMIN = res.body || [];
      renderHistoryAdmin(filterHistoryAdmin(historyAdminSearch.value));
    });
  }

  historyAdminSearch.addEventListener('input', function () {
    renderHistoryAdmin(filterHistoryAdmin(historyAdminSearch.value));
  });

  document.getElementById('hAddBtn').addEventListener('click', function () {
    const btn = this;
    const msgEl = document.getElementById('hAddMsg');
    const payload = {
      name: document.getElementById('hAddName').value.trim(),
      village: document.getElementById('hAddVillage').value.trim(),
      year: document.getElementById('hAddYear').value.trim(),
    };
    btn.disabled = true;
    msgEl.textContent = '';
    msgEl.className = 'roster-msg';
    api('/api/shete-admin/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (res) {
      btn.disabled = false;
      if (!res.ok) {
        msgEl.textContent = res.body.error || 'जोडता आले नाही.';
        msgEl.className = 'roster-msg error';
        return;
      }
      msgEl.textContent = 'जोडले — वेबसाइटवर लगेच दिसेल.';
      msgEl.className = 'roster-msg success';
      document.getElementById('hAddName').value = '';
      document.getElementById('hAddVillage').value = '';
      document.getElementById('hAddYear').value = '';
      loadHistoryAdmin();
    });
  });

  historyAdminList.addEventListener('click', function (e) {
    if (!e.target.classList.contains('btn-save') && !e.target.classList.contains('btn-delete')) return;
    const card = e.target.closest('.roster-card');
    const id = card.dataset.id;
    const msgEl = card.querySelector('.roster-msg');

    if (e.target.classList.contains('btn-delete')) {
      if (!confirm('ही नोंद कायमची काढून टाकायची?')) return;
      e.target.disabled = true;
      api('/api/shete-admin/history/' + id, { method: 'DELETE' }).then(function (res) {
        if (!res.ok) {
          e.target.disabled = false;
          msgEl.textContent = res.body.error || 'काढता आले नाही.';
          msgEl.className = 'roster-msg error';
          return;
        }
        HISTORY_ADMIN = HISTORY_ADMIN.filter(function (h) { return String(h.id) !== String(id); });
        card.remove();
      });
      return;
    }

    const payload = {
      name: card.querySelector('.h-name').value.trim(),
      village: card.querySelector('.h-village').value.trim(),
      year: card.querySelector('.h-year').value.trim(),
    };
    e.target.disabled = true;
    msgEl.textContent = '';
    msgEl.className = 'roster-msg';
    api('/api/shete-admin/history/' + id, {
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
      const idx = HISTORY_ADMIN.findIndex(function (h) { return String(h.id) === String(id); });
      if (idx !== -1) HISTORY_ADMIN[idx] = Object.assign({}, HISTORY_ADMIN[idx], payload);
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

  // ---- Family trees (approve / reopen for editing) ----
  const treesList = document.getElementById('treesList');
  const treePreview = document.getElementById('treePreview');
  const TREE_STATUS = { draft: 'मसुदा (अजून पाठवला नाही)', pending: 'मंजुरीसाठी प्रलंबित', approved: 'मंजूर व प्रकाशित' };
  let treeRows = [];

  function loadTrees() {
    api('/api/shete-admin/trees').then(function (res) {
      treeRows = res.body || [];
      treePreview.innerHTML = '';
      document.getElementById('treesCount').textContent = treeRows.filter(function (r) { return r.status === 'pending'; }).length || '';
      document.getElementById('treesEmpty').style.display = treeRows.length ? 'none' : 'block';
      treesList.innerHTML = treeRows.map(function (r) {
        return '<div class="request-card">' +
          '<div class="request-info">' +
            '<div class="rtitle">' + escapeHtml(r.name) + '</div>' +
            '<div class="rmeta">भरणारे: ' + escapeHtml(r.ownerName) + ' · ' + r.mobile + ' · ' + FamilyTree.count(r.data) + ' व्यक्ती · ' + r.updatedAt + '</div>' +
            '<div class="rmeta"><span class="ft-status ' + r.status + '">' + TREE_STATUS[r.status] + '</span>' +
              (r.status !== 'approved' && r.hasPublished ? ' (जुना मंजूर वृक्ष प्रकाशित आहे)' : '') + '</div>' +
          '</div>' +
          '<div class="request-btns">' +
            '<button class="btn-save" data-act="view" data-id="' + r.memberId + '">पहा</button>' +
            (r.status === 'approved'
              ? '<button class="btn-reject" data-act="reopen" data-id="' + r.memberId + '">संपादनासाठी उघडा</button>'
              : '<button class="btn-approve" data-act="approve" data-id="' + r.memberId + '">मंजूर</button>') +
            '<button class="btn-save" data-act="copy" data-id="' + r.memberId + '">कॉपी करा</button>' +
            (FamilyTree.siblingGroups(r.data).length
              ? '<button class="btn-save" data-act="order" data-id="' + r.memberId + '">भावंडांचा क्रम</button>' : '') +
            '<button class="btn-reject" data-act="delete" data-id="' + r.memberId + '">हटवा</button>' +
          '</div></div>';
      }).join('');
    });
  }

  treesList.addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const row = treeRows.find(function (r) { return r.memberId === id; });
    if (btn.dataset.act === 'view') {
      openViewer(row);
    } else if (btn.dataset.act === 'approve') {
      if (row.status === 'draft' && !confirm('सभासदाने हा वृक्ष अजून मंजुरीसाठी पाठवलेला नाही. तरीही मंजूर करायचा?')) return;
      api('/api/shete-admin/trees/' + id + '/approve', { method: 'POST' }).then(loadTrees);
    } else if (btn.dataset.act === 'copy') {
      openCopy(row);
    } else if (btn.dataset.act === 'order') {
      openOrder(row);
    } else if (btn.dataset.act === 'reopen') {
      if (!confirm('हा वृक्ष सभासदाला पुन्हा संपादनासाठी उघडायचा? (मंजुरीपर्यंत जुना वृक्ष प्रकाशित राहील.)')) return;
      api('/api/shete-admin/trees/' + id + '/reopen', { method: 'POST' }).then(loadTrees);
    } else if (btn.dataset.act === 'delete') {
      deleteTree(row);
    }
  });

  // Delete one member's tree. Trees copied from / to it (same मूळपुरुष) are
  // kept unless the admin says OK to the second, explicit question about them.
  function deleteTree(row) {
    if (!confirm('"' + row.name + '" यांचा कुटुंब वृक्ष कायमचा हटवायचा?\n(मसुदा व प्रकाशित दोन्ही हटतील.)')) return;
    api('/api/shete-admin/trees/' + row.memberId + '/linked').then(function (res) {
      const linked = res.ok ? res.body : [];
      let also = [];
      if (linked.length && confirm(
        'हाच वृक्ष (कॉपी) खालील ' + linked.length + ' सभासदांकडेही आहे:\n\n' +
        linked.map(function (l) { return '• ' + l.name + ' (' + l.village + ')'; }).join('\n') +
        '\n\nत्यांचे वृक्ष सुद्धा हटवायचे?\n\nOK = हे सुद्धा हटवा\nCancel = फक्त "' + row.name + '" यांचा हटवा, बाकीचे तसेच राहतील'
      )) also = linked.map(function (l) { return l.memberId; });
      return api('/api/shete-admin/trees/' + row.memberId + (also.length ? '?also=' + also.join(',') : ''), { method: 'DELETE' });
    }).then(function (res) {
      if (!res.ok) return alert(res.body.error || 'काहीतरी चूक झाली.');
      alert(res.body.deleted + ' वृक्ष हटवला/हटवले.');
      loadTrees();
    });
  }

  // ---- अद्वितीय वंशावळ: one entry per family, copies folded into their original ----
  // A copy made via "कॉपी करा" keeps the original's node ids, so trees with the
  // same root id are one family (same rule as linkedTrees on the server). The
  // original is the row the member filled in themself — copies are owned by
  // "Admin (... यांच्या वृक्षावरून कॉपी)". If the original was deleted, the
  // first remaining copy stands in for it. Only families whose original is
  // मंजूर व प्रकाशित are listed.
  const uniqueList = document.getElementById('uniqueList');
  let uniqueGroups = [];

  function loadUnique() {
    api('/api/shete-admin/trees').then(function (res) {
      const rows = res.body || [];
      const byRoot = {};
      rows.forEach(function (r) { (byRoot[r.data.id] = byRoot[r.data.id] || []).push(r); });
      uniqueGroups = Object.keys(byRoot).map(function (k) {
        const g = byRoot[k];
        const original = g.find(function (r) { return r.ownerName.indexOf('Admin (') !== 0; }) || g[0];
        return { original: original, copies: g.filter(function (r) { return r !== original; }) };
      }).filter(function (g) { return g.original.status === 'approved'; }).sort(function (a, b) { return a.original.name.localeCompare(b.original.name); });

      document.getElementById('uniqueCount').textContent = uniqueGroups.length || '';
      document.getElementById('uniqueEmpty').style.display = uniqueGroups.length ? 'none' : 'block';
      document.getElementById('uniqueSummary').textContent = rows.length
        ? 'एकूण ' + rows.length + ' वृक्षांपैकी ' + uniqueGroups.length + ' मंजूर व प्रकाशित अद्वितीय वंशावळी — कॉपी केलेले वृक्ष मूळ वृक्षाखाली दाखवले आहेत.' : '';
      uniqueList.innerHTML = uniqueGroups.map(function (g, i) {
        const r = g.original;
        return '<div class="request-card">' +
          '<div class="request-info">' +
            '<div class="rtitle">' + escapeHtml(r.name) + '</div>' +
            '<div class="rmeta">मूळपुरुष: ' + escapeHtml(r.data.name) + ' · ' + FamilyTree.count(r.data) + ' व्यक्ती · ' + r.mobile + '</div>' +
            '<div class="rmeta"><span class="ft-status ' + r.status + '">' + TREE_STATUS[r.status] + '</span></div>' +
            (g.copies.length
              ? '<div class="rmeta">कॉपी यांच्याकडेही: ' + g.copies.map(function (c) { return escapeHtml(c.name); }).join(', ') + '</div>' : '') +
          '</div>' +
          '<div class="request-btns">' +
            '<button class="btn-save" data-i="' + i + '">पहा</button>' +
          '</div></div>';
      }).join('');
    });
  }

  uniqueList.addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-i]');
    if (btn) openViewer(uniqueGroups[Number(btn.dataset.i)].original, true);
  });

  // ---- Personal tree links, sent on WhatsApp (like the Musicbox invites) ----
  const linkList = document.getElementById('linkList');
  const linkSearch = document.getElementById('linkSearch');
  const linkText = document.getElementById('linkText');
  const linkWa = document.getElementById('linkWa');
  const linkNote = document.getElementById('linkNote');
  const LINK_SENT_KEY = 'shete_tree_links_sent'; // this browser's "already sent" ticks
  const LINK_STATUS = { none: ['', 'वृक्ष नाही'], draft: ['draft', 'अर्धवट'], pending: ['pending', 'प्रलंबित'], approved: ['approved', 'मंजूर'] };
  let linkMembers = [], linkStatus = {}, linkSel = null;

  function linkSent() {
    try { return JSON.parse(localStorage.getItem(LINK_SENT_KEY)) || {}; } catch (e) { return {}; }
  }

  function loadLinks() {
    Promise.all([api('/api/shete-admin/members'), api('/api/shete-admin/trees')]).then(function (r) {
      linkMembers = r[0].body || [];
      linkStatus = {};
      (r[1].body || []).forEach(function (t) { linkStatus[t.memberId] = t.status; });
      renderLinks();
    });
  }

  function renderLinks() {
    const q = linkSearch.value.trim().toLowerCase();
    const sent = linkSent();
    linkList.innerHTML = linkMembers.filter(function (m) {
      return !q || [m.name, m.nameEn, m.village, m.villageEn, m.mobile].some(function (v) { return (v || '').toLowerCase().includes(q); });
    }).map(function (m) {
      const st = LINK_STATUS[linkStatus[m.id] || 'none'];
      return '<button data-id="' + m.id + '"' + (linkSel && linkSel.id === m.id ? ' class="sel"' : '') + '>' +
        '<span>' + escapeHtml(m.name) + '<br><small style="color:var(--text-soft);">' + escapeHtml(m.village) + '</small></span>' +
        (sent[m.id] ? '<span class="sent">✓ पाठवली</span>' : '') +
        '<span class="ft-status ' + st[0] + '">' + st[1] + '</span></button>';
    }).join('');
  }

  function linkMessage(m, url) {
    const name = m.name.replace(/^श्री\.?\s*/, '');
    return [
      '🌳 *शेटे परिवार — कुटुंब वृक्ष*',
      '',
      'नमस्कार ' + name + ' (' + m.village + '),',
      '',
      'आपल्या कुटुंबाचा वृक्ष तयार करण्यासाठी ही आपली *खास लिंक* आहे. नाव किंवा मोबाईल टाकायची गरज नाही — लिंक उघडताच थेट आपला वृक्ष उघडेल:',
      url,
      '',
      '• मूळपुरुषापासून सुरुवात करा, ➕ ने अपत्ये जोडा.',
      '• अर्धवट राहिल्यास *जतन करा* दाबा — नंतर याच लिंकने पुन्हा उघडून पुढे भरता येईल.',
      '• पूर्ण झाल्यावर *मंजुरीसाठी पाठवा* दाबा.',
      '',
      'ही लिंक फक्त आपल्यासाठी आहे, कृपया इतरांना पाठवू नका.',
      '',
      '— नरेंद्र रामचंद्र शेटे',
    ].join('\n');
  }

  function updateWaHref() {
    linkWa.href = 'https://wa.me/91' + linkSel.mobile + '?text=' + encodeURIComponent(linkText.value);
  }

  linkSearch.addEventListener('input', renderLinks);
  linkList.addEventListener('click', function (e) {
    const b = e.target.closest('button[data-id]');
    if (!b) return;
    const m = linkMembers.find(function (x) { return x.id === Number(b.dataset.id); });
    api('/api/shete-admin/members/' + m.id + '/tree-link', { method: 'POST' }).then(function (res) {
      if (!res.ok) return alert(res.body.error || 'काहीतरी चूक झाली.');
      linkSel = m;
      const url = location.origin + '/shetenavratri/familytree.html?k=' + res.body.token;
      document.getElementById('linkName').textContent = m.name;
      document.getElementById('linkMeta').textContent = m.village + ' · ' + m.mobile + ' · ' + LINK_STATUS[res.body.treeStatus][1];
      linkText.value = linkMessage(m, url);
      linkNote.textContent = res.body.treeStatus === 'approved'
        ? 'या सभासदाचा वृक्ष मंजूर (लॉक) आहे — बदल करू द्यायचे असल्यास आधी "कुटुंब वृक्ष" टॅबमध्ये "संपादनासाठी उघडा" दाबा.' : '';
      linkNote.className = 'roster-msg';
      updateWaHref();
      document.getElementById('linkPick').style.display = 'block';
      renderLinks();
      document.getElementById('linkPick').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  linkText.addEventListener('input', updateWaHref);
  linkWa.addEventListener('click', function () {
    const sent = linkSent();
    sent[linkSel.id] = Date.now();
    try { localStorage.setItem(LINK_SENT_KEY, JSON.stringify(sent)); } catch (e) { /* tick is only a convenience */ }
    renderLinks();
  });
  document.getElementById('linkCopy').addEventListener('click', function () {
    const done = function (ok) {
      linkNote.textContent = ok ? 'मेसेज कॉपी झाला.' : 'कॉपी झाला नाही — "WhatsApp वर पाठवा" वापरा.';
      linkNote.className = 'roster-msg' + (ok ? ' success' : '');
    };
    if (navigator.clipboard) navigator.clipboard.writeText(linkText.value).then(function () { done(true); }, function () { linkText.select(); done(document.execCommand('copy')); });
    else { linkText.select(); done(document.execCommand('copy')); }
  });

  // ---- Full-screen viewer: fits the whole tree on screen, zoom, PNG download ----
  const treeViewer = document.getElementById('treeViewer');
  const tvBody = document.getElementById('tvBody');
  const tvTree = document.getElementById('tvTree');
  let tvRow = null, tvZoom = 1;

  function tvApply() {
    const inner = tvTree.querySelector('.ft-tree');
    tvTree.style.transform = 'scale(' + tvZoom + ')';
    // A transform doesn't change layout size, so size the wrapper by hand or
    // the scrollbars would still cover the unscaled tree.
    tvTree.style.width = inner.offsetWidth + 'px';
    tvTree.style.height = inner.offsetHeight + 'px';
    tvTree.style.marginBottom = (inner.offsetHeight * (tvZoom - 1)) + 'px';
    tvTree.style.marginRight = (inner.offsetWidth * (tvZoom - 1)) + 'px';
    tvTree.style.marginLeft = Math.max(0, (tvBody.clientWidth - 32 - inner.offsetWidth * tvZoom) / 2) + 'px';
  }
  function tvFit() {
    const inner = tvTree.querySelector('.ft-tree');
    const fw = (tvBody.clientWidth - 32) / inner.offsetWidth;
    const fh = (tvBody.clientHeight - 32) / inner.offsetHeight;
    tvZoom = Math.min(1, fw, fh);
    tvApply();
  }
  // noTitle: the अद्वितीय वंशावळ tab downloads the tree without the member's
  // name printed on top, since one family tree stands for all its copies.
  let tvNoTitle = false;
  function openViewer(row, noTitle) {
    tvRow = row;
    tvNoTitle = !!noTitle;
    document.getElementById('tvTitle').textContent = row.name + ' — कुटुंब वृक्ष';
    treeViewer.classList.add('open');
    document.body.style.overflow = 'hidden';
    FamilyTree.render(tvTree, row.data, { ownerId: row.memberId });
    tvTree.querySelector('.ft-tree').style.display = 'inline-block';
    tvFit();
  }
  document.getElementById('tvFit').addEventListener('click', tvFit);
  document.getElementById('tvIn').addEventListener('click', function () { tvZoom = Math.min(2, tvZoom * 1.2); tvApply(); });
  document.getElementById('tvOut').addEventListener('click', function () { tvZoom = Math.max(0.2, tvZoom / 1.2); tvApply(); });
  document.getElementById('tvClose').addEventListener('click', function () {
    treeViewer.classList.remove('open');
    document.body.style.overflow = '';
  });
  document.getElementById('tvPng').addEventListener('click', function () {
    FamilyTree.downloadPng(tvRow.data, tvNoTitle ? '' : tvRow.name + ' — कुटुंब वृक्ष', 'kutumb-vruksha-' + tvRow.memberId + '.png');
  });

  // ---- Copy a tree to other members (brothers / cousins of the same family) ----
  const copyOverlay = document.getElementById('copyOverlay');
  const copyList = document.getElementById('copyList');
  const copySearch = document.getElementById('copySearch');
  const copyMsg = document.getElementById('copyMsg');
  let copySource = null;
  let copyMembers = [];
  const copyChecked = new Set();

  function renderCopyList() {
    const q = copySearch.value.trim().toLowerCase();
    const withTree = new Set(treeRows.map(function (r) { return r.memberId; }));
    copyList.innerHTML = copyMembers.filter(function (m) {
      return m.id !== copySource.memberId && (!q ||
        [m.name, m.nameEn, m.village, m.villageEn, m.mobile].some(function (v) { return (v || '').toLowerCase().includes(q); }));
    }).map(function (m) {
      return '<label><input type="checkbox" value="' + m.id + '"' + (copyChecked.has(m.id) ? ' checked' : '') + '>' +
        '<span>' + escapeHtml(m.name) + '<br><small style="color:var(--text-soft);">' + escapeHtml(m.village) + '</small></span>' +
        (withTree.has(m.id) ? '<span class="has-tree">आधीचा वृक्ष बदलेल</span>' : '') + '</label>';
    }).join('');
  }

  function openCopy(row) {
    copySource = row;
    copyChecked.clear();
    copySearch.value = '';
    copyMsg.textContent = '';
    copyMsg.className = 'form-msg';
    document.getElementById('copyHint').textContent = '"' + row.name + '" यांचा वृक्ष निवडलेल्या सभासदांसाठी कॉपी होईल आणि लगेच प्रकाशित (मंजूर) होईल.';
    copyOverlay.classList.add('open');
    api('/api/shete-admin/members').then(function (res) { copyMembers = res.body || []; renderCopyList(); });
  }

  copySearch.addEventListener('input', renderCopyList);
  copyList.addEventListener('change', function (e) {
    const id = Number(e.target.value);
    if (e.target.checked) copyChecked.add(id); else copyChecked.delete(id);
  });
  document.getElementById('copyClose').addEventListener('click', function () { copyOverlay.classList.remove('open'); });
  copyOverlay.addEventListener('click', function (e) { if (e.target === copyOverlay) copyOverlay.classList.remove('open'); });

  document.getElementById('copyBtn').addEventListener('click', function () {
    const ids = Array.from(copyChecked);
    if (!ids.length) { copyMsg.textContent = 'किमान एक सभासद निवडा.'; copyMsg.className = 'form-msg error'; return; }
    const names = copyMembers.filter(function (m) { return copyChecked.has(m.id); }).map(function (m) { return m.name; });
    if (!confirm('हा वृक्ष खालील सभासदांना कॉपी करायचा?\n\n' + names.join('\n'))) return;
    api('/api/shete-admin/trees/' + copySource.memberId + '/copy', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: ids }),
    }).then(function (res) {
      if (!res.ok) { copyMsg.textContent = res.body.error || 'काहीतरी चूक झाली.'; copyMsg.className = 'form-msg error'; return; }
      copyMsg.textContent = res.body.copied + ' सभासदांना वृक्ष कॉपी झाला.';
      copyMsg.className = 'form-msg success';
      loadTrees();
      setTimeout(function () { copyOverlay.classList.remove('open'); }, 1500);
    });
  });

  // ---- Sibling order ----
  const orderOverlay = document.getElementById('orderOverlay');
  const orderList = document.getElementById('orderList');
  const orderMsg = document.getElementById('orderMsg');
  let orderRow = null, orderGroups = [];

  function openOrder(row) {
    orderRow = row;
    orderGroups = FamilyTree.siblingGroups(row.data);
    orderMsg.textContent = '';
    orderMsg.className = 'form-msg';
    orderList.innerHTML = orderGroups.map(function (g, gi) {
      return '<div class="order-group" data-g="' + gi + '">' +
        '<div class="order-parent">' + escapeHtml(g.parentName) + ' यांची अपत्ये</div>' +
        g.children.map(function (c, i) {
          return '<div class="order-row" data-child="' + escapeHtml(c.id) + '">' +
            '<input type="number" class="order-num" min="1" value="' + (i + 1) + '">' +
            '<span class="order-name">' + escapeHtml(c.name) + '</span></div>';
        }).join('') + '</div>';
    }).join('') || '<p class="form-hint">या वृक्षात २ किंवा अधिक अपत्ये असलेला कोणताही सभासद नाही.</p>';
    orderOverlay.classList.add('open');
  }
  document.getElementById('orderClose').addEventListener('click', function () { orderOverlay.classList.remove('open'); });
  orderOverlay.addEventListener('click', function (e) { if (e.target === orderOverlay) orderOverlay.classList.remove('open'); });

  document.getElementById('orderSaveBtn').addEventListener('click', function () {
    const btn = this;
    const calls = [];
    orderList.querySelectorAll('.order-group').forEach(function (el) {
      const g = orderGroups[Number(el.dataset.g)];
      const rows = Array.from(el.querySelectorAll('.order-row'));
      const ranked = rows.map(function (r, i) {
        return { id: r.dataset.child, n: parseFloat(r.querySelector('.order-num').value) || (i + 1) };
      }).sort(function (a, b) { return a.n - b.n; });
      const newOrder = ranked.map(function (r) { return r.id; });
      const same = newOrder.every(function (id, i) { return id === String(g.children[i].id); });
      if (!same) calls.push({ parentId: g.parentId, order: newOrder });
    });
    if (!calls.length) { orderMsg.textContent = 'काहीही बदल नाही.'; orderMsg.className = 'form-msg'; return; }
    btn.disabled = true;
    orderMsg.textContent = 'जतन होत आहे...';
    orderMsg.className = 'form-msg';
    let updated = 0, failed = false;
    (function next(i) {
      if (i >= calls.length) {
        btn.disabled = false;
        if (failed) { orderMsg.textContent = 'काही बदल जतन होऊ शकले नाहीत.'; orderMsg.className = 'form-msg error'; return; }
        orderMsg.textContent = 'क्रम जतन झाला — ' + updated + ' वृक्षांमध्ये लागू झाला.';
        orderMsg.className = 'form-msg success';
        loadTrees();
        setTimeout(function () { orderOverlay.classList.remove('open'); }, 1200);
        return;
      }
      api('/api/shete-admin/trees/' + orderRow.memberId + '/reorder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(calls[i]),
      }).then(function (res) {
        if (res.ok) updated = Math.max(updated, res.body.updated || 0); else failed = true;
        next(i + 1);
      }).catch(function () { failed = true; next(i + 1); });
    })(0);
  });

  // ---- WhatsApp group list ----
  // Each contact shows which tree people it already covers (by the member
  // whose number it is, or by name); the ones covering nobody are for the
  // admin to pin to a tree name by hand, which then shows WA in every tree.
  const waList = document.getElementById('waList');
  const waSearch = document.getElementById('waSearch');
  const waFilter = document.getElementById('waFilter');
  let WA = [], WA_MEMBERS = [], WA_TREE_NAMES = [];

  function waMatches(c) {
    const key = FamilyTree.nameKey;
    const member = WA_MEMBERS.find(function (m) { return m.mobile === c.mobile || m.altMobile === c.mobile; });
    const memberKeys = member ? [key(member.name), key(member.nameEn)].filter(Boolean) : [];
    const pinned = c.treeName ? key(c.treeName) : null;
    const hits = WA_TREE_NAMES.filter(function (n) {
      const k = key(n);
      return k === pinned || memberKeys.indexOf(k) >= 0 || (c.name && FamilyTree.waNameMatch(n, c.name));
    });
    return { member: member, hits: hits };
  }

  // Minimal CSV reader: quoted fields with commas and "" escapes, as WhatsApp
  // export tools write them.
  function parseCsv(text) {
    const rows = [];
    let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') q = false;
        else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function waCard(c) {
    const st = waMatches(c);
    const card = document.createElement('div');
    card.className = 'roster-card';
    card.dataset.id = c.id;
    card.innerHTML =
      '<div class="roster-row"><div class="roster-fields">' +
        '<label>नाव<input type="text" class="w-name" value="' + escapeHtml(c.name) + '" placeholder="(नाव नाही)"></label>' +
        '<label>WhatsApp क्रमांक<input type="text" class="w-mobile" value="' + escapeHtml(c.mobile) + '" maxlength="10"></label>' +
      '</div></div>' +
      '<div class="wa-status ' + (st.hits.length ? 'ok' : 'miss') + '">' +
        (st.member ? 'सभासद: ' + escapeHtml(st.member.name) + ' · ' : '') +
        (st.hits.length ? '✓ वृक्षात: ' + escapeHtml(st.hits.join(', ')) : '⚠ वृक्षात जुळले नाही — खाली वृक्षातील नाव निवडा') +
      '</div>' +
      '<div class="roster-row"><div class="roster-fields">' +
        '<label>वृक्षातील नाव (Admin जुळवणी)<input type="text" class="w-tree" list="waTreeNames" value="' +
          escapeHtml(c.treeName) + '" placeholder="वृक्षातील व्यक्तीचे नाव निवडा"></label>' +
      '</div></div>' +
      '<div class="roster-msg"></div>' +
      '<div class="roster-actions">' +
        '<button class="btn-delete">काढून टाका</button>' +
        '<button class="btn-save">जतन करा</button>' +
      '</div>';
    return card;
  }

  function renderWa() {
    const q = normalize(waSearch.value), f = waFilter.value;
    let matched = 0;
    const shown = WA.filter(function (c) {
      const hit = waMatches(c).hits.length > 0;
      if (hit) matched++;
      if (f === 'matched' && !hit) return false;
      if (f === 'unmatched' && hit) return false;
      return !q || normalize(c.name).includes(q) || c.mobile.includes(q) || normalize(c.treeName).includes(q);
    });
    document.getElementById('waSummary').textContent =
      WA.length + ' संपर्क · ' + matched + ' वृक्षात जुळले · ' + (WA.length - matched) + ' जुळले नाहीत';
    waList.innerHTML = '';
    const frag = document.createDocumentFragment();
    shown.forEach(function (c) { frag.appendChild(waCard(c)); });
    waList.appendChild(frag);
  }

  function loadWa() {
    Promise.all([
      api('/api/shete-admin/wa'), api('/api/shete-admin/members'), api('/api/shete-admin/trees'),
    ]).then(function (res) {
      WA = res[0].body || [];
      WA_MEMBERS = res[1].body || [];
      const names = new Set();
      (res[2].body || []).forEach(function (t) {
        (function walk(n) {
          if (!n) return;
          if (n.name) names.add(n.name.trim());
          if (n.spouse) names.add(n.spouse.trim());
          (n.children || []).forEach(walk);
        })(t.data);
      });
      WA_TREE_NAMES = Array.from(names).sort();
      document.getElementById('waTreeNames').innerHTML = WA_TREE_NAMES.map(function (n) {
        return '<option value="' + escapeHtml(n) + '">';
      }).join('');
      renderWa();
    });
  }

  waSearch.addEventListener('input', renderWa);
  waFilter.addEventListener('change', renderWa);

  document.getElementById('waImportBtn').addEventListener('click', function () {
    const msg = document.getElementById('waImportMsg');
    const file = document.getElementById('waFile').files[0];
    if (!file) { msg.textContent = 'आधी CSV फाईल निवडा.'; msg.className = 'roster-msg error'; return; }
    file.text().then(function (text) {
      const rows = parseCsv(text.replace(/^﻿/, ''));
      const head = (rows.shift() || []).map(function (h) { return h.trim().toLowerCase(); });
      const col = function (n) { return head.indexOf(n); };
      const iName = col('name'), iSaved = col('saved name'), iPush = col('push name');
      const iPhone = col('phone number') >= 0 ? col('phone number') : col('phone');
      if (iPhone < 0) { msg.textContent = 'CSV मध्ये "Phone Number" कॉलम सापडला नाही.'; msg.className = 'roster-msg error'; return; }
      const payload = rows.map(function (r) {
        const name = [iName, iSaved, iPush].map(function (i) { return i >= 0 ? (r[i] || '').trim() : ''; })
          .find(Boolean) || '';
        return { name: name, mobile: r[iPhone] || '' };
      });
      return api('/api/shete-admin/wa/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows: payload }),
      }).then(function (res) {
        if (!res.ok) { msg.textContent = res.body.error || 'आयात अयशस्वी.'; msg.className = 'roster-msg error'; return; }
        msg.textContent = res.body.added + ' नवीन जोडले, ' + res.body.updated + ' नावे भरली, ' + res.body.skipped + ' आधीच होते/अवैध.';
        msg.className = 'roster-msg success';
        loadWa();
      });
    });
  });

  document.getElementById('waAddBtn').addEventListener('click', function (e) {
    const msg = document.getElementById('waAddMsg');
    const body = {
      name: document.getElementById('waAddName').value.trim(),
      mobile: document.getElementById('waAddMobile').value.trim(),
    };
    e.target.disabled = true;
    api('/api/shete-admin/wa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then(function (res) {
      e.target.disabled = false;
      if (!res.ok) { msg.textContent = res.body.error || 'जोडता आले नाही.'; msg.className = 'roster-msg error'; return; }
      msg.textContent = 'संपर्क जोडला.';
      msg.className = 'roster-msg success';
      document.getElementById('waAddName').value = document.getElementById('waAddMobile').value = '';
      loadWa();
    });
  });

  waList.addEventListener('click', function (e) {
    if (!e.target.classList.contains('btn-save') && !e.target.classList.contains('btn-delete')) return;
    const card = e.target.closest('.roster-card');
    const id = card.dataset.id;
    const msgEl = card.querySelector('.roster-msg');
    const fail = function (res, text) {
      e.target.disabled = false;
      msgEl.textContent = res.body.error || text;
      msgEl.className = 'roster-msg error';
    };

    if (e.target.classList.contains('btn-delete')) {
      if (!confirm('हा संपर्क WhatsApp यादीतून काढायचा?')) return;
      e.target.disabled = true;
      api('/api/shete-admin/wa/' + id, { method: 'DELETE' }).then(function (res) {
        if (!res.ok) return fail(res, 'काढता आले नाही.');
        WA = WA.filter(function (c) { return String(c.id) !== String(id); });
        renderWa();
      });
      return;
    }

    const payload = {
      name: card.querySelector('.w-name').value.trim(),
      mobile: card.querySelector('.w-mobile').value.trim(),
      treeName: card.querySelector('.w-tree').value.trim(),
    };
    e.target.disabled = true;
    api('/api/shete-admin/wa/' + id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }).then(function (res) {
      if (!res.ok) return fail(res, 'जतन करता आले नाही.');
      const idx = WA.findIndex(function (c) { return String(c.id) === String(id); });
      if (idx !== -1) WA[idx] = Object.assign({}, WA[idx], payload);
      renderWa();
    });
  });

  function loadAll() {
    loadGalleryPending();
    loadMembersPending();
    loadTrees();
  }

  // ---- देणगी यादी (donor lists) ----
  // The CSV is the one made from the handwritten receipt sheets: a title line,
  // "भाग १ …" / "भाग २ …" headings, a header row, data rows (पावती क्र. numeric),
  // sub-total rows and an "अंतिम एकूण" row. Only data rows and the final
  // figure are kept; every total is recomputed from the rows.
  const donSelect = document.getElementById('donSelect');
  const donView = document.getElementById('donView');
  const donEmpty = document.getElementById('donEmpty');
  let donCurrent = null;
  const DON_SEC = { 1: 'भाग १ — सभासद यादीतील देणगीदार', 2: 'भाग २ — सभासद यादीत नसलेले देणगीदार' };

  function inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
  function donSum(rows) { return rows.reduce(function (t, r) { return t + (Number(r.amount) || 0); }, 0); }

  function parseDonationCsv(text) {
    const lines = parseCsv(text.replace(/^﻿/, ''));
    let title = '', section = 1, rounded = null;
    const rows = [];
    lines.forEach(function (c) {
      const cells = c.map(function (x) { return (x || '').trim(); });
      const first = cells[0] || '';
      if (!cells.some(Boolean)) return;
      if (/^भाग\s*(२|2)/.test(first)) { section = 2; return; }
      if (/^भाग\s*(१|1)/.test(first)) { section = 1; return; }
      const label = cells.slice(0, 4).join(' ');
      if (/अंतिम\s*एकूण/.test(label)) { const v = parseInt((cells[4] || '').replace(/[^\d-]/g, ''), 10); if (!isNaN(v)) rounded = v; return; }
      if (/^\d+$/.test(cells[1] || '') && cells[3]) {
        rows.push({ section: section, receipt: cells[1], book: cells[2], name: cells[3],
          amount: parseInt((cells[4] || '').replace(/[^\d]/g, ''), 10) || 0,
          village: cells[5] || '', mobile: cells[6] || '', note: cells[7] || '' });
        return;
      }
      if (!title && !rows.length && cells.filter(Boolean).length === 1 && !/^अ\.?क्र/.test(first)) title = first;
    });
    return { title: title, roundedTotal: rounded, rows: rows };
  }

  document.getElementById('donImportBtn').addEventListener('click', function () {
    const msg = document.getElementById('donImportMsg');
    const f = document.getElementById('donFile').files[0];
    if (!f) { msg.textContent = 'आधी CSV फाईल निवडा.'; msg.className = 'roster-msg error'; return; }
    f.text().then(function (text) {
      const parsed = parseDonationCsv(text);
      if (!parsed.rows.length) throw new Error('CSV मध्ये एकही नोंद सापडली नाही.');
      if (!parsed.title) parsed.title = f.name.replace(/\.csv$/i, '');
      return api('/api/shete-admin/donations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed)
      }).then(function (res) {
        if (!res.ok) throw new Error(res.body.error || 'आयात अयशस्वी.');
        msg.textContent = '✓ ' + parsed.rows.length + ' नोंदी आयात झाल्या.';
        msg.className = 'roster-msg success';
        document.getElementById('donFile').value = '';
        loadDonationLists(res.body.id);
      });
    }).catch(function (e) {
      if (e.message === 'unauthorized') return;
      msg.textContent = e.message; msg.className = 'roster-msg error';
    });
  });

  function loadDonationLists(selectId) {
    api('/api/shete-admin/donations').then(function (res) {
      const lists = res.body || [];
      donSelect.innerHTML = lists.map(function (l) {
        return '<option value="' + l.id + '">' + escapeHtml(l.title) + ' (' + l.count + ' नोंदी)</option>';
      }).join('');
      donEmpty.style.display = lists.length ? 'none' : 'block';
      donSelect.parentElement.style.display = lists.length ? 'flex' : 'none';
      if (!lists.length) { donView.style.display = 'none'; donCurrent = null; return; }
      const want = selectId || (donCurrent && donCurrent.id) || lists[0].id;
      donSelect.value = lists.some(function (l) { return l.id === want; }) ? want : lists[0].id;
      loadDonation(Number(donSelect.value));
    }).catch(function () {});
  }

  function loadDonation(id) {
    api('/api/shete-admin/donations/' + id).then(function (res) {
      if (!res.ok) return;
      donCurrent = res.body;
      renderDonation();
    }).catch(function () {});
  }

  donSelect.addEventListener('change', function () { loadDonation(Number(donSelect.value)); });

  document.getElementById('donDelete').addEventListener('click', function () {
    if (!donCurrent || !confirm('"' + donCurrent.title + '" ही संपूर्ण यादी हटवायची?')) return;
    api('/api/shete-admin/donations/' + donCurrent.id, { method: 'DELETE' }).then(function () {
      donCurrent = null; loadDonationLists();
    }).catch(function () {});
  });

  document.getElementById('donMetaSave').addEventListener('click', function () {
    const msg = document.getElementById('donMetaMsg');
    api('/api/shete-admin/donations/' + donCurrent.id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: document.getElementById('donTitle').value, roundedTotal: document.getElementById('donRounded').value })
    }).then(function (res) {
      msg.textContent = res.ok ? '✓ जतन केले.' : (res.body.error || 'जतन अयशस्वी.');
      msg.className = 'roster-msg ' + (res.ok ? 'success' : 'error');
      if (res.ok) loadDonationLists(donCurrent.id);
    }).catch(function () {});
  });

  function donTotals(d) {
    const s1 = d.rows.filter(function (r) { return r.section === 1; });
    const s2 = d.rows.filter(function (r) { return r.section === 2; });
    const total = donSum(d.rows);
    const final = d.roundedTotal == null ? total : d.roundedTotal;
    return { s1: s1, s2: s2, total: total, final: final, round: final - total };
  }

  function renderDonation() {
    const d = donCurrent;
    const t = donTotals(d);
    donView.style.display = 'block';
    document.getElementById('donTitle').value = d.title;
    document.getElementById('donRounded').value = d.roundedTotal == null ? '' : d.roundedTotal;
    document.getElementById('donMetaMsg').textContent = '';
    document.getElementById('donSummary').textContent =
      d.rows.length + ' देणगीदार · भाग १: ' + t.s1.length + ' · भाग २: ' + t.s2.length + ' · अंतिम एकूण ' + inr(t.final);
    function table(sec, rows) {
      if (!rows.length) return '';
      return '<div class="don-sec"><h3>' + DON_SEC[sec] + '</h3><div class="don-scroll"><table class="don-table">' +
        '<tr><th>अ.क्र.</th><th>पावती</th><th>नाव</th><th class="amt">रक्कम</th><th>गाव</th><th>मोबाईल</th><th>टीप</th><th></th></tr>' +
        rows.map(function (r, i) {
          return '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(r.receipt) + '</td><td>' + escapeHtml(r.name) + '</td>' +
            '<td class="amt">' + inr(r.amount) + '</td><td>' + escapeHtml(r.village) + '</td><td>' + escapeHtml(r.mobile) + '</td>' +
            '<td class="note">' + escapeHtml(r.note) + '</td>' +
            '<td><button class="don-move" data-id="' + r.id + '" data-to="' + (sec === 1 ? 2 : 1) + '">' +
              (sec === 2 ? '↑ भाग १ मध्ये (सभासद)' : '↓ भाग २ मध्ये') + '</button></td></tr>';
        }).join('') +
        '<tr class="sub"><td></td><td></td><td>उप-एकूण</td><td class="amt">' + inr(donSum(rows)) + '</td><td colspan="4"></td></tr>' +
        '</table></div></div>';
    }
    document.getElementById('donTables').innerHTML = table(1, t.s1) + table(2, t.s2) +
      '<div class="don-total"><div><span>एकूण</span><span>' + inr(t.total) + '</span></div>' +
      (t.round ? '<div><span>राउंड ऑफ</span><span>' + (t.round > 0 ? '+' : '−') + inr(Math.abs(t.round)) + '</span></div>' : '') +
      '<div class="final"><span>अंतिम एकूण</span><span>' + inr(t.final) + '</span></div></div>';
  }

  document.getElementById('donTables').addEventListener('click', function (e) {
    const b = e.target.closest('.don-move');
    if (!b) return;
    b.disabled = true;
    api('/api/shete-admin/donation-rows/' + b.dataset.id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: Number(b.dataset.to) })
    }).then(function () { loadDonation(donCurrent.id); }).catch(function () {});
  });

  function donFileName(ext) {
    // ASCII only: Chrome drops a Devanagari download name and saves "download".
    const dev = '०१२३४५६७८९';
    const digits = (donCurrent.title || '').replace(/[०-९]/g, function (c) { return dev.indexOf(c); });
    const year = (digits.match(/20\d\d/) || [])[0];
    return 'devangi-yadi-' + (year || donCurrent.id) + '.' + ext;
  }

  function downloadBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  // Same layout as the uploaded CSV, so it can be re-imported; BOM so Excel
  // shows Devanagari.
  document.getElementById('donCsv').addEventListener('click', function () {
    const d = donCurrent, t = donTotals(d);
    const q = function (v) { v = (v == null ? '' : String(v)); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const head = 'अ.क्र.,पावती क्र.,बुक नं.,सदस्याचे नाव,देणगी (₹),गाव,मोबाईल नंबर,टीप';
    const out = [q(d.title), ''];
    [[1, t.s1], [2, t.s2]].forEach(function (p) {
      if (!p[1].length) return;
      out.push(q(DON_SEC[p[0]]), head);
      p[1].forEach(function (r, i) {
        out.push([i + 1, r.receipt, r.book, r.name, r.amount, r.village, r.mobile, r.note].map(q).join(','));
      });
      out.push(',,,' + q('उप-एकूण (भाग ' + (p[0] === 1 ? '१' : '२') + ')') + ',' + donSum(p[1]) + ',,,', '');
    });
    out.push(',,,एकूण,' + t.total + ',,,');
    if (t.round) out.push(',,,राउंड ऑफ,' + t.round + ',,,');
    out.push(',,,अंतिम एकूण,' + t.final + ',,,');
    downloadBlob(new Blob(['﻿' + out.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }), donFileName('csv'));
  });

  // A shareable picture of the list (WhatsApp etc.), drawn on a canvas at 2x
  // like the family-tree PNG. Mobiles are off by default — it gets forwarded.
  function donationCanvas(d, withMobile) {
    const FONT = "'Noto Sans Devanagari','Poppins',sans-serif";
    const t = donTotals(d);
    const W = 900, PAD = 28, ROW = 30, S = 2;
    const cols = [
      { k: 'n', h: 'अ.क्र.', w: 54 }, { k: 'receipt', h: 'पावती', w: 66 },
      { k: 'name', h: 'नाव', w: withMobile ? 250 : 360 }, { k: 'village', h: 'गाव', w: withMobile ? 130 : 200 }
    ];
    if (withMobile) cols.push({ k: 'mobile', h: 'मोबाईल', w: 200 });
    cols.push({ k: 'amount', h: 'रक्कम', w: 0, right: true });
    const used = cols.reduce(function (s, c) { return s + c.w; }, 0);
    cols[cols.length - 1].w = W - 2 * PAD - used;
    const secs = [[1, t.s1], [2, t.s2]].filter(function (p) { return p[1].length; });
    const totalLines = 2 + (t.round ? 1 : 0);
    const H = 120 + secs.reduce(function (h, p) { return h + 44 + ROW + p[1].length * ROW + ROW + 16; }, 0) + totalLines * 32 + 60;

    const cv = document.createElement('canvas');
    cv.width = W * S; cv.height = H * S;
    const ctx = cv.getContext('2d');
    ctx.scale(S, S);
    ctx.fillStyle = '#fffaf2'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#7a1024'); g.addColorStop(1, '#520a19');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 92);
    ctx.fillStyle = '#e8b04b'; ctx.fillRect(0, 92, W, 4);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    ctx.fillStyle = '#f6d98b'; ctx.font = '700 15px ' + FONT;
    ctx.fillText('॥ शेटे परिवार नवरात्री ॥', W / 2, 26);
    ctx.fillStyle = '#fff'; ctx.font = '800 21px ' + FONT;
    let title = d.title;
    while (ctx.measureText(title).width > W - 2 * PAD && title.length > 10) title = title.slice(0, -2);
    if (title !== d.title) title += '…';
    ctx.fillText(title, W / 2, 62);

    function cell(text, x, w, y, right, font, color) {
      ctx.font = font; ctx.fillStyle = color;
      let s = String(text == null ? '' : text);
      while (s.length > 1 && ctx.measureText(s).width > w - 12) s = s.slice(0, -1);
      ctx.textAlign = right ? 'right' : 'left';
      ctx.fillText(s, right ? x + w - 8 : x + 8, y);
    }
    let y = 116;
    secs.forEach(function (p) {
      ctx.textAlign = 'left'; ctx.fillStyle = '#7a1024'; ctx.font = '800 16px ' + FONT;
      ctx.fillText(DON_SEC[p[0]], PAD, y + 14);
      y += 34;
      ctx.fillStyle = '#7a1024'; ctx.fillRect(PAD, y, W - 2 * PAD, ROW);
      let x = PAD;
      cols.forEach(function (c) { cell(c.h, x, c.w, y + ROW / 2, c.right, '700 13px ' + FONT, '#fff'); x += c.w; });
      y += ROW;
      p[1].forEach(function (r, i) {
        ctx.fillStyle = i % 2 ? '#fdf1df' : '#ffffff'; ctx.fillRect(PAD, y, W - 2 * PAD, ROW);
        let cx = PAD;
        cols.forEach(function (c) {
          const v = c.k === 'n' ? i + 1 : c.k === 'amount' ? inr(r.amount) : r[c.k];
          cell(v, cx, c.w, y + ROW / 2, c.right, (c.k === 'name' ? '600 ' : '400 ') + '13.5px ' + FONT, '#3a2a22');
          cx += c.w;
        });
        y += ROW;
      });
      ctx.fillStyle = '#f6d98b'; ctx.fillRect(PAD, y, W - 2 * PAD, ROW);
      cell('उप-एकूण (' + p[1].length + ' देणगीदार)', PAD + cols[0].w + cols[1].w, 300, y + ROW / 2, false, '700 13.5px ' + FONT, '#520a19');
      const last = cols[cols.length - 1];
      cell(inr(donSum(p[1])), W - PAD - last.w, last.w, y + ROW / 2, true, '800 14px ' + FONT, '#520a19');
      ctx.strokeStyle = '#e2d3c0'; ctx.lineWidth = 1;
      ctx.strokeRect(PAD + 0.5, y - p[1].length * ROW - ROW + 0.5, W - 2 * PAD - 1, (p[1].length + 2) * ROW - 1);
      y += ROW + 16;
    });
    const BX = W - PAD - 360;
    function totalLine(label, val, big) {
      ctx.font = (big ? '800 18px ' : '600 15px ') + FONT; ctx.fillStyle = big ? '#7a1024' : '#3a2a22';
      ctx.textAlign = 'left'; ctx.fillText(label, BX, y + 14);
      ctx.textAlign = 'right'; ctx.fillText(val, W - PAD - 8, y + 14);
      y += 32;
    }
    totalLine('एकूण', inr(t.total));
    if (t.round) totalLine('राउंड ऑफ', (t.round > 0 ? '+' : '−') + inr(Math.abs(t.round)));
    ctx.fillStyle = '#e8b04b'; ctx.fillRect(BX, y - 2, W - PAD - BX, 2);
    totalLine('अंतिम एकूण', inr(t.final), true);
    ctx.textAlign = 'center'; ctx.fillStyle = '#9a8070'; ctx.font = '400 11px ' + FONT;
    ctx.fillText('शेटे परिवार नवरात्री — देणगी यादी', W / 2, H - 18);
    return cv;
  }

  document.getElementById('donPng').addEventListener('click', function () {
    const withMobile = document.getElementById('donPngMobile').checked;
    Promise.all([
      document.fonts.load("700 16px 'Noto Sans Devanagari'"),
      document.fonts.load("400 16px 'Noto Sans Devanagari'")
    ]).catch(function () {}).then(function () { return document.fonts.ready; }).then(function () {
      donationCanvas(donCurrent, withMobile).toBlob(function (b) { downloadBlob(b, donFileName('png')); }, 'image/png');
    });
  });

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
