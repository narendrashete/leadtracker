// Shared family-tree renderer — used by the public viewer (tree.html), the
// member's editor (familytree.html) and the admin preview. A tree is nested
// { id, name, spouse, children }; it is drawn as nested <ul>/<li> with CSS
// connector lines (the classic "CSS org chart" — no library, no canvas), so it
// stays crisp at any zoom and scrolls sideways on a phone when it is wide.
window.FamilyTree = (function () {
  function esc(s) {
    return (s || '').toString().replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function nodeHtml(n, depth, editable) {
    let h = '<li><div class="ft-node' + (depth === 0 ? ' ft-root' : '') + '" data-id="' + esc(n.id) + '">' +
      (depth === 0 ? '<div class="ft-tag">मूळपुरुष</div>' : '') +
      '<div class="ft-name" data-name="' + esc(n.name) + '">' + esc(n.name) + (n.dead ? ' <span class="ft-dead">मयत</span>' : '') + '</div>' +
      (n.spouse ? '<div class="ft-spouse">⚭ ' + esc(n.spouse) + (n.spouseDead ? ' <span class="ft-dead">मयत</span>' : '') + '</div>' : '') +
      (editable
        ? '<div class="ft-tools">' +
            '<button type="button" data-act="add" title="अपत्य जोडा">➕</button>' +
            '<button type="button" data-act="edit" title="संपादन">✏️</button>' +
            (depth === 0 ? '' : '<button type="button" data-act="del" title="हटवा">🗑</button>') +
          '</div>'
        : '') +
      '</div>';
    if (n.children && n.children.length) {
      h += '<ul>' + n.children.map(function (c) { return nodeHtml(c, depth + 1, editable); }).join('') + '</ul>';
    }
    return h + '</li>';
  }

  function render(container, data, opts) {
    opts = opts || {};
    container.classList.add('ft-scroll');
    container.innerHTML = '<div class="ft-tree"><ul>' + nodeHtml(data, 0, !!opts.editable) + '</ul></div>';
    // Start a wide tree scrolled to its centre, where the मूळपुरुष sits.
    container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
    linkMembers(container, opts.ownerId);
  }

  // People in the tree who are also in the सभासद यादी get their membership
  // number as a blue badge linking to their card. Matched by name, ignoring
  // the श्री./सौ. prefix, punctuation and common spelling variants (ी/ि, ू/ु,
  // a dropped े/ै as in दत्तात्रेय/दत्तात्रय). When two members share a name,
  // the tree's owner wins, else the one from the owner's village; if that
  // still leaves a tie the name is left unlinked rather than guessed.
  let membersReq = null;
  function nameKey(s) {
    return (s || '').replace(/^\s*(श्रीमती|श्री|सौ|कु|डॉ)\s*\.\s*/, '').replace(/[.,()]/g, ' ').replace(/\s+/g, ' ').trim()
      .replace(/ी/g, 'ि').replace(/ू/g, 'ु').replace(/[ेै]/g, '');
  }
  function pick(cands, owner) {
    if (!cands) return null;
    if (cands.length === 1) return cands[0];
    if (!owner) return null;
    if (cands.indexOf(owner) >= 0) return owner;
    const local = cands.filter(function (m) { return m.village === owner.village; });
    return local.length === 1 ? local[0] : null;
  }
  function linkMembers(container, ownerId) {
    membersReq = membersReq || fetch('/api/shete/members/approved')
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
    membersReq.then(function (list) {
      const byName = {};
      list.forEach(function (m) {
        const k = nameKey(m.name);
        (byName[k] = byName[k] || []).push(m);
      });
      const owner = list.find(function (m) { return String(m.id) === String(ownerId); });
      container.querySelectorAll('.ft-name[data-name]').forEach(function (el) {
        const m = pick(byName[nameKey(el.dataset.name)], owner);
        if (!m || el.querySelector('.ft-sr')) return;
        el.insertAdjacentHTML('beforeend', ' <a class="ft-sr" href="/shetenavratri/members.html?m=' + m.id +
          '" title="सभासद क्र. ' + m.sr + '">' + m.sr + '</a>');
      });
    });
  }

  function find(node, id, parent) {
    if (node.id === id) return { node: node, parent: parent };
    for (let i = 0; i < (node.children || []).length; i++) {
      const r = find(node.children[i], id, node);
      if (r) return r;
    }
    return null;
  }

  function count(node) {
    return 1 + (node.children || []).reduce(function (s, c) { return s + count(c); }, 0);
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---- PNG export ----
  // Drawn straight onto a canvas with its own small layout (each subtree as
  // wide as its children, parent centred over them) rather than screenshotting
  // the DOM: crisp at 2x, no library, and the whole tree regardless of scroll.
  const FONT = "'Noto Sans Devanagari','Poppins',sans-serif";
  const PAD = 14, GAP_X = 18, GAP_Y = 46, LINE = 22, TAG_W = 40;

  function measure(ctx, n) {
    ctx.font = '700 15px ' + FONT;
    let w = ctx.measureText(n.name).width + (n.dead ? TAG_W : 0);
    ctx.font = '400 13px ' + FONT;
    if (n.spouse) w = Math.max(w, ctx.measureText('⚭ ' + n.spouse).width + (n.spouseDead ? TAG_W : 0));
    n._w = Math.max(120, Math.ceil(w) + PAD * 2);
    n._h = PAD + LINE + (n.spouse ? LINE + 4 : 0) + (n._root ? 16 : 0) + PAD - 6;
    let kids = 0;
    (n.children || []).forEach(function (c) { measure(ctx, c); kids += c._sw; });
    if (n.children && n.children.length) kids += GAP_X * (n.children.length - 1);
    n._sw = Math.max(n._w, kids);
  }

  function levelHeights(n, depth, arr) {
    arr[depth] = Math.max(arr[depth] || 0, n._h);
    (n.children || []).forEach(function (c) { levelHeights(c, depth + 1, arr); });
    return arr;
  }

  function place(n, left, depth, tops) {
    n._x = left + n._sw / 2;
    n._y = tops[depth];
    let kidsW = (n.children || []).reduce(function (s, c) { return s + c._sw; }, 0) +
      GAP_X * Math.max(0, (n.children || []).length - 1);
    let x = left + (n._sw - kidsW) / 2;
    (n.children || []).forEach(function (c) { place(c, x, depth + 1, tops); x += c._sw + GAP_X; });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function deadTag(ctx, x, y) {
    ctx.fillStyle = '#5b5b5b';
    roundRect(ctx, x, y - 9, TAG_W - 6, 18, 9); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 11px ' + FONT; ctx.textAlign = 'center';
    ctx.fillText('मयत', x + (TAG_W - 6) / 2, y + 1);
  }

  function drawNode(ctx, n, levelH) {
    const x = n._x - n._w / 2, y = n._y, root = n._root;
    // connectors to children
    if (n.children && n.children.length) {
      ctx.strokeStyle = '#e8b04b'; ctx.lineWidth = 2;
      const midY = y + levelH + GAP_Y / 2;
      ctx.beginPath();
      ctx.moveTo(n._x, y + n._h); ctx.lineTo(n._x, midY);
      const first = n.children[0], last = n.children[n.children.length - 1];
      ctx.moveTo(first._x, midY); ctx.lineTo(last._x, midY);
      n.children.forEach(function (c) { ctx.moveTo(c._x, midY); ctx.lineTo(c._x, c._y); });
      ctx.stroke();
    }
    ctx.shadowColor = 'rgba(122,16,36,0.15)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2;
    roundRect(ctx, x, y, n._w, n._h, 10);
    ctx.fillStyle = root ? '#6a0d20' : '#fff'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = root ? '#520a19' : '#ecd9b8'; ctx.lineWidth = 1.5; ctx.stroke();

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let ty = y + PAD + 4;
    if (root) { ctx.fillStyle = '#f6d98b'; ctx.font = '700 11px ' + FONT; ctx.fillText('मूळपुरुष', n._x, ty); ty += 16; }
    ctx.font = '700 15px ' + FONT;
    const nameW = ctx.measureText(n.name).width + (n.dead ? TAG_W : 0);
    ctx.fillStyle = root ? '#fff' : '#520a19'; ctx.textAlign = 'left';
    ctx.fillText(n.name, n._x - nameW / 2, ty + 2);
    if (n.dead) deadTag(ctx, n._x + nameW / 2 - TAG_W + 6, ty + 2);
    if (n.spouse) {
      ty += LINE;
      ctx.strokeStyle = root ? 'rgba(255,255,255,0.25)' : '#eadfd0'; ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(x + 10, ty - 6); ctx.lineTo(x + n._w - 10, ty - 6); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = '400 13px ' + FONT;
      const s = '⚭ ' + n.spouse, sw = ctx.measureText(s).width + (n.spouseDead ? TAG_W : 0);
      ctx.fillStyle = root ? '#f6d98b' : '#6b5245'; ctx.textAlign = 'left';
      ctx.fillText(s, n._x - sw / 2, ty + 6);
      if (n.spouseDead) deadTag(ctx, n._x + sw / 2 - TAG_W + 6, ty + 6);
    }
  }

  function drawAll(ctx, n, depth, levels) {
    drawNode(ctx, n, levels[depth]);
    (n.children || []).forEach(function (c) { drawAll(ctx, c, depth + 1, levels); });
  }

  function toCanvas(data, title) {
    const tree = JSON.parse(JSON.stringify(data));
    tree._root = true;
    const ctx0 = document.createElement('canvas').getContext('2d');
    measure(ctx0, tree);
    const levels = levelHeights(tree, 0, []);
    const M = 40, HEAD = title ? 56 : 0;
    const tops = []; let y = M + HEAD;
    levels.forEach(function (h, i) { tops[i] = y; y += h + GAP_Y; });
    place(tree, M, 0, tops);
    const W = tree._sw + M * 2, H = y - GAP_Y + M + 22;
    const scale = 2, cv = document.createElement('canvas');
    cv.width = W * scale; cv.height = H * scale;
    const ctx = cv.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fff8ec'; ctx.fillRect(0, 0, W, H);
    if (title) {
      ctx.fillStyle = '#7a1024'; ctx.font = '800 22px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(title, W / 2, M + 14);
    }
    drawAll(ctx, tree, 0, levels);
    ctx.fillStyle = '#6b5245'; ctx.font = '400 11px ' + FONT; ctx.textAlign = 'right';
    ctx.fillText('शेटे परिवार नवरात्री', W - 16, H - 14);
    return cv;
  }

  function downloadPng(data, title, filename) {
    return document.fonts.ready.then(function () {
      const a = document.createElement('a');
      a.href = toCanvas(data, title).toDataURL('image/png');
      a.download = filename || 'kutumb-vruksha.png';
      document.body.appendChild(a); a.click(); a.remove();
    });
  }

  return { render: render, find: find, count: count, newId: newId, esc: esc, downloadPng: downloadPng };
})();
