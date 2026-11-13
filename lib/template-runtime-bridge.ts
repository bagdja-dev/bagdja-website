import type { CatalogItem } from './template-data';

export const TEMPLATE_RUNTIME_ACTION = 'bagdja:template:action';
export const TEMPLATE_RUNTIME_ACTION_RESULT = 'bagdja:template:action-result';
export const TEMPLATE_RUNTIME_ORDER_ACTION = 'bagdja:template:order-action';
export const TEMPLATE_RUNTIME_ORDER_ACTION_RESULT = 'bagdja:template:order-action-result';
export const TEMPLATE_RUNTIME_NAVIGATE = 'bagdja:template:navigate';
/** Bagikan / salin tautan tenant (mis. undangan) — dijalankan host karena iframe sandbox tak punya izin clipboard/share. */
export const TEMPLATE_RUNTIME_SHARE = 'bagdja:template:share';
export const TEMPLATE_RUNTIME_SHARE_RESULT = 'bagdja:template:share-result';
/** Muat ulang data halaman (refresh lembut host) — mis. tombol "Muat ulang" daftar reservasi/pembayaran. */
export const TEMPLATE_RUNTIME_REFRESH = 'bagdja:template:refresh';
export const TEMPLATE_RUNTIME_REFRESH_RESULT = 'bagdja:template:refresh-result';
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

