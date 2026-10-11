import { itemsToLines, parseProfile, derive } from './parse.js';
import * as store from './store.js';

let pdfjsP;
async function loadPdfjs() {
  if (!pdfjsP) {
    pdfjsP = (async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const workerCode = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw')).default;
      const url = URL.createObjectURL(new Blob([workerCode], { type: 'text/javascript' }));
      pdfjs.GlobalWorkerOptions.workerSrc = url;
      return pdfjs;
    })();
  }
  return pdfjsP;
}

const mul = (a, b) => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
];

// Finds where the profile photo sits on the page (fractions of width/height)
async function findPhotoBox(page, OPS, vp) {
  const ol = await page.getOperatorList();
  let ctm = [1, 0, 0, 1, 0, 0];
  const st = [];
  const boxes = [];
  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i];
    const a = ol.argsArray[i];
    if (fn === OPS.save) st.push(ctm);
    else if (fn === OPS.restore) ctm = st.pop() || ctm;
    else if (fn === OPS.transform) ctm = mul(ctm, a);
    else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject || fn === OPS.paintInlineImageXObject) {
      const xs = [ctm[4], ctm[4] + ctm[0], ctm[4] + ctm[2], ctm[4] + ctm[0] + ctm[2]];
      const ys = [ctm[5], ctm[5] + ctm[1], ctm[5] + ctm[3], ctm[5] + ctm[1] + ctm[3]];
      boxes.push({
        x0: Math.max(0, Math.min(...xs) / vp.width),
        x1: Math.min(1, Math.max(...xs) / vp.width),
        y0: Math.max(0, 1 - Math.max(...ys) / vp.height),
        y1: Math.min(1, 1 - Math.min(...ys) / vp.height),
      });
    }
  }
  const cands = boxes.filter((b) => {
    const w = b.x1 - b.x0, h = b.y1 - b.y0;
    return w > 0.2 && h > 0.15 && w < 0.85 && b.x0 > 0.3;
  });
  cands.sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0));
  return cands[0] || { x0: 0.49, x1: 0.98, y0: 0.09, y1: 0.55 };
}

const toBlob = (canvas, q) => new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));

function profileKey(p) {
  const n = (p.surname || p.name || '').toLowerCase().replace(/[^a-zऀ-ॿ]/g, '');
  const d = p.dob ? `${p.dob.y}-${p.dob.approx ? '' : p.dob.m + '-' + p.dob.d}` : '';
  return [n, d, p.mvs || '', p.heightIn || ''].join('|');
}

const isProfile = (p) => Object.keys(p.raw).filter((k) => !k.startsWith('note_')).length >= 3;

/**
 * Imports a PDF file. onProgress({done,total,added,updated,phase})
 */
export async function importPdf(file, onProgress = () => {}) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const total = doc.numPages;
  const importId = `imp_${Date.now()}`;
  const now = new Date().toISOString();
  let listTitle = '';
  let added = 0, updated = 0, skipped = 0;
  const existing = new Map((await store.loadAll()).map((p) => [p.id, p]));
  // Uploads run behind page rendering (a few pages in flight) so a 300-page
  // list doesn't wait on the network page by page.
  let chain = Promise.resolve();
  let inflight = 0;
  let uploadError = null;
  const queue = (fn) => {
    inflight++;
    chain = chain
      .then(fn)
      .catch((e) => {
        uploadError = uploadError || e;
      })
      .finally(() => inflight--);
  };
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const crop = document.createElement('canvas');
  const cctx = crop.getContext('2d');

  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const lines = itemsToLines(tc.items);
    const p = parseProfile(lines);
    if (!isProfile(p)) {
      if (i <= 2 && !listTitle) listTitle = lines.slice(0, 2).join(' · ');
      skipped++;
      page.cleanup();
      onProgress({ done: i, total, added, updated, skipped });
      continue;
    }

    // Render page + crop photo
    const base = page.getViewport({ scale: 1 });
    const scale = 760 / base.width;
    const vp = page.getViewport({ scale });
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const box = await findPhotoBox(page, pdfjs.OPS, base);
    const sx = box.x0 * canvas.width, sy = box.y0 * canvas.height;
    const sw = (box.x1 - box.x0) * canvas.width, sh = (box.y1 - box.y0) * canvas.height;
    crop.width = Math.round(sw);
    crop.height = Math.round(sh);
    cctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
    const [pageBlob, photoBlob] = await Promise.all([toBlob(canvas, 0.78), toBlob(crop, 0.85)]);

    p.id = profileKey(p);
    const prev = existing.get(p.id);
    const rec = {
      ...p,
      page: i,
      source: file.name,
      importId,
      firstSeen: prev?.firstSeen || now,
      lastSeen: now,
      sources: [...new Set([...(prev?.sources || []), file.name])],
      // keep the user's own data on re-import
      status: prev?.status || 'new',
      note: prev?.note || '',
      edits: prev?.edits || {},
    };
    derive(rec);
    queue(async () => {
      if (uploadError) return;
      await store.saveProfiles([rec]);
      await Promise.all([store.putImage('photo', p.id, photoBlob), store.putImage('page', p.id, pageBlob)]);
    });
    if (inflight > 3) await chain;
    if (uploadError) throw uploadError;
    existing.set(p.id, rec);
    prev ? updated++ : added++;
    page.cleanup();
    onProgress({ done: i, total, added, updated, skipped });
    // let the UI breathe
    if (i % 4 === 0) await new Promise((r) => setTimeout(r, 0));
  }
  await chain;
  if (uploadError) throw uploadError;
  await store.addImport({ id: importId, name: file.name, title: listTitle, at: now, pages: total, added, updated });
  await doc.destroy();
  return { added, updated, skipped, total, title: listTitle };
}
