/**
 * Dokumen iframe demo template package (katalog Studio, /templates/package/[slug]).
 * Salinan pola lib/template-preview-document.ts di bagdja-website-platform.
 *
 * JavaScript template dijalankan agar reviewer bisa menilai interaksinya, dengan batas:
 * - iframe `sandbox="allow-scripts"` TANPA allow-same-origin → origin opaque, tidak bisa
 *   membaca cookie/sesi/DOM platform, tidak bisa membuka jendela atau menavigasi top;
 * - CSP: tanpa jaringan (connect-src 'none'), form, worker, frame, object, base;
 * - skrip penjaga mencegat tautan & tombol aksi Bagdja (hanya berjalan di website sungguhan)
 *   tanpa menghentikan interaksi lokal template, dan menampilkan galat JavaScript template;
 * - data yang dirender hanya halaman & katalog contoh, bukan data tenant/pembeli.
 */

const PREVIEW_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline' https:",
  'img-src https: data: blob:',
  'font-src https: data:',
  'media-src https: data:',
  "connect-src 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
].join('; ');

const GUARD_SCRIPT = `(function () {
  var toast;
  function show(text) {
    if (!toast) {
      toast = document.createElement('div');
      toast.setAttribute('role', 'status');
      toast.setAttribute('data-preview-toast', '');
      toast.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483647;max-width:min(92vw,440px);padding:10px 14px;border-radius:10px;background:#18181b;color:#fff;font:13px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)';
      (document.body || document.documentElement).appendChild(toast);
    }
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toast.hidden = true; }, 4000);
  }
  document.addEventListener('click', function (event) {
    var target = event.target instanceof Element
      ? event.target.closest('a[href], [data-bagdja-intent], [data-bagdja-action]')
      : null;
    if (!target) return;
    if (target.matches('a[href]')) {
      var href = target.getAttribute('href') || '';
      if (href.charAt(0) === '#') return;
      event.preventDefault();
      show('Preview: tautan ke ' + href + ' tidak dibuka.');
      return;
    }
    event.preventDefault();
    show('Preview: aksi "' + (target.getAttribute('data-bagdja-intent') || target.getAttribute('data-bagdja-action')) + '" dijalankan Bagdja di website sungguhan.');
  }, true);
  document.addEventListener('submit', function (event) {
    event.preventDefault();
    show('Preview: form tidak dikirim.');
  }, true);
  window.open = function () { show('Preview: jendela baru diblokir.'); return null; };
  window.addEventListener('error', function (event) {
    show('Galat JavaScript template: ' + (event.message || 'tidak diketahui'));
  });
})();`;

function escapeScript(source: string): string {
  return source.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
}

export function buildPreviewDocument(html: string, clientScript: string | null, runScripts: boolean): string {
  const scripts = runScripts
    ? `<script>${GUARD_SCRIPT}</script>`
    : '';
  const client = runScripts && clientScript ? `<script>${escapeScript(clientScript)}</script>` : '';
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`
    + `${scripts}</head><body style="margin:0">${html}${client}</body></html>`;
}
