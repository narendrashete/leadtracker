(function () {
  // Transcribed from the Shete Kutumbiya register (यजमान यादी), sr 1-31. Sr 31 has
  // no year/village recorded yet in the source — shown with a placeholder until
  // it's supplied. Add future years to the end of this array; no build step needed,
  // just edit and save.
  var HISTORY = [
    { sr: 1, name: 'रामचंद्र शेटे', year: 1991, village: 'कुळगाव' },
    { sr: 2, name: 'चंद्रकांत शेटे', year: 1992, village: 'कुळगाव' },
    { sr: 3, name: 'साईनाथ शेटे', year: 1993, village: 'कल्याण' },
    { sr: 4, name: 'पदमाकर शेटे', year: 1994, village: 'कल्याण' },
    { sr: 5, name: 'शांताराम शेटे', year: 1995, village: 'कल्याण' },
    { sr: 6, name: 'दत्तात्रय शेटे', year: 1996, village: 'मुरबाड' },
    { sr: 7, name: 'दिनेश शेटे', year: 1997, village: 'खोपोली' },
    { sr: 8, name: 'विनोद शेटे', year: 1998, village: 'कल्याण' },
    { sr: 9, name: 'सुधाकर शेटे', year: 1999, village: 'अंबरनाथ' },
    { sr: 10, name: 'ऋषिकांत शेटे', year: 2000, village: 'कल्याण' },
    { sr: 11, name: 'रामचंद्र शेटे', year: 2001, village: 'कुळगाव' },
    { sr: 12, name: 'चंद्रकांत शेटे', year: 2002, village: 'मुरबाड' },
    { sr: 13, name: 'दत्तात्रय शेटे', year: 2003, village: 'मुरबाड' },
    { sr: 14, name: 'दत्तात्रय द्वा. शेटे', year: 2004, village: 'मुरबाड' },
    { sr: 15, name: 'प्रमोद शेटे', year: 2005, village: 'कल्याण' },
    { sr: 16, name: 'विश्वनाथ शेटे', year: 2006, village: 'भिवंडी' },
    { sr: 17, name: 'कृष्णा शेटे', year: 2007, village: 'भिवंडी' },
    { sr: 18, name: 'सुभाष शेटे', year: 2008, village: 'भिवंडी' },
    { sr: 19, name: 'नंदकुमार शेटे', year: 2009, village: 'भिवंडी' },
    { sr: 20, name: 'अरुण शेटे', year: 2010, village: 'कल्याण' },
    { sr: 21, name: 'दत्तात्रय शेटे', year: 2011, village: 'कल्याण' },
    { sr: 22, name: 'दिगंबर शेटे', year: 2012, village: 'कल्याण' },
    { sr: 23, name: 'नंदकुमार वासुदेव शेटे', year: 2013, village: 'भिवंडी' },
    { sr: 24, name: 'रवींद्र भीमनाथ शेटे', year: 2014, village: 'मुरबाड' },
    { sr: 25, name: 'दत्तात्रय द्वा. शेटे', year: 2015, village: 'मुरबाड' },
    { sr: 26, name: 'अनिरुद्ध सूर्यकांत शेटे', year: 2016, village: 'बदलापूर' },
    { sr: 27, name: 'रामचंद्र प. शेटे', year: 2017, village: 'बदलापूर' },
    { sr: 28, name: 'चंद्रकांत प. शेटे', year: 2018, village: 'बदलापूर' },
    { sr: 29, name: 'अरुण दत्तात्रय शेटे', year: 2019, village: 'देवरूग' },
    { sr: 30, name: 'गुरुनाथ द्वा. शेटे', year: 2020, village: 'बापगाव' },
    { sr: 31, name: 'विलास मोरेश्वर शेटे', year: null, village: null },
  ];

  var listEl = document.getElementById('historyList');
  var searchEl = document.getElementById('historySearch');
  var countEl = document.getElementById('historyCount');
  var noResultsEl = document.getElementById('historyNoResults');

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

  render(HISTORY);
})();
