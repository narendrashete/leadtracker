(function () {
  var listEl = document.getElementById('historyList');
  var searchEl = document.getElementById('historySearch');
  var countEl = document.getElementById('historyCount');
  var noResultsEl = document.getElementById('historyNoResults');
  var loadingEl = document.getElementById('historyLoading');

  var HISTORY = [];

  function escapeHtml(s) {
    return (s || '').toString().replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function render(list) {
    listEl.innerHTML = '';
    if (!list.length) {
      noResultsEl.style.display = 'block';
      countEl.textContent = '';
      return;
    }
    noResultsEl.style.display = 'none';
    countEl.textContent = list.length + ' नोंदी';

    var frag = document.createDocumentFragment();
    list.forEach(function (h) {
      var card = document.createElement('div');
      card.className = 'history-item';
      card.innerHTML =
        '<div class="hsr">' + h.sr + '</div>' +
        '<div class="hinfo">' +
          '<div class="hname">' + escapeHtml(h.name) + '</div>' +
          '<div class="hvillage">📍 ' + (h.village ? escapeHtml(h.village) : 'तपशील लवकरच') + '</div>' +
        '</div>' +
        '<div class="hyear">' + (h.year || '—') + '</div>';
      frag.appendChild(card);
    });
    listEl.appendChild(frag);
  }

  function normalize(s) { return (s || '').toString().toLowerCase().trim(); }

  function filter(q) {
    q = normalize(q);
    if (!q) return HISTORY;
    return HISTORY.filter(function (h) {
      return normalize(h.name).includes(q) ||
        normalize(h.village).includes(q) ||
        String(h.year || '').includes(q) ||
        String(h.sr).includes(q);
    });
  }

  searchEl.addEventListener('input', function () {
    render(filter(searchEl.value));
  });

  fetch('/api/shete/history')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      HISTORY = data;
      loadingEl.style.display = 'none';
      render(HISTORY);
    })
    .catch(function () {
      loadingEl.textContent = 'यादी लोड करता आली नाही. कृपया पुन्हा प्रयत्न करा.';
    });
})();