/** Tautan Google Maps lokasi gathering (gathering-option-location-plan L1) — dibuka host di tab baru. */
export const GOOGLE_MAPS_NAVIGATION_URL = /^https:\/\/(?:maps\.app\.goo\.gl\/|goo\.gl\/maps\/|maps\.google\.[a-z]{2,3}(?:\.[a-z]{2})?\/|(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?\/maps(?:\/|\?|$))[^\s<>"']*$/i;

export function isGoogleMapsNavigationUrl(url: URL): boolean {
  return url.protocol === 'https:' && url.port === '' && url.username === '' && url.password === '' &&
    url.href.length <= 1000 && GOOGLE_MAPS_NAVIGATION_URL.test(url.href);
}

export type TemplateRuntimeShareMode = 'share' | 'copy';
export type TemplateRuntimeShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export interface TemplateRuntimeShareMessage extends TemplateRuntimeIdentity {
  protocol: typeof TEMPLATE_RUNTIME_BRIDGE_VERSION;
  type: typeof TEMPLATE_RUNTIME_SHARE;
  requestId: string;
  mode: TemplateRuntimeShareMode;
  href: string;
  title?: string;
}

export function parseTemplateRuntimeShareMessage(value: unknown, identity: TemplateRuntimeIdentity): TemplateRuntimeShareMessage | null {
  if (
    !isRecord(value) ||
    value.protocol !== TEMPLATE_RUNTIME_BRIDGE_VERSION ||
    value.type !== TEMPLATE_RUNTIME_SHARE ||
    value.slug !== identity.slug ||
    value.version !== identity.version ||
    value.digest !== identity.digest ||
    typeof value.requestId !== 'string' ||
    !REQUEST_ID_PATTERN.test(value.requestId) ||
    (value.mode !== 'share' && value.mode !== 'copy') ||
    typeof value.href !== 'string' ||
    value.href.length > 2048
  ) {
    return null;
  }
  const title = typeof value.title === 'string' ? value.title.trim().slice(0, 120) : '';
  return {
    protocol: TEMPLATE_RUNTIME_BRIDGE_VERSION,
    type: TEMPLATE_RUNTIME_SHARE,
    slug: identity.slug,
    version: identity.version,
    digest: identity.digest,
    requestId: value.requestId,
    mode: value.mode,
    href: value.href,
    ...(title ? { title } : {}),
  };
}

export interface TemplateRuntimeRefreshMessage extends TemplateRuntimeIdentity {
  protocol: typeof TEMPLATE_RUNTIME_BRIDGE_VERSION;
  type: typeof TEMPLATE_RUNTIME_REFRESH;
  requestId: string;
}

export function parseTemplateRuntimeRefreshMessage(value: unknown, identity: TemplateRuntimeIdentity): TemplateRuntimeRefreshMessage | null {
  if (
    !isRecord(value) ||
    value.protocol !== TEMPLATE_RUNTIME_BRIDGE_VERSION ||
    value.type !== TEMPLATE_RUNTIME_REFRESH ||
    value.slug !== identity.slug ||
    value.version !== identity.version ||
    value.digest !== identity.digest ||
    typeof value.requestId !== 'string' ||
    !REQUEST_ID_PATTERN.test(value.requestId)
  ) {
    return null;
  }
  return {
    protocol: TEMPLATE_RUNTIME_BRIDGE_VERSION,
    type: TEMPLATE_RUNTIME_REFRESH,
    slug: identity.slug,
    version: identity.version,
    digest: identity.digest,
    requestId: value.requestId,
  };
}

/** Hanya tautan halaman tenant di origin yang sama (bukan Google Maps/WhatsApp/situs lain). */
export function getAllowedTemplateShareUrl(href: string, currentOrigin: string, tenantPathPrefix: string): URL | null {
  const url = getAllowedTemplateNavigationUrl(href, currentOrigin, tenantPathPrefix);
  return url && url.origin === currentOrigin ? url : null;
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
  if (isGoogleMapsNavigationUrl(targetUrl)) return targetUrl;
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

// ── Intent halaman sistem (plan/website-builder/template-owned-system-pages-plan.md §4.3) ──

export const TEMPLATE_RUNTIME_INTENT = 'bagdja:template:intent';
export const TEMPLATE_RUNTIME_INTENT_RESULT = 'bagdja:template:intent-result';
export const TEMPLATE_RUNTIME_INTENTS = [
  'cart.set_quantity',
  'cart.remove',
  'cart.checkout',
  'transaction.chat.open',
  'invoice.pay',
  'gathering.respond',
  'gathering.chat.open',
  'gathering.plan.save',
  'gathering.invitation.add',
  'gathering.invitation.revoke',
  'gathering.invitation.content.save',
  'gathering.invitations.submit',
  'gathering.registrations.reject',
  'gathering.reservations.confirm',
  'gathering.registrations.checkout',
  'gathering.registration.cancel_checkout',
  'gathering.registration.refund',
  'gathering.invoices.resend',
  'gathering.event.confirm',
  'gathering.cancel',
  'gathering.plan.create',
  'product.chat.open',
  'gathering.invitation.rsvp',
  'gathering.invitation.verify_otp',
  'gathering.invitation.resend_otp',
  'gathering.invitation.pay',
] as const;

export type TemplateRuntimeIntentAction = typeof TEMPLATE_RUNTIME_INTENTS[number];

export interface TemplateRuntimeIntent {
  action: TemplateRuntimeIntentAction;
  /** `key` opaque dari props.page — bukan ID internal. */
  key?: string;
  /** cart.checkout: item terpilih. */
  keys?: string[];
  /** gathering.invitation.rsvp — kontak (email) hanya untuk undangan terbuka. */
  rsvp?: { attendeeName?: string; contact?: string; whatsapp?: string; optionKeys?: string[] };
  /** gathering.invitation.verify_otp — kode 6 digit. */
  code?: string;
  /** cart.set_quantity: jumlah tujuan. */
  quantity?: number;
  /** gathering.respond. */
  response?: 'ACCEPTED' | 'DECLINED';
  /** Pengelolaan rencana: item (undangan/registrasi) di dalam rencana `key`. */
  target?: string;
  /** gathering.plan.save: submit ke tahap berikutnya. */
  submit?: boolean;
  /** gathering.plan.save / gathering.event.confirm. */
  plan?: {
    title?: string;
    invitePolicy?: 'OPEN' | 'INVITE_ONLY';
    optionKeys?: string[];
    rsvpCloseAt?: string;
    paymentDueAt?: string;
    scheduledAt?: string;
  };
  /** gathering.invitation.add — kontak hanya input ke host. */
  invitee?: { name?: string; email?: string; whatsapp?: string };
  /**
   * gathering.invitation.content.save — deskripsi undangan (string kosong = hapus) dan
   * `removeBanner` untuk menghapus banner yang ada.
   */
  invitationContent?: { description: string; removeBanner?: boolean };
  /** gathering.invitation.content.save — file banner baru (gambar ≤ 5 MB) dari input file template. */
  bannerFile?: Blob;
  /** gathering.registrations.reject. */
  message?: string;
  /** gathering.cancel. */
  reason?: string;
  /**
   * Pengguna sudah mengonfirmasi lewat popup template (klik asli pada elemen
   * `data-bagdja-confirmed="true"`, divalidasi bootstrap). Host lalu tidak memakai window.confirm.
   */
  confirmed?: true;
}

/** Aksi berisiko yang dikonfirmasi host (bukan template) sebelum dijalankan. */
export const TEMPLATE_RUNTIME_INTENT_CONFIRMATIONS: Partial<Record<TemplateRuntimeIntentAction, string>> = {
  'cart.remove': 'Hapus item ini dari keranjang?',
  'gathering.invitation.revoke': 'Cabut undangan ini? Tautan undangan tidak dapat dipakai lagi.',
  'gathering.invitations.submit': 'Kirim undangan sekarang? Rencana lanjut ke tahap Konfirmasi undangan.',
  'gathering.registrations.reject': 'Tolak peserta terpilih? Peserta akan menerima alasan penolakan.',
  'gathering.reservations.confirm': 'Tutup RSVP dan buka pembayaran? Peserta baru tidak dapat mendaftar lagi.',
  'gathering.registration.cancel_checkout': 'Batalkan checkout peserta ini?',
  'gathering.registration.refund': 'Refund kursi peserta ini? Dana dikembalikan ke dompet pembayar.',
  'gathering.event.confirm': 'Konfirmasi acara dengan opsi final terpilih? DP dicairkan ke penyelenggara.',
  'gathering.cancel': 'Batalkan acara ini? Proses refund dijalankan sesuai kebijakan.',
};

export interface TemplateRuntimeIntentMessage extends TemplateRuntimeIdentity {
  protocol: typeof TEMPLATE_RUNTIME_BRIDGE_VERSION;
  type: typeof TEMPLATE_RUNTIME_INTENT;
  requestId: string;
  intent: TemplateRuntimeIntent;
}

export interface TemplateRuntimeIntentResultMessage extends TemplateRuntimeIdentity {
  protocol: typeof TEMPLATE_RUNTIME_BRIDGE_VERSION;
  type: typeof TEMPLATE_RUNTIME_INTENT_RESULT;
  requestId: string;
  result: { ok: true } | { ok: false; message: string };
}

export type TemplateRuntimeIntentHandler = (intent: TemplateRuntimeIntent) => Promise<void>;

const OPAQUE_KEY_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHATSAPP_PATTERN = /^\+?[0-9][0-9 -]{6,18}$/;
/** Batas banner undangan — sama dengan GatheringInvitationAppearance & endpoint invitation-banner. */
export const INVITATION_BANNER_MAX_BYTES = 5 * 1024 * 1024;
/** HTML ringan dari editor (tag ikut dihitung) — sama dengan DTO API. */
export const INVITATION_DESCRIPTION_MAX_LENGTH = 5000;
const PLAN_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2}))?$/;

