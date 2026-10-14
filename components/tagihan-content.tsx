'use client';

import { useEffect, useMemo, useState } from 'react';

import { ConfirmDialog } from './confirm-dialog';

/**
 * Halaman "Tagihan" buyer — shortcut lintas-order untuk lihat & bayar
 * Termin/Tagihan tanpa harus buka detail pesanan satu-satu (riset UX gap:
 * sebelumnya tombol "Bayar" hanya ada di dalam `fulfillment-progress.tsx`
 * pada halaman detail 1 order).
 *
 * Data source: GET /api/transactions/termins (lihat TerminListItemDto di
 * bagdja-website-api). Fetch sekali, tab filter client-side — pola sama
 * `orders-content.tsx`.
 */

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Menunggu diterbitkan',
  ISSUED: 'Perlu dibayar',
  PAID: 'Lunas',
  CANCELLED: 'Dibatalkan',
};

type StatusPillTone = 'pending' | 'process' | 'success' | 'muted';

const STATUS_TONE: Record<string, StatusPillTone> = {
  SCHEDULED: 'muted',
  ISSUED: 'pending',
  PAID: 'success',
  CANCELLED: 'muted',
};

function pillBg(tone: StatusPillTone): { bg: string; color: string } {
  switch (tone) {
    case 'pending':
      return { bg: 'rgba(245, 158, 11, 0.14)', color: 'rgb(180, 83, 9)' };
    case 'process':
      return { bg: 'rgba(59, 130, 246, 0.14)', color: 'rgb(37, 99, 235)' };
    case 'success':
      return { bg: 'rgba(34, 197, 94, 0.14)', color: 'rgb(22, 163, 74)' };
    case 'muted':
    default:
      return { bg: 'rgba(107, 114, 128, 0.14)', color: 'rgb(75, 85, 99)' };
  }
}

function formatMoney(v: number | string): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!Number.isFinite(n)) return '-';
  return `Rp ${n.toLocaleString('id-ID')}`;
}

