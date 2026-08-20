'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * Daftar transaksi buyer (client component).
 *
 * Data source: GET /api/transactions — semua WebsiteTransaction milik buyer
 * (1 transaksi = 1 checkout, bisa berisi >1 item — W2.8). Sebelumnya halaman
 * ini pakai GET /api/orders (per-produk, status/checkout_url basi setelah
 * order diklaim ke transaksi) — diganti karena link detail & statusnya
 * jadi salah begitu order sudah pindah ke level transaksi.
 */

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu pembayaran',
  PENDING_PAYMENT: 'Menunggu pembayaran',
  HELD: 'Diproses',
  COMPLETED: 'Selesai',
  REFUNDED: 'Direfund',
  CLOSED: 'Ditutup',
  DISPUTED: 'Dalam sengketa',
  CANCELLED: 'Dibatalkan',
};

type StatusPillTone = 'pending' | 'process' | 'success' | 'danger' | 'muted';

const STATUS_TONE: Record<string, StatusPillTone> = {
  PENDING: 'pending',
  PENDING_PAYMENT: 'pending',
  HELD: 'process',
  COMPLETED: 'success',
  REFUNDED: 'danger',
  CLOSED: 'muted',
  DISPUTED: 'danger',
  CANCELLED: 'muted',
};

interface WebsiteProductLite {
  id: string;
  name?: string | null;
  images?: string[] | null;
}

interface TransactionItemRow {
  id: string;
  quantity: number;
  unit_price: number | string;
  total_amount: number | string;
  order?: { product?: WebsiteProductLite | null } | null;
}

interface WebsiteTransactionRow {
  id: string;
  total_amount: number | string;
  currency?: string | null;
  payment_mode?: 'ADD_TO_CART' | 'ESCROW' | string | null;
  status: string;
  checkout_url?: string | null;
  courier?: string | null;
  created_at: string;
  items?: TransactionItemRow[];
}

interface OrdersContentProps {
  /** Slug tenant (base path link) — e.g. `fashion-store` atau '' untuk custom domain/subdomain. */
  slug: string;
}

type TabKey = 'all' | 'awaiting' | 'process' | 'done' | 'cancelled';

const TABS: Array<{ key: TabKey; label: string; match?: (s: string) => boolean }> = [
  { key: 'all', label: 'Semua' },
  {
    key: 'awaiting',
    label: 'Menunggu Bayar',
    match: (s) => s === 'PENDING' || s === 'PENDING_PAYMENT',
  },
  {
    key: 'process',
    label: 'Diproses',
    match: (s) => s === 'HELD' || s === 'DISPUTED',
  },
  {
    key: 'done',
    label: 'Selesai',
    match: (s) => s === 'COMPLETED',
  },
  {
    key: 'cancelled',
    label: 'Dibatalkan',
    match: (s) => s === 'CANCELLED' || s === 'CLOSED' || s === 'REFUNDED',
  },
];