/** string ber-trim ≤ max; '' bila kosong/absen; null bila tipe/panjang salah. */
function boundedText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > max ? null : trimmed;
}

function parseKeyList(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  if (!value.every((item) => typeof item === 'string' && OPAQUE_KEY_PATTERN.test(item))) return null;
  return [...new Set(value as string[])];
}

function parsePlanForm(value: unknown, optionsOnly: boolean): NonNullable<TemplateRuntimeIntent['plan']> | null {
  if (!isRecord(value)) return null;
  const plan: NonNullable<TemplateRuntimeIntent['plan']> = {};
  if (value.optionKeys !== undefined) {
    const optionKeys = parseKeyList(value.optionKeys, 100);
    if (!optionKeys) return null;
    plan.optionKeys = optionKeys;
  }
  if (optionsOnly) return plan.optionKeys ? { optionKeys: plan.optionKeys } : null;
  const title = boundedText(value.title, 255);
  if (title === null) return null;
  if (title) plan.title = title;
  if (value.invitePolicy !== undefined) {
    if (value.invitePolicy !== 'OPEN' && value.invitePolicy !== 'INVITE_ONLY') return null;
    plan.invitePolicy = value.invitePolicy;
  }
  for (const field of ['rsvpCloseAt', 'paymentDueAt', 'scheduledAt'] as const) {
    const date = boundedText(value[field], 40);
    if (date === null || (date && !PLAN_DATE_PATTERN.test(date))) return null;
    if (date) plan[field] = date;
  }
  return plan;
}

