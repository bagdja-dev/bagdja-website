import type { CatalogItem } from './template-data';

export const TEMPLATE_RUNTIME_ACTION = 'bagdja:template:action';
export const TEMPLATE_RUNTIME_ACTION_RESULT = 'bagdja:template:action-result';
export const TEMPLATE_RUNTIME_ORDER_ACTION = 'bagdja:template:order-action';
export const TEMPLATE_RUNTIME_ORDER_ACTION_RESULT = 'bagdja:template:order-action-result';
export const TEMPLATE_RUNTIME_NAVIGATE = 'bagdja:template:navigate';
export const TEMPLATE_RUNTIME_BRIDGE_VERSION = 1;
export const TEMPLATE_RUNTIME_ORDER_ACTIONS = [
  'order.retry_payment',
  'order.cancel',
  'order.complete',
  'order.dispute',
] as const;

export interface TemplateRuntimeIdentity {
  slug: string;
  version: string;
  digest: string;
}

export interface AddToCartAction {
  type: 'cart.add';
  productId: string;
  quantity: number;
  locationId?: string;
}

export interface TemplateRuntimeActionMessage extends TemplateRuntimeIdentity {
  protocol: typeof TEMPLATE_RUNTIME_BRIDGE_VERSION;
  type: typeof TEMPLATE_RUNTIME_ACTION;
  requestId: string;
  action: AddToCartAction;
}

export type TemplateRuntimeOrderAction = typeof TEMPLATE_RUNTIME_ORDER_ACTIONS[number];

export interface TemplateRuntimeOrderActionMessage extends TemplateRuntimeIdentity {
  protocol: typeof TEMPLATE_RUNTIME_BRIDGE_VERSION;
  type: typeof TEMPLATE_RUNTIME_ORDER_ACTION;
  requestId: string;
  action: TemplateRuntimeOrderAction;
}

export interface TemplateRuntimeOrderActionResultMessage extends TemplateRuntimeIdentity {
  protocol: typeof TEMPLATE_RUNTIME_BRIDGE_VERSION;
  type: typeof TEMPLATE_RUNTIME_ORDER_ACTION_RESULT;
  requestId: string;
  result: { ok: true } | { ok: false; message: string };
}

export interface TemplateRuntimeActionResultMessage extends TemplateRuntimeIdentity {
  protocol: typeof TEMPLATE_RUNTIME_BRIDGE_VERSION;
  type: typeof TEMPLATE_RUNTIME_ACTION_RESULT;
  requestId: string;
  result:
    | { ok: true; orderId: string }
    | { ok: false; code: string; message: string };
}

export interface TemplateRuntimeNavigationMessage extends TemplateRuntimeIdentity {
  protocol: typeof TEMPLATE_RUNTIME_BRIDGE_VERSION;
  type: typeof TEMPLATE_RUNTIME_NAVIGATE;
  href: string;
}

export type TemplateRuntimeActionHandler = (action: AddToCartAction) => Promise<{ orderId: string }>;
export type TemplateRuntimeOrderActionHandler = (action: TemplateRuntimeOrderAction) => Promise<void>;

