/**
 * Sandbox section HTML Kustom.
 *
 * HTML (termasuk JS) milik tenant TIDAK pernah dirender satu origin dengan halaman
 * website. Section dirender di iframe yang memuat dokumen bootstrap
 * (`app/api/sandbox/custom-html/route.ts`) dengan:
 *  - CSP `sandbox` (origin opaque → tanpa cookie/storage/DOM induk), dan
 *  - `connect-src 'none'`, `form-action 'none'`, aset hanya dari CDN kita
 *    → JS boleh menjalankan UI, tapi tidak bisa mengirim data keluar.
 *
 * Alur pesan (lihat components/templates/shared/custom-html-section.tsx):
 *   iframe → induk : { type: READY }                (diulang sampai dirender)
 *   induk  → iframe: { type: RENDER, html, baseUrl } (hanya dari window.parent)
 *   iframe → induk : { type: HEIGHT, height }       (ResizeObserver)
 */

export const CUSTOM_HTML_MESSAGE = {
  ready: 'bagdja:custom-html:ready',
  render: 'bagdja:custom-html:render',
  height: 'bagdja:custom-html:height',
} as const;

export const CUSTOM_HTML_SANDBOX_PATH = '/api/sandbox/custom-html';

/** Batas tinggi iframe supaya script tenant tidak bisa memanjangkan halaman tanpa batas. */
export const CUSTOM_HTML_MAX_HEIGHT = 20000;

/** Atribut `sandbox` iframe; CSP `sandbox` di respons bootstrap memakai nilai yang sama. */
export const CUSTOM_HTML_SANDBOX_FLAGS = [
  'allow-scripts',
  'allow-forms',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
  'allow-top-navigation-by-user-activation',
].join(' ');

/** Origin aset yang boleh dimuat (gambar/font/media) — CDN storage-service, R2, Supabase lama. */
export const DEFAULT_CUSTOM_HTML_ASSET_ORIGINS = [
  'https://cdn.bagdja.com',
  'https://*.r2.dev',
  'https://*.supabase.co',
];

const ASSET_ORIGIN_PATTERN = /^https:\/\/(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d{1,5})?$/i;

/** Parse `CUSTOM_HTML_ASSET_ORIGINS` (dipisah koma/spasi); entri tidak valid dibuang supaya header tidak bisa disisipi. */
export function parseAssetOrigins(value: string | undefined): string[] {
  const origins = (value ?? '')
    .split(/[\s,]+/)
    .map((entry) => entry.trim().replace(/\/+$/, ''))
    .filter((entry) => ASSET_ORIGIN_PATTERN.test(entry));
  return origins.length > 0 ? Array.from(new Set(origins)) : DEFAULT_CUSTOM_HTML_ASSET_ORIGINS;
}

export function buildCustomHtmlSandboxCsp(assetOrigins: string[]): string {
  const assets = assetOrigins.join(' ');
  return [
    `sandbox ${CUSTOM_HTML_SANDBOX_FLAGS}`,
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    `img-src data: blob: ${assets}`,
    `font-src data: ${assets}`,
    `media-src ${assets}`,
    "connect-src 'none'",
    "form-action 'none'",
    "frame-src 'none'",
    "child-src 'none'",
    "worker-src 'none'",
    "manifest-src 'none'",
    "base-uri 'none'",
    // Tenant bisa memakai custom domain apa pun; dokumen ini kosong & origin-nya opaque.
    'frame-ancestors *',
  ].join('; ');
}

/**
 * URL dokumen sandbox. `NEXT_PUBLIC_CUSTOM_HTML_SANDBOX_URL` (mis.
 * `https://usercontent.bagdja.com/api/sandbox/custom-html`) memisahkan origin
 * sepenuhnya; kosong → path relatif di host yang sama (tetap terisolasi oleh CSP sandbox).
 */
export function getCustomHtmlSandboxUrl(): string {
  const configured = process.env.NEXT_PUBLIC_CUSTOM_HTML_SANDBOX_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString();
    } catch {
      // fall through to the same-host path
    }
  }
  return CUSTOM_HTML_SANDBOX_PATH;
}

/**
 * Dokumen bootstrap. Script ini satu-satunya kode kita di dalam sandbox:
 * menerima HTML dari induk, menulisnya dengan document.write (script tenant
 * ikut jalan berurutan), lalu melaporkan tinggi dan mengarahkan link ke `_top`.
 */
