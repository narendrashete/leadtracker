(function () {
  const collage = document.getElementById('collage');
  const loadingEl = document.getElementById('loadingNote');
  const noPhotosEl = document.getElementById('noPhotos');
  const overlay = document.getElementById('modalOverlay');
  const modalImg = document.getElementById('modalImg');
  const modalCaption = document.getElementById('modalCaption');

  let PHOTOS = [];
  let current = 0;

  function escapeHtml(s) {
    return (s || '').toString().replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderCollage() {
    collage.innerHTML = '';
    if (PHOTOS.length === 0) {
      noPhotosEl.style.display = 'block';
      return;
    }
    noPhotosEl.style.display = 'none';
    PHOTOS.forEach(function (p, i) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.innerHTML = '<img src="' + p.url + '" alt="' + escapeHtml(p.caption) + '" loading="lazy">';
      cell.addEventListener('click', function () { openModal(i); });
      collage.appendChild(cell);
    });
  }

  function openModal(i) {
    current = i;
    showCurrent();
    overlay.classList.add('open');
  }
  function showCurrent() {
    const p = PHOTOS[current];
    modalImg.src = p.url;
    modalCaption.textContent = p.caption + ' — ' + p.year;
  }
  function closeModal() {
    overlay.classList.remove('open');
  }
  function show(delta) {
    current = (current + delta + PHOTOS.length) % PHOTOS.length;
    showCurrent();
  }

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalPrev').addEventListener('click', function () { show(-1); });
  document.getElementById('modalNext').addEventListener('click', function () { show(1); });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (!overlay.classList.contains('open')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') show(-1);
    if (e.key === 'ArrowRight') show(1);
  });

  function loadGallery() {
    fetch('/api/shete/gallery/approved')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        PHOTOS = data;
        loadingEl.style.display = 'none';
        renderCollage();
      })
      .catch(function () {
        loadingEl.textContent = 'फोटो लोड करता आले नाहीत. कृपया पुन्हा प्रयत्न करा.';
      });
  }
  loadGallery();

  // ---- Upload form ----
  const fab = document.getElementById('uploadFab');
  const uOverlay = document.getElementById('uploadOverlay');
  const form = document.getElementById('uploadForm');
  const msgEl = document.getElementById('uploadMsg');
  const yearInput = document.getElementById('uYear');
  yearInput.max = new Date().getFullYear();

  fab.addEventListener('click', function () {
    msgEl.textContent = '';
    msgEl.className = 'form-msg';
    form.reset();
    uOverlay.classList.add('open');
  });
  document.getElementById('uploadClose').addEventListener('click', function () {
    uOverlay.classList.remove('open');
  });
  uOverlay.addEventListener('click', function (e) {
    if (e.target === uOverlay) uOverlay.classList.remove('open');
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const photoFile = document.getElementById('uPhoto').files[0];
    const caption = document.getElementById('uCaption').value.trim();
    const year = document.getElementById('uYear').value;
    const mobile = document.getElementById('uMobile').value.trim();
    const maxYear = new Date().getFullYear();

    if (!photoFile) {
      msgEl.textContent = 'कृपया एक फोटो निवडा.';
      msgEl.className = 'form-msg error';
      return;
    }
    if (!caption) {
      msgEl.textContent = 'कॅप्शन आवश्यक आहे.';
      msgEl.className = 'form-msg error';
      return;
    }
    const yearNum = parseInt(year, 10);
    if (!yearNum || yearNum < 1990 || yearNum > maxYear) {
      msgEl.textContent = 'वर्ष 1990 ते ' + maxYear + ' दरम्यान असावे.';
      msgEl.className = 'form-msg error';
      return;
    }
    if (!/^[0-9]{10}$/.test(mobile)) {
      msgEl.textContent = 'कृपया वैध १० अंकी मोबाईल क्रमांक टाका.';
      msgEl.className = 'form-msg error';
      return;
    }

    const fd = new FormData();
    fd.append('photo', photoFile);
    fd.append('caption', caption);
    fd.append('year', String(yearNum));
    fd.append('mobile', mobile);

    const submitBtn = form.querySelector('.form-submit');
    submitBtn.disabled = true;
    msgEl.textContent = 'अपलोड होत आहे...';
    msgEl.className = 'form-msg';

    fetch('/api/shete/gallery/request', { method: 'POST', body: fd })
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
        setTimeout(function () { uOverlay.classList.remove('open'); }, 1800);
      })
      .catch(function () {
        submitBtn.disabled = false;
        msgEl.textContent = 'नेटवर्क समस्या. पुन्हा प्रयत्न करा.';
        msgEl.className = 'form-msg error';
      });
  });
})();
