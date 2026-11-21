/**
 * Render template LANGSUNG di halaman tenant, tanpa iframe (template-client-rendering-plan D7, §15).
 *
 * Kontrak template tidak berubah: `render(props)` + `client.js` apa adanya. Agar `client.js` (yang memasang
 * listener di `document` saat dimuat) tetap mendapat "dokumen segar" seperti di iframe:
 * - browser.js dimuat sekali per versi per dokumen (terisolasi, versi baru tidak memaksa reload); header, isi,
 *   dan navigasi bawah dirender ke root masing-masing;
 * - `client.js` dijalankan SEKALI per dokumen, setelah semua bagian pada muat halaman itu terpasang;
 * - perubahan DOM template setelah itu (navigasi SPA, refresh data) = muat ulang halaman penuh.
 */
import { loadTemplateBrowserBundle, type TemplateBrowserBundleRef } from './template-browser-bundle';

export interface InlineTemplate {
  render: (props: Record<string, unknown>) => string;
  clientSource: string | null;
}

/**
 * Kontrak opsional client.js untuk SPA (D8): dipasang sekali oleh client.js; Bagdja memanggil `mount(root)`
 * untuk shell & setiap isi baru di outlet, dan fungsi yang dikembalikan saat isi itu diganti/dilepas.
 */
export interface TemplateClientApi {
  mount: (root: HTMLElement) => (() => void) | void;
}

interface InlineTemplateWindow extends Window {
  BagdjaTemplateClient?: TemplateClientApi;
  /** Template yang sudah dimuat di dokumen ini, per SHA-256 browser.js (beberapa versi boleh berdampingan). */
  __bagdjaTemplates?: Record<string, InlineTemplate>;
  /** Objek global bayangan per SHA selama browser.js dijalankan (lihat `runIsolatedBundle`). */
  __bagdjaTemplateTargets?: Record<string, Record<string, unknown>>;
  /**
   * scheduled → loading (blob client.js sedang diunduh/dieksekusi) → ran | failed. `ran` baru diset SETELAH
   * client.js selesai dieksekusi: di HP lambat, eksekusi bundle besar bisa memakan waktu, dan menganggapnya
   * sudah jalan (tanpa mount) sebelum waktunya memicu reload berulang.
   */
  __bagdjaTemplateClientState?: 'scheduled' | 'loading' | 'ran' | 'failed';
  __bagdjaTemplateLinkGuard?: boolean;
  /** Tanda untuk client.js template: dirender langsung oleh Bagdja → daftarkan mount, jangan pasang ke dokumen. */
  __bagdjaTemplateHost?: 'inline';
}

const loading = new Map<string, Promise<InlineTemplate>>();
/** Root bagian template yang terpasang → cleanup dari `BagdjaTemplateClient.mount` (null = belum/ tidak ada). */
const mountedRoots = new Map<HTMLElement, (() => void) | null>();

function inlineWindow(): InlineTemplateWindow {
  return window as InlineTemplateWindow;
}

function runBlobScript(source: BlobPart): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    script.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Template gagal dimuat.'));
    };
    document.head.appendChild(script);
  });
}

