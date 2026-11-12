import type { TemplateRuntimeIdentity } from './template-runtime-bridge';

interface TemplateRuntimeNavigationMessage extends TemplateRuntimeIdentity {
  protocol: 1;
  type: 'bagdja:template:navigate';
  href: string;
}

interface TemplateRuntimeResizeMessage extends TemplateRuntimeIdentity {
  protocol: 1;
  type: 'bagdja:template:resize';
  height: number;
}

const MAX_TEMPLATE_CLIENT_BUNDLE_BYTES = 512 * 1024;
const MAX_TEMPLATE_CLIENT_BUNDLE_BASE64_LENGTH = Math.ceil(MAX_TEMPLATE_CLIENT_BUNDLE_BYTES / 3) * 4;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return window.btoa(binary);
}

function escapeAttribute(value: string): string {
  return value.replace(/[&"'<>]/g, (character) => ({
    '&': '&amp;',
    '"': '&quot;',
    "'": '&#39;',
    '<': '&lt;',
    '>': '&gt;',
  })[character] ?? character);
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => ({
    '<': '\\u003c',
    '>': '\\u003e',
    '&': '\\u0026',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
  })[character] ?? character);
}

function createNavigationBootstrap({
  identity,
  parentOrigin,
  tenantPathPrefix,
  resizeToContent,
  clientBundleBase64,
}: {
  identity: TemplateRuntimeIdentity;
  parentOrigin: string;
  tenantPathPrefix: string;
  resizeToContent: boolean;
  clientBundleBase64: string | null;
}): string {
  return `(() => {
  const identity = ${scriptJson(identity)};
  const parentOrigin = ${scriptJson(parentOrigin)};
  const tenantPathPrefix = ${scriptJson(tenantPathPrefix)};
  const isTenantPath = (pathname) => {
    const pathPrefix = tenantPathPrefix === '/' ? '/' : tenantPathPrefix.replace(/\\/$/, '');
    return pathPrefix === '/' || pathname === pathPrefix || pathname.startsWith(pathPrefix + '/');
  };
  const isTenantAuthLink = (url) => {
    const key = url.pathname === '/auth/login'
      ? 'next'
      : url.pathname === '/auth/logout'
        ? 'returnTo'
        : null;
    if (!key || url.hash) return false;
    const params = Array.from(url.searchParams.entries());
    if (params.length > 1 || params.some(([name]) => name !== key)) return false;
    if (params.length === 0) return true;
    const returnPath = params[0][1];
    if (!returnPath.startsWith('/') || returnPath.startsWith('//')) return false;
    try {
      const returnUrl = new URL(returnPath, parentOrigin);
      return returnUrl.origin === parentOrigin && isTenantPath(returnUrl.pathname);
    } catch {
      return false;
    }
  };
  const pendingOrderActions = new Map();
  const newRequestId = () => {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (character) =>
      (Number(character) ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> Number(character) / 4).toString(16)
    );
  };
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (event.source !== parent || event.origin !== parentOrigin ||
        !message || message.protocol !== 1 ||
        message.type !== 'bagdja:template:order-action-result' ||
        message.slug !== identity.slug || message.version !== identity.version ||
        message.digest !== identity.digest || typeof message.requestId !== 'string') return;
    const pending = pendingOrderActions.get(message.requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    pendingOrderActions.delete(message.requestId);
    pending.button.disabled = false;
    const feedback = pending.button.closest('.sc-order-actions')?.querySelector('[data-bagdja-action-feedback]');
    if (feedback) {
      feedback.textContent = message.result?.ok === true
        ? 'Aksi berhasil diproses.'
        : (typeof message.result?.message === 'string' ? message.result.message : 'Aksi transaksi gagal diproses.');
    }
  });
  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element
      ? event.target.closest('button[data-bagdja-action]')
      : null;
    if (!button || button.disabled) return;
    const action = button.getAttribute('data-bagdja-action');
    if (!['order.retry_payment', 'order.cancel', 'order.complete', 'order.dispute'].includes(action)) return;
    event.preventDefault();
    button.disabled = true;
    const requestId = newRequestId();
    const timeout = setTimeout(() => {
      pendingOrderActions.delete(requestId);
      button.disabled = false;
      const feedback = button.closest('.sc-order-actions')?.querySelector('[data-bagdja-action-feedback]');
      if (feedback) feedback.textContent = 'Aksi transaksi belum mendapatkan respons. Coba lagi.';
    }, 30000);
    pendingOrderActions.set(requestId, { button, timeout });
    parent.postMessage({
      protocol: 1,
      type: 'bagdja:template:order-action',
      ...identity,
      requestId,
      action,
    }, parentOrigin);
  }, true);
  const pendingIntents = new Map();
  const showIntentMessage = (text) => {
    let toast = document.querySelector('[data-bagdja-intent-toast]');
    if (!toast) {
      toast = document.createElement('div');
      toast.setAttribute('data-bagdja-intent-toast', '');
      toast.setAttribute('role', 'alert');
      Object.assign(toast.style, {
        position: 'fixed', left: '50%', bottom: '20px', transform: 'translateX(-50%)', zIndex: '2147483647',
        maxWidth: 'min(92vw, 420px)', padding: '10px 14px', borderRadius: '10px', background: '#18181b',
        color: '#fff', font: '13px/1.4 system-ui, sans-serif', boxShadow: '0 8px 24px rgba(0,0,0,.25)',
      });
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toast.__bagdjaTimer);
    toast.__bagdjaTimer = setTimeout(() => { toast.hidden = true; }, 5000);
  };
  window.addEventListener('message', (event) => {
    const message = event.data;
    if (event.source !== parent || event.origin !== parentOrigin ||
        !message || message.protocol !== 1 ||
        message.type !== 'bagdja:template:intent-result' ||
        message.slug !== identity.slug || message.version !== identity.version ||
        message.digest !== identity.digest || typeof message.requestId !== 'string') return;
    const pending = pendingIntents.get(message.requestId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    pendingIntents.delete(message.requestId);
    pending.element.removeAttribute('aria-busy');
    if ('disabled' in pending.element) pending.element.disabled = false;
    if (message.result?.ok !== true) {
      showIntentMessage(typeof message.result?.message === 'string' ? message.result.message : 'Aksi belum dapat diproses.');
    }
  });
  document.addEventListener('click', (event) => {
    const element = event.target instanceof Element ? event.target.closest('[data-bagdja-intent]') : null;
    if (!element || element.disabled || element.getAttribute('aria-busy') === 'true') return;
    const action = element.getAttribute('data-bagdja-intent');
    if (!['cart.set_quantity', 'cart.remove', 'cart.checkout', 'invoice.pay', 'gathering.respond'].includes(action)) return;
    event.preventDefault();
    const intent = { action };
    const key = element.getAttribute('data-bagdja-key');
    if (key) intent.key = key;
    if (action === 'cart.set_quantity') intent.quantity = Number(element.getAttribute('data-bagdja-quantity'));
    if (action === 'gathering.respond' && element.getAttribute('data-bagdja-response')) {
      intent.response = element.getAttribute('data-bagdja-response');
    }
    if (action === 'cart.checkout') {
      intent.keys = Array.from(document.querySelectorAll('input[data-bagdja-selectable][data-bagdja-key]'))
        .filter((input) => input.checked && !input.disabled)
        .map((input) => input.getAttribute('data-bagdja-key'));
      if (intent.keys.length === 0) {
        showIntentMessage('Pilih minimal satu item untuk checkout.');
        return;
      }
    }
    element.setAttribute('aria-busy', 'true');
    if ('disabled' in element) element.disabled = true;
    const requestId = newRequestId();
    const timeout = setTimeout(() => {
      pendingIntents.delete(requestId);
      element.removeAttribute('aria-busy');
      if ('disabled' in element) element.disabled = false;
      showIntentMessage('Aksi belum mendapatkan respons. Coba lagi.');
    }, 30000);
    pendingIntents.set(requestId, { element, timeout });
    parent.postMessage({ protocol: 1, type: 'bagdja:template:intent', ...identity, requestId, intent }, parentOrigin);
  }, true);
  ${clientBundleBase64 === null ? '' : `document.addEventListener('DOMContentLoaded', () => {
    try {
      const binary = atob(${scriptJson(clientBundleBase64)});
      const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
      const bundleUrl = URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }));
      const clientScript = document.createElement('script');
      clientScript.src = bundleUrl;
      clientScript.onload = () => URL.revokeObjectURL(bundleUrl);
      clientScript.onerror = () => {
        URL.revokeObjectURL(bundleUrl);
        document.dispatchEvent(new CustomEvent('bagdja:template:script-error'));
      };
      document.body.appendChild(clientScript);
    } catch {
      document.dispatchEvent(new CustomEvent('bagdja:template:script-error'));
    }
  }, { once: true });`}
  ${resizeToContent ? `let lastHeight = 0;
  const reportHeight = () => {
    const height = Math.min(600, Math.max(56, Math.ceil(
      Math.max(
        document.body.scrollHeight,
        document.body.getBoundingClientRect().height,
        ...Array.from(document.querySelectorAll('.sc-account-dropdown'))
          .filter((element) =>
            element.closest('details')?.open && getComputedStyle(element).display !== 'none')
          .map((element) => element.getBoundingClientRect().bottom),
      ),
    )));
    if (height === lastHeight) return;
    lastHeight = height;
    parent.postMessage({
      protocol: 1,
      type: 'bagdja:template:resize',
      ...identity,
      height,
    }, parentOrigin);
  };
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(reportHeight).observe(document.documentElement);
  }
  new MutationObserver(reportHeight).observe(document.documentElement, {
    attributes: true,
    subtree: true,
    attributeFilter: ['open'],
  });
  document.addEventListener('toggle', reportHeight, true);
  window.addEventListener('load', reportHeight);
  requestAnimationFrame(reportHeight);` : ''}
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!target) return;
    event.preventDefault();
    if (target.hasAttribute('download') ||
        (target.target && target.target.toLowerCase() !== '_self')) return;
    let url;
    try {
      url = new URL(target.getAttribute('href'), document.baseURI);
    } catch {
      return;
    }
    if (
      url.protocol === 'https:' &&
      url.hostname === 'wa.me' &&
      url.port === '' &&
      url.username === '' &&
      url.password === '' &&
      /^\\/\\d{7,15}\\/?$/.test(url.pathname) &&
      url.search === '' &&
      url.hash === ''
    ) {
      const message = {
        protocol: 1,
        type: 'bagdja:template:navigate',
        ...identity,
        href: url.href,
      };
      parent.postMessage(message, parentOrigin);
      return;
    }
      if (
        url.origin !== parentOrigin ||
        (!isTenantPath(url.pathname) && !isTenantAuthLink(url))
    ) return;
    const message = {
      protocol: 1,
      type: 'bagdja:template:navigate',
      ...identity,
      href: url.href,
    };
    parent.postMessage(message, parentOrigin);
  }, true);
})();`;
}

