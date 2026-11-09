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

function createNavigationBootstrap({
  identity,
  parentOrigin,
  tenantPathPrefix,
  resizeToContent,
}: {
  identity: TemplateRuntimeIdentity;
  parentOrigin: string;
  tenantPathPrefix: string;
  resizeToContent: boolean;
}): string {
  return `(() => {
  const identity = ${JSON.stringify(identity)};
  const parentOrigin = ${JSON.stringify(parentOrigin)};
  const tenantPathPrefix = ${JSON.stringify(tenantPathPrefix)};
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

function sanitizeTemplateHtml(html: string): string {
  const parsed = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
  parsed.querySelectorAll('script, meta, base, iframe, frame, object, embed, form, link[rel="import"]')
    .forEach((element) => element.remove());
  return parsed.body.innerHTML;
}

export async function createTemplateRuntimeSsrDocument({
  html,
  identity,
  parentOrigin,
  tenantPathPrefix,
  stylesheetUrls,
  resizeToContent = false,
}: {
  html: string;
  identity: TemplateRuntimeIdentity;
  parentOrigin: string;
  tenantPathPrefix: string;
  stylesheetUrls: readonly string[];
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

  const bootstrap = createNavigationBootstrap({
    identity,
    parentOrigin: origin.origin,
    tenantPathPrefix: prefix.pathname,
    resizeToContent,
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
  const policy = [
    "default-src 'none'",
    `script-src 'sha256-${bootstrapHash}'`,
    "connect-src 'none'",
    "img-src data: blob: https://*.supabase.co https://*.supabase.in https://*.r2.dev https://*.r2.cloudflarestorage.com",
    `style-src 'unsafe-inline' ${origin.origin}`,
    `font-src data: ${origin.origin}`,
    "media-src data: blob: https://*.supabase.co https://*.supabase.in https://*.r2.dev https://*.r2.cloudflarestorage.com",
    "form-action 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "manifest-src 'none'",
  ].join('; ');

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${escapeAttribute(policy)}"><script>${bootstrap}</script>${stylesheets}</head><body>${sanitizeTemplateHtml(html)}</body></html>`;
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
