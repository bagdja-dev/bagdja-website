/**
 * Validator kontrak `props.page` — port dari
 * bagdja-website-template-runtime/src/page-contract.mjs (sumber kanonik).
 * Dipakai sanitizer runtime: page yang tidak valid TIDAK dikirim ke template.
 * Jaga tetap sinkron; scripts/check-template-runtime-adapter.mjs memeriksa paritasnya.
 */

/** Objek `props.page` (bentuk rinci per halaman ada di page-contract.d.ts kanonik). */
export type TemplatePageObject = { type: string; contractVersion: number } & Record<string, unknown>;

export const TEMPLATE_SYSTEM_PAGES = [
  'header',
  'bottom_nav',
  'cart',
  'orders',
  'order_detail',
  'tagihan',
  'invoice_detail',
  'calendar',
  'gathering_plan',
  'product_detail',
  'gathering_invitation',
];

/** page.type → field wajib (selain field PageBase). */
const REQUIRED_FIELDS: Record<string, string[]> = {
  cart: ['items', 'actions'],
  orders: ['transactions', 'actions'],
  order_detail: ['transaction', 'actions'],
  tagihan: ['invoices', 'actions'],
  invoice_detail: ['invoice', 'canPay', 'loginRequired', 'actions'],
  calendar: ['initialMonth', 'plans', 'invitations', 'actions'],
  gathering_plan: ['plan', 'invitees', 'invitations', 'registrations', 'viewerRole', 'actions'],
  product_detail: ['product', 'related', 'loggedIn', 'actions'],
  gathering_invitation: ['invitation', 'optionGroups', 'viewer', 'loginHref', 'actions'],
};

/** Versi kontrak per halaman (v2 = superset v1). */
const CONTRACT_VERSIONS: Record<string, number> = { order_detail: 2, gathering_plan: 2 };

export const GATHERING_PLAN_ACTIONS = [
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
];

const ALLOWED_ACTIONS: Record<string, string[]> = {
  cart: ['cart.set_quantity', 'cart.remove', 'cart.checkout'],
  orders: ['transaction.chat.open'],
  order_detail: ['order.retry_payment', 'order.cancel', 'order.complete', 'order.dispute'],
  tagihan: ['invoice.pay'],
  invoice_detail: ['invoice.pay'],
  calendar: ['gathering.respond'],
  gathering_plan: GATHERING_PLAN_ACTIONS,
  product_detail: ['gathering.plan.create', 'product.chat.open'],
  gathering_invitation: [
    'gathering.invitation.rsvp',
    'gathering.invitation.verify_otp',
    'gathering.invitation.resend_otp',
    'gathering.invitation.pay',
  ],
};

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const OPAQUE_KEY = /^[A-Za-z0-9_-]{6,128}$/;
const TENANT_PATH = /^\/(?!\/)[^\s\\]*$/;
/** Tautan peta lokasi gathering — hanya Google Maps https (gathering-option-location-plan L1). */
const GOOGLE_MAPS_URL = /^https:\/\/(?:maps\.app\.goo\.gl\/|goo\.gl\/maps\/|maps\.google\.[a-z]{2,3}(?:\.[a-z]{2})?\/|(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?\/maps(?:\/|\?|$))[^\s<>"']*$/i;
/** Pertahanan lapis kedua untuk field `*Html` (sanitasi utama di Website API). */
const UNSAFE_HTML = /<\s*(script|style|iframe|object|embed)\b|\son[a-z]+\s*=|javascript:/i;
const FORBIDDEN_KEY = /(^|_)(email|token|password|secret)$|email|accessToken|refreshToken/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isIsoDateTimeWithOffset(value: unknown): boolean {
  return typeof value === 'string' && ISO_WITH_OFFSET.test(value) && !Number.isNaN(Date.parse(value));
}

/** Aturan umum yang berlaku di seluruh pohon objek. */
function walk(value: unknown, path: string, issues: string[]): void {
  if (Array.isArray(value)) {
    if (value.length > 200) issues.push(`${path}: maksimal 200 item`);
    value.forEach((item, index) => walk(item, `${path}[${index}]`, issues));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_KEY.test(key)) issues.push(`${childPath}: field email/token tidak boleh dikirim ke template`);
    if (/At$/.test(key) && child !== undefined && !isIsoDateTimeWithOffset(child)) {
      issues.push(`${childPath}: harus ISO 8601 dengan offset timezone, mis. 2026-11-22T09:00:00+07:00`);
    }
    if (/^(amount|price)$|(Amount|Price)$/.test(key) && child !== undefined && !(typeof child === "number" && Number.isInteger(child) && child >= 0)) {
      issues.push(`${childPath}: harus bilangan bulat ≥ 0`);
    }
    if (key === 'key' && !(typeof child === 'string' && OPAQUE_KEY.test(child))) {
      issues.push(`${childPath}: key opaque 6–128 karakter [A-Za-z0-9_-]`);
    }
    if (/MapUrl$|^mapUrl$/.test(key) && child !== undefined && !(typeof child === 'string' && child.length <= 1000 && GOOGLE_MAPS_URL.test(child))) {
      issues.push(`${childPath}: harus tautan Google Maps https`);
    }
    if (key === 'publicInvitationUrl' && child !== undefined && !(typeof child === 'string' && child.length <= 2048 && /^https?:\/\/[^\s<>"']+$/.test(child))) {
      issues.push(`${childPath}: harus URL http(s) absolut`);
    }
    if (/BannerUrl$/.test(key) && child !== undefined && !(typeof child === 'string' && child.length <= 2048 && /^https:\/\/[^\s<>"']+$/.test(child))) {
      issues.push(`${childPath}: harus URL gambar https`);
    }
    if (/Html$/.test(key) && child !== undefined && !(typeof child === 'string' && child.length <= 20000 && !UNSAFE_HTML.test(child))) {
      issues.push(`${childPath}: harus HTML tersanitasi ≤ 20000 karakter`);
    }
    if (/Href$/.test(key) && child !== undefined && !(typeof child === 'string' && TENANT_PATH.test(child))) {
      issues.push(`${childPath}: harus path relatif tenant yang diawali "/"`);
    }
    walk(child, childPath, issues);
  }
}

/** Kembalikan daftar masalah; kosong = valid. */
export function validateTemplatePage(page: unknown): string[] {
  const issues: string[] = [];
  if (!isRecord(page)) return ['page: harus objek'];
  const required = REQUIRED_FIELDS[String(page.type)];
  if (!required) return [`page.type: tidak dikenal (${String(page.type)})`];

  const expectedVersion = CONTRACT_VERSIONS[String(page.type)] ?? 1;
  if (page.contractVersion !== expectedVersion) issues.push(`page.contractVersion: harus ${expectedVersion}`);
  if (page.currency !== 'IDR') issues.push('page.currency: harus "IDR"');
  if (typeof page.timezone !== 'string' || !page.timezone.includes('/')) {
    issues.push('page.timezone: harus nama zona IANA, mis. "Asia/Jakarta"');
  }
  for (const field of required) {
    if (page[field] === undefined) issues.push(`page.${field}: wajib ada`);
  }
  if (Array.isArray(page.actions)) {
    for (const action of page.actions) {
      if (!ALLOWED_ACTIONS[String(page.type)].includes(String(action))) issues.push(`page.actions: "${action}" tidak berlaku untuk ${page.type}`);
    }
  }
  if (page.type === 'calendar' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(page.initialMonth))) {
    issues.push('page.initialMonth: format YYYY-MM');
  }
  walk(page, 'page', issues);
  return issues;
}
