/**
 * Pembentuk `props.page` untuk halaman sistem milik template
 * (plan/website-builder/template-owned-system-pages-plan.md §4–5, kontrak:
 * bagdja-website-template-runtime/contract/page-contract.d.ts).
 *
 * Fungsi murni: input = data API milik sesi pembeli (dimuat server-side oleh route),
 * output = objek kontrak. Tidak ada email/token; ID internal diganti `key` opaque.
 * Sengaja tanpa import relatif agar bisa diuji langsung dengan `node --test`.
 */
import { createHash, createHmac } from 'node:crypto';

export const PAGE_TIMEZONE = 'Asia/Jakarta';
const PAGE_OFFSET = '+07:00';
const MAX_ROWS = 100;

// ── Utilitas kontrak ───────────────────────────────────────────────────────

export type PageKeyFactory = (kind: string, id: string) => string;

const DEVELOPMENT_PAGE_KEY_SECRET = 'bagdja-template-page-key-development-only';

/**
 * Keputusan E1: key = HMAC(secret, jenis:id:user). Tanpa state di server; host
 * memetakan balik dengan menghitung ulang key untuk data milik sesi yang sama.
 */
export function createPageKeyFactory(
  userId: string,
  secret: string | undefined = process.env.TEMPLATE_PAGE_KEY_SECRET,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): PageKeyFactory {
  let keySecret = secret?.trim();
  if (!keySecret) {
    if (nodeEnv === 'production') {
      throw new Error('TEMPLATE_PAGE_KEY_SECRET is required in production.');
    }
    keySecret = DEVELOPMENT_PAGE_KEY_SECRET;
  }
  return (kind, id) =>
    `k${createHmac('sha256', keySecret!).update(`${kind}:${id}:${userId}`).digest('base64url').slice(0, 32)}`;
}

/**
 * Key untuk data publik (detail produk): sama untuk semua pengunjung sehingga halaman boleh
 * di-cache dan dibuka tanpa login. Hanya untuk ID yang memang publik (produk/opsi produk).
 */
export const PUBLIC_PAGE_KEY_SCOPE = 'public';

export function toMoney(value: unknown): number {
  const amount = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 0;
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
}

/** ISO 8601 dengan offset eksplisit. Tanggal tanpa jam → awal hari zona website. */
export function toIsoDateTime(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00:00${PAGE_OFFSET}`;
  if (/(Z|[+-]\d{2}:\d{2})$/.test(raw) && !Number.isNaN(Date.parse(raw))) return raw;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

/** Batas deskripsi undangan — sama dengan INVITATION_DESCRIPTION_MAX_LENGTH (template-runtime-bridge.ts). */
const INVITATION_DESCRIPTION_LIMIT = 5000;

/**
 * Salinan lib/rich-text.ts (file ini dijalankan langsung oleh node --test tanpa import relatif).
 * Paritas dijaga test `rich text helpers stay in sync`.
 */
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

/** Batas panjang HTML yang diteruskan ke template — sama dengan DTO opsi (5000). */
const RICH_TEXT_MAX_LENGTH = 5000;

export function richTextToPlainText(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  return value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6]|blockquote|tr|pre)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
      const lower = entity.toLowerCase();
      if (ENTITIES[lower] !== undefined) return ENTITIES[lower];
      const code = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : lower.startsWith('#') ? parseInt(lower.slice(1), 10) : NaN;
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * HTML untuk template: hanya keluaran editor (diawali tag) yang sudah melewati sanitasi API.
 * Teks polos lama tidak dikirim sebagai HTML — template memakai `description`.
 */
export function richTextHtml(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const html = value.trim();
  if (!html.startsWith('<') || html.length > RICH_TEXT_MAX_LENGTH || !richTextToPlainText(html)) return undefined;
  return html;
}

/** URL gambar https (banner undangan) — selain itu tidak dikirim ke template. */
function httpsUrl(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw || raw.length > 2048) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** URL absolut dari origin http(s) + path tenant; undefined bila origin tidak valid. */
function absoluteTenantUrl(origin: string | undefined, path: string): string | undefined {
  if (!origin) return undefined;
  try {
    const base = new URL(origin);
    if ((base.protocol !== 'https:' && base.protocol !== 'http:') || base.username || base.password) return undefined;
    return new URL(path.startsWith('/') ? path : `/${path}`, base.origin).href;
  } catch {
    return undefined;
  }
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null)) as T;
}

function base() {
  return { contractVersion: 1 as const, currency: 'IDR' as const, timezone: PAGE_TIMEZONE };
}

// ── Transaksi ──────────────────────────────────────────────────────────────

export interface TransactionRowInput {
  id: string;
  total_amount: number | string;
  status: string;
  ref_number?: string | null;
  created_at: string;
  termin_summary?: { total: number; paid: number; issued: number; scheduled: number } | null;
  items?: Array<{ order?: { product?: { name?: string | null } | null } | null }>;
}

export const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Menunggu pembayaran',
  PENDING_PAYMENT: 'Menunggu pembayaran',
  HELD: 'Diproses',
  COMPLETED: 'Selesai',
  REFUNDED: 'Direfund',
  CLOSED: 'Ditutup',
  DISPUTED: 'Dalam sengketa',
  CANCELLED: 'Dibatalkan',
};

export function buildOrdersPage(rows: TransactionRowInput[], options: { basePath: string; key: PageKeyFactory }) {
  return {
    ...base(),
    type: 'orders' as const,
    actions: ['transaction.chat.open'] as const,
    transactions: rows.slice(0, MAX_ROWS).map((row) => {
      const summary = row.termin_summary;
      const remaining = summary ? Math.max(0, summary.total - summary.paid) : 0;
      const outstanding = row.status === 'COMPLETED' && remaining > 0;
      const itemNames = (row.items ?? [])
        .map((item) => text(item.order?.product?.name))
        .filter(Boolean);
      return {
        key: options.key('transaction', row.id),
        reference: text(row.ref_number, `#${row.id.slice(0, 8).toUpperCase()}`),
        status: row.status,
        statusLabel: TRANSACTION_STATUS_LABELS[row.status] ?? row.status,
        createdAt: toIsoDateTime(row.created_at) ?? new Date(0).toISOString(),
        totalAmount: toMoney(row.total_amount),
        itemCount: row.items?.length ?? 0,
        itemNames,
        outstanding: outstanding ? { label: `Sisa ${remaining} Tagihan` } : null,
        detailHref: `${options.basePath}/order/${encodeURIComponent(row.id)}`,
      };
    }),
  };
}

// ── Tagihan ────────────────────────────────────────────────────────────────

export interface TerminRowInput {
  id: string;
  sequence: number;
  label: string;
  amount: number | string;
  status: 'SCHEDULED' | 'ISSUED' | 'PAID' | 'CANCELLED';
  anchorStepName: string | null;
  orderId: string;
  orderTransactionId: string | null;
  productName: string | null;
  createdAt: string;
  dueDate?: string | null;
}

export interface GatheringInvoiceInput {
  id: string;
  transaction_id?: string | null;
  can_view_transaction?: boolean;
  invoice_id: string;
  plan_number: string;
  gathering_title: string;
  amount: number;
  payment_status: string;
  invoice_status?: 'SCHEDULED' | 'ISSUED';
  invoice_issued_at: string | null;
  payment_deadline?: string | null;
  can_pay: boolean;
}

const INVOICE_STATUS_LABELS = {
  SCHEDULED: 'Menunggu diterbitkan',
  ISSUED: 'Perlu dibayar',
  OVERDUE: 'Lewat jatuh tempo',
  PAID: 'Lunas',
  REFUNDED: 'Direfund',
  CANCELLED: 'Dibatalkan',
} as const;

type InvoiceStatus = keyof typeof INVOICE_STATUS_LABELS;

function gatheringInvoiceStatus(invoice: GatheringInvoiceInput): InvoiceStatus {
  if (!invoice.invoice_issued_at || invoice.invoice_status === 'SCHEDULED') return 'SCHEDULED';
  if (invoice.payment_status === 'REFUNDED') return 'REFUNDED';
  if (invoice.payment_status === 'PAID') return 'PAID';
  return 'ISSUED';
}

export function buildTagihanPage(
  termins: TerminRowInput[],
  gatheringInvoices: GatheringInvoiceInput[],
  options: { basePath: string; key: PageKeyFactory },
) {
  const terminRows = termins.map((termin) => {
    const status: InvoiceStatus = termin.status;
    return compact({
      key: options.key('termin', termin.id),
      kind: 'termin' as const,
      sequence: termin.sequence,
      title: text(termin.productName, 'Pesanan'),
      label: text(termin.label, `Termin ${termin.sequence}`),
      amount: toMoney(termin.amount),
      status,
      statusLabel: INVOICE_STATUS_LABELS[status],
      stepLabel: termin.anchorStepName ?? undefined,
      createdAt: toIsoDateTime(termin.createdAt) ?? new Date(0).toISOString(),
      dueAt: toIsoDateTime(termin.dueDate),
      canPay: status === 'ISSUED',
      transactionHref: termin.orderTransactionId
        ? `${options.basePath}/order/${encodeURIComponent(termin.orderTransactionId)}`
        : undefined,
    });
  });
  const gatheringRows = gatheringInvoices.map((invoice) => {
    const status = gatheringInvoiceStatus(invoice);
    return compact({
      key: options.key('gathering_invoice', invoice.id),
      kind: 'gathering' as const,
      title: text(invoice.gathering_title, 'Gathering'),
      label: `${text(invoice.invoice_id, 'Invoice')} · ${text(invoice.plan_number)}`,
      amount: toMoney(invoice.amount),
      status,
      statusLabel: INVOICE_STATUS_LABELS[status],
      createdAt: toIsoDateTime(invoice.invoice_issued_at) ?? new Date(0).toISOString(),
      dueAt: toIsoDateTime(invoice.payment_deadline),
      canPay: invoice.can_pay === true && status === 'ISSUED',
      detailHref: `${options.basePath}/gathering/invoice/${encodeURIComponent(invoice.id)}`,
      transactionHref: invoice.transaction_id && invoice.can_view_transaction !== false
        ? `${options.basePath}/order/${encodeURIComponent(invoice.transaction_id)}`
        : undefined,
    });
  });
  return {
    ...base(),
    type: 'tagihan' as const,
    invoices: [...terminRows, ...gatheringRows].slice(0, MAX_ROWS),
    actions: ['invoice.pay'] as const,
  };
}

// ── Kalender ───────────────────────────────────────────────────────────────

export interface CalendarPlanInput {
  id: string;
  plan_number: string;
  order_id: string | null;
  title: string;
  status: string;
  workflow_step: string;
  occurrence: {
    status: string;
    min_attendees: number;
    max_attendees: number;
    final_schedule?: string | null;
    payment_deadline?: string | null;
  };
}

export interface CalendarInvitationInput {
  id: string;
  gathering_title: string;
  plan_number: string;
  initiator_name: string;
  event_date: string | null;
  event_location: string | null;
  registration_status: string | null;
  action: string;
  action_path: string | null;
}

const STEP_LABELS: Record<string, string> = {
  PLAN: 'Atur rencana',
  INVITATIONS: 'Buat undangan',
  INVITATION_CONFIRMATION: 'Konfirmasi peserta',
  PAYMENT_CONFIRMATION: 'Konfirmasi opsi & pembayaran',
  LOCKED: 'Terkunci',
};

const INVITATION_ACTION_LABELS: Record<string, string> = {
  RSVP: 'Belum dijawab',
  WAITING_INVOICE: 'Menunggu tagihan',
  PAY: 'Perlu dibayar',
  PAYMENT_PENDING: 'Pembayaran diproses',
  WAITING_CONFIRMATION: 'Menunggu konfirmasi',
  TICKET: 'Tiket tersedia',
  ATTENDED: 'Sudah hadir',
  NONE: 'Undangan',
};

function invitationResponse(invitation: CalendarInvitationInput): 'PENDING' | 'ACCEPTED' | 'DECLINED' {
  const status = (invitation.registration_status ?? '').toUpperCase();
  if (status.includes('DECLIN') || status === 'CANCELLED') return 'DECLINED';
  if (invitation.action === 'RSVP' || !status) return 'PENDING';
  return 'ACCEPTED';
}

function tenantPath(basePath: string, path: string | null): string | undefined {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return undefined;
  return basePath && !path.startsWith(`${basePath}/`) ? `${basePath}${path}` : path;
}