export class TemplateRuntimeActionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'TemplateRuntimeActionError';
  }
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isWithinTenantPath(pathname: string, tenantPathPrefix: string): boolean {
  const prefix = tenantPathPrefix === '/' ? '/' : tenantPathPrefix.replace(/\/$/, '');
  return prefix === '/' || pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isSafeAuthNavigation(targetUrl: URL, tenantPathPrefix: string): boolean {
  const returnParam = targetUrl.pathname === '/auth/login'
    ? 'next'
    : targetUrl.pathname === '/auth/logout'
      ? 'returnTo'
      : null;
  if (!returnParam || targetUrl.hash) return false;
  const params = [...targetUrl.searchParams.entries()];
  if (params.some(([key]) => key !== returnParam) || params.length > 1) return false;
  const returnPath = params[0]?.[1];
  if (returnPath === undefined) return true;
  if (
    !returnPath.startsWith('/') ||
    returnPath.startsWith('//') ||
    /[\u0000-\u001f\u007f]/.test(returnPath)
  ) return false;
  try {
    const url = new URL(returnPath, targetUrl.origin);
    return url.origin === targetUrl.origin &&
      url.username === '' &&
      url.password === '' &&
      isWithinTenantPath(url.pathname, tenantPathPrefix);
  } catch {
    return false;
  }
}

export function parseTemplateRuntimeActionMessage(value: unknown): TemplateRuntimeActionMessage | null {
  if (!isRecord(value) || value.protocol !== TEMPLATE_RUNTIME_BRIDGE_VERSION || value.type !== TEMPLATE_RUNTIME_ACTION) {
    return null;
  }
  if (
    typeof value.slug !== 'string' ||
    !SLUG_PATTERN.test(value.slug) ||
    typeof value.version !== 'string' ||
    !VERSION_PATTERN.test(value.version) ||
    typeof value.digest !== 'string' ||
    !DIGEST_PATTERN.test(value.digest) ||
    typeof value.requestId !== 'string' ||
    !REQUEST_ID_PATTERN.test(value.requestId) ||
    !isRecord(value.action) ||
    value.action.type !== 'cart.add' ||
    typeof value.action.productId !== 'string' ||
    !UUID_PATTERN.test(value.action.productId) ||
    !Number.isInteger(value.action.quantity) ||
    (value.action.quantity as number) < 1 ||
    (value.action.quantity as number) > 99 ||
    (value.action.locationId !== undefined &&
      (typeof value.action.locationId !== 'string' || !UUID_PATTERN.test(value.action.locationId)))
  ) {
    return null;
  }

  return {
    protocol: TEMPLATE_RUNTIME_BRIDGE_VERSION,
    type: TEMPLATE_RUNTIME_ACTION,
    slug: value.slug,
    version: value.version,
    digest: value.digest,
    requestId: value.requestId,
    action: {
      type: 'cart.add',
      productId: value.action.productId,
      quantity: value.action.quantity as number,
      ...(typeof value.action.locationId === 'string' ? { locationId: value.action.locationId } : {}),
    },
  };
}

export function parseTemplateRuntimeOrderActionMessage(value: unknown): TemplateRuntimeOrderActionMessage | null {
  if (
    !isRecord(value) ||
    value.protocol !== TEMPLATE_RUNTIME_BRIDGE_VERSION ||
    value.type !== TEMPLATE_RUNTIME_ORDER_ACTION ||
    typeof value.slug !== 'string' ||
    !SLUG_PATTERN.test(value.slug) ||
    typeof value.version !== 'string' ||
    !VERSION_PATTERN.test(value.version) ||
    typeof value.digest !== 'string' ||
    !DIGEST_PATTERN.test(value.digest) ||
    typeof value.requestId !== 'string' ||
    !REQUEST_ID_PATTERN.test(value.requestId) ||
    typeof value.action !== 'string' ||
    !(TEMPLATE_RUNTIME_ORDER_ACTIONS as readonly string[]).includes(value.action)
  ) {
    return null;
  }
  return {
    protocol: TEMPLATE_RUNTIME_BRIDGE_VERSION,
    type: TEMPLATE_RUNTIME_ORDER_ACTION,
    slug: value.slug,
    version: value.version,
    digest: value.digest,
    requestId: value.requestId,
    action: value.action as TemplateRuntimeOrderAction,
  };
}

export function parseTemplateRuntimeNavigationMessage(value: unknown): TemplateRuntimeNavigationMessage | null {
  if (
    !isRecord(value) ||
    value.protocol !== TEMPLATE_RUNTIME_BRIDGE_VERSION ||
    value.type !== TEMPLATE_RUNTIME_NAVIGATE ||
    typeof value.slug !== 'string' ||
    !SLUG_PATTERN.test(value.slug) ||
    typeof value.version !== 'string' ||
    !VERSION_PATTERN.test(value.version) ||
    typeof value.digest !== 'string' ||
    !DIGEST_PATTERN.test(value.digest) ||
    typeof value.href !== 'string' ||
    value.href.length === 0 ||
    value.href.length > 2048
  ) {
    return null;
  }
  return {
    protocol: TEMPLATE_RUNTIME_BRIDGE_VERSION,
    type: TEMPLATE_RUNTIME_NAVIGATE,
    slug: value.slug,
    version: value.version,
    digest: value.digest,
    href: value.href,
  };
}

export function getAllowedTemplateNavigationUrl(
  href: string,
  currentOrigin: string,
  tenantPathPrefix: string,
): URL | null {
  let currentUrl: URL;
  let targetUrl: URL;
  let prefixUrl: URL;
  try {
    currentUrl = new URL(currentOrigin);
    targetUrl = new URL(href);
    prefixUrl = new URL(tenantPathPrefix, currentUrl.origin);
  } catch {
    return null;
  }
  if (
    (currentUrl.protocol !== 'https:' && currentUrl.protocol !== 'http:') ||
    currentUrl.origin !== currentOrigin ||
    (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') ||
    targetUrl.username !== '' ||
    targetUrl.password !== '' ||
    href.length > 2048 ||
    !tenantPathPrefix.startsWith('/') ||
    tenantPathPrefix.startsWith('//') ||
    prefixUrl.origin !== currentUrl.origin ||
    prefixUrl.pathname !== tenantPathPrefix ||
    prefixUrl.search !== '' ||
    prefixUrl.hash !== ''
  ) {
    return null;
  }
  if (
    targetUrl.protocol === 'https:' &&
    targetUrl.hostname === 'wa.me' &&
    targetUrl.port === '' &&
    /^\/\d{7,15}\/?$/.test(targetUrl.pathname) &&
    targetUrl.search === '' &&
    targetUrl.hash === ''
  ) {
    return targetUrl;
  }
  if (targetUrl.origin !== currentUrl.origin) return null;
  if (isSafeAuthNavigation(targetUrl, tenantPathPrefix)) return targetUrl;
  const prefix = tenantPathPrefix === '/' ? '/' : tenantPathPrefix.replace(/\/$/, '');
  if (prefix !== '/' && targetUrl.pathname !== prefix && !targetUrl.pathname.startsWith(`${prefix}/`)) {
    return null;
  }
  return targetUrl;
}

export function createTemplateRuntimeActionBridge({
  frame,
  identity,
  onAction,
}: {
  frame: Pick<Window, 'postMessage'>;
  identity: TemplateRuntimeIdentity;
  onAction: TemplateRuntimeActionHandler;
}): (event: MessageEvent<unknown>) => Promise<void> {
  const seenRequests = new Set<string>();

  return async (event) => {
    if (event.source !== frame || event.origin !== 'null') return;

    const message = parseTemplateRuntimeActionMessage(event.data);
    if (
      !message ||
      message.slug !== identity.slug ||
      message.version !== identity.version ||
      message.digest !== identity.digest ||
      seenRequests.has(message.requestId)
    ) {
      return;
    }

    if (seenRequests.size >= 256) {
      frame.postMessage({
        protocol: TEMPLATE_RUNTIME_BRIDGE_VERSION,
        type: TEMPLATE_RUNTIME_ACTION_RESULT,
        ...identity,
        requestId: message.requestId,
        result: { ok: false, code: 'action_limit_reached', message: 'Batas aksi template untuk halaman ini tercapai.' },
      } satisfies TemplateRuntimeActionResultMessage, '*');
      return;
    }

    seenRequests.add(message.requestId);
    const response: TemplateRuntimeActionResultMessage = {
      protocol: TEMPLATE_RUNTIME_BRIDGE_VERSION,
      type: TEMPLATE_RUNTIME_ACTION_RESULT,
      slug: identity.slug,
      version: identity.version,
      digest: identity.digest,
      requestId: message.requestId,
      result: { ok: false, code: 'action_failed', message: 'Aksi template gagal diproses.' },
    };

    try {
      const result = await onAction(message.action);
      response.result = { ok: true, orderId: result.orderId };
    } catch (error) {
      response.result = error instanceof TemplateRuntimeActionError
        ? { ok: false, code: error.code, message: error.message }
        : { ok: false, code: 'action_failed', message: 'Aksi template gagal diproses.' };
    }
    frame.postMessage(response, '*');
  };
}

export function createTemplateRuntimeOrderActionBridge({
  frame,
  identity,
  allowedActions,
  onAction,
}: {
  frame: Pick<Window, 'postMessage'>;
  identity: TemplateRuntimeIdentity;
  allowedActions: readonly TemplateRuntimeOrderAction[];
  onAction: TemplateRuntimeOrderActionHandler;
}): (event: MessageEvent<unknown>) => Promise<void> {
  const allowed = new Set(allowedActions);
  const seenRequests = new Set<string>();

  return async (event) => {
    if (event.source !== frame || event.origin !== 'null') return;
    const message = parseTemplateRuntimeOrderActionMessage(event.data);
    if (
      !message ||
      message.slug !== identity.slug ||
      message.version !== identity.version ||
      message.digest !== identity.digest ||
      !allowed.has(message.action) ||
      seenRequests.has(message.requestId)
    ) return;

    if (seenRequests.size >= 256) {
      frame.postMessage({
        protocol: TEMPLATE_RUNTIME_BRIDGE_VERSION,
        type: TEMPLATE_RUNTIME_ORDER_ACTION_RESULT,
        ...identity,
        requestId: message.requestId,
        result: { ok: false, message: 'Batas aksi template untuk halaman ini tercapai.' },
      } satisfies TemplateRuntimeOrderActionResultMessage, '*');
      return;
    }

    seenRequests.add(message.requestId);
    const response: TemplateRuntimeOrderActionResultMessage = {
      protocol: TEMPLATE_RUNTIME_BRIDGE_VERSION,
      type: TEMPLATE_RUNTIME_ORDER_ACTION_RESULT,
      ...identity,
      requestId: message.requestId,
      result: { ok: false, message: 'Aksi transaksi gagal diproses.' },
    };
    try {
      await onAction(message.action);
      response.result = { ok: true };
    } catch (error) {
      response.result = {
        ok: false,
        message: error instanceof TemplateRuntimeActionError
          ? error.message
          : 'Aksi transaksi gagal diproses.',
      };
    }
    frame.postMessage(response, '*');
  };
}

export function createCartAddActionHandler({
  websiteId,
  products,
  fetchImpl = fetch,
  onAdded,
}: {
  websiteId: string;
  products: readonly CatalogItem[];
  fetchImpl?: typeof fetch;
  onAdded?: (orderId: string) => void;
}): TemplateRuntimeActionHandler {
  return async (action) => {
    const product = products.find((candidate) => candidate.id === action.productId);
    if (
      !product ||
      (product.websiteId !== undefined && product.websiteId !== websiteId) ||
      product.type === 'gathering' ||
      product.quotable === true ||
      (typeof product.price === 'number' && product.price <= 0) ||
      (typeof product.stock === 'number' && (product.stock <= 0 || action.quantity > product.stock)) ||
      (action.locationId !== undefined &&
        Array.isArray(product.locationIds) &&
        product.locationIds.length > 0 &&
        !product.locationIds.includes(action.locationId))
    ) {
      throw new Error('Product is not available for cart actions.');
    }

    const response = await fetchImpl('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        website_id: websiteId,
        product_id: product.id,
        quantity: product.type === 'digital' ? 1 : action.quantity,
        ...(action.locationId ? { location_id: action.locationId } : {}),
      }),
    });
    if (response.status === 401) {
      throw new TemplateRuntimeActionError('authentication_required', 'Login diperlukan untuk menambahkan produk ke keranjang.');
    }
    if (!response.ok) {
      throw new TemplateRuntimeActionError('cart_add_failed', 'Produk gagal ditambahkan ke keranjang.');
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new TemplateRuntimeActionError('invalid_cart_response', 'Respons keranjang tidak valid.');
    }
    if (!isRecord(result) || typeof result.id !== 'string' || result.id.length === 0) {
      throw new TemplateRuntimeActionError('invalid_cart_response', 'Respons keranjang tidak valid.');
    }

    onAdded?.(result.id);
    return { orderId: result.id };
  };
}