function formatDate(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface TagihanRow {
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
}

interface GatheringInvoiceRow {
  id: string;
  transaction_id?: string | null;
  can_view_transaction?: boolean;
  invoice_id: string;
  gathering_title: string;
  attendee_name: string;
  amount: number;
  currency: string;
  payment_status: string;
  invoice_status?: 'SCHEDULED' | 'ISSUED';
  invoice_issued_at: string | null;
  payment_deadline?: string | null;
  can_pay: boolean;
  is_initiator: boolean;
}

interface GatheringInvoiceGroup {
  id: string;
  transaction_id: string | null;
  invoices: GatheringInvoiceRow[];
  amount: number;
  payment_status: string;
  has_not_issued_invoice: boolean;
  has_refunded_invoice: boolean;
  has_paid_invoice: boolean;
  has_outstanding_invoice: boolean;
  is_fully_paid: boolean;
  can_view_transaction: boolean;
}

interface TagihanContentProps {
  /** Kosong ('') di subdomain/custom domain, `/{slug}` di path-based (local dev) — lihat `resolveTenantLinkBase`. */
  basePath: string;
}

type TabKey = 'all' | 'scheduled' | 'issued' | 'paid' | 'refunded' | 'cancelled';

const TABS: Array<{ key: TabKey; label: string; match?: (s: string) => boolean }> = [
  { key: 'all', label: 'Semua' },
  { key: 'scheduled', label: 'Menunggu Diterbitkan', match: (s) => s === 'SCHEDULED' },
  { key: 'issued', label: 'Perlu Dibayar', match: (s) => s === 'ISSUED' },
  { key: 'paid', label: 'Lunas', match: (s) => s === 'PAID' },
  { key: 'refunded', label: 'Direfund' },
  { key: 'cancelled', label: 'Dibatalkan', match: (s) => s === 'CANCELLED' },
];

export function TagihanContent({ basePath, websiteId }: TagihanContentProps & { websiteId: string }) {
  const [rows, setRows] = useState<TagihanRow[]>([]);
  const [gatheringInvoices, setGatheringInvoices] = useState<GatheringInvoiceRow[]>([]);
  const [gatheringInvoiceError, setGatheringInvoiceError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('all');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<Record<string, string>>({});
  /** Termin yang sedang dikonfirmasi lewat popup sebelum benar-benar dibayar — buyer harus sadar dana ini langsung ke penjual, tanpa Escrow. */
  const [pendingTermin, setPendingTermin] = useState<{ id: string; label: string; amount: number | string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/transactions/termins?size=100&website_id=${encodeURIComponent(websiteId)}`, { method: 'GET', credentials: 'include' });
        if (res.status === 401) {
          if (!cancelled) setError('Silakan login untuk melihat Tagihan Anda.');
          return;
        }
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          let msg = 'Gagal memuat Tagihan';
          try {
            const j = JSON.parse(text);
            if (j?.message) msg = j.message;
          } catch {
            /* noop */
          }
          if (!cancelled) setError(msg);
          return;
        }
        const json = (await res.json()) as { data?: TagihanRow[] };
        if (!cancelled) setRows(json.data ?? []);
      } catch {
        if (!cancelled) setError('Terjadi kesalahan jaringan. Coba sebentar lagi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [websiteId]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/gathering/invoices?website_id=${encodeURIComponent(websiteId)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) return [];
        const payload = await response.json().catch(() => null) as GatheringInvoiceRow[] | { message?: string } | null;
        if (!response.ok) throw new Error((payload as { message?: string } | null)?.message || 'Gagal memuat tagihan gathering.');
        return Array.isArray(payload) ? payload : [];
      })
      .then((invoices) => { if (!cancelled) setGatheringInvoices(invoices); })
      .catch((cause) => { if (!cancelled) setGatheringInvoiceError(cause instanceof Error ? cause.message : 'Gagal memuat tagihan gathering.'); });
    return () => { cancelled = true; };
  }, [websiteId]);

  const groupedGatheringInvoices = useMemo(() => {
    const groups = new Map<string, GatheringInvoiceRow[]>();
    for (const invoice of gatheringInvoices) {
      const key = invoice.transaction_id ? `transaction:${invoice.transaction_id}` : `invoice:${invoice.id}`;
      groups.set(key, [...(groups.get(key) ?? []), invoice]);
    }

    return Array.from(groups.values()).map((invoices): GatheringInvoiceGroup => {
      const statuses = new Set(invoices.map((invoice) => invoice.payment_status));
      const hasRefundedInvoice = statuses.has('REFUNDED');
      const hasPaidInvoice = statuses.has('PAID');
      const hasNotIssuedInvoice = invoices.some((invoice) => !invoice.invoice_issued_at || invoice.invoice_status === 'SCHEDULED');
      const hasOutstandingInvoice = invoices.some((invoice) => Boolean(invoice.invoice_issued_at) && !['PAID', 'REFUNDED'].includes(invoice.payment_status));
      const isFullyPaid = invoices.every((invoice) => invoice.payment_status === 'PAID');
      const paymentStatus = statuses.size > 1 ? 'PARTIAL' : invoices[0].payment_status;
      return {
        id: invoices[0].id,
        transaction_id: invoices[0].transaction_id ?? null,
        invoices,
        amount: invoices.reduce((total, invoice) => total + Number(invoice.amount), 0),
        payment_status: paymentStatus,
        has_not_issued_invoice: hasNotIssuedInvoice,
        has_refunded_invoice: hasRefundedInvoice,
        has_paid_invoice: hasPaidInvoice,
        has_outstanding_invoice: hasOutstandingInvoice,
        is_fully_paid: isFullyPaid,
        can_view_transaction: Boolean(invoices[0].can_view_transaction),
      };
    });
  }, [gatheringInvoices]);

  const filtered = useMemo(() => {
    const t = TABS.find((x) => x.key === tab);
    if (!t || tab === 'all') return rows;
    if (tab === 'refunded') return [];
    return rows.filter((row) => t.match?.(row.status));
  }, [rows, tab]);

  const filteredGatheringInvoices = useMemo(() => {
    if (tab === 'all') return groupedGatheringInvoices;
    if (tab === 'scheduled') return groupedGatheringInvoices.filter((group) => group.has_not_issued_invoice);
    if (tab === 'issued') return groupedGatheringInvoices.filter((group) => group.has_outstanding_invoice);
    if (tab === 'paid') return groupedGatheringInvoices.filter((group) => group.is_fully_paid);
    if (tab === 'refunded') return groupedGatheringInvoices.filter((group) => group.has_refunded_invoice);
    return [];
  }, [groupedGatheringInvoices, tab]);

  const tabCounts = useMemo(() => {
    const cnt: Record<TabKey, number> = {
      all: rows.length + groupedGatheringInvoices.length,
      scheduled: groupedGatheringInvoices.filter((group) => group.has_not_issued_invoice).length,
      issued: groupedGatheringInvoices.filter((group) => group.has_outstanding_invoice).length,
      paid: groupedGatheringInvoices.filter((group) => group.is_fully_paid).length,
      refunded: groupedGatheringInvoices.filter((group) => group.has_refunded_invoice).length,
      cancelled: 0,
    };
    for (const r of rows) {
      for (const t of TABS) {
        if (t.match?.(r.status)) cnt[t.key] += 1;
      }
    }
    return cnt;
  }, [groupedGatheringInvoices, rows]);

  async function payTermin(terminId: string) {
    setPayingId(terminId);
    setPayError((prev) => ({ ...prev, [terminId]: '' }));
    try {
      const res = await fetch(`/api/transactions/termins/${terminId}/pay`, { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.message ?? 'Gagal memproses pembayaran Termin');
      if (!json?.checkout_url) throw new Error('Gagal mendapatkan link pembayaran.');
      window.dispatchEvent(new Event('bagdja:tagihan-changed'));
      window.location.href = json.checkout_url;
    } catch (err) {
      setPayError((prev) => ({
        ...prev,
        [terminId]: err instanceof Error ? err.message : 'Gagal memproses pembayaran Termin',
      }));
      setPayingId(null);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <h1
          className="text-2xl font-bold sm:text-3xl"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
        >
          Tagihan
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--brand-muted)' }}>
          Semua Termin/Tagihan Anda lintas pesanan — bayar langsung dari sini.
        </p>
      </header>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                active ? '' : 'hover:opacity-90'
              }`}
              style={{
                borderColor: active ? 'var(--brand-accent)' : 'var(--brand-border)',
                backgroundColor: active ? 'var(--brand-accent)' : 'var(--brand-surface)',
                color: active ? 'var(--brand-on-accent)' : 'var(--brand-text)',
              }}
            >
              {t.label}
              <span
                className="inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: active ? 'rgba(255,255,255,0.18)' : 'var(--brand-border)',
                  color: active ? 'var(--brand-on-accent)' : 'var(--brand-muted)',
                }}
              >
                {tabCounts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {loading && (
        <div
          className="rounded-xl border p-10 text-center text-sm"
          style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}
        >
          Memuat Tagihan…
        </div>
      )}

      {!loading && error && (
        <div
          className="rounded-xl border p-5 text-sm"
          style={{ borderColor: 'var(--brand-border)', backgroundColor: 'rgba(239,68,68,0.06)' }}
        >
          <p style={{ color: 'rgb(185, 28, 28)' }}>{error}</p>
        </div>
      )}

      {!loading && !error && (filtered.length > 0 || filteredGatheringInvoices.length > 0) ? (
        <section className="mb-8">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold">Daftar tagihan</h2>
            <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>{filtered.length + filteredGatheringInvoices.length} tagihan</span>
          </div>
          <div className="flex flex-col gap-3">
            {filteredGatheringInvoices.map((group) => {
              const invoice = group.invoices[0];
              const status = group.payment_status === 'PARTIAL'
                ? group.has_refunded_invoice ? 'Sebagian direfund' : group.has_paid_invoice ? 'Sebagian dibayar' : 'Pembayaran diproses'
                : group.has_not_issued_invoice && !invoice.invoice_issued_at ? 'Menunggu diterbitkan'
                : group.payment_status === 'PAID' ? 'Lunas' : group.payment_status === 'PENDING_PAYMENT' ? 'Pembayaran diproses' : group.payment_status === 'REFUNDED' ? 'Direfund' : 'Perlu dibayar';
              const invoiceHref = !invoice.invoice_issued_at
                ? undefined
                : group.transaction_id && group.can_view_transaction
                ? `${basePath}/order/${encodeURIComponent(group.transaction_id)}`
                : `${basePath}/gathering/invoice/${encodeURIComponent(invoice.id)}`;
              const invoiceSummary = group.invoices.length > 1
                ? `${group.invoices.length} invoice · ${group.invoices.slice(0, 2).map((item) => item.attendee_name).join(', ')}${group.invoices.length > 2 ? ` +${group.invoices.length - 2} lainnya` : ''}`
                : `${invoice.invoice_id} · ${invoice.attendee_name}`;
              return (
                <article key={group.id} className="border text-sm" style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3" style={{ borderColor: 'var(--brand-border)' }}>
                    <div>
                      <p className="font-semibold">{invoice.gathering_title}</p>
                      <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>{invoiceSummary}</p>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: group.is_fully_paid ? 'rgb(22, 163, 74)' : group.has_refunded_invoice ? 'rgb(180, 83, 9)' : 'var(--brand-muted)' }}>{status}</span>
                  </div>
                  <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-lg font-bold" style={{ color: 'var(--brand-accent-muted)' }}>{formatMoney(group.amount)}</p>
                      {invoice.payment_deadline ? <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>Batas: {formatDate(invoice.payment_deadline)}</p> : null}
                      {invoice.is_initiator && !invoice.can_pay ? <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>Anda pengelola gathering ini.</p> : null}
                    </div>
                    {invoiceHref ? (
                      <a href={invoiceHref} className="inline-flex rounded-full border px-4 py-2 text-xs font-semibold" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}>Lihat detail tagihan</a>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>Tagihan tersedia setelah initiator membuka pembayaran.</span>
                    )}
                  </div>
                </article>
              );
            })}
            {filtered.map((row) => {
              const tone = STATUS_TONE[row.status] ?? 'muted';
              const toneStyle = pillBg(tone);
              const orderHref = row.orderTransactionId ? `${basePath}/order/${row.orderTransactionId}` : undefined;
              return (
                <article key={`termin:${row.id}`} className="rounded border text-sm" style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}>
                  <div className="flex items-center justify-between gap-3 border-b px-5 py-3" style={{ borderColor: 'var(--brand-border)' }}>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--brand-muted)' }}>
                      <span className="font-semibold">{row.productName ?? 'Produk'}</span><span>•</span><span>{formatDate(row.createdAt)}</span>
                    </div>
                    <span className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide" style={{ backgroundColor: toneStyle.bg, color: toneStyle.color }}>{STATUS_LABEL[row.status] ?? row.status}</span>
                  </div>
                  <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold" style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}>{row.label}</p>
                      {row.anchorStepName ? <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>Setelah &quot;{row.anchorStepName}&quot;</p> : null}
                      {payError[row.id] ? <p className="mt-1 text-xs" style={{ color: 'rgb(185, 28, 28)' }}>{payError[row.id]}</p> : null}
                    </div>
                    <div className="flex flex-col items-start gap-3 sm:shrink-0 sm:items-end">
                      <p className="text-lg font-bold" style={{ color: 'var(--brand-accent-muted)' }}>{formatMoney(row.amount)}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {orderHref ? <a href={orderHref} className="inline-flex rounded-full border px-4 py-1.5 text-xs font-semibold transition-opacity hover:opacity-85" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}>Lihat Order</a> : null}
                        {row.status === 'ISSUED' ? <button type="button" disabled={payingId === row.id} onClick={() => setPendingTermin({ id: row.id, label: row.label, amount: row.amount })} className="inline-flex rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-60" style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}>{payingId === row.id ? 'Memproses…' : 'Bayar'}</button> : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {gatheringInvoiceError ? <p role="alert" className="mt-2 text-xs text-red-700">{gatheringInvoiceError}</p> : null}
        </section>
      ) : null}

      {!loading && !error && filtered.length === 0 && filteredGatheringInvoices.length === 0 && (
        <div
          className="flex flex-col items-center gap-4 rounded-xl border p-10 text-center"
          style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}
        >
          <p
            className="text-lg font-semibold"
            style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
          >
            Belum ada Tagihan
          </p>
          <p className="max-w-sm text-sm" style={{ color: 'var(--brand-muted)' }}>
            Termin atau tagihan peserta akan muncul di sini setelah diterbitkan.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={pendingTermin !== null}
        title="Konfirmasi Pembayaran Tagihan"
        message={
          pendingTermin
            ? `Anda akan membayar "${pendingTermin.label}" sebesar ${formatMoney(pendingTermin.amount)}. Dana ini ditransfer langsung ke penjual tanpa melalui Escrow — pastikan progres pesanan Anda sudah berjalan sesuai kesepakatan sebelum melanjutkan.`
            : ''
        }
        error={pendingTermin ? payError[pendingTermin.id] : null}
        confirmLabel="Ya, Bayar"
        loading={pendingTermin ? payingId === pendingTermin.id : false}
        onConfirm={() => {
          if (pendingTermin) void payTermin(pendingTermin.id);
        }}
        onCancel={() => setPendingTermin(null)}
      />
    </section>
  );
}