export function buildCalendarPage(
  plans: CalendarPlanInput[],
  invitations: CalendarInvitationInput[],
  options: { basePath: string; key: PageKeyFactory; now?: Date },
) {
  const planRows = plans.slice(0, MAX_ROWS).map((plan) =>
    compact({
      key: options.key('gathering_plan', plan.id),
      title: text(plan.title, 'Rencana gathering'),
      planNumber: text(plan.plan_number),
      status: plan.occurrence?.status || plan.status,
      stepLabel: STEP_LABELS[plan.workflow_step] ?? plan.workflow_step,
      eventAt: toIsoDateTime(plan.occurrence?.final_schedule),
      paymentDueAt: toIsoDateTime(plan.occurrence?.payment_deadline),
      minAttendees: plan.occurrence?.min_attendees,
      maxAttendees: plan.occurrence?.max_attendees,
      // Sama dengan kalender bawaan: rencana gathering = order di cart; fallback ke id rencana.
      detailHref: `${options.basePath}/cart/order/${encodeURIComponent(plan.order_id ?? plan.id)}`,
    }),
  );
  const invitationRows = invitations.slice(0, MAX_ROWS).map((invitation) => {
    const response = invitationResponse(invitation);
    return compact({
      key: options.key('gathering_invitation', invitation.id),
      title: text(invitation.gathering_title, 'Undangan gathering'),
      planNumber: text(invitation.plan_number),
      initiatorName: text(invitation.initiator_name, 'Penyelenggara'),
      eventAt: toIsoDateTime(invitation.event_date),
      location: invitation.event_location ?? undefined,
      isNew: invitation.action === 'RSVP',
      needsAction: ['RSVP', 'PAY'].includes(invitation.action),
      response,
      responseLabel: INVITATION_ACTION_LABELS[invitation.action] ?? 'Undangan',
      detailHref: tenantPath(options.basePath, invitation.action_path),
    });
  });
  const firstEvent = [...planRows, ...invitationRows]
    .map((row) => row.eventAt)
    .filter((value): value is string => Boolean(value))
    .sort()[0];
  const month = (firstEvent ?? (options.now ?? new Date()).toISOString()).slice(0, 7);
  return {
    ...base(),
    type: 'calendar' as const,
    initialMonth: month,
    plans: planRows,
    invitations: invitationRows,
    actions: ['gathering.respond'] as const,
  };
}

// ── Invoice gathering ─────────────────────────────────────────────────────

export interface PublicGatheringInvoiceInput {
  id: string;
  invoice_id: string;
  plan_number: string;
  gathering_title: string;
  initiator_name: string;
  attendee_name: string;
  amount: number;
  payment_status: string;
  invoice_issued_at: string | null;
  payment_deadline?: string | null;
  event_date?: string | null;
  payment_open: boolean;
}

export function buildInvoiceDetailPage(
  invoice: PublicGatheringInvoiceInput,
  options: { key: PageKeyFactory; loggedIn: boolean },
) {
  const status: InvoiceStatus =
    invoice.payment_status === 'PAID'
      ? 'PAID'
      : invoice.payment_status === 'REFUNDED'
        ? 'REFUNDED'
        : !invoice.invoice_issued_at
          ? 'SCHEDULED'
          : 'ISSUED';
  const payable = invoice.payment_open === true && status === 'ISSUED';
  return {
    ...base(),
    type: 'invoice_detail' as const,
    invoice: compact({
      key: options.key('gathering_invoice', invoice.id),
      number: text(invoice.invoice_id, 'Invoice'),
      planNumber: invoice.plan_number || undefined,
      title: text(invoice.gathering_title, 'Gathering'),
      attendeeName: invoice.attendee_name || undefined,
      initiatorName: invoice.initiator_name || undefined,
      amount: toMoney(invoice.amount),
      status,
      statusLabel: invoice.payment_status === 'PENDING_PAYMENT' ? 'Pembayaran sedang diproses' : INVOICE_STATUS_LABELS[status],
      dueAt: toIsoDateTime(invoice.payment_deadline),
      eventAt: toIsoDateTime(invoice.event_date),
    }),
    canPay: payable,
    loginRequired: payable && !options.loggedIn,
    actions: ['invoice.pay'] as const,
  };
}

// ── Detail produk (gathering) ─────────────────────────────────────────────

/** Bentuk minimal CatalogItem (lib/template-data.ts) yang dibutuhkan halaman detail produk. */
export interface ProductDetailInput {
  id: string;
  type: string;
  name: string;
  slug: string;
  category?: string;
  description?: string;
  detail?: string;
  priceLabel: string;
  image?: string;
  images?: string[];
  specifications?: Record<string, string>;
  gatheringMeta?: {
    eventDate?: string;
    eventTime?: string;
    location?: string;
    minAttendees?: number;
    maxAttendees?: number;
    depositAmountPerSeat?: number;
    cancellationPolicy?: string;
    optionGroups?: Array<{
      key: string;
      label: string;
      options: Array<{
        id: string;
        label: string;
        description?: string;
        descriptionHtml?: string;
        venueLocation?: string;
        venueAddress?: string;
        venueMapUrl?: string;
        availabilityNote?: string;
        benefits?: string[];
        images?: string[];
      }>;
    }>;
  };
}

/** Batas HTML deskripsi/detail produk yang diteruskan ke template — sama dengan validator kontrak. */
const PRODUCT_HTML_MAX_LENGTH = 20000;
const MAX_PRODUCT_IMAGES = 10;

function productHtml(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const html = value.trim();
  return html.startsWith('<') && html.length <= PRODUCT_HTML_MAX_LENGTH && richTextToPlainText(html) ? html : undefined;
}

function httpsImages(values: unknown, limit = MAX_PRODUCT_IMAGES): string[] {
  return (Array.isArray(values) ? values : [])
    .map((value) => httpsUrl(value))
    .filter((value): value is string => Boolean(value))
    .slice(0, limit);
}

/**
 * Detail produk gathering untuk template package (contractVersion 1). Produk non-gathering tetap
 * tampilan Bagdja (pembelian butuh lokasi/penawaran/escrow yang belum ada di kontrak).
 * Kelompok & opsi mengikuti urutan data (sort_order API) — tidak diurutkan ulang.
 */
export function buildProductDetailPage(
  product: ProductDetailInput,
  related: ProductDetailInput[],
  options: { key: PageKeyFactory; basePath: string; loggedIn: boolean },
) {
  const meta = product.gatheringMeta ?? {};
  const eventDateLabel = [text(meta.eventDate), text(meta.eventTime)].filter(Boolean).join(' · ');
  const productHref = (item: ProductDetailInput) => `${options.basePath}/products/${encodeURIComponent(item.slug || item.id)}`;
  return {
    ...base(),
    type: 'product_detail' as const,
    product: compact({
      key: options.key('product', product.id),
      name: text(product.name, 'Gathering'),
      category: text(product.category) || undefined,
      priceLabel: text(product.priceLabel),
      href: productHref(product),
      images: httpsImages([product.image, ...(product.images ?? [])].filter((value, index, all) => value && all.indexOf(value) === index)),
      description: richTextToPlainText(product.description) || undefined,
      descriptionHtml: productHtml(product.description),
      detailHtml: productHtml(product.detail),
      gathering: compact({
        depositAmount: typeof meta.depositAmountPerSeat === 'number' ? toMoney(meta.depositAmountPerSeat) : undefined,
        minAttendees: Number.isInteger(meta.minAttendees) && meta.minAttendees! > 0 ? meta.minAttendees : undefined,
        maxAttendees: Number.isInteger(meta.maxAttendees) && meta.maxAttendees! > 0 ? meta.maxAttendees : undefined,
        eventDateLabel: eventDateLabel || undefined,
        location: text(meta.location) || undefined,
        cancellationPolicy: text(meta.cancellationPolicy) || undefined,
        optionGroups: (meta.optionGroups ?? []).slice(0, MAX_ROWS).map((group) => ({
          label: text(group.label, 'Pilihan'),
          options: group.options.slice(0, MAX_ROWS).map((option) => {
            const images = httpsImages(option.images, 5);
            return compact({
              key: options.key('product_option', option.id),
              label: text(option.label, 'Opsi'),
              description: richTextToPlainText(option.description) || undefined,
              descriptionHtml: richTextHtml(option.descriptionHtml ?? option.description),
              venue: text(option.venueLocation) || undefined,
              address: text(option.venueAddress) || undefined,
              mapUrl: googleMapsUrl(option.venueMapUrl),
              availabilityNote: text(option.availabilityNote) || undefined,
              benefits: (option.benefits ?? []).map((benefit) => text(benefit)).filter(Boolean).slice(0, 20),
              imageUrl: images[0],
              images,
            });
          }),
        })),
      }),
      specifications: Object.entries(product.specifications ?? {})
        .filter(([label, value]) => text(label) && text(value))
        .slice(0, 50)
        .map(([label, value]) => ({ label: text(label), value: text(value) })),
    }),
    related: related
      .filter((item) => item.id !== product.id && item.type === 'gathering')
      .slice(0, 4)
      .map((item) => compact({
        name: text(item.name, 'Gathering'),
        href: productHref(item),
        imageUrl: httpsImages([item.image, ...(item.images ?? [])], 1)[0],
        priceLabel: text(item.priceLabel) || undefined,
      })),
    loggedIn: options.loggedIn,
    actions: ['gathering.plan.create', 'product.chat.open'] as const,
  };
}

// ── Undangan gathering (contractVersion 1) ────────────────────────────────

export interface InvitationOptionInput {
  product_option_id: string;
  option_group_key: string;
  label: string;
  description?: string | null;
  venue_location?: string | null;
  venue_address?: string | null;
  venue_map_url?: string | null;
  images?: unknown[] | null;
}

/** Respons GET /api/public/gathering-invitations/:token. */
export interface InvitationPreviewInput {
  invitation: { invitee_name?: string | null; invitee_email_masked?: string | null; expires_at?: string | null };
  group: {
    title: string;
    plan_number?: string | null;
    initiator_name?: string | null;
    invite_policy: 'OPEN' | 'INVITE_ONLY';
    invitation_banner_url?: string | null;
    invitation_description?: string | null;
  };
  occurrence: {
    status: string;
    price_per_seat: number | string;
    min_attendees?: number | null;
    max_attendees?: number | null;
    cancellation_policy_snapshot?: { participant_terms?: string } | null;
    final_schedule?: string | null;
    rsvp_close_at?: string | null;
    voting_results?: Record<string, { total_votes?: number; options?: Record<string, { votes?: number; percentage?: number }> }>;
    options: InvitationOptionInput[];
  };
}

/** Respons GET …/private-status (undangan khusus, butuh login). */
export interface InvitationPrivateStatusInput {
  invitation: {
    invitee_name?: string | null;
    invitee_email_masked?: string | null;
    account_email?: string | null;
    account_matches: boolean;
    requires_attendee_name: boolean;
    requires_whatsapp: boolean;
  };
  registration?: {
    id: string;
    payment_status?: string | null;
    selected_options?: Record<string, string> | null;
    attendee_name?: string | null;
    email_masked?: string | null;
    whatsapp_masked?: string | null;
  } | null;
}

/**
 * Status tamu undangan terbuka (tanpa login) — cookie httpOnly per undangan, menggantikan
 * sessionStorage komponen Bagdja: reservasi menunggu OTP & registrasi yang sudah terverifikasi.
 */
export interface InvitationGuestState {
  pending?: { reservationId: string; contact: string; name: string; whatsapp?: string; options: Record<string, string>; expiresAt?: string };
  registrationId?: string;
  selectedOptions?: Record<string, string>;
  /** Peserta terverifikasi — hanya nama & kontak tersamar yang disimpan. */
  attendee?: { name: string; contactMasked?: string; phoneMasked?: string };
}

const INVITATION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export function invitationCookieName(token: string): string {
  return `bgi_${createHash('sha256').update(token).digest('hex').slice(0, 16)}`;
}

export function encodeInvitationGuestState(state: InvitationGuestState): string {
  return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
}