export const CUSTOM_HTML_SANDBOX_DOCUMENT = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"></head>
<body><script>
(function () {
  var parentWindow = window.parent;
  if (!parentWindow || parentWindow === window) return;
  var MSG = ${JSON.stringify(CUSTOM_HTML_MESSAGE)};
  var MAX_HEIGHT = ${CUSTOM_HTML_MAX_HEIGHT};
  var rendered = false;
  var readyTimer = null;
  var readyCount = 0;

  function post(message) {
    try { parentWindow.postMessage(message, '*'); } catch (error) {}
  }

  function announceReady() {
    if (rendered) return;
    post({ type: MSG.ready });
    readyCount += 1;
    if (readyCount < 40) readyTimer = setTimeout(announceReady, 250);
  }

  function startHeightReporter() {
    var last = -1;
    var growth = 0;
    var windowStart = Date.now();
    function report() {
      var root = document.documentElement;
      if (!root) return;
      var height = Math.min(MAX_HEIGHT, Math.ceil(root.getBoundingClientRect().height));
      if (height === last) return;
      var now = Date.now();
      if (now - windowStart > 2000) { windowStart = now; growth = 0; }
      if (height > last) growth += 1;
      // Konten 100vh membuat tinggi terus naik mengikuti iframe — hentikan loop.
      if (growth > 20) return;
      last = height;
      post({ type: MSG.height, height: height });
    }
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(report).observe(document.documentElement);
    }
    window.addEventListener('load', report);
    report();
  }

  function routeLinks(baseUrl) {
    window.addEventListener('click', function (event) {
      var target = event.target;
      var anchor = target && target.closest ? target.closest('a[href]') : null;
      if (!anchor || event.defaultPrevented) return;
      var raw = anchor.getAttribute('href') || '';
      if (raw.charAt(0) === '#') return;
      var resolved;
      try { resolved = new URL(raw, baseUrl); } catch (error) { event.preventDefault(); return; }
      if (['http:', 'https:', 'mailto:', 'tel:'].indexOf(resolved.protocol) === -1) {
        event.preventDefault();
        return;
      }
      anchor.setAttribute('href', resolved.href);
      var targetName = (anchor.getAttribute('target') || '').toLowerCase();
      if (targetName !== '_blank') anchor.setAttribute('target', '_top');
      if (targetName === '_blank') anchor.setAttribute('rel', 'noopener noreferrer');
    }, true);
  }

  function copyAttributes(from, to) {
    for (var index = 0; index < from.attributes.length; index += 1) {
      var attribute = from.attributes[index];
      try { to.setAttribute(attribute.name, attribute.value); } catch (error) {}
    }
  }

  // document.open/write tidak andal di dokumen sandbox (origin opaque) — sisipkan lewat DOM,
  // lalu buat ulang tiap <script> (hasil parse tidak dieksekusi) supaya jalan berurutan.
  function render(html) {
    var parsed = new DOMParser().parseFromString(html, 'text/html');
    var reset = document.createElement('style');
    reset.textContent = 'html,body{margin:0}';
    document.head.appendChild(reset);
    copyAttributes(parsed.documentElement, document.documentElement);
    copyAttributes(parsed.body, document.body);
    document.body.textContent = '';
    var parsedHead = Array.prototype.slice.call(parsed.head.childNodes);
    var parsedBody = Array.prototype.slice.call(parsed.body.childNodes);
    parsedHead.forEach(function (node) { document.head.appendChild(document.importNode(node, true)); });
    parsedBody.forEach(function (node) { document.body.appendChild(document.importNode(node, true)); });
    var scripts = Array.prototype.slice.call(document.querySelectorAll('script'));
    scripts.forEach(function (stale) {
      var fresh = document.createElement('script');
      copyAttributes(stale, fresh);
      fresh.textContent = stale.textContent;
      stale.parentNode.replaceChild(fresh, stale);
    });
    // Kode AI sering menunggu DOMContentLoaded/load; event aslinya sudah lewat.
    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    window.dispatchEvent(new Event('load'));
  }

  window.addEventListener('message', function (event) {
    if (rendered || event.source !== parentWindow) return;
    var data = event.data;
    if (!data || data.type !== MSG.render || typeof data.html !== 'string') return;
    rendered = true;
    if (readyTimer) clearTimeout(readyTimer);
    var baseUrl = typeof data.baseUrl === 'string' ? data.baseUrl : 'about:blank';
    routeLinks(baseUrl);
    try { render(data.html); } finally { startHeightReporter(); }
  });

  announceReady();
})();
</script></body></html>`;
