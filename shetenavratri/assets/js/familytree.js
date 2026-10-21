// Member-side family tree editor. Identify (full name + registered mobile) →
// edit the working copy → save as draft or submit for approval. Every save
// re-sends the identity; there is no session. Once approved the tree is locked
// until an admin reopens it.
(function () {
  const $ = function (id) { return document.getElementById(id); };
  let ident = null;   // { firstName, fatherName, surname, mobile }
  let tree = null;    // working copy
  let status = 'none';
  let dirty = false;
  let sheet = null;   // { mode: 'root'|'add'|'edit', id }

  const STATUS_TEXT = {
    none: ['draft', 'नवीन'],
    draft: ['draft', 'मसुदा (Draft)'],
    pending: ['pending', 'मंजुरीसाठी प्रलंबित'],
    approved: ['approved', 'मंजूर व प्रकाशित'],
  };

  function setMsg(el, text, kind) { el.textContent = text || ''; el.className = 'form-msg' + (kind ? ' ' + kind : ''); }

  function post(method, url, body) {
    return fetch(url, { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, status: r.status, body: b }; }); });
  }

  // ---- Step 1 ----
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const body = {
      firstName: $('fFirst').value.trim(), fatherName: $('fFather').value.trim(),
      surname: $('fSurname').value.trim(), mobile: $('fMobile').value.trim(),
    };
    if (!/^[0-9]{10}$/.test(body.mobile)) return setMsg($('loginMsg'), 'कृपया वैध १० अंकी मोबाईल क्रमांक टाका.', 'error');
    post('POST', '/api/shete/tree/login', body).then(function (res) {
      if (!res.ok) return setMsg($('loginMsg'), res.body.error || 'काहीतरी चूक झाली.', 'error');
      ident = body;
      tree = res.body.data;
      status = res.body.status;
      $('eOwner').textContent = res.body.ownerName;
      $('loginView').style.display = 'none';
      $('editView').style.display = 'block';
      refresh();
    }).catch(function () { setMsg($('loginMsg'), 'नेटवर्क समस्या. पुन्हा प्रयत्न करा.', 'error'); });
  });

  // ---- Editor ----
  function locked() { return status === 'approved'; }

  function refresh() {
    const st = STATUS_TEXT[status] || STATUS_TEXT.none;
    $('eStatus').className = 'ft-status ' + st[0];
    $('eStatus').textContent = st[1];
    $('eHint').textContent = locked()
      ? 'हा वृक्ष मंजूर झाला आहे, त्यामुळे बदल करता येणार नाहीत. बदल हवे असल्यास Admin शी संपर्क करा.'
      : status === 'pending'
        ? 'Admin च्या मंजुरीपर्यंत तुम्ही याच वृक्षात बदल करू शकता. बदल केल्यावर पुन्हा "मंजुरीसाठी पाठवा" दाबा.'
        : 'प्रत्येक व्यक्तीवरील ➕ ने अपत्य जोडा, ✏️ ने नाव बदला, 🗑 ने हटवा.';
    $('eBar').style.display = locked() ? 'none' : 'flex';
    $('startBox').style.display = !tree && !locked() ? 'block' : 'none';
    const box = $('treeEdit');
    if (tree) FamilyTree.render(box, tree, { editable: !locked() });
    else box.innerHTML = '';
  }

  $('treeEdit').addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn || locked()) return;
    const id = btn.closest('.ft-node').dataset.id;
    const found = FamilyTree.find(tree, id, null);
    if (!found) return;
    const act = btn.dataset.act;
    if (act === 'add') openSheet({ mode: 'add', id: id }, found.node.name + ' — अपत्य जोडा', {});
    if (act === 'edit') openSheet({ mode: 'edit', id: id }, 'संपादन', found.node);
    if (act === 'del') {
      const n = FamilyTree.count(found.node);
      const warn = n > 1 ? '\n(यांच्या खालील ' + (n - 1) + ' व्यक्ती देखील हटवल्या जातील.)' : '';
      if (!confirm('"' + found.node.name + '" हटवायचे?' + warn)) return;
      found.parent.children = found.parent.children.filter(function (c) { return c.id !== id; });
      changed();
    }
  });

  $('startBtn').addEventListener('click', function () { openSheet({ mode: 'root' }, 'मूळपुरुष', {}); });

  function openSheet(s, title, n) {
    sheet = s;
    $('personTitle').textContent = title;
    $('pName').value = n.name || '';
    $('pSpouse').value = n.spouse || '';
    $('pDead').checked = !!n.dead;
    $('pSpouseDead').checked = !!n.spouseDead;
    $('personOverlay').classList.add('open');
    setTimeout(function () { $('pName').focus(); }, 50);
  }
  function closeSheet() { $('personOverlay').classList.remove('open'); }
  $('personClose').addEventListener('click', closeSheet);
  $('personOverlay').addEventListener('click', function (e) { if (e.target === $('personOverlay')) closeSheet(); });

  $('personForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const name = $('pName').value.trim();
    const spouse = $('pSpouse').value.trim();
    const dead = $('pDead').checked;
    const spouseDead = !!spouse && $('pSpouseDead').checked;
    if (!name) return;
    if (sheet.mode === 'root') {
      tree = { id: FamilyTree.newId(), name: name, spouse: spouse, dead: dead, spouseDead: spouseDead, children: [] };
    } else {
      const node = FamilyTree.find(tree, sheet.id, null).node;
      if (sheet.mode === 'add') node.children.push({ id: FamilyTree.newId(), name: name, spouse: spouse, dead: dead, spouseDead: spouseDead, children: [] });
      else { node.name = name; node.spouse = spouse; node.dead = dead; node.spouseDead = spouseDead; }
    }
    closeSheet();
    changed();
  });

  function changed() {
    dirty = true;
    setMsg($('eMsg'), 'जतन न केलेले बदल आहेत.', '');
    refresh();
  }

  function save(submit) {
    if (!tree) return setMsg($('eMsg'), 'आधी मूळपुरुष जोडा.', 'error');
    if (submit && !confirm('वृक्ष Admin कडे मंजुरीसाठी पाठवायचा?')) return;
    $('saveBtn').disabled = $('submitBtn').disabled = true;
    post('PUT', '/api/shete/tree', Object.assign({}, ident, { data: tree, submit: submit }))
      .then(function (res) {
        $('saveBtn').disabled = $('submitBtn').disabled = false;
        if (!res.ok) {
          if (res.status === 423) status = 'approved';
          setMsg($('eMsg'), res.body.error || 'काहीतरी चूक झाली.', 'error');
          return refresh();
        }
        tree = res.body.data;
        status = res.body.status;
        dirty = false;
        refresh();
        setMsg($('eMsg'), res.body.message, 'success');
      })
      .catch(function () {
        $('saveBtn').disabled = $('submitBtn').disabled = false;
        setMsg($('eMsg'), 'नेटवर्क समस्या. पुन्हा प्रयत्न करा.', 'error');
      });
  }
  $('saveBtn').addEventListener('click', function () { save(false); });
  $('submitBtn').addEventListener('click', function () { save(true); });

  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
})();
