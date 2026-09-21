(function () {
  // Mock gallery images generated as inline SVG placeholders (festive colors).
  // Replace this array with real photo URLs/paths later, e.g. "assets/img/photo1.jpg".
  const colors = ['#7a1024', '#e8622c', '#e8b04b', '#3f8f6b', '#6a4c9c', '#c0293f', '#2f6f9e', '#a8763e', '#b23a6b'];
  const icons = ['🪔', '🎊', '🥁', '💃', '🌸', '🕉️', '✨', '🎶', '🙏'];

  function mockSvg(i) {
    const c = colors[i % colors.length];
    const icon = icons[i % icons.length];
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">' +
      '<rect width="300" height="300" fill="' + c + '"/>' +
      '<circle cx="150" cy="150" r="90" fill="rgba(255,255,255,0.12)"/>' +
      '<text x="50%" y="54%" font-size="100" text-anchor="middle" dominant-baseline="middle">' + icon + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  const GALLERY_IMAGES = Array.from({ length: 9 }, function (_, i) { return mockSvg(i); });

  const collage = document.getElementById('collage');
  const overlay = document.getElementById('modalOverlay');
  const modalImg = document.getElementById('modalImg');
  let current = 0;

  GALLERY_IMAGES.forEach(function (src, i) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.innerHTML = '<img src="' + src + '" alt="क्षणचित्र ' + (i + 1) + '">';
    cell.addEventListener('click', function () { openModal(i); });
    collage.appendChild(cell);
  });

  function openModal(i) {
    current = i;
    modalImg.src = GALLERY_IMAGES[current];
    overlay.classList.add('open');
  }
  function closeModal() {
    overlay.classList.remove('open');
  }
  function show(delta) {
    current = (current + delta + GALLERY_IMAGES.length) % GALLERY_IMAGES.length;
    modalImg.src = GALLERY_IMAGES[current];
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
})();