export function parseTemplateRuntimeIntent(value: unknown): TemplateRuntimeIntent | null {
  const intent = parseTemplateRuntimeIntentFields(value);
  if (!intent || !isRecord(value) || value.confirmed !== true) return intent;
  // `confirmed` hanya berarti untuk aksi yang memang dikonfirmasi host.
  return TEMPLATE_RUNTIME_INTENT_CONFIRMATIONS[intent.action] ? { ...intent, confirmed: true } : intent;
}

function parseTemplateRuntimeIntentFields(value: unknown): TemplateRuntimeIntent | null {
  if (!isRecord(value) || typeof value.action !== 'string') return null;
  const action = value.action as TemplateRuntimeIntentAction;
  if (!(TEMPLATE_RUNTIME_INTENTS as readonly string[]).includes(action)) return null;
  const key = typeof value.key === 'string' && OPAQUE_KEY_PATTERN.test(value.key) ? value.key : undefined;
  switch (action) {
    case 'cart.set_quantity': {
      const quantity = value.quantity;
      if (!key || typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) return null;
      return { action, key, quantity };
    }
    case 'cart.checkout': {
      if (!Array.isArray(value.keys) || value.keys.length === 0 || value.keys.length > 100) return null;
      if (!value.keys.every((item) => typeof item === 'string' && OPAQUE_KEY_PATTERN.test(item))) return null;
      return { action, keys: [...new Set(value.keys as string[])] };
    }
    case 'gathering.respond': {
      if (!key) return null;
      const response = value.response === 'ACCEPTED' || value.response === 'DECLINED' ? value.response : undefined;
      return response ? { action, key, response } : { action, key };
    }
    case 'gathering.plan.save':
    case 'gathering.event.confirm': {
      if (!key) return null;
      const plan = parsePlanForm(value.plan, action === 'gathering.event.confirm');
      if (!plan) return null;
      return action === 'gathering.plan.save' && value.submit === true
        ? { action, key, plan, submit: true }
        : { action, key, plan };
    }
    case 'gathering.invitation.add': {
      if (!key || !isRecord(value.invitee)) return null;
      const name = boundedText(value.invitee.name, 120);
      const email = boundedText(value.invitee.email, 254);
      const whatsapp = boundedText(value.invitee.whatsapp, 20);
      if (name === null || email === null || whatsapp === null) return null;
      if (email && !EMAIL_PATTERN.test(email)) return null;
      if (whatsapp && !WHATSAPP_PATTERN.test(whatsapp)) return null;
      if (!email && !whatsapp) return null;
      return { action, key, invitee: { ...(name ? { name } : {}), ...(email ? { email } : {}), ...(whatsapp ? { whatsapp } : {}) } };
    }
    case 'gathering.invitation.rsvp': {
      if (!key) return null;
      const rsvp = isRecord(value.rsvp) ? value.rsvp : {};
      const attendeeName = boundedText(rsvp.attendeeName, 255);
      const contact = boundedText(rsvp.contact, 320);
      const whatsapp = boundedText(rsvp.whatsapp, 20);
      if (attendeeName === null || contact === null || whatsapp === null) return null;
      if (contact && !EMAIL_PATTERN.test(contact)) return null;
      if (whatsapp && !WHATSAPP_PATTERN.test(whatsapp)) return null;
      const optionKeys = Array.isArray(rsvp.optionKeys) ? rsvp.optionKeys : [];
      if (optionKeys.length > 20 || !optionKeys.every((item) => typeof item === 'string' && OPAQUE_KEY_PATTERN.test(item))) return null;
      return {
        action,
        key,
        rsvp: {
          ...(attendeeName ? { attendeeName } : {}),
          ...(contact ? { contact } : {}),
          ...(whatsapp ? { whatsapp } : {}),
          optionKeys: [...new Set(optionKeys as string[])],
        },
      };
    }
    case 'gathering.invitation.verify_otp': {
      const code = typeof value.code === 'string' ? value.code.trim() : '';
      return key && /^\d{6}$/.test(code) ? { action, key, code } : null;
    }
    case 'gathering.invitations.submit':
    case 'gathering.invitation.content.save': {
      // Kirim undangan: isi tampilan undangan opsional (disimpan host sebelum mengirim).
      if (action === 'gathering.invitations.submit' && value.invitationContent === undefined) {
        return key && value.bannerFile === undefined ? { action, key } : null;
      }
      if (!key || !isRecord(value.invitationContent)) return null;
      const description = boundedText(value.invitationContent.description, INVITATION_DESCRIPTION_MAX_LENGTH);
      if (description === null) return null;
      const removeBanner = value.invitationContent.removeBanner === true;
      let bannerFile: Blob | undefined;
      if (value.bannerFile !== undefined) {
        const file = value.bannerFile;
        if (typeof Blob === 'undefined' || !(file instanceof Blob)) return null;
        if (file.size === 0 || file.size > INVITATION_BANNER_MAX_BYTES || !file.type.startsWith('image/')) return null;
        bannerFile = file;
      }
      return {
        action,
        key,
        invitationContent: removeBanner && !bannerFile ? { description, removeBanner: true } : { description },
        ...(bannerFile ? { bannerFile } : {}),
      };
    }
    case 'gathering.invitation.revoke':
    case 'gathering.registration.cancel_checkout':
    case 'gathering.registration.refund': {
      const target = typeof value.target === 'string' && OPAQUE_KEY_PATTERN.test(value.target) ? value.target : undefined;
      return key && target ? { action, key, target } : null;
    }
    case 'gathering.registrations.reject':
    case 'gathering.registrations.checkout': {
      const keys = parseKeyList(value.keys, 200);
      if (!key || !keys) return null;
      if (action === 'gathering.registrations.checkout') return { action, key, keys };
      const message = boundedText(value.message, 2000);
      return message ? { action, key, keys, message } : null;
    }
    case 'gathering.cancel': {
      if (!key) return null;
      const reason = boundedText(value.reason, 500);
      if (reason === null) return null;
      return reason ? { action, key, reason } : { action, key };
    }
    default:
      return key ? { action, key } : null;
  }
}

