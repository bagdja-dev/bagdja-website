/**
 * Pembentuk `props.page` untuk halaman sistem milik template
 * (plan/website-builder/template-owned-system-pages-plan.md §4–5, kontrak:
 * bagdja-website-template-runtime/contract/page-contract.d.ts).
 *
 * Fungsi murni: input = data API milik sesi pembeli (dimuat server-side oleh route),
 * output = objek kontrak. Tidak ada email/token; ID internal diganti `key` opaque.
 * Sengaja tanpa import relatif agar bisa diuji langsung dengan `node --test`.
 */
import { createHmac, randomBytes } from 'node:crypto';

export const PAGE_TIMEZONE = 'Asia/Jakarta';
const PAGE_OFFSET = '+07:00';
const MAX_ROWS = 100;

// ── Utilitas kontrak ───────────────────────────────────────────────────────

export type PageKeyFactory = (kind: string, id: string) => string;

let developmentKeySecret: string | null = null;

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
    developmentKeySecret ??= randomBytes(32).toString('hex');
    keySecret = developmentKeySecret;
  }
  return (kind, id) =>
    `k${createHmac('sha256', keySecret!).update(`${kind}:${id}:${userId}`).digest('base64url').slice(0, 32)}`;
}

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
      detailHref: plan.order_id ? `${options.basePath}/cart/order/${encodeURIComponent(plan.order_id)}` : undefined,
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

// ── Rencana gathering ─────────────────────────────────────────────────────

export interface GatheringPlanInput {
  id: string;
  plan_number: string;
  title: string;
  status: string;
  workflow_step: string;
  invite_policy: 'OPEN' | 'INVITE_ONLY';
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
}

const PLAN_STATUS_LABELS: Record<string, string> = {
  PREORDER: 'Pra-pesan',
  DRAFT: 'Draft',
  RSVP_OPEN: 'RSVP dibuka',
  PAYMENT_OPEN: 'Pembayaran dibuka',
  CONFIRMED: 'Dikonfirmasi',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

const RSVP_LABELS = { PENDING: 'Belum dijawab', ACCEPTED: 'Hadir', DECLINED: 'Tidak hadir' } as const;

function statusLabel(status: string): string {
  return PLAN_STATUS_LABELS[status] ?? status.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function buildGatheringPlanPage(
  plan: GatheringPlanInput,
  invitations: PlanInvitationInput[],
  options: { key: PageKeyFactory; viewerRole: 'initiator' | 'invitee' | 'guest' },
) {
  const occurrence = plan.occurrence;
  const votesFor = (optionId: string) => {
    for (const group of Object.values(occurrence.voting_results ?? {})) {
      const votes = group?.options?.[optionId]?.votes;
      if (typeof votes === 'number') return votes;
    }
    return undefined;
  };
  return {
    ...base(),
    type: 'gathering_plan' as const,
    plan: {
      key: options.key('gathering_plan', plan.id),
      planNumber: text(plan.plan_number),
      title: text(plan.title, 'Rencana gathering'),
      status: plan.status,
      statusLabel: statusLabel(plan.status),
      workflowStep: plan.workflow_step,
      workflowStepLabel: STEP_LABELS[plan.workflow_step] ?? plan.workflow_step,
      invitePolicy: plan.invite_policy === 'OPEN' ? 'OPEN' as const : 'INVITE_ONLY' as const,
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
        location: occurrence.final_location ?? undefined,
        options: (occurrence.option_groups_snapshot ?? []).slice(0, MAX_ROWS).map((option) =>
          compact({
            key: options.key('gathering_option', option.product_option_id),
            group: text(option.option_group_key, 'Opsi'),
            label: text(option.label, 'Opsi'),
            description: option.description ?? undefined,
            venue: option.venue_location ?? undefined,
            isOpen: (occurrence.opened_option_ids_snapshot ?? []).includes(option.product_option_id),
            isFinal: option.is_final_selection === true,
            votes: votesFor(option.product_option_id),
          }),
        ),
      }),
    },
    // Keputusan E3: nama + status saja, tanpa email/WhatsApp.
    invitees: invitations.slice(0, MAX_ROWS).map((invitation) => {
      const rsvpStatus = invitation.status === 'ACCEPTED'
        ? 'ACCEPTED' as const
        : invitation.status === 'PENDING'
          ? 'PENDING' as const
          : 'DECLINED' as const;
      return { name: text(invitation.invitee_name, 'Peserta'), rsvpStatus, rsvpLabel: RSVP_LABELS[rsvpStatus] };
    }),
    viewerRole: options.viewerRole,
    actions: ['gathering.respond'] as const,
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

export type IntentFetch = (
  path: string,
  init?: { method?: string; body?: string },
) => Promise<{ data: unknown; status: number; error?: string }>;

export interface TemplateIntentInput {
  action: string;
  key?: string;
  keys?: string[];
  quantity?: number;
  response?: 'ACCEPTED' | 'DECLINED';
}

export interface TemplateIntentResult {
  status: number;
  body: { ok: boolean; redirect?: string; message?: string };
}

/** Halaman yang boleh mengirim tiap intent (template harus menyatakan halaman itu di manifest). */
export const INTENT_PAGES: Record<string, readonly string[]> = {
  'cart.set_quantity': ['cart'],
  'cart.remove': ['cart'],
  'cart.checkout': ['cart'],
  'invoice.pay': ['tagihan', 'invoice_detail'],
  'gathering.respond': ['calendar', 'gathering_plan'],
};

function fail(status: number, message: string): TemplateIntentResult {
  return { status, body: { ok: false, message } };
}

function messageOf(data: unknown, fallback: string): string {
  return data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string'
    ? (data as { message: string }).message
    : fallback;
}

function checkoutUrlOf(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as { checkout_url?: unknown; checkoutUrl?: unknown };
  const url = typeof record.checkout_url === 'string' ? record.checkout_url : typeof record.checkoutUrl === 'string' ? record.checkoutUrl : null;
  return url && /^https?:\/\//.test(url) ? url : null;
}

/**
 * Jalankan intent untuk sesi pembeli saat ini. `key` dipetakan balik dengan
 * menghitung ulang key atas data milik sesi yang sama (dimuat ulang dari API),
 * sehingga template tidak bisa menargetkan data milik orang lain.
 */
export async function executeTemplateIntent(
  intent: TemplateIntentInput,
  context: { pageType: string; websiteId: string; basePath: string; key: PageKeyFactory; fetch: IntentFetch },
): Promise<TemplateIntentResult> {
  if (!INTENT_PAGES[intent.action]?.includes(context.pageType)) {
    return fail(403, 'Aksi ini tidak tersedia di halaman ini.');
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