export function decodeInvitationGuestState(value: string | undefined | null): InvitationGuestState {
  if (!value || value.length > 4096) return {};
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as InvitationGuestState;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function maskContact(value: string): string {
  const [local, domain] = value.trim().toLowerCase().split('@');
  if (!domain) return '';
  const visible = local.slice(0, Math.min(2, Math.max(local.length - 1, 1)));
  return `${visible}${'•'.repeat(Math.max(local.length - visible.length, 3))}@${domain}`;
}

/** Sama dengan maskPhone Website API: `+6281234567890` → `+6281••••••890`. */
export function maskPhone(value: string | undefined | null): string {
  const digits = (value ?? '').replace(/[^\d+]/g, '');
  const plain = digits.replace(/\+/g, '');
  if (plain.length < 7) return '';
  const head = digits.startsWith('+') ? digits.slice(0, 5) : digits.slice(0, 4);
  return `${head}${'•'.repeat(Math.max(plain.length - head.replace('+', '').length - 3, 3))}${plain.slice(-3)}`;
}

const INVITATION_STATUS_LABELS: Record<string, string> = {
  PREORDER: 'Perencanaan',
  RSVP_OPEN: 'Pendaftaran dibuka',
  PAYMENT_OPEN: 'Pembayaran dibuka',
  CONFIRMED: 'Acara dikonfirmasi',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};
const SEAT_PAYMENT_LABELS: Record<string, string> = {
  PAID: 'Lunas',
  PENDING_PAYMENT: 'Menunggu pembayaran',
  UNPAID: 'Belum dibayar',
  REFUNDED: 'Dikembalikan',
};

export type InvitationViewerState =
  | 'guest_form' | 'otp_pending' | 'registered' | 'login_required' | 'account_mismatch' | 'closed' | 'unavailable';

/**
 * Halaman undangan gathering untuk template package. Key undangan & opsi memakai key publik
 * (terikat token); intent RSVP/OTP undangan terbuka boleh tanpa login.
 */
export function buildGatheringInvitationPage(
  preview: InvitationPreviewInput,
  options: {
    key: PageKeyFactory;
    token: string;
    pagePath: string;
    loggedIn: boolean;
    guest?: InvitationGuestState;
    /** Undangan khusus: null = gagal dimuat (padahal sudah login). */
    privateStatus?: InvitationPrivateStatusInput | null;
    /** Status bayar kursi (receipt) untuk registrasi yang terlihat. */
    paymentStatus?: string | null;
    now?: Date;
  },
) {
  const now = options.now ?? new Date();
  const { group, occurrence } = preview;
  const policy = group.invite_policy === 'INVITE_ONLY' ? 'INVITE_ONLY' as const : 'OPEN' as const;
  const rsvpCloseAt = occurrence.rsvp_close_at ? Date.parse(occurrence.rsvp_close_at) : Number.NaN;
  const rsvpOpen = occurrence.status === 'RSVP_OPEN' && (!Number.isFinite(rsvpCloseAt) || rsvpCloseAt > now.getTime());
  const paymentOpen = occurrence.status === 'PAYMENT_OPEN';
  const guest = options.guest ?? {};
  const pendingValid = Boolean(guest.pending?.reservationId)
    && (!guest.pending?.expiresAt || Date.parse(guest.pending.expiresAt) > now.getTime() - 60_000);

  let state: InvitationViewerState;
  let registered: {
    selectedOptions: Record<string, string>;
    paymentStatus: string;
    attendee?: { name?: string; contact?: string; phone?: string };
  } | null = null;
  let form: { askName: boolean; askContact: boolean; askWhatsapp: boolean; whatsappRequired: boolean } | undefined;
  let accountLabel: string | undefined;
  if (policy === 'INVITE_ONLY') {
    const status = options.privateStatus;
    if (!options.loggedIn) state = 'login_required';
    else if (!status) state = 'unavailable';
    else if (!status.invitation.account_matches) {
      state = 'account_mismatch';
      accountLabel = status.invitation.account_email ? maskContact(status.invitation.account_email) || undefined : undefined;
    } else if (status.registration) {
      state = 'registered';
      registered = {
        selectedOptions: status.registration.selected_options ?? {},
        paymentStatus: text(options.paymentStatus, text(status.registration.payment_status, 'UNPAID')),
        attendee: {
          name: text(status.registration.attendee_name, text(status.invitation.invitee_name)) || undefined,
          contact: text(status.registration.email_masked, text(status.invitation.invitee_email_masked)) || undefined,
          phone: text(status.registration.whatsapp_masked) || undefined,
        },
      };
    } else {
      state = rsvpOpen ? 'guest_form' : 'closed';
      form = { askName: status.invitation.requires_attendee_name, askContact: false, askWhatsapp: true, whatsappRequired: status.invitation.requires_whatsapp };
    }
  } else if (pendingValid) {
    state = 'otp_pending';
  } else if (guest.registrationId) {
    state = 'registered';
    registered = {
      selectedOptions: guest.selectedOptions ?? {},
      paymentStatus: text(options.paymentStatus, 'UNPAID'),
      attendee: guest.attendee
        ? { name: text(guest.attendee.name) || undefined, contact: text(guest.attendee.contactMasked) || undefined, phone: text(guest.attendee.phoneMasked) || undefined }
        : undefined,
    };
  } else {
    state = rsvpOpen ? 'guest_form' : 'closed';
  }
  if (policy === 'OPEN' && (state === 'guest_form' || state === 'otp_pending' || (state === 'registered' && rsvpOpen))) {
    form = { askName: true, askContact: true, askWhatsapp: true, whatsappRequired: false };
  }

  const selected = registered?.selectedOptions ?? (state === 'otp_pending' ? guest.pending?.options ?? {} : {});
  const groups = new Map<string, InvitationOptionInput[]>();
  for (const option of occurrence.options ?? []) {
    const groupKey = text(option.option_group_key, 'Pilihan');
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), option]);
  }
  const canPay = state === 'registered' && paymentOpen && registered?.paymentStatus !== 'PAID';
  const canAddReservation = state === 'registered' && policy === 'OPEN' && rsvpOpen;
  const actions: string[] = [];
  if (state === 'guest_form' || canAddReservation || state === 'otp_pending') actions.push('gathering.invitation.rsvp');
  if (state === 'otp_pending') actions.push('gathering.invitation.verify_otp', 'gathering.invitation.resend_otp');
  if (canPay) actions.push('gathering.invitation.pay');

  const encodedPath = encodeURIComponent(options.pagePath);
  const terms = richTextToPlainText(occurrence.cancellation_policy_snapshot?.participant_terms);
  return {
    ...base(),
    type: 'gathering_invitation' as const,
    invitation: compact({
      key: options.key('gathering_invitation', options.token),
      title: text(group.title, 'Undangan gathering'),
      planNumber: text(group.plan_number) || undefined,
      initiatorName: text(group.initiator_name, 'Penyelenggara'),
      inviteeName: text(preview.invitation.invitee_name) || undefined,
      policy,
      bannerUrl: httpsUrl(group.invitation_banner_url),
      description: richTextToPlainText(group.invitation_description) || undefined,
      descriptionHtml: richTextHtml(group.invitation_description),
      terms: terms || undefined,
      seatPrice: toMoney(occurrence.price_per_seat),
      minAttendees: Number(occurrence.min_attendees) || 0,
      maxAttendees: Number(occurrence.max_attendees) || 0,
      scheduledAt: toIsoDateTime(occurrence.final_schedule),
      rsvpCloseAt: toIsoDateTime(occurrence.rsvp_close_at),
      validUntilAt: toIsoDateTime(preview.invitation.expires_at),
      status: text(occurrence.status),
      statusLabel: INVITATION_STATUS_LABELS[occurrence.status] ?? text(occurrence.status),
      rsvpOpen,
      paymentOpen,
    }),
    optionGroups: [...groups.entries()].slice(0, MAX_ROWS).map(([groupKey, rows]) => {
      const result = occurrence.voting_results?.[groupKey];
      return {
        key: options.key('gathering_invitation_group', `${options.token}:${groupKey}`),
        label: groupKey,
        totalVotes: Number(result?.total_votes) || 0,
        options: rows.slice(0, MAX_ROWS).map((option) => {
          const vote = result?.options?.[option.product_option_id];
          const images = httpsImages(option.images, 5);
          return compact({
            key: options.key('gathering_invitation_option', option.product_option_id),
            label: text(option.label, 'Opsi'),
            description: richTextToPlainText(option.description) || undefined,
            descriptionHtml: richTextHtml(option.description),
            venue: text(option.venue_location) || undefined,
            address: text(option.venue_address) || undefined,
            mapUrl: googleMapsUrl(option.venue_map_url),
            imageUrl: images[0],
            images: images.length ? images : undefined,
            votes: Number(vote?.votes) || 0,
            percentage: Number(vote?.percentage) || 0,
            selected: selected[groupKey] === option.product_option_id,
          });
        }),
      };
    }),
    viewer: compact({
      state,
      loggedIn: options.loggedIn,
      form,
      recipientContact: text(preview.invitation.invitee_email_masked) || undefined,
      accountLabel,
      otpDestination: state === 'otp_pending' && guest.pending ? maskContact(guest.pending.contact) || undefined : undefined,
      otpExpiresAt: state === 'otp_pending' ? toIsoDateTime(guest.pending?.expiresAt) : undefined,
      paymentStatus: registered ? (SEAT_PAYMENT_LABELS[registered.paymentStatus] ? registered.paymentStatus : 'UNPAID') : undefined,
      paymentLabel: registered ? SEAT_PAYMENT_LABELS[registered.paymentStatus] ?? 'Belum dibayar' : undefined,
      // Peserta terdaftar: nama + kontak & nomor tersamar (tanpa data mentah).
      attendee: registered?.attendee && (registered.attendee.name || registered.attendee.contact || registered.attendee.phone)
        ? compact({ ...registered.attendee })
        : undefined,
      canPay,
      canAddReservation,
    }),
    loginHref: `/auth/login?next=${encodedPath}`,
    switchAccountHref: `/auth/logout?returnTo=${encodedPath}`,
    actions,
  };
}

// ── Rencana gathering ─────────────────────────────────────────────────────

export interface GatheringPlanInput {
  id: string;
  order_id?: string | null;
  plan_number: string;
  title: string;
  status: string;
  workflow_step: string;
  invite_policy: 'OPEN' | 'INVITE_ONLY';
  invitation_banner_url?: string | null;
  invitation_description?: string | null;
  occurrence: {
    status: string;
    price_per_seat: number;
    min_attendees: number;
    max_attendees: number;
    deposit_amount_per_seat?: number;
    final_schedule?: string | null;
    final_location?: string | null;
    rsvp_close_at?: string | null;
    payment_deadline?: string | null;
    option_groups_snapshot: Array<{
      product_option_id: string;
      option_group_key: string;
      label: string;
      description?: string | null;
      venue_location?: string | null;
      /** Alamat & tautan Google Maps (gathering-option-location-plan.md). */
      venue_address?: string | null;
      venue_map_url?: string | null;
      /** Gambar opsi produk (snapshot rencana baru); gambar pertama dikirim ke template. */
      images?: unknown[] | null;
      is_final_selection?: boolean;
    }>;
    opened_option_ids_snapshot: string[];
    voting_results?: Record<string, { options?: Record<string, { votes: number }> }>;
  };
}

export interface PlanInvitationInput {
  id: string;
  invitee_name: string | null;
  status: string;
  /** Hanya dipakai untuk menentukan saluran — tidak pernah diteruskan ke template (E3). */
  email?: string | null;
  whatsapp?: string | null;
  expires_at?: string | null;
}

export interface PlanRegistrationInput {
  id: string;
  attendee_name?: string | null;
  registration_status: string;
  payment_status: string;
  invoice_amount?: number | string | null;
  order_id?: string | null;
  rejection_message?: string | null;
  selected_option_details?: Array<{ option_group_key?: string | null; label?: string | null }> | null;
}

export interface PlanOperationInput {
  kind: string;
  status: string;
  total_count?: number;
  processed_count?: number;
  failed_count?: number;
  error_message?: string | null;
}