const BANNER_NAME_PATTERN = /[^\w.\- ]+/g;

/**
 * Banner dari iframe dikirim sebagai bytes (`intent.banner = { bytes, type, name }`), bukan objek File:
 * File milik dokumen sandbox (origin opaque) bisa gagal dibaca browser saat host mengunggahnya.
 * Host membuat Blob baru miliknya sendiri; validasi tipe/ukuran tetap di `parseTemplateRuntimeIntent`.
 * `bannerFile` mentah dari pesan iframe selalu dibuang.
 */
function intentWithBannerFromBytes(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const { banner, bannerFile: _ignored, ...rest } = value;
  if (banner === undefined) return rest;
  if (
    !isRecord(banner) ||
    !(banner.bytes instanceof ArrayBuffer) ||
    typeof banner.type !== 'string' ||
    typeof banner.name !== 'string' ||
    typeof File === 'undefined'
  ) {
    // Banner tidak valid → biarkan parser menolak intent (bukan sekadar mengabaikan banner).
    return { ...rest, bannerFile: null };
  }
  const name = banner.name.replace(BANNER_NAME_PATTERN, '_').slice(0, 120) || 'banner';
  return { ...rest, bannerFile: new File([banner.bytes], name, { type: banner.type }) };
}

export function parseTemplateRuntimeIntentMessage(value: unknown): TemplateRuntimeIntentMessage | null {
  if (
    !isRecord(value) ||
    value.protocol !== TEMPLATE_RUNTIME_BRIDGE_VERSION ||
    value.type !== TEMPLATE_RUNTIME_INTENT ||
    typeof value.slug !== 'string' ||
    !SLUG_PATTERN.test(value.slug) ||
    typeof value.version !== 'string' ||
    !VERSION_PATTERN.test(value.version) ||
    typeof value.digest !== 'string' ||
    !DIGEST_PATTERN.test(value.digest) ||
    typeof value.requestId !== 'string' ||
    !REQUEST_ID_PATTERN.test(value.requestId)
  ) {
    return null;
  }
  const intent = parseTemplateRuntimeIntent(intentWithBannerFromBytes(value.intent));
  if (!intent) return null;
  return {
    protocol: TEMPLATE_RUNTIME_BRIDGE_VERSION,
    type: TEMPLATE_RUNTIME_INTENT,
    slug: value.slug,
    version: value.version,
    digest: value.digest,
    requestId: value.requestId,
    intent,
  };
}