const STORAGE_HOST_SUFFIXES = [
  '.supabase.co',
  '.supabase.in',
  '.r2.dev',
  '.r2.cloudflarestorage.com',
];

function isAllowedStorageUrl(value: string, parentOrigin: string): URL | null {
  try {
    const url = new URL(value, parentOrigin);
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      !STORAGE_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix))
    ) return null;
    return url;
  } catch {
    return null;
  }
}

function sanitizeTemplateHtml(html: string, parentOrigin: string): { html: string; resourceOrigins: string[] } {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
  parsed.querySelectorAll('script, meta, base, iframe, frame, object, embed, form, link[rel="import"]')
    .forEach((element) => element.remove());
  const resourceOrigins = new Set<string>();
  parsed.body.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') {
        element.removeAttribute(attribute.name);
      } else if (['src', 'poster', 'xlink:href'].includes(name)) {
        if (value.startsWith('data:') || value.startsWith('blob:')) {
          if (element.tagName.toLowerCase() !== 'img') element.removeAttribute(attribute.name);
          continue;
        }
        const resource = isAllowedStorageUrl(value, parentOrigin);
        if (!resource) {
          element.removeAttribute(attribute.name);
          continue;
        }
        resourceOrigins.add(resource.origin);
        element.setAttribute(attribute.name, resource.href);
      } else if (
        ['href', 'action'].includes(name) &&
        /^(?:javascript|vbscript|data):/i.test(value)
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  });
  return { html: parsed.body.innerHTML, resourceOrigins: [...resourceOrigins].sort() };
}

