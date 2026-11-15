/**
 * Render template LANGSUNG di halaman tenant, tanpa iframe (template-client-rendering-plan D7, §15).
 *
 * Kontrak template tidak berubah: `render(props)` + `client.js` apa adanya. Agar `client.js` (yang memasang
 * listener di `document` saat dimuat) tetap mendapat "dokumen segar" seperti di iframe:
 * - browser.js dimuat sekali per dokumen; header, isi, dan navigasi bawah dirender ke root masing-masing;
 * - `client.js` dijalankan SEKALI per dokumen, setelah semua bagian pada muat halaman itu terpasang;
 * - perubahan DOM template setelah itu (navigasi SPA, refresh data) = muat ulang halaman penuh.
 */
import { loadTemplateBrowserBundle, type TemplateBrowserBundleRef } from './template-browser-bundle';

export interface InlineTemplate {
  render: (props: Record<string, unknown>) => string;
  clientSource: string | null;
}

interface InlineTemplateWindow extends Window {
  BagdjaTemplate?: InlineTemplate;
  __bagdjaTemplateSha256?: string;
  __bagdjaTemplateClientState?: 'scheduled' | 'ran';
  __bagdjaTemplateLinkGuard?: boolean;
}

const loading = new Map<string, Promise<InlineTemplate>>();

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

/** browser.js (SHA-256 terverifikasi) → `window.BagdjaTemplate`, sekali per dokumen. */
export function loadInlineTemplate(ref: TemplateBrowserBundleRef): Promise<InlineTemplate> {
  const win = inlineWindow();
  if (win.__bagdjaTemplateSha256 === ref.sha256 && isInlineTemplate(win.BagdjaTemplate)) {
    return Promise.resolve(win.BagdjaTemplate);
  }
  let pending = loading.get(ref.sha256);
  if (!pending) {
    pending = (async () => {
      if (win.__bagdjaTemplateSha256 && win.__bagdjaTemplateSha256 !== ref.sha256) {
        // Versi template lain sudah dimuat di dokumen ini (global tidak bisa diganti) → dokumen baru.
        window.location.reload();
        throw new Error('Memuat ulang halaman untuk versi template terbaru.');
      }
      const base64 = await loadTemplateBrowserBundle(ref);
      const bytes = Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
      await runBlobScript(bytes);
      if (!isInlineTemplate(win.BagdjaTemplate)) throw new Error('browser.js tidak memuat BagdjaTemplate.render.');
      win.__bagdjaTemplateSha256 = ref.sha256;
      return win.BagdjaTemplate;
    })();
    loading.set(ref.sha256, pending);
    pending.catch(() => loading.delete(ref.sha256));
  }
  return pending;
}

/** `client.js` sudah dijalankan di dokumen ini → DOM template baru butuh dokumen segar (muat ulang). */
export function templateClientScriptRan(): boolean {
  return inlineWindow().__bagdjaTemplateClientState === 'ran';
}

/**
 * Jadwalkan `client.js` sekali per dokumen, setelah bagian lain pada muat halaman yang sama ikut terpasang
 * (semua menunggu promise browser.js yang sama, lalu satu tick).
 */
export function scheduleTemplateClientScript(template: InlineTemplate): void {
  const win = inlineWindow();
  if (win.__bagdjaTemplateClientState) return;
  win.__bagdjaTemplateClientState = 'scheduled';
  window.setTimeout(() => {
    win.__bagdjaTemplateClientState = 'ran';
    if (typeof template.clientSource === 'string' && template.clientSource) {
      void runBlobScript(template.clientSource).catch(() => {
        console.warn('[template-inline] client.js template gagal dijalankan.');
      });
    }
  }, 0);
}

/**
 * `document` untuk bootstrap bridge yang dibatasi ke root bagian template: listener & pencarian elemen hanya
 * di root itu (bagian lain & halaman Bagdja tidak tersentuh); sisanya diteruskan ke dokumen asli.
 */
function scopedDocument(root: HTMLElement): Document {
  return new Proxy(document, {
    get(target, key) {
      if (key === 'addEventListener' || key === 'removeEventListener' || key === 'dispatchEvent' ||
          key === 'querySelector' || key === 'querySelectorAll') {
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