function isInlineTemplate(value: unknown): value is InlineTemplate {
  return Boolean(value) && typeof (value as InlineTemplate).render === 'function';
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Jalankan browser.js dengan `globalThis`/`self` bayangan milik versi ini. browser.js mendefinisikan
 * `BagdjaTemplate` (non-writable) dan React UMD menulis `self.React`; tanpa isolasi, versi kedua di dokumen
 * yang sama gagal dan dulu memaksa reload — yang berulang terus bila sumber versi bergantian (cache) setelah
 * template baru dipublish. Dengan isolasi, versi lama & baru berdampingan dan halaman tidak perlu dimuat ulang.
 */
async function runIsolatedBundle(sha256: string, bytes: Uint8Array<ArrayBuffer>): Promise<InlineTemplate> {
  if (!SHA256_HEX.test(sha256)) throw new Error('SHA-256 browser.js tidak valid.');
  const win = inlineWindow();
  const target: Record<string, unknown> = {};
  win.__bagdjaTemplateTargets = { ...(win.__bagdjaTemplateTargets ?? {}), [sha256]: target };
  const slot = `window.__bagdjaTemplateTargets[${JSON.stringify(sha256)}]`;
  try {
    await runBlobScript(new Blob([
      `;(function (globalThis, self) {\n`,
      bytes,
      `\n}).call(${slot}, ${slot}, ${slot});\n`,
    ], { type: 'text/javascript' }));
  } finally {
    if (win.__bagdjaTemplateTargets) delete win.__bagdjaTemplateTargets[sha256];
  }
  const template = target.BagdjaTemplate;
  if (!isInlineTemplate(template)) throw new Error('browser.js tidak memuat BagdjaTemplate.render.');
  return template;
}

/**
 * browser.js (SHA-256 terverifikasi) → template, sekali per versi per dokumen. Versi berbeda (mis. template
 * baru dipublish saat halaman terbuka) dimuat berdampingan, tanpa reload.
 */
export function loadInlineTemplate(ref: TemplateBrowserBundleRef): Promise<InlineTemplate> {
  const win = inlineWindow();
  const loaded = win.__bagdjaTemplates?.[ref.sha256];
  if (loaded) return Promise.resolve(loaded);
  let pending = loading.get(ref.sha256);
  if (!pending) {
    pending = (async () => {
      const base64 = await loadTemplateBrowserBundle(ref);
      const bytes = Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
      const template = await runIsolatedBundle(ref.sha256, bytes);
      win.__bagdjaTemplates = { ...(win.__bagdjaTemplates ?? {}), [ref.sha256]: template };
      return template;
    })();
    loading.set(ref.sha256, pending);
    pending.catch(() => loading.delete(ref.sha256));
  }
  return pending;
}

const FRESH_DOCUMENT_RELOAD_KEY = 'bagdja:template-inline-reload-at';
const FRESH_DOCUMENT_RELOAD_COOLDOWN_MS = 15_000;

/**
 * Muat ulang dokumen agar client.js lama (tanpa mount) mendapat DOM segar — paling banyak sekali per 15 detik.
 * false = reload baru saja dilakukan (atau sessionStorage tak tersedia di sini): pemanggil melanjutkan tanpa
 * reload, sehingga tidak pernah terjadi loop muat ulang.
 */
export function reloadForFreshTemplateDocument(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(FRESH_DOCUMENT_RELOAD_KEY) || 0);
    if (Date.now() - last < FRESH_DOCUMENT_RELOAD_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(FRESH_DOCUMENT_RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** `client.js` sudah dijalankan di dokumen ini → DOM template baru butuh dokumen segar (muat ulang). */
export function templateClientScriptRan(): boolean {
  return inlineWindow().__bagdjaTemplateClientState === 'ran';
}

/** Template mendukung SPA (D8): client.js mendaftarkan `BagdjaTemplateClient.mount`. */
export function templateClientSupportsMount(): boolean {
  return typeof inlineWindow().BagdjaTemplateClient?.mount === 'function';
}

function mountRoot(root: HTMLElement): void {
  try {
    const cleanup = inlineWindow().BagdjaTemplateClient?.mount(root);
    mountedRoots.set(root, typeof cleanup === 'function' ? cleanup : null);
  } catch (error) {
    console.warn('[template-inline] client.js mount gagal.', error);
  }
}

/**
 * Daftarkan root bagian template. client.js yang mendukung `mount` dipanggil untuk root ini (sekarang, atau
 * setelah client.js selesai dimuat); fungsi yang dikembalikan melepas root (memanggil cleanup template).
 */
export function registerTemplateRoot(root: HTMLElement): () => void {
  mountedRoots.set(root, null);
  if (templateClientScriptRan() && templateClientSupportsMount()) mountRoot(root);
  return () => {
    const cleanup = mountedRoots.get(root);
    mountedRoots.delete(root);
    try {
      cleanup?.();
    } catch (error) {
      console.warn('[template-inline] client.js unmount gagal.', error);
    }
  };
}

/**
 * Jadwalkan `client.js` sekali per dokumen, setelah bagian lain pada muat halaman yang sama ikut terpasang
 * (semua menunggu promise browser.js yang sama, lalu satu tick).
 */
export function scheduleTemplateClientScript(template: InlineTemplate): void {
  const win = inlineWindow();
  if (win.__bagdjaTemplateClientState) return;
  win.__bagdjaTemplateClientState = 'scheduled';
  win.__bagdjaTemplateHost = 'inline';
  window.setTimeout(() => {
    if (typeof template.clientSource !== 'string' || !template.clientSource) {
      win.__bagdjaTemplateClientState = 'ran';
      return;
    }
    win.__bagdjaTemplateClientState = 'loading';
    void runBlobScript(template.clientSource)
      .then(() => {
        win.__bagdjaTemplateClientState = 'ran';
        // Template SPA: pasang client.js ke semua root yang sudah ada (shell + isi yang terdaftar selama memuat).
        if (templateClientSupportsMount()) Array.from(mountedRoots.keys()).forEach(mountRoot);
      })
      .catch(() => {
        win.__bagdjaTemplateClientState = 'failed';
        console.warn('[template-inline] client.js template gagal dijalankan.');
      });
  }, 0);
}

/**
 * `document` untuk bootstrap bridge yang dibatasi ke root bagian template: listener & pencarian elemen hanya
 * di root itu (bagian lain & halaman Bagdja tidak tersentuh); sisanya diteruskan ke dokumen asli.
 */
/** Event berasal dari dalam outlet milik root ini (isi halaman) → bukan urusan bootstrap shell. */
function fromNestedOutlet(root: HTMLElement, event: Event): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  const outlet = target.closest('[data-bagdja-outlet]');
  return Boolean(outlet && outlet !== root && root.contains(outlet));
}

function scopedDocument(root: HTMLElement): Document {
  const wrapped = new WeakMap<object, EventListener>();
  const wrap = (listener: unknown): EventListener | null => {
    if (typeof listener !== 'function') return null;
    let handler = wrapped.get(listener);
    if (!handler) {
      handler = (event: Event) => {
        if (!fromNestedOutlet(root, event)) (listener as EventListener).call(root, event);
      };
      wrapped.set(listener, handler);
    }
    return handler;
  };
  return new Proxy(document, {
    get(target, key) {
      if (key === 'addEventListener' || key === 'removeEventListener') {
        return (type: string, listener: unknown, options?: boolean | AddEventListenerOptions) => {
          const handler = wrap(listener);
          if (handler) root[key](type, handler, options);
        };
      }
      if (key === 'dispatchEvent' || key === 'querySelector' || key === 'querySelectorAll') {
        const method = root[key as 'addEventListener'] as unknown as (...args: unknown[]) => unknown;
        return method.bind(root);
      }
      const value = Reflect.get(target, key, target) as unknown;
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
}

/** Jalankan bootstrap bridge (createTemplateInlineBootstrap) untuk satu root bagian template. */
export function startInlineBootstrap(root: HTMLElement, bootstrapSource: string): void {
  // Kode bootstrap dibuat Bagdja sendiri (createTemplateInlineBootstrap), bukan kode template.
  new Function('document', bootstrapSource)(scopedDocument(root));
}

/**
 * Navigasi antarhalaman tenant = muat halaman penuh selama template dirender langsung, agar `client.js`
 * selalu mendapat dokumen segar (setara iframe). Tautan DI DALAM template ditangani bootstrap bridge.
 */
export function installTemplateDocumentNavigation(): void {
  const win = inlineWindow();
  if (win.__bagdjaTemplateLinkGuard) return;
  win.__bagdjaTemplateLinkGuard = true;
  document.addEventListener('click', (event) => {
    // Template SPA (D8): navigasi Next.js biasa — shell tetap, isi berganti di outlet.
    if (templateClientSupportsMount()) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!(anchor instanceof HTMLAnchorElement) || anchor.closest('[data-bagdja-template-root]')) return;
    if (anchor.target && anchor.target !== '_self') return;
    if (anchor.hasAttribute('download')) return;
    let url: URL;
    try {
      url = new URL(anchor.href, window.location.href);
    } catch {
      return;
    }
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
    event.preventDefault();
    window.location.assign(url.href);
  }, true);
}

/**
 * Tandai menu shell yang aktif tanpa merender ulang shell (D8). Isi halaman template mengumumkan kunci menunya
 * (`data-bagdja-active-nav`, mis. "page:katalog cart") → link `a[data-bagdja-nav]` dengan kunci itu. Tanpa
 * pengumuman (halaman Bagdja): link dengan path persis sama, selain itu awalan terpanjang (beranda — path
 * terpendek — hanya bila persis).
 */
export function markActiveShellNav(container: HTMLElement, pathname: string, activeKeys: readonly string[] = []): void {
  if (activeKeys.length > 0) {
    container.querySelectorAll<HTMLAnchorElement>('a[data-bagdja-nav]').forEach((link) => {
      if (activeKeys.includes(link.getAttribute('data-bagdja-nav') ?? '')) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    return;
  }
  const normalize = (path: string) => path.replace(/\/+$/, '') || '/';
  const current = normalize(pathname);
  const links = Array.from(container.querySelectorAll<HTMLAnchorElement>('a[data-bagdja-nav]')).map((link) => {
    try {
      return { link, path: normalize(new URL(link.href, window.location.href).pathname) };
    } catch {
      return { link, path: '' };
    }
  }).filter((item) => item.path);
  const homePath = links.reduce((shortest, item) => (shortest === null || item.path.length < shortest.length ? item.path : shortest), null as string | null);
  const exact = links.find((item) => item.path === current);
  const prefix = links
    .filter((item) => item.path !== homePath && current.startsWith(`${item.path}/`))
    .sort((left, right) => right.path.length - left.path.length)[0];
  const active = exact ?? prefix;
  links.forEach(({ link }) => {
    if (active && link === active.link) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