function pillBg(tone: StatusPillTone): { bg: string; color: string } {
  switch (tone) {
    case 'pending':
      return { bg: 'rgba(245, 158, 11, 0.14)', color: 'rgb(180, 83, 9)' };
    case 'process':
      return { bg: 'rgba(59, 130, 246, 0.14)', color: 'rgb(37, 99, 235)' };
    case 'success':
      return { bg: 'rgba(34, 197, 94, 0.14)', color: 'rgb(22, 163, 74)' };
    case 'danger':
      return { bg: 'rgba(239, 68, 68, 0.14)', color: 'rgb(220, 38, 38)' };
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

function shortId(id: string): string {
  if (!id) return '-';
  if (id.length <= 8) return id;
  return id.slice(0, 8);
}

export function OrdersContent({ slug }: OrdersContentProps) {
  const basePath = slug ? `/${slug}` : '';

  const [rows, setRows] = useState<WebsiteTransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/transactions?size=100', { method: 'GET', credentials: 'include' });
        if (res.status === 401) {
          // middleware harusnya sudah redirect, tapi fallback handle.
          if (!cancelled) setError('Silakan login untuk melihat daftar transaksi.');
          return;
        }
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          let msg = 'Gagal memuat daftar transaksi';
          try {
            const j = JSON.parse(text);
            if (j?.message) msg = j.message;
          } catch {
            /* noop */
          }
          if (!cancelled) setError(msg);
          return;
        }
        const data = (await res.json()) as
          | WebsiteTransactionRow[]
          | { data?: WebsiteTransactionRow[] };
        const list = Array.isArray(data)
          ? data
          : Array.isArray((data as { data?: WebsiteTransactionRow[] }).data)
            ? (data as { data: WebsiteTransactionRow[] }).data
            : [];
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        if (!cancelled) setRows(list);
      } catch (e) {
        if (!cancelled) setError('Terjadi kesalahan jaringan. Coba sebentar lagi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const t = TABS.find((x) => x.key === tab);
    if (!t || !t.match) return rows;
    return rows.filter((r) => t.match!(r.status));
  }, [rows, tab]);

  const tabCounts = useMemo(() => {
    const cnt: Record<TabKey, number> = { all: rows.length, awaiting: 0, process: 0, done: 0, cancelled: 0 };
    for (const r of rows) {
      for (const t of TABS) {
        if (t.match?.(r.status)) {
          cnt[t.key] += 1;
        }
      }
    }
    return cnt;
  }, [rows]);

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <h1
          className="text-2xl font-bold sm:text-3xl"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
        >
          Daftar Transaksi
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--brand-muted)' }}>
          Lihat semua pesanan, status pembayaran, dan riwayat pembelian Anda.
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
                  backgroundColor: active
                    ? 'rgba(255,255,255,0.18)'
                    : 'var(--brand-border)',
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
          Memuat transaksi…
        </div>
      )}

      {!loading && error && (
        <div
          className="rounded-xl border p-5 text-sm"
          style={{ borderColor: 'var(--brand-border)', backgroundColor: 'rgba(239,68,68,0.06)' }}
        >
          <p style={{ color: 'rgb(185, 28, 28)' }}>{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-3 inline-flex rounded-full px-5 py-2 text-sm font-semibold"
            style={{
              backgroundColor: 'var(--brand-accent)',
              color: 'var(--brand-on-accent)',
            }}
          >
            Coba Lagi
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState tab={tab} basePath={basePath} hasAny={rows.length > 0} />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="flex flex-col gap-3">
          {filtered.map((row) => (
            <TransactionCard key={row.id} row={row} basePath={basePath} />
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyState({
  tab,
  basePath,
  hasAny,
}: {
  tab: TabKey;
  basePath: string;
  hasAny: boolean;
}) {
  const label = hasAny ? TABS.find((t) => t.key === tab)?.label ?? '' : '';
  const title = hasAny
    ? label
      ? `Belum ada transaksi dengan status "${label}"`
      : 'Belum ada transaksi'
    : 'Anda belum memiliki transaksi';
  const subtitle = hasAny
    ? 'Coba pilih tab status lain untuk melihat transaksi yang lain.'
    : 'Belanja produk menarik dan lakukan pembayaran — transaksi Anda akan muncul di sini.';

  return (
    <div
      className="flex flex-col items-center gap-4 rounded-xl border p-10 text-center"
      style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}
    >
      <div
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-full"
        style={{ backgroundColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-3 7h3m-3 4h3M6 12h.01M6 16h.01" />
        </svg>
      </div>
      <div>
        <p
          className="text-lg font-semibold"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
        >
          {title}
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--brand-muted)' }}>
          {subtitle}
        </p>
      </div>
      <a
        href={basePath || '/'}
        className="inline-flex rounded-full px-6 py-2.5 text-sm font-semibold"
        style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
      >
        Mulai Belanja
      </a>
    </div>
  );
}

function TransactionCard({ row, basePath }: { row: WebsiteTransactionRow; basePath: string }) {
  const tone = STATUS_TONE[row.status] ?? 'muted';
  const toneStyle = pillBg(tone);
  const items = row.items ?? [];
  const firstItem = items[0];
  const firstProduct = firstItem?.order?.product;
  const productName = firstProduct?.name ?? 'Produk';
  const productImage = firstProduct?.images?.[0];
  const extraCount = Math.max(0, items.length - 1);
  const detailHref = `${basePath}/order/${row.id}`;

  const needPayment = row.status === 'PENDING_PAYMENT' && Boolean(row.checkout_url);

  return (
    <article
      className="rounded-xl border text-sm"
      style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}
    >
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3" style={{ borderColor: 'var(--brand-border)' }}>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--brand-muted)' }}>
          <span className="font-mono font-semibold">#{shortId(row.id)}</span>
          <span>•</span>
          <span>{formatDate(row.created_at)}</span>
        </div>
        <span
          className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={{ backgroundColor: toneStyle.bg, color: toneStyle.color }}
        >
          {STATUS_LABEL[row.status] ?? row.status}
        </span>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
        <a
          href={detailHref}
          className="flex flex-shrink-0 items-center gap-4 sm:max-w-md sm:flex-1"
        >
          <div
            className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border"
            style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-bg)' }}
          >
            {productImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={productImage} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-8 w-8"
                fill="none"
                strokeWidth={1.6}
                style={{ color: 'var(--brand-muted)' }}
                stroke="currentColor"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="truncate font-semibold"
              style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
            >
              {productName}
              {extraCount > 0 ? ` + ${extraCount} produk lainnya` : ''}
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>
              {items.length} item
              {row.courier ? ` • Kurir: ${row.courier}` : ''}
            </p>
          </div>
        </a>

        <div className="flex flex-col items-start justify-between gap-3 sm:items-end sm:gap-4">
          <div className="text-right">
            <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
              Total
            </p>
            <p
              className="text-lg font-bold"
              style={{ color: 'var(--brand-accent-muted)' }}
            >
              {formatMoney(row.total_amount)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={detailHref}
              className="inline-flex rounded-full border px-4 py-1.5 text-xs font-semibold transition-opacity hover:opacity-85"
              style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}
            >
              Detail
            </a>
            {needPayment && row.checkout_url && (
              <a
                href={row.checkout_url}
                className="inline-flex rounded-full px-4 py-1.5 text-xs font-semibold"
                style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
              >
                Lanjutkan Pembayaran
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