const PLAN_STATUS_LABELS: Record<string, string> = {
  PREORDER: 'Pra-pesan',
  DRAFT: 'Draft',
  RSVP_OPEN: 'RSVP dibuka',
  PAYMENT_OPEN: 'Pembayaran dibuka',
  CONFIRMED: 'Dikonfirmasi',
  IN_PROGRESS: 'Sedang berlangsung',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

const RSVP_LABELS = { PENDING: 'Belum dijawab', ACCEPTED: 'Hadir', DECLINED: 'Tidak hadir' } as const;

const OPERATION_LABELS: Record<string, string> = {
  INVITATION_DISPATCH: 'Mengirim undangan',
  INVITATION_REVOCATION: 'Mencabut undangan',
  INVOICE_ISSUANCE: 'Menerbitkan invoice peserta',
};

/** Jenis key opaque untuk data pengelolaan rencana. */
export const PLAN_KEY_KINDS = {
  plan: 'gathering_plan',
  option: 'gathering_option',
  invitation: 'gathering_plan_invitation',
  registration: 'gathering_registration',
} as const;

/** Hanya tautan Google Maps https yang diteruskan ke template (gathering-option-location-plan L1). */
const GOOGLE_MAPS_URL = /^https:\/\/(?:maps\.app\.goo\.gl\/|goo\.gl\/maps\/|maps\.google\.[a-z]{2,3}(?:\.[a-z]{2})?\/|(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?\/maps(?:\/|\?|$))[^\s<>"']*$/i;

export function googleMapsUrl(value: unknown): string | undefined {
  const url = typeof value === 'string' ? value.trim() : '';
  return url.length <= 1000 && GOOGLE_MAPS_URL.test(url) ? url : undefined;
}

function statusLabel(status: string): string {
  return PLAN_STATUS_LABELS[status] ?? status.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

const CLOSED_PLAN_STATUSES = ['CANCELLED', 'IN_PROGRESS', 'COMPLETED'];

function isPublicInvitation(invitation: PlanInvitationInput): boolean {
  return !text(invitation.email) && !text(invitation.whatsapp);
}

function invitationExpired(invitation: PlanInvitationInput, now: Date): boolean {
  if (invitation.status === 'EXPIRED') return true;
  const expiresAt = invitation.expires_at ? Date.parse(invitation.expires_at) : Number.NaN;
  return invitation.status === 'PENDING' && Number.isFinite(expiresAt) && expiresAt <= now.getTime();
}

/** Aturan tahap — sama dengan alur bawaan Bagdja (components/gathering-workflow-steps.tsx). */
export function gatheringPlanRules(plan: Pick<GatheringPlanInput, 'status' | 'workflow_step'>) {
  return {
    planStep: plan.workflow_step === 'PLAN',
    invitationStep: plan.workflow_step === 'INVITATIONS',
    confirmationStep: plan.workflow_step === 'INVITATION_CONFIRMATION',
    paymentPhase: plan.workflow_step === 'PAYMENT_CONFIRMATION' && plan.status === 'PAYMENT_OPEN',
    canCancel: !CLOSED_PLAN_STATUSES.includes(plan.status),
  };
}

export function registrationRules(
  registration: PlanRegistrationInput,
  rules: ReturnType<typeof gatheringPlanRules>,
) {
  const confirmed = registration.registration_status === 'RSVP_CONFIRMED';
  return {
    canReject: rules.confirmationStep && confirmed && registration.payment_status === 'UNPAID' && !registration.order_id,
    canCheckout: rules.paymentPhase && confirmed && registration.payment_status === 'UNPAID' && toMoney(registration.invoice_amount) > 0,
    canCancelCheckout: rules.paymentPhase && confirmed && registration.payment_status === 'PENDING_PAYMENT' && Boolean(registration.order_id),
    canRefund: rules.paymentPhase && confirmed && registration.payment_status === 'PAID',
    outstanding: confirmed && !['PAID', 'REFUNDED'].includes(registration.payment_status),
  };
}

function registrationLabel(registration: PlanRegistrationInput): string {
  if (registration.registration_status === 'REJECTED') return 'Ditolak';
  if (registration.registration_status === 'CANCELLED') return 'Dibatalkan';
  switch (registration.payment_status) {
    case 'PAID': return 'Hadir · lunas';
    case 'PENDING_PAYMENT': return 'Hadir · menunggu pembayaran';
    case 'REFUNDED': return 'Dana dikembalikan';
    default: return 'Hadir · belum dibayar';
  }
}

function invitationStatus(invitation: PlanInvitationInput, now: Date): 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED' {
  if (invitation.status === 'ACCEPTED') return 'ACCEPTED';
  if (invitation.status === 'REVOKED') return 'REVOKED';
  return invitationExpired(invitation, now) ? 'EXPIRED' : 'PENDING';
}

export function buildGatheringPlanPage(
  plan: GatheringPlanInput,
  invitations: PlanInvitationInput[],
  options: {
    key: PageKeyFactory;
    viewerRole: 'initiator' | 'invitee' | 'guest';
    basePath?: string;
    registrations?: PlanRegistrationInput[];
    operation?: PlanOperationInput | null;
    now?: Date;
    /** Origin publik halaman tenant (mis. https://toko.bagdja.id) — untuk tautan/QR undangan terbuka. */
    origin?: string;
  },
) {
  const occurrence = plan.occurrence;
  const now = options.now ?? new Date();
  const basePath = options.basePath ?? '';
  const initiator = options.viewerRole === 'initiator';
  const rules = gatheringPlanRules(plan);
  const registrations = (options.registrations ?? []).slice(0, MAX_ROWS);
  const votesFor = (optionId: string) => {
    for (const group of Object.values(occurrence.voting_results ?? {})) {
      const votes = group?.options?.[optionId]?.votes;
      if (typeof votes === 'number') return votes;
    }
    return undefined;
  };
  const inviteHrefOf = (invitation: PlanInvitationInput) =>
    isPublicInvitation(invitation)
      ? `${basePath}/gathering/invite/${encodeURIComponent(invitation.id)}`
      : `${basePath}/gathering/invite/id/${encodeURIComponent(invitation.id)}`;

  const invitationRows = invitations.slice(0, MAX_ROWS).map((invitation) => {
    const status = invitationStatus(invitation, now);
    const isPublic = isPublicInvitation(invitation);
    const channel = isPublic
      ? 'public' as const
      : text(invitation.email) && text(invitation.whatsapp)
        ? 'email_whatsapp' as const
        : text(invitation.email) ? 'email' as const : 'whatsapp' as const;
    const statusText = {
      PENDING: isPublic ? 'Aktif' : 'Menunggu jawaban',
      ACCEPTED: 'Diterima',
      REVOKED: 'Dicabut',
      EXPIRED: 'Kedaluwarsa',
    }[status];
    return compact({
      key: options.key(PLAN_KEY_KINDS.invitation, invitation.id),
      name: text(invitation.invitee_name, isPublic ? 'Undangan terbuka' : 'Peserta'),
      status,
      statusLabel: statusText,
      channel,
      inviteHref: initiator && (status === 'PENDING' || status === 'ACCEPTED') ? inviteHrefOf(invitation) : undefined,
      canRevoke: initiator && rules.invitationStep && !isPublic && status === 'PENDING',
    });
  });
  const publicInvitation = invitations.find((invitation) =>
    isPublicInvitation(invitation) && invitationStatus(invitation, now) === 'PENDING');

  const registrationRows = registrations.map((registration) => {
    const allowed = registrationRules(registration, rules);
    return compact({
      key: options.key(PLAN_KEY_KINDS.registration, registration.id),
      name: text(registration.attendee_name, 'Peserta'),
      registrationStatus: registration.registration_status,
      paymentStatus: registration.payment_status,
      statusLabel: registrationLabel(registration),
      invoiceAmount: registration.invoice_amount === undefined || registration.invoice_amount === null
        ? undefined
        : toMoney(registration.invoice_amount),
      selectedOptions: (registration.selected_option_details ?? [])
        .map((detail) => [text(detail.option_group_key), text(detail.label)].filter(Boolean).join(' · '))
        .filter(Boolean),
      rejectionMessage: text(registration.rejection_message) || undefined,
      canReject: initiator && allowed.canReject,
      canCheckout: initiator && allowed.canCheckout,
      canCancelCheckout: initiator && allowed.canCancelCheckout,
      canRefund: initiator && allowed.canRefund,
    });
  });

  const operation = options.operation && ['QUEUED', 'RUNNING', 'FAILED'].includes(options.operation.status)
    && OPERATION_LABELS[options.operation.kind]
    ? compact({
      kind: options.operation.kind,
      status: options.operation.status,
      label: OPERATION_LABELS[options.operation.kind],
      processedCount: Math.max(0, Math.round(Number(options.operation.processed_count) || 0)),
      totalCount: Math.max(0, Math.round(Number(options.operation.total_count) || 0)),
      failedCount: Math.max(0, Math.round(Number(options.operation.failed_count) || 0)),
      message: text(options.operation.error_message) || undefined,
    })
    : undefined;
  const operationBusy = operation ? ['QUEUED', 'RUNNING'].includes(operation.status) : false;
  // Lokasi final = pilihan final yang punya data lokasi (final_location bila ada tetap diutamakan).
  const finalVenue = (occurrence.option_groups_snapshot ?? [])
    .find((option) => option.is_final_selection === true && (option.venue_location || option.venue_address || option.venue_map_url));

  const actions: string[] = ['gathering.respond'];
  if (initiator) {
    // Diskusikan tersedia di setiap tahap (termasuk ringkasan baca saja) selama rencana punya order initiator.
    if (text(plan.order_id)) actions.push('gathering.chat.open');
    if (rules.planStep) actions.push('gathering.plan.save');
    if (rules.invitationStep) {
      actions.push('gathering.invitation.content.save');
      if (plan.invite_policy === 'INVITE_ONLY') actions.push('gathering.invitation.add');
      if (invitationRows.some((row) => row.canRevoke)) actions.push('gathering.invitation.revoke');
      if (!operationBusy) actions.push('gathering.invitations.submit');
    }
    if (rules.confirmationStep) {
      if (registrationRows.some((row) => row.canReject)) actions.push('gathering.registrations.reject');
      actions.push('gathering.reservations.confirm');
    }
    if (rules.paymentPhase) {
      if (registrationRows.some((row) => row.canCheckout)) actions.push('gathering.registrations.checkout');
      if (registrationRows.some((row) => row.canCancelCheckout)) actions.push('gathering.registration.cancel_checkout');
      if (registrationRows.some((row) => row.canRefund)) actions.push('gathering.registration.refund');
      if (!operationBusy && registrations.some((row) => registrationRules(row, rules).outstanding)) {
        actions.push('gathering.invoices.resend');
      }
      actions.push('gathering.event.confirm');
    }
    if (rules.canCancel) actions.push('gathering.cancel');
  }

  return {
    ...base(),
    contractVersion: 2 as const,
    type: 'gathering_plan' as const,
    plan: compact({
      key: options.key(PLAN_KEY_KINDS.plan, plan.id),
      planNumber: text(plan.plan_number),
      title: text(plan.title, 'Rencana gathering'),
      status: plan.status,
      statusLabel: statusLabel(plan.status),
      workflowStep: plan.workflow_step,
      workflowStepLabel: STEP_LABELS[plan.workflow_step] ?? plan.workflow_step,
      invitePolicy: plan.invite_policy === 'OPEN' ? 'OPEN' as const : 'INVITE_ONLY' as const,
      invitationBannerUrl: httpsUrl(plan.invitation_banner_url),
      // Teks polos untuk semua template + HTML ringan tersanitasi (editor) untuk yang mendukung.
      invitationDescription: richTextToPlainText(plan.invitation_description) || undefined,
      invitationDescriptionHtml: richTextHtml(plan.invitation_description),
      canCancel: initiator && rules.canCancel,
      publicInvitationHref: initiator && plan.invite_policy === 'OPEN' && publicInvitation
        ? inviteHrefOf(publicInvitation)
        : undefined,
      publicInvitationUrl: initiator && plan.invite_policy === 'OPEN' && publicInvitation
        ? absoluteTenantUrl(options.origin, inviteHrefOf(publicInvitation))
        : undefined,
      occurrence: compact({
        status: occurrence.status,
        statusLabel: statusLabel(occurrence.status),
        seatPrice: toMoney(occurrence.price_per_seat),
        depositPerSeatAmount: occurrence.deposit_amount_per_seat === undefined ? undefined : toMoney(occurrence.deposit_amount_per_seat),
        minAttendees: occurrence.min_attendees,
        maxAttendees: occurrence.max_attendees,
        rsvpCloseAt: toIsoDateTime(occurrence.rsvp_close_at),
        paymentDueAt: toIsoDateTime(occurrence.payment_deadline),
        scheduledAt: toIsoDateTime(occurrence.final_schedule),
        location: text(occurrence.final_location) || text(finalVenue?.venue_location) || undefined,
        locationAddress: text(finalVenue?.venue_address) || undefined,
        locationMapUrl: googleMapsUrl(finalVenue?.venue_map_url),
        options: (occurrence.option_groups_snapshot ?? []).slice(0, MAX_ROWS).map((option) =>
          compact({
            key: options.key(PLAN_KEY_KINDS.option, option.product_option_id),
            group: text(option.option_group_key, 'Opsi'),
            label: text(option.label, 'Opsi'),
            description: richTextToPlainText(option.description) || undefined,
            descriptionHtml: richTextHtml(option.description),
            venue: option.venue_location ?? undefined,
            address: text(option.venue_address) || undefined,
            mapUrl: googleMapsUrl(option.venue_map_url),
            imageUrl: httpsUrl(Array.isArray(option.images) ? option.images[0] : undefined),
            images: httpsImages(option.images, 5).length ? httpsImages(option.images, 5) : undefined,
            isOpen: (occurrence.opened_option_ids_snapshot ?? []).includes(option.product_option_id),
            isFinal: option.is_final_selection === true,
            votes: votesFor(option.product_option_id),
          }),
        ),
      }),
    }),
    // v1 — Keputusan E3: nama + status saja, tanpa email/WhatsApp. Undangan terbuka tidak dihitung.
    invitees: invitations.filter((invitation) => !isPublicInvitation(invitation)).slice(0, MAX_ROWS).map((invitation) => {
      const rsvpStatus = invitation.status === 'ACCEPTED'
        ? 'ACCEPTED' as const
        : invitation.status === 'PENDING'
          ? 'PENDING' as const
          : 'DECLINED' as const;
      return { name: text(invitation.invitee_name, 'Peserta'), rsvpStatus, rsvpLabel: RSVP_LABELS[rsvpStatus] };
    }),
    invitations: invitationRows,
    registrations: registrationRows,
    ...(operation ? { operation } : {}),
    viewerRole: options.viewerRole,
    actions,
  };
}

// ── Keranjang ─────────────────────────────────────────────────────────────

export interface CartOrderInput {
  id: string;
  product?: {
    name?: string;
    type?: string;
    description?: string | null;
    images?: string[];
    metadata?: { variant_attributes?: Record<string, string> };
    quotable?: boolean;
  };
  quantity: number;
  unit_price: number | string;
  quoted_total_amount: number | string | null;
  praorderProgress?: { steps: { completed: boolean }[] } | null;
  metadata?: { gathering?: { role?: string; group_id?: string } } | null;
}

export interface CartPlanInput {
  order_id: string | null;
  title: string;
  occurrence?: { final_schedule?: string | null } | null;
}

/** Sama dengan checkoutBlockedReason di components/cart-content.tsx. */
export function cartBlockedReason(order: CartOrderInput): string | null {
  if (order.metadata?.gathering?.role === 'initiator') return 'Rencana gathering belum masuk tahap pembayaran';
  const quoted = order.quoted_total_amount != null;
  if (order.product?.quotable && !quoted) return 'Menunggu penawaran';
  if (order.product?.quotable && order.praorderProgress?.steps?.some((step) => !step.completed)) {
    return 'Lengkapi data praorder dulu';
  }
  if (toMoney(order.unit_price) <= 0 && !quoted) return 'Harga belum tersedia';
  return null;
}

export const CART_KEY_KIND = 'cart_order';

export function buildCartPage(
  orders: CartOrderInput[],
  plans: CartPlanInput[],
  options: { basePath: string; key: PageKeyFactory },
) {
  const planByOrder = new Map(plans.filter((plan) => plan.order_id).map((plan) => [plan.order_id as string, plan]));
  return {
    ...base(),
    type: 'cart' as const,
    items: orders.slice(0, MAX_ROWS).map((order) => {
      const isPlan = order.metadata?.gathering?.role === 'initiator';
      const isSeat = !isPlan && Boolean(order.metadata?.gathering?.group_id);
      const isDigital = order.product?.type === 'digital';
      const quantity = isDigital ? 1 : Math.max(1, Math.round(order.quantity || 1));
      const quoted = order.quoted_total_amount != null ? toMoney(order.quoted_total_amount) : null;
      const blockedReason = cartBlockedReason(order);
      const plan = planByOrder.get(order.id);
      const variant = Object.values(order.product?.metadata?.variant_attributes ?? {}).filter(Boolean).join(' · ');
      return compact({
        key: options.key(CART_KEY_KIND, order.id),
        kind: isPlan ? 'gathering_plan' as const : isSeat ? 'seat' as const : isDigital ? 'digital' as const : order.product?.type === 'service' ? 'service' as const : 'product' as const,
        name: text(isPlan ? plan?.title : order.product?.name, isPlan ? 'Rencana gathering' : 'Produk'),
        subtitle: isPlan
          ? (plan?.occurrence?.final_schedule ? undefined : 'Jadwal belum ditentukan')
          : text(order.product?.description).slice(0, 160) || undefined,
        variant: variant || undefined,
        imageUrl: order.product?.images?.[0],
        unitPrice: quoted !== null ? Math.round(quoted / quantity) : toMoney(order.unit_price),
        quantity,
        quantityEditable: !isPlan && !isDigital,
        maxQuantity: isDigital ? 1 : undefined,
        checkoutable: blockedReason === null,
        blockedReason: blockedReason ?? undefined,
        detailHref: `${options.basePath}/cart/order/${encodeURIComponent(order.id)}`,
      });
    }),
    actions: ['cart.set_quantity', 'cart.remove', 'cart.checkout'] as const,
  };
}

// ── Eksekusi intent (P2) ──────────────────────────────────────────────────

/** Unggah multipart (banner undangan) ke backend dengan sesi yang sama. */
export type IntentUpload = (path: string, form: FormData) => Promise<{ data: unknown; status: number; error?: string }>;

export type IntentFetch = (
  path: string,
  init?: { method?: string; body?: string; headers?: Record<string, string> },
) => Promise<{ data: unknown; status: number; error?: string }>;

/** Isian form rencana (kontrak `GatheringPlanForm`). */
export interface GatheringPlanFormInput {
  title?: string;
  invitePolicy?: 'OPEN' | 'INVITE_ONLY';
  optionKeys?: string[];
  rsvpCloseAt?: string;
  paymentDueAt?: string;
  scheduledAt?: string;
}

export interface TemplateIntentInput {
  action: string;
  key?: string;
  keys?: string[];
  quantity?: number;
  response?: 'ACCEPTED' | 'DECLINED';
  /** Item di dalam halaman (undangan/registrasi) — `key` = rencana. */
  target?: string;
  submit?: boolean;
  plan?: GatheringPlanFormInput;
  invitee?: { name?: string; email?: string; whatsapp?: string };
  /** gathering.invitation.content.save — deskripsi ('' = hapus) & hapus banner. */
  invitationContent?: { description: string; removeBanner?: boolean };
  /** gathering.invitation.content.save — banner baru (sudah divalidasi route: gambar ≤ 5 MB). */
  bannerFile?: Blob;
  message?: string;
  reason?: string;
  /** gathering.invitation.rsvp — kontak (email) hanya untuk undangan terbuka. */
  rsvp?: { attendeeName?: string; contact?: string; whatsapp?: string; optionKeys?: string[] };
  /** gathering.invitation.verify_otp — kode 6 digit. */
  code?: string;
}

export interface TemplateIntentResult {
  status: number;
  body: { ok: boolean; redirect?: string; message?: string };
  /** Cookie httpOnly yang diterapkan route (status tamu undangan); `value: null` = hapus. */
  cookie?: { name: string; value: string | null; maxAge: number };
}

/** Halaman yang boleh mengirim tiap intent (template harus menyatakan halaman itu di manifest). */
export const INTENT_PAGES: Record<string, readonly string[]> = {
  'cart.set_quantity': ['cart'],
  'cart.remove': ['cart'],
  'cart.checkout': ['cart'],
  'transaction.chat.open': ['orders'],
  'invoice.pay': ['tagihan', 'invoice_detail'],
  'gathering.respond': ['calendar', 'gathering_plan'],
  'gathering.chat.open': ['gathering_plan'],
  'gathering.plan.save': ['gathering_plan'],
  'gathering.invitation.add': ['gathering_plan'],
  'gathering.invitation.revoke': ['gathering_plan'],
  'gathering.invitation.content.save': ['gathering_plan'],
  'gathering.invitations.submit': ['gathering_plan'],
  'gathering.registrations.reject': ['gathering_plan'],
  'gathering.reservations.confirm': ['gathering_plan'],
  'gathering.registrations.checkout': ['gathering_plan'],
  'gathering.registration.cancel_checkout': ['gathering_plan'],
  'gathering.registration.refund': ['gathering_plan'],
  'gathering.invoices.resend': ['gathering_plan'],
  'gathering.event.confirm': ['gathering_plan'],
  'gathering.cancel': ['gathering_plan'],
  'gathering.plan.create': ['product_detail'],
  'gathering.invitation.rsvp': ['gathering_invitation'],
  'gathering.invitation.verify_otp': ['gathering_invitation'],
  'gathering.invitation.resend_otp': ['gathering_invitation'],
  'gathering.invitation.pay': ['gathering_invitation'],
  'product.chat.open': ['product_detail'],
};

function fail(status: number, message: string): TemplateIntentResult {
  return { status, body: { ok: false, message } };
}

function messageOf(data: unknown, fallback: string, error?: string): string {
  if (data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string') {
    return (data as { message: string }).message;
  }
  // backendFetch menaruh body galat mentah di `error` (sering berupa JSON `{ message }`).
  if (typeof error === 'string' && error.trim()) {
    try {
      const parsed = JSON.parse(error) as { message?: unknown };
      const message = Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
      if (typeof message === 'string' && message.trim()) return message;
    } catch {
      if (error.length <= 200 && !error.trim().startsWith('<')) return error;
    }
  }
  return fallback;
}

function checkoutUrlOf(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as { checkout_url?: unknown; checkoutUrl?: unknown };
  const url = typeof record.checkout_url === 'string' ? record.checkout_url : typeof record.checkoutUrl === 'string' ? record.checkoutUrl : null;
  return url && /^https?:\/\//.test(url) ? url : null;
}

export interface IntentContext {
  pageType: string;
  websiteId: string;
  basePath: string;
  key: PageKeyFactory;
  fetch: IntentFetch;
  /** Wajib untuk gathering.invitation.content.save yang membawa banner. */
  upload?: IntentUpload;
  /** Origin halaman (untuk URL kembali pembayaran kolektif). */
  origin?: string;
  /** Key publik (PUBLIC_PAGE_KEY_SCOPE) — dipakai halaman detail produk yang di-cache untuk semua pengunjung. */
  publicKey?: PageKeyFactory;
  /** Halaman undangan: token dari path halaman (diverifikasi terhadap key intent). */
  invitationToken?: string;
  /** Status tamu undangan terbuka (cookie). */
  invitationGuest?: InvitationGuestState;
  /** Fetch Website API tanpa sesi (endpoint publik undangan). */
  publicFetch?: IntentFetch;
  /** Produk website (dari loader tenant) — dipetakan ulang dari key untuk aksi halaman detail produk. */
  products?: Array<Pick<ProductDetailInput, 'id' | 'type' | 'name' | 'slug' | 'priceLabel' | 'image' | 'images'>>;
}

/** Intent halaman undangan gathering. Undangan terbuka: RSVP/OTP tanpa login (status di cookie). */
async function executeInvitationIntent(intent: TemplateIntentInput, context: IntentContext): Promise<TemplateIntentResult> {
  const token = context.invitationToken;
  const publicKey = context.publicKey;
  const publicFetch = context.publicFetch;
  if (!token || !publicKey || !publicFetch || intent.key !== publicKey('gathering_invitation', token)) {
    return fail(409, 'Undangan tidak dikenali. Muat ulang halaman.');
  }
  const tokenPath = `/api/public/gathering-invitations/${encodeURIComponent(token)}`;
  const loaded = await publicFetch(tokenPath);
  if (loaded.status >= 400 || !loaded.data) return fail(loaded.status === 404 ? 404 : 502, messageOf(loaded.data, 'Undangan tidak valid atau sudah kedaluwarsa.', loaded.error));
  const preview = loaded.data as InvitationPreviewInput;
  const policy = preview.group.invite_policy === 'INVITE_ONLY' ? 'INVITE_ONLY' : 'OPEN';
  const guest = context.invitationGuest ?? {};
  const cookieName = invitationCookieName(token);
  const withCookie = (result: TemplateIntentResult, state: InvitationGuestState | null): TemplateIntentResult => ({
    ...result,
    cookie: { name: cookieName, value: state ? encodeInvitationGuestState(state) : null, maxAge: INVITATION_COOKIE_MAX_AGE },
  });
  const ok = (redirect?: string): TemplateIntentResult => ({ status: 200, body: redirect ? { ok: true, redirect } : { ok: true } });

  if (intent.action === 'gathering.invitation.rsvp') {
    const rsvp = intent.rsvp ?? {};
    const optionById = new Map((preview.occurrence.options ?? []).map((option) => [option.product_option_id, option]));
    const selected: Record<string, string> = {};
    for (const optionKey of rsvp.optionKeys ?? []) {
      const option = (preview.occurrence.options ?? []).find((row) => publicKey('gathering_invitation_option', row.product_option_id) === optionKey);
      if (!option || !optionById.has(option.product_option_id)) return fail(409, 'Pilihan berubah. Muat ulang halaman.');
      selected[text(option.option_group_key, 'Pilihan')] = option.product_option_id;
    }
    if (policy === 'INVITE_ONLY') {
      const created = await context.fetch(`${tokenPath}/private-rsvp`, {
        method: 'POST',
        body: JSON.stringify({
          ...(text(rsvp.attendeeName) ? { attendee_name: text(rsvp.attendeeName) } : {}),
          ...(text(rsvp.whatsapp) ? { whatsapp: text(rsvp.whatsapp) } : {}),
          selected_options: selected,
        }),
      });
      if (created.status === 401) return fail(401, 'Login diperlukan.');
      if (created.status >= 400) return fail(created.status >= 500 ? 502 : 422, messageOf(created.data, 'RSVP gagal dikirim.', created.error));
      return ok();
    }
    const attendeeName = text(rsvp.attendeeName);
    const contact = text(rsvp.contact).toLowerCase();
    if (!attendeeName || !contact) return fail(422, 'Isi nama peserta dan email.');
    const reserved = await publicFetch(`${tokenPath}/rsvp`, {
      method: 'POST',
      body: JSON.stringify({
        attendee_name: attendeeName,
        email: contact,
        ...(text(rsvp.whatsapp) ? { whatsapp: text(rsvp.whatsapp) } : {}),
        selected_options: selected,
      }),
    });
    const payload = reserved.data as { reservation_id?: unknown; expires_at?: unknown } | null;
    if (reserved.status >= 400 || typeof payload?.reservation_id !== 'string') {
      return fail(reserved.status >= 500 ? 502 : 422, messageOf(reserved.data, 'Reservasi tidak dapat disiapkan.', reserved.error));
    }
    return withCookie(ok(), {
      ...guest,
      pending: {
        reservationId: payload.reservation_id,
        contact,
        name: attendeeName,
        ...(text(rsvp.whatsapp) ? { whatsapp: text(rsvp.whatsapp) } : {}),
        options: selected,
        ...(typeof payload.expires_at === 'string' ? { expiresAt: payload.expires_at } : {}),
      },
    });
  }

  if (intent.action === 'gathering.invitation.verify_otp' || intent.action === 'gathering.invitation.resend_otp') {
    const pending = guest.pending;
    if (policy !== 'OPEN' || !pending?.reservationId) return fail(409, 'Tidak ada reservasi yang menunggu verifikasi. Muat ulang halaman.');
    if (intent.action === 'gathering.invitation.resend_otp') {
      const resent = await publicFetch(`${tokenPath}/rsvp`, {
        method: 'POST',
        body: JSON.stringify({
          attendee_name: pending.name,
          email: pending.contact,
          ...(pending.whatsapp ? { whatsapp: pending.whatsapp } : {}),
          selected_options: pending.options,
        }),
      });
      const payload = resent.data as { reservation_id?: unknown; expires_at?: unknown } | null;
      if (resent.status >= 400 || typeof payload?.reservation_id !== 'string') {
        return fail(resent.status >= 500 ? 502 : 422, messageOf(resent.data, 'Kode baru belum dapat dikirim.', resent.error));
      }
      return withCookie(ok(), {
        ...guest,
        pending: { ...pending, reservationId: payload.reservation_id, ...(typeof payload.expires_at === 'string' ? { expiresAt: payload.expires_at } : {}) },
      });
    }
    const code = text(intent.code);
    if (!/^\d{6}$/.test(code)) return fail(422, 'Masukkan kode 6 digit.');
    const verified = await publicFetch(`${tokenPath}/verify-otp`, {
      method: 'POST',
      body: JSON.stringify({ reservation_id: pending.reservationId, code }),
    });
    const payload = verified.data as { id?: unknown; selected_options?: unknown } | null;
    if (verified.status >= 400 || typeof payload?.id !== 'string') {
      return fail(verified.status >= 500 ? 502 : 422, messageOf(verified.data, 'Kode verifikasi tidak valid.', verified.error));
    }
    const selectedOptions = payload.selected_options && typeof payload.selected_options === 'object'
      ? payload.selected_options as Record<string, string>
      : pending.options;
    return withCookie(ok(), {
      registrationId: payload.id,
      selectedOptions,
      attendee: {
        name: pending.name,
        ...(maskContact(pending.contact) ? { contactMasked: maskContact(pending.contact) } : {}),
        ...(maskPhone(pending.whatsapp) ? { phoneMasked: maskPhone(pending.whatsapp) } : {}),
      },
    });
  }

  // gathering.invitation.pay — selalu lewat seat-order (sesi bayar lama bisa kedaluwarsa), butuh login.
  let registrationId = policy === 'OPEN' ? guest.registrationId : undefined;
  if (policy === 'INVITE_ONLY') {
    const status = await context.fetch(`${tokenPath}/private-status`);
    if (status.status === 401) return fail(401, 'Login diperlukan.');
    registrationId = (status.data as InvitationPrivateStatusInput | null)?.registration?.id;
  }
  if (!registrationId) return fail(409, 'Belum ada RSVP untuk dibayar. Muat ulang halaman.');
  const order = await context.fetch(`/api/gathering/registrations/${encodeURIComponent(registrationId)}/seat-order`, { method: 'POST' });
  if (order.status === 401) return fail(401, 'Login diperlukan.');
  const seatOrder = order.data as { id?: unknown; checkout_url?: unknown } | null;
  if (order.status >= 400 || typeof seatOrder?.id !== 'string') return fail(order.status >= 500 ? 502 : 422, messageOf(order.data, 'Gagal menyiapkan order seat.', order.error));
  const directCheckout = checkoutUrlOf(order.data);
  if (directCheckout) return ok(directCheckout);
  const checkout = await context.fetch('/api/transactions/checkout', { method: 'POST', body: JSON.stringify({ order_ids: [seatOrder.id] }) });
  if (checkout.status === 401) return fail(401, 'Login diperlukan.');
  const checkoutUrl = checkoutUrlOf(checkout.data);
  return checkoutUrl ? ok(checkoutUrl) : fail(checkout.status >= 500 ? 502 : 422, messageOf(checkout.data, 'Checkout pembayaran tidak berhasil disiapkan.', checkout.error));
}

const CHAT_REFERENCE_PREFIX = '__BAGDJA_CHAT_REFERENCE__';

async function executeProductIntent(intent: TemplateIntentInput, context: IntentContext): Promise<TemplateIntentResult> {
  const product = intent.key
    ? (context.products ?? []).find((item) => (context.publicKey ?? context.key)('product', item.id) === intent.key)
    : undefined;
  if (!product) return fail(409, 'Produk tidak ditemukan. Muat ulang halaman.');

  if (intent.action === 'gathering.plan.create') {
    if (product.type !== 'gathering') return fail(422, 'Produk ini bukan gathering.');
    const created = await context.fetch('/api/gathering/plans', {
      method: 'POST',
      body: JSON.stringify({ website_id: context.websiteId, product_id: product.id }),
    });
    if (created.status === 401) return fail(401, 'Login diperlukan.');
    if (created.status >= 400) {
      return fail(created.status >= 500 ? 502 : 422, messageOf(created.data, 'Rencana gathering belum dapat dibuat.', created.error));
    }
    const payload = (created.data as { data?: unknown } | null)?.data ?? created.data;
    const orderId = (payload as { order_id?: unknown } | null)?.order_id;
    if (typeof orderId !== 'string' || !orderId.trim()) return fail(502, 'Rencana dibuat, tetapi responsnya tidak memuat ID pesanan.');
    return { status: 200, body: { ok: true, redirect: `${context.basePath}/cart/order/${encodeURIComponent(orderId)}` } };
  }

  // product.chat.open — sama dengan ChatReferenceButton (kartu referensi produk di pesan pertama).
  const reference = {
    type: 'product',
    id: product.id,
    title: product.name,
    imageUrl: product.image ?? product.images?.[0] ?? null,
    meta: product.priceLabel || null,
    href: `${context.basePath}/products/${encodeURIComponent(product.slug || product.id)}`,
  };
  const created = await context.fetch(`/api/chat/${encodeURIComponent(context.websiteId)}/customer-threads`, {
    method: 'POST',
    body: JSON.stringify({
      channel_type: 'product',
      channel_label: product.name,
      product_id: product.id,
      initial_message: `${CHAT_REFERENCE_PREFIX}${JSON.stringify(reference)}`,
    }),
  });
  if (created.status === 401) return fail(401, 'Login diperlukan.');
  if (created.status >= 400) {
    return fail(created.status >= 500 ? 502 : 422, messageOf(created.data, 'Kanal chat untuk produk ini belum dapat dibuat.', created.error));
  }
  const thread = ((created.data as { data?: unknown } | null)?.data ?? created.data) as { id?: unknown } | null;
  if (typeof thread?.id !== 'string' || !thread.id.trim()) {
    return fail(502, 'Kanal chat berhasil diminta, tetapi responsnya tidak memuat ID percakapan.');
  }
  const href = tenantPath(context.basePath, `/chat?thread=${encodeURIComponent(thread.id)}`);
  return href ? { status: 200, body: { ok: true, redirect: href } } : fail(422, 'Tautan chat tidak dapat dibuat untuk halaman tenant ini.');
}

/**
 * Jalankan intent untuk sesi pembeli saat ini. `key` dipetakan balik dengan
 * menghitung ulang key atas data milik sesi yang sama (dimuat ulang dari API),
 * sehingga template tidak bisa menargetkan data milik orang lain.
 */
export async function executeTemplateIntent(
  intent: TemplateIntentInput,
  context: IntentContext,
): Promise<TemplateIntentResult> {
  if (!INTENT_PAGES[intent.action]?.includes(context.pageType)) {
    return fail(403, 'Aksi ini tidak tersedia di halaman ini.');
  }
  if (intent.action === 'gathering.plan.create' || intent.action === 'product.chat.open') {
    return executeProductIntent(intent, context);
  }
  if (intent.action.startsWith('gathering.invitation.') && INTENT_PAGES[intent.action]?.includes('gathering_invitation')) {
    return executeInvitationIntent(intent, context);
  }
  if (intent.action.startsWith('gathering.') && intent.action !== 'gathering.respond') {
    return executeGatheringPlanIntent(intent, context);
  }
  const query = `website_id=${encodeURIComponent(context.websiteId)}`;
  const load = async (path: string) => {
    const result = await context.fetch(path);
    if (result.status === 401) return { unauthenticated: true as const };
    if (result.status >= 400) return { error: messageOf(result.data, 'Data belum dapat dimuat.') };
    return { rows: Array.isArray(result.data)
      ? result.data
      : Array.isArray((result.data as { data?: unknown } | null)?.data) ? (result.data as { data: unknown[] }).data : [] };
  };

  if (intent.action === 'transaction.chat.open') {
    if (!intent.key) return fail(400, 'Transaksi tidak dikenali.');
    const loaded = await load(`/api/transactions?size=100&${query}`);
    if ('unauthenticated' in loaded) return fail(401, 'Login diperlukan.');
    if ('error' in loaded) return fail(502, loaded.error ?? 'Transaksi belum dapat dimuat.');
    const transaction = (loaded.rows as TransactionRowInput[])
      .find((row) => context.key('transaction', row.id) === intent.key);
    if (!transaction) return fail(409, 'Transaksi tidak ditemukan untuk akun ini. Muat ulang halaman.');

    const reference = text(transaction.ref_number, `#${transaction.id.slice(0, 8).toUpperCase()}`);
    const created = await context.fetch(`/api/chat/${encodeURIComponent(context.websiteId)}/customer-threads`, {
      method: 'POST',
      body: JSON.stringify({
        channel_type: 'transaction',
        channel_label: `TRX ${reference}`,
        transaction_id: transaction.id,
        initial_message: `Halo, saya ingin berdiskusi tentang transaksi ${reference}.`,
      }),
    });
    if (created.status === 401) return fail(401, 'Login diperlukan.');
    if (created.status >= 400) {
      return fail(created.status >= 500 ? 502 : 422, messageOf(created.data, 'Kanal chat untuk transaksi ini belum dapat dibuat.', created.error));
    }
    const response = created.data as { data?: unknown } | null;
    const thread = (response?.data ?? created.data) as { id?: unknown } | null;
    if (typeof thread?.id !== 'string' || !thread.id.trim()) {
      return fail(502, 'Kanal chat berhasil diminta, tetapi responsnya tidak memuat ID percakapan.');
    }
    const href = tenantPath(context.basePath, `/chat?thread=${encodeURIComponent(thread.id)}`);
    return href ? { status: 200, body: { ok: true, redirect: href } } : fail(422, 'Tautan chat tidak dapat dibuat untuk halaman tenant ini.');
  }

  if (intent.action.startsWith('cart.')) {
    const loaded = await load(`/api/orders?cart=true&${query}`);
    if ('unauthenticated' in loaded) return fail(401, 'Login diperlukan.');
    if ('error' in loaded) return fail(502, loaded.error ?? 'Data belum dapat dimuat.');
    const orders = loaded.rows as CartOrderInput[];
    const byKey = new Map(orders.map((order) => [context.key(CART_KEY_KIND, order.id), order]));

    if (intent.action === 'cart.checkout') {
      const selected = (intent.keys ?? []).map((itemKey) => byKey.get(itemKey));
      if (selected.length === 0 || selected.some((order) => !order)) {
        return fail(409, 'Keranjang berubah. Muat ulang halaman lalu coba lagi.');
      }
      const blocked = selected.find((order) => cartBlockedReason(order!) !== null);
      if (blocked) return fail(409, `${text(blocked.product?.name, 'Item')}: ${cartBlockedReason(blocked) ?? 'belum bisa checkout'}`);
      const ids = selected.map((order) => order!.id).join(',');
      return { status: 200, body: { ok: true, redirect: `${context.basePath}/checkout?order_ids=${encodeURIComponent(ids)}` } };
    }

    const order = intent.key ? byKey.get(intent.key) : undefined;
    if (!order) return fail(409, 'Item tidak lagi ada di keranjang. Muat ulang halaman.');
    if (intent.action === 'cart.remove') {
      const removed = await context.fetch(`/api/orders/${encodeURIComponent(order.id)}`, { method: 'DELETE' });
      return removed.status < 400
        ? { status: 200, body: { ok: true } }
        : fail(removed.status === 401 ? 401 : 422, messageOf(removed.data, 'Gagal menghapus item.'));
    }
    if (order.metadata?.gathering?.role === 'initiator' || order.product?.type === 'digital') {
      return fail(409, 'Jumlah item ini tidak dapat diubah.');
    }
    const updated = await context.fetch(`/api/orders/${encodeURIComponent(order.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity: intent.quantity }),
    });
    return updated.status < 400
      ? { status: 200, body: { ok: true } }
      : fail(updated.status === 401 ? 401 : 422, messageOf(updated.data, 'Gagal mengubah jumlah item.'));
  }

  if (intent.action === 'invoice.pay') {
    const [termins, gathering] = await Promise.all([
      load(`/api/transactions/termins?size=100&${query}`),
      load(`/api/gathering/invoices?${query}`),
    ]);
    if ('unauthenticated' in termins || 'unauthenticated' in gathering) return fail(401, 'Login diperlukan untuk membayar.');
    const termin = 'rows' in termins
      ? (termins.rows as TerminRowInput[]).find((row) => context.key('termin', row.id) === intent.key)
      : undefined;
    if (termin) {
      if (termin.status !== 'ISSUED') return fail(409, 'Tagihan ini tidak sedang menunggu pembayaran.');
      const paid = await context.fetch(`/api/transactions/termins/${encodeURIComponent(termin.id)}/pay`, { method: 'POST' });
      const url = checkoutUrlOf(paid.data);
      if (paid.status >= 400 || !url) return fail(paid.status === 401 ? 401 : 422, messageOf(paid.data, 'Gagal memproses pembayaran tagihan.'));
      return { status: 200, body: { ok: true, redirect: url } };
    }
    const invoice = 'rows' in gathering
      ? (gathering.rows as GatheringInvoiceInput[]).find((row) => context.key('gathering_invoice', row.id) === intent.key)
      : undefined;
    if (!invoice) return fail(409, 'Tagihan tidak ditemukan untuk akun ini. Masuk dengan email yang dipakai saat RSVP.');
    if (!invoice.can_pay) return fail(409, 'Pembayaran tagihan ini belum dibuka.');
    const seat = await context.fetch(`/api/gathering/registrations/${encodeURIComponent(invoice.id)}/seat-order`, { method: 'POST' });
    const seatOrder = seat.data as { id?: string } | null;
    const seatUrl = checkoutUrlOf(seat.data);
    if (seat.status >= 400 || !seatOrder?.id) return fail(seat.status === 401 ? 401 : 422, messageOf(seat.data, 'Pembayaran belum dapat disiapkan.'));
    if (seatUrl) return { status: 200, body: { ok: true, redirect: seatUrl } };
    const checkout = await context.fetch('/api/transactions/checkout', {
      method: 'POST',
      body: JSON.stringify({ order_ids: [seatOrder.id] }),
    });
    const checkoutUrl = checkoutUrlOf(checkout.data);
    if (checkout.status >= 400 || !checkoutUrl) return fail(checkout.status === 401 ? 401 : 422, messageOf(checkout.data, 'Checkout belum dapat disiapkan.'));
    return { status: 200, body: { ok: true, redirect: checkoutUrl } };
  }

  // gathering.respond — RSVP tetap di halaman undangan milik Bagdja.
  if (context.pageType === 'calendar') {
    const loaded = await load(`/api/gathering/invitations/mine?${query}`);
    if ('unauthenticated' in loaded) return fail(401, 'Login diperlukan.');
    if ('error' in loaded) return fail(502, loaded.error ?? 'Data belum dapat dimuat.');
    const invitation = (loaded.rows as CalendarInvitationInput[])
      .find((row) => context.key('gathering_invitation', row.id) === intent.key);
    const href = invitation ? tenantPath(context.basePath, invitation.action_path) : undefined;
    if (!href) return fail(409, 'Undangan tidak ditemukan atau tidak memerlukan tanggapan.');
    return { status: 200, body: { ok: true, redirect: href } };
  }
  return fail(409, 'Tanggapan rencana gathering dikelola langsung di halaman ini.');
}

// ── Pengelolaan rencana gathering oleh initiator (kontrak v2) ─────────────

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * Isian tanggal template → ISO UTC untuk API. "YYYY-MM-DDTHH:mm" dibaca sebagai
 * waktu lokal zona halaman (Asia/Jakarta, +07:00); ISO ber-offset diterima apa adanya.
 */
export function planDateToIso(value: string | undefined): string | undefined | null {
  if (value === undefined || value === '') return undefined;
  const raw = value.trim();
  const local = LOCAL_DATE_TIME.exec(raw);
  const iso = local ? `${raw}:00${PAGE_OFFSET}` : raw;
  if (!local && !/(Z|[+-]\d{2}:\d{2})$/.test(raw)) return null;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

async function executeGatheringPlanIntent(
  intent: TemplateIntentInput,
  context: IntentContext,
): Promise<TemplateIntentResult> {
  const query = `website_id=${encodeURIComponent(context.websiteId)}`;
  type CallResult = { error: TemplateIntentResult } | { data: unknown };
  const call = async (
    path: string,
    init: { method: string; body?: unknown; headers?: Record<string, string> },
    fallback: string,
  ): Promise<CallResult> => {
    const result = await context.fetch(path, {
      method: init.method,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      ...(init.headers ? { headers: init.headers } : {}),
    });
    if (result.status === 401) return { error: fail(401, 'Login diperlukan.') };
    if (result.status >= 400) {
      return { error: fail(result.status >= 500 ? 502 : 422, messageOf(result.data, fallback, result.error)) };
    }
    return { data: result.data };
  };
  const rowsFrom = (data: unknown): unknown[] => Array.isArray(data)
    ? data
    : Array.isArray((data as { data?: unknown } | null)?.data) ? (data as { data: unknown[] }).data : [];

  // Rencana = milik sesi ini (daftar rencana initiator), dipetakan ulang dari key.
  if (!intent.key) return fail(400, 'Rencana tidak dikenali.');
  const plans = await call(`/api/gathering/plans?${query}`, { method: 'GET' }, 'Rencana belum dapat dimuat.');
  if ('error' in plans) return plans.error;
  const planRow = (rowsFrom(plans.data) as Array<{ id?: string }>)
    .find((row) => typeof row.id === 'string' && context.key(PLAN_KEY_KINDS.plan, row.id) === intent.key);
  if (!planRow?.id) return fail(409, 'Rencana tidak ditemukan untuk akun ini. Muat ulang halaman.');
  const planPath = `/api/gathering/plans/${encodeURIComponent(planRow.id)}`;
  const detail = await call(`${planPath}?${query}`, { method: 'GET' }, 'Rencana belum dapat dimuat.');
  if ('error' in detail) return detail.error;
  const plan = detail.data as GatheringPlanInput | null;
  if (!plan?.occurrence) return fail(409, 'Rencana belum dapat dimuat.');
  const rules = gatheringPlanRules(plan);
  const stale = (message: string) => fail(409, `${message} Muat ulang halaman untuk melihat tahap terbaru.`);
  const ok = (redirect?: string): TemplateIntentResult => ({ status: 200, body: redirect ? { ok: true, redirect } : { ok: true } });

  const loadRegistrations = async (): Promise<{ error: TemplateIntentResult } | { rows: PlanRegistrationInput[] }> => {
    const loaded = await call(`${planPath}/registrations?${query}`, { method: 'GET' }, 'Data peserta belum dapat dimuat.');
    return 'error' in loaded ? loaded : { rows: rowsFrom(loaded.data) as PlanRegistrationInput[] };
  };
  const registrationByKey = (rows: PlanRegistrationInput[], key: string | undefined) =>
    key ? rows.find((row) => context.key(PLAN_KEY_KINDS.registration, row.id) === key) : undefined;
  const optionByKey = new Map((plan.occurrence.option_groups_snapshot ?? [])
    .map((option) => [context.key(PLAN_KEY_KINDS.option, option.product_option_id), option]));

  /** Simpan banner/teks undangan (`intent.invitationContent` + `bannerFile`); `null` = berhasil. */
  const saveInvitationContent = async (): Promise<TemplateIntentResult | null> => {
    const content = intent.invitationContent;
    if (!content) return fail(422, 'Konten undangan tidak lengkap.');
    const description = text(content.description);
    if (description.length > INVITATION_DESCRIPTION_LIMIT) return fail(422, `Deskripsi undangan maksimal ${INVITATION_DESCRIPTION_LIMIT} karakter.`);
    let bannerUrl: string | null | undefined = content.removeBanner ? null : undefined;
    if (intent.bannerFile) {
      if (!context.upload) return fail(422, 'Unggah banner belum didukung di halaman ini.');
      const form = new FormData();
      form.append('file', intent.bannerFile, intent.bannerFile instanceof File ? intent.bannerFile.name : 'banner');
      const uploaded = await context.upload(`${planPath}/invitation-banner?${query}`, form);
      if (uploaded.status === 401) return fail(401, 'Login diperlukan.');
      const url = (uploaded.data as { url?: unknown } | null)?.url;
      if (uploaded.status >= 400 || typeof url !== 'string' || !url) {
        return fail(uploaded.status >= 500 ? 502 : 422, messageOf(uploaded.data, 'Gagal mengunggah banner undangan.', uploaded.error));
      }
      bannerUrl = url;
    }
    const saved = await call(`${planPath}/invitation-content?${query}`, {
      method: 'PATCH',
      body: {
        invitation_description: description || null,
        ...(bannerUrl !== undefined ? { invitation_banner_url: bannerUrl } : {}),
      },
    }, 'Gagal menyimpan tampilan undangan.');
    return 'error' in saved ? saved.error : null;
  };

  switch (intent.action) {
    case 'gathering.chat.open': {
      if (!text(plan.order_id)) {
        return stale('Chat hanya tersedia untuk rencana yang memiliki pesanan.');
      }
      // Endpoint pembeli Website API (bukan route renderer `/api/chat/threads`): penanya selalu
      // diperlakukan sebagai pembeli, termasuk staf/penguji yang memesan sendiri.
      const created = await call(`/api/chat/${encodeURIComponent(context.websiteId)}/customer-threads`, {
        method: 'POST',
        body: {
          channel_type: 'order',
          channel_label: `Rencana ${text(plan.plan_number, 'gathering')}`,
          order_id: plan.order_id,
          initial_message: `Halo, saya ingin berdiskusi tentang rencana ${text(plan.title, 'gathering')}.`,
        },
      }, 'Kanal chat untuk pesanan ini belum dapat dibuat.');
      if ('error' in created) return created.error;
      const response = created.data as { data?: unknown } | null;
      const thread = (response?.data ?? created.data) as { id?: unknown } | null;
      if (typeof thread?.id !== 'string' || !thread.id.trim()) {
        return fail(502, 'Kanal chat berhasil diminta, tetapi responsnya tidak memuat ID percakapan.');
      }
      const href = tenantPath(context.basePath, `/chat?thread=${encodeURIComponent(thread.id)}`);
      return href ? ok(href) : fail(422, 'Tautan chat tidak dapat dibuat untuk halaman tenant ini.');
    }
    case 'gathering.plan.save': {
      if (!rules.planStep) return stale('Rencana sudah melewati tahap pengaturan.');
      const form = intent.plan ?? {};
      const title = text(form.title, text(plan.title));
      if (title.length < 3 || title.length > 255) return fail(422, 'Nama rencana 3–255 karakter.');
      const optionIds: string[] = [];
      for (const optionKey of form.optionKeys ?? []) {
        const option = optionByKey.get(optionKey);
        if (!option) return stale('Pilihan produk berubah.');
        optionIds.push(option.product_option_id);
      }
      const dates = {
        reservation_deadline: planDateToIso(form.rsvpCloseAt),
        payment_deadline: planDateToIso(form.paymentDueAt),
        event_at: planDateToIso(form.scheduledAt),
      };
      if (Object.values(dates).some((value) => value === null)) return fail(422, 'Format tanggal tidak valid.');
      if (intent.submit && Object.values(dates).some((value) => !value)) {
        return fail(422, 'Lengkapi batas reservasi, batas pembayaran, dan tanggal acara sebelum submit.');
      }
      const saved = await call(`${planPath}?${query}`, {
        method: 'PATCH',
        body: compact({
          title,
          invite_policy: form.invitePolicy ?? plan.invite_policy,
          opened_option_ids: form.optionKeys ? optionIds : plan.occurrence.opened_option_ids_snapshot ?? [],
          ...dates,
          submit_plan: intent.submit === true ? true : undefined,
        }),
      }, intent.submit ? 'Rencana gagal disubmit.' : 'Rencana gagal disimpan.');
      return 'error' in saved ? saved.error : ok();
    }
    case 'gathering.invitation.add': {
      if (!rules.invitationStep) return stale('Undangan hanya bisa ditambah di tahap Buat undangan.');
      if (plan.invite_policy !== 'INVITE_ONLY') return fail(409, 'Undangan terbuka tidak memerlukan daftar peserta.');
      const invitee = intent.invitee ?? {};
      if (!invitee.email && !invitee.whatsapp) return fail(422, 'Isi email atau nomor WhatsApp peserta.');
      const added = await call(`${planPath}/invitations?${query}`, {
        method: 'POST',
        body: compact({ invitee_name: invitee.name || undefined, email: invitee.email || undefined, whatsapp: invitee.whatsapp || undefined }),
      }, 'Undangan gagal ditambahkan.');
      return 'error' in added ? added.error : ok();
    }
    case 'gathering.invitation.revoke': {
      if (!rules.invitationStep) return stale('Undangan hanya bisa dicabut di tahap Buat undangan.');
      const loaded = await call(`${planPath}/invitations?${query}`, { method: 'GET' }, 'Undangan belum dapat dimuat.');
      if ('error' in loaded) return loaded.error;
      const invitation = (rowsFrom(loaded.data) as PlanInvitationInput[])
        .find((row) => intent.target && context.key(PLAN_KEY_KINDS.invitation, row.id) === intent.target);
      if (!invitation || isPublicInvitation(invitation) || invitationStatus(invitation, new Date()) !== 'PENDING') {
        return stale('Undangan ini tidak dapat dicabut.');
      }
      const revoked = await call(`${planPath}/invitations/${encodeURIComponent(invitation.id)}?${query}`, { method: 'DELETE' }, 'Undangan gagal dicabut.');
      return 'error' in revoked ? revoked.error : ok();
    }
    case 'gathering.invitation.content.save': {
      if (!rules.invitationStep) return stale('Tampilan undangan hanya bisa diubah di tahap Buat undangan.');
      return (await saveInvitationContent()) ?? ok();
    }
    case 'gathering.invitations.submit': {
      if (!rules.invitationStep) return stale('Undangan sudah dikirim.');
      // Simpan dulu tampilan undangan yang ikut dikirim (perubahan belum disimpan tidak hilang).
      if (intent.invitationContent) {
        const saveError = await saveInvitationContent();
        if (saveError) return saveError;
      }
      const submitted = await call(`${planPath}/invitations/submit?${query}`, { method: 'POST' }, 'Undangan gagal dikirim.');
      return 'error' in submitted ? submitted.error : ok();
    }
    case 'gathering.registrations.reject': {
      if (!rules.confirmationStep) return stale('Registrasi hanya bisa ditolak di tahap Konfirmasi undangan.');
      const message = text(intent.message);
      if (!message || message.length > 2000) return fail(422, 'Tulis alasan penolakan (maks. 2000 karakter).');
      const loaded = await loadRegistrations();
      if ('error' in loaded) return loaded.error;
      const selected = (intent.keys ?? []).map((itemKey) => registrationByKey(loaded.rows, itemKey));
      if (selected.length === 0) return fail(422, 'Pilih peserta yang akan ditolak.');
      if (selected.some((row) => !row || !registrationRules(row, rules).canReject)) return stale('Sebagian peserta tidak dapat ditolak.');
      const rejected = await call(`${planPath}/registrations/reject?${query}`, {
        method: 'POST',
        body: { registration_ids: selected.map((row) => row!.id), message },
      }, 'Registrasi gagal ditolak.');
      return 'error' in rejected ? rejected.error : ok();
    }
    case 'gathering.reservations.confirm': {
      if (!rules.confirmationStep) return stale('RSVP sudah ditutup.');
      const loaded = await loadRegistrations();
      if ('error' in loaded) return loaded.error;
      const active = loaded.rows.filter((row) => row.registration_status === 'RSVP_CONFIRMED').length;
      const { min_attendees: min, max_attendees: max } = plan.occurrence;
      if (active < min || active > max) {
        return fail(422, `Peserta hadir ${active}; harus antara ${min} dan ${max} sebelum RSVP ditutup.`);
      }
      const confirmed = await call(`${planPath}/confirm-reservations?${query}`, { method: 'POST' }, 'RSVP gagal ditutup.');
      return 'error' in confirmed ? confirmed.error : ok();
    }
    case 'gathering.registrations.checkout': {
      if (!rules.paymentPhase) return stale('Pembayaran peserta belum dibuka.');
      const loaded = await loadRegistrations();
      if ('error' in loaded) return loaded.error;
      const selected = (intent.keys ?? []).map((itemKey) => registrationByKey(loaded.rows, itemKey));
      if (selected.length === 0) return fail(422, 'Pilih peserta yang akan dibayarkan.');
      if (selected.some((row) => !row || !registrationRules(row, rules).canCheckout)) return stale('Sebagian peserta tidak dapat dibayarkan.');
      const checkout = await call(`${planPath}/registrations/collective-checkout?${query}`, {
        method: 'POST',
        body: { registration_ids: selected.map((row) => row!.id) },
        ...(context.origin ? { headers: { 'x-return-origin': context.origin } } : {}),
      }, 'Pembayaran kolektif gagal disiapkan.');
      if ('error' in checkout) return checkout.error;
      const url = checkoutUrlOf(checkout.data);
      return url ? ok(url) : fail(502, 'Tautan pembayaran tidak tersedia.');
    }
    case 'gathering.registration.cancel_checkout':
    case 'gathering.registration.refund': {
      if (!rules.paymentPhase) return stale('Pembayaran peserta tidak sedang dibuka.');
      const loaded = await loadRegistrations();
      if ('error' in loaded) return loaded.error;
      const registration = registrationByKey(loaded.rows, intent.target);
      const refund = intent.action === 'gathering.registration.refund';
      const allowed = registration ? registrationRules(registration, rules) : null;
      if (!registration || !(refund ? allowed?.canRefund : allowed?.canCancelCheckout)) {
        return stale(refund ? 'Kursi peserta ini tidak dapat direfund.' : 'Checkout peserta ini tidak dapat dibatalkan.');
      }
      const done = await call(
        `${planPath}/registrations/${encodeURIComponent(registration.id)}/${refund ? 'refund' : 'cancel-checkout'}?${query}`,
        { method: 'POST' },
        refund ? 'Refund gagal diproses.' : 'Checkout gagal dibatalkan.',
      );
      return 'error' in done ? done.error : ok();
    }
    case 'gathering.invoices.resend': {
      if (!rules.paymentPhase) return stale('Pembayaran peserta tidak sedang dibuka.');
      const sent = await call(`${planPath}/resend-invoices?${query}`, { method: 'POST' }, 'Invoice gagal dikirim ulang.');
      return 'error' in sent ? sent.error : ok();
    }
    case 'gathering.event.confirm': {
      if (!rules.paymentPhase) return stale('Acara belum dapat dikonfirmasi.');
      const opened = new Set(plan.occurrence.opened_option_ids_snapshot ?? []);
      const openedGroups = new Set((plan.occurrence.option_groups_snapshot ?? [])
        .filter((option) => opened.has(option.product_option_id))
        .map((option) => option.option_group_key));
      const selections = new Map<string, string>();
      for (const optionKey of intent.plan?.optionKeys ?? []) {
        const option = optionByKey.get(optionKey);
        if (!option || !opened.has(option.product_option_id)) return stale('Pilihan final berubah.');
        if (selections.has(option.option_group_key)) return fail(422, `Pilih satu opsi final untuk ${option.option_group_key}.`);
        selections.set(option.option_group_key, option.product_option_id);
      }
      const missing = [...openedGroups].filter((group) => !selections.has(group));
      if (missing.length) return fail(422, `Pilih opsi final untuk: ${missing.join(', ')}.`);
      const loaded = await loadRegistrations();
      if ('error' in loaded) return loaded.error;
      const paidSeats = loaded.rows.filter((row) =>
        row.registration_status === 'RSVP_CONFIRMED' && row.payment_status === 'PAID' && row.order_id).length;
      const { min_attendees: min, max_attendees: max } = plan.occurrence;
      if (paidSeats < min || paidSeats > max) {
        return fail(422, `Peserta lunas ${paidSeats}; harus antara ${min} dan ${max} untuk mengonfirmasi acara.`);
      }
      const confirmed = await call(`${planPath}/confirm-event?${query}`, {
        method: 'POST',
        body: { final_selections: [...selections].map(([group, optionId]) => ({ option_group_key: group, option_id: optionId })) },
      }, 'Acara gagal dikonfirmasi.');
      return 'error' in confirmed ? confirmed.error : ok();
    }
    case 'gathering.cancel': {
      if (!rules.canCancel) return stale('Acara ini tidak dapat dibatalkan.');
      const reason = text(intent.reason, 'Dibatalkan oleh initiator').slice(0, 500);
      const cancelled = await call(`${planPath}/cancel?${query}`, { method: 'POST', body: { reason } }, 'Acara gagal dibatalkan.');
      return 'error' in cancelled ? cancelled.error : ok();
    }
    default:
      return fail(400, 'Aksi tidak dikenal.');
  }
}