/**
 * Bridge host untuk intent dari iframe opaque: cek sumber/origin, identitas
 * slug+version+digest, aksi yang diizinkan halaman, dan replay requestId.
 */
export function createTemplateRuntimeIntentBridge({
  frame,
  identity,
  allowedActions,
  onIntent,
}: {
  frame: Pick<Window, 'postMessage'>;
  identity: TemplateRuntimeIdentity;
  allowedActions: readonly string[];
  onIntent: TemplateRuntimeIntentHandler;
}): (event: MessageEvent<unknown>) => Promise<void> {
  const allowed = new Set(allowedActions);
  const seenRequests = new Set<string>();

  return async (event) => {
    if (event.source !== frame || event.origin !== 'null') return;
    const message = parseTemplateRuntimeIntentMessage(event.data);
    if (
      !message ||
      message.slug !== identity.slug ||
      message.version !== identity.version ||
      message.digest !== identity.digest ||
      !allowed.has(message.intent.action) ||
      seenRequests.has(message.requestId)
    ) return;

    const response: TemplateRuntimeIntentResultMessage = {
      protocol: TEMPLATE_RUNTIME_BRIDGE_VERSION,
      type: TEMPLATE_RUNTIME_INTENT_RESULT,
      ...identity,
      requestId: message.requestId,
      result: { ok: false, message: 'Aksi belum dapat diproses.' },
    };
    if (seenRequests.size >= 256) {
      response.result = { ok: false, message: 'Batas aksi template untuk halaman ini tercapai.' };
      frame.postMessage(response, '*');
      return;
    }
    seenRequests.add(message.requestId);
    try {
      await onIntent(message.intent);
      response.result = { ok: true };
    } catch (error) {
      response.result = {
        ok: false,
        message: error instanceof TemplateRuntimeActionError
          ? error.message
          : error instanceof Error && error.message.trim()
            ? `Aksi gagal: ${error.message}`
            : 'Aksi belum dapat diproses.',
      };
    }
    frame.postMessage(response, '*');
  };
}