export async function createTemplateRuntimeSsrDocument({
  html,
  identity,
  parentOrigin,
  tenantPathPrefix,
  stylesheetUrls,
  clientBundle = null,
  clientBundleSha256 = null,
  resizeToContent = false,
}: {
  html: string;
  identity: TemplateRuntimeIdentity;
  parentOrigin: string;
  tenantPathPrefix: string;
  stylesheetUrls: readonly string[];
  clientBundle?: string | null;
  clientBundleSha256?: string | null;
  resizeToContent?: boolean;
}): Promise<string> {
  if (typeof html !== 'string') throw new TypeError('Template runtime HTML must be a string.');
  if (
    !/^[a-z0-9][a-z0-9-]{0,62}$/.test(identity.slug) ||
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(identity.version) ||
    !/^[a-f0-9]{64}$/.test(identity.digest)
  ) {
    throw new TypeError('Template runtime frame identity is invalid.');
  }
  const origin = new URL(parentOrigin);
  if (
    (origin.protocol !== 'https:' && origin.protocol !== 'http:') ||
    origin.origin !== parentOrigin
  ) {
    throw new TypeError('Template runtime frame parent origin must be an HTTP(S) origin.');
  }
  const prefix = new URL(tenantPathPrefix, origin.origin);
  if (
    !tenantPathPrefix.startsWith('/') ||
    tenantPathPrefix.startsWith('//') ||
    prefix.origin !== origin.origin ||
    prefix.pathname !== tenantPathPrefix ||
    prefix.search !== '' ||
    prefix.hash !== ''
  ) {
    throw new TypeError('Template runtime tenant path prefix is invalid.');
  }

  let clientBundleBytes: Uint8Array | null = null;
  if (clientBundle !== null) {
    if (
      typeof clientBundle !== 'string' ||
      clientBundle.length > MAX_TEMPLATE_CLIENT_BUNDLE_BASE64_LENGTH ||
      typeof clientBundleSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(clientBundleSha256) ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(clientBundle)
    ) {
      throw new TypeError('Template client bundle is invalid.');
    }
    const binary = window.atob(clientBundle);
    clientBundleBytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const bundleBuffer = new ArrayBuffer(clientBundleBytes.byteLength);
    new Uint8Array(bundleBuffer).set(clientBundleBytes);
    if (
      clientBundleBytes.length === 0 ||
      clientBundleBytes.length > MAX_TEMPLATE_CLIENT_BUNDLE_BYTES ||
      toBase64(clientBundleBytes) !== clientBundle ||
      toHex(new Uint8Array(await window.crypto.subtle.digest('SHA-256', bundleBuffer))) !== clientBundleSha256
    ) {
      throw new TypeError('Template client bundle integrity check failed.');
    }
  } else if (clientBundleSha256 !== null) {
    throw new TypeError('Template client bundle digest is invalid.');
  }

  const sanitized = sanitizeTemplateHtml(html, origin.origin);
  const bootstrap = createNavigationBootstrap({
    identity,
    parentOrigin: origin.origin,
    tenantPathPrefix: prefix.pathname,
    resizeToContent,
    clientBundleBase64: clientBundle,
  });
  const bootstrapBytes = new TextEncoder().encode(bootstrap);
  const bootstrapHash = toBase64(new Uint8Array(await window.crypto.subtle.digest(
    'SHA-256',
    new Uint8Array(bootstrapBytes).buffer,
  )));
  const stylesheets = stylesheetUrls.flatMap((stylesheetUrl) => {
    try {
      const stylesheet = new URL(stylesheetUrl, origin.origin);
      if (stylesheet.origin !== origin.origin || stylesheet.protocol !== origin.protocol) return [];
      return [`<link rel="stylesheet" href="${escapeAttribute(stylesheet.href)}">`];
    } catch {
      return [];
    }
  }).join('');
  const scriptSources = [`'sha256-${bootstrapHash}'`, ...(clientBundle === null ? [] : ['blob:'])];
  const policy = [
    "default-src 'none'",
    `script-src ${scriptSources.join(' ')}`,
    "connect-src 'none'",
    `img-src data: blob:${sanitized.resourceOrigins.length ? ` ${sanitized.resourceOrigins.join(' ')}` : ''}`,
    `style-src 'unsafe-inline' ${origin.origin}`,
    'font-src data:',
    `media-src data: blob:${sanitized.resourceOrigins.length ? ` ${sanitized.resourceOrigins.join(' ')}` : ''}`,
    "form-action 'none'",
    "navigate-to 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "child-src 'none'",
    "worker-src 'none'",
    "manifest-src 'none'",
  ].join('; ');

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${escapeAttribute(policy)}"><script>${bootstrap}</script>${stylesheets}</head><body>${sanitized.html}</body></html>`;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isTemplateRuntimeNavigationMessage(
  value: unknown,
  identity: TemplateRuntimeIdentity,
): value is TemplateRuntimeNavigationMessage {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const message = value as Partial<TemplateRuntimeNavigationMessage>;
  return message.protocol === 1 &&
    message.type === 'bagdja:template:navigate' &&
    message.slug === identity.slug &&
    message.version === identity.version &&
    message.digest === identity.digest &&
    typeof message.href === 'string' &&
    message.href.length > 0 &&
    message.href.length <= 2048;
}

export function isTemplateRuntimeResizeMessage(
  value: unknown,
  identity: TemplateRuntimeIdentity,
): value is TemplateRuntimeResizeMessage {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const message = value as Partial<TemplateRuntimeResizeMessage>;
  return message.protocol === 1 &&
    message.type === 'bagdja:template:resize' &&
    message.slug === identity.slug &&
    message.version === identity.version &&
    message.digest === identity.digest &&
    typeof message.height === 'number' &&
    Number.isInteger(message.height) &&
    message.height >= 56 &&
    message.height <= 600;
}
