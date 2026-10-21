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
      '<div class="ft-name">' + esc(n.name) + (n.dead ? ' <span class="ft-dead">मयत</span>' : '') + '</div>' +
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

  return { render: render, find: find, count: count, newId: newId, esc: esc };
})();
