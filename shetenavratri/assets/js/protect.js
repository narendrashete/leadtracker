// Basic anti-copy guard for contact numbers shown as text.
// Blocks right-click context menu, text selection start, drag, and copy/cut
// events on elements marked with the "protected" class or inside .member-card.
(function () {
  function isProtectedTarget(el) {
    return !!(el && el.closest && el.closest('.member-card, .protected'));
  }

  document.addEventListener('contextmenu', function (e) {
    if (isProtectedTarget(e.target)) e.preventDefault();
  });

  document.addEventListener('selectstart', function (e) {
    if (isProtectedTarget(e.target)) e.preventDefault();
  });

  document.addEventListener('dragstart', function (e) {
    if (isProtectedTarget(e.target)) e.preventDefault();
  });

  document.addEventListener('copy', function (e) {
    if (isProtectedTarget(e.target)) {
      e.preventDefault();
      if (e.clipboardData) e.clipboardData.setData('text/plain', '');
    }
  });

  document.addEventListener('cutx', function () {});

  // Block common keyboard copy shortcuts while focus is inside a protected area
  document.addEventListener('keydown', function (e) {
    const ctrlOrCmd = e.ctrlKey || e.metaKey;
    if (ctrlOrCmd && ['c', 'C', 'x', 'X', 'u', 'U'].includes(e.key)) {
      if (isProtectedTarget(document.activeElement) || (document.getSelection && document.getSelection().anchorNode && isProtectedTarget(document.getSelection().anchorNode.parentElement))) {
        e.preventDefault();
      }
    }
  });
})();
