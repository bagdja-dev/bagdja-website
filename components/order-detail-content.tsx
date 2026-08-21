/**
 * Konten halaman status pesanan — dirender DI DALAM template (section type
 * `order_detail`) supaya header/footer/theme konsisten dengan cart/checkout/
 * orders. Read-only, layout mirip `checkout-content.tsx` (foto produk,
 * alamat, kurir, ringkasan di sidebar) tapi tanpa form — plus tombol
 * lanjut/ulang bayar di posisi yang sama dengan tombol "Bayar Sekarang" di
 * checkout.
 *
 * Data (`transaction`/`order`) sudah di-fetch server-side oleh
 * `app/[website_slug]/order/[order_id]/page.tsx` dan dilewatkan lewat
 * `section.content` — komponen ini murni presentational (bukan client
 * fetch), kecuali tombol retry yang jadi island client tersendiri.
 */
import { OrderActionButtons } from './order-action-buttons';
import { RetryPaymentButton } from './retry-payment-button';

export interface TransactionProduct {
  name?: string;
  images?: string[];
  description?: string | null;
}

export interface TransactionItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  order?: { product?: TransactionProduct | null } | null;
}

export interface TransactionDetail {
  id: string;
  website_id: string;
  recipient_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  postal_code: string | null;
  courier: string | null;
  total_amount: number;
  currency: string;
  payment_mode: 'ADD_TO_CART' | 'ESCROW';
  status: string;
  checkout_url: string | null;
  created_at: string;
  items?: TransactionItem[];
}

export interface OrderDetail {
  id: string;
  product_id: string;
  product?: { name: string } | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  payment_mode: 'ADD_TO_CART' | 'ESCROW';
  status: string;
  checkout_url: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu pembayaran',
  PENDING_PAYMENT: 'Menunggu pembayaran',
  HELD: 'Pembayaran sukses',
  COMPLETED: 'Selesai',
  REFUNDED: 'Direfund',
  CLOSED: 'Ditutup',
  DISPUTED: 'Dalam sengketa',
  CANCELLED: 'Dibatalkan',
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span style={{ color: 'var(--brand-muted)' }}>{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

export function OrderDetailContent({
  transaction,
  order,
}: {
  transaction?: TransactionDetail | null;
  order?: OrderDetail | null;
}) {
  if (transaction) return <TransactionView transaction={transaction} />;
  if (order) return <LegacyOrderView order={order} />;
  return null;
}

/** Tampilan transaksi (alur baru W2.8) — read-only, mirip layout checkout. */
function TransactionView({ transaction }: { transaction: TransactionDetail }) {
  const items = transaction.items ?? [];

  const shippingLines = [
    transaction.recipient_name,
    transaction.phone,
    [transaction.address, transaction.district, transaction.city]
      .filter(Boolean)
      .join(', '),
    transaction.postal_code,
  ].filter((line): line is string => Boolean(line));

  const statusLabel = STATUS_LABEL[transaction.status] ?? transaction.status;
  // Backend menormalisasi status escrow `PENDING` -> `PENDING_PAYMENT` saat
  // sync (lihat `normalizeEscrowStatus` di website-api), tapi cek juga
  // `PENDING` di sini sebagai jaga-jaga kalau ada transaksi lama yang belum
  // ke-sync ulang.
  const needsPayment = transaction.status === 'PENDING_PAYMENT' || transaction.status === 'PENDING';

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span
          className="rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide"
          style={{
            backgroundColor: needsPayment ? 'var(--brand-surface)' : 'var(--brand-accent)',
            color: needsPayment ? 'var(--brand-text)' : 'var(--brand-on-accent)',
            border: needsPayment ? '1px solid var(--brand-border)' : 'none',
          }}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Kolom kiri: detail pemesanan (read-only, mirip checkout) */}
        <div className="flex flex-col gap-8">
          <section>
            <h2
              className="text-sm font-bold uppercase tracking-wide"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Detail Pemesanan ({items.length} item)
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              {items.map((item) => {
                const product = item.order?.product;
                const image = product?.images?.[0];
                return (
                  <div
                    key={item.id}
                    className="flex gap-4 rounded-xl border p-4"
                    style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
                  >
                    {image ? (
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div
                        className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg text-lg font-bold uppercase"
                        style={{ backgroundColor: 'var(--brand-muted)', color: 'var(--brand-on-accent)' }}
                      >
                        {(product?.name ?? 'P').charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium" style={{ fontFamily: 'var(--font-heading)' }}>
                        {product?.name ?? 'Produk'}
                      </p>
                      {product?.description && (
                        <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--brand-muted)' }}>
                          {product.description}
                        </p>
                      )}
                      <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>
                        {transaction.payment_mode === 'ESCROW'
                          ? 'Escrow — dana ditahan sampai Anda konfirmasi terima barang'
                          : 'Checkout Bagdja'}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold">
                          {item.quantity} × Rp {Number(item.unit_price).toLocaleString('id-ID')}
                        </span>
                        <span className="text-sm font-bold" style={{ color: 'var(--brand-accent-muted)' }}>
                          Rp {Number(item.total_amount).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {shippingLines.length > 0 && (
            <section>
              <h2
                className="text-sm font-bold uppercase tracking-wide"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Alamat Pengiriman
              </h2>
              <div
                className="mt-4 space-y-2 rounded-xl border p-5 text-sm"
                style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
              >
                {transaction.recipient_name && <Row label="Penerima" value={transaction.recipient_name} />}
                {transaction.phone && <Row label="No. HP" value={transaction.phone} />}
                {(transaction.address || transaction.district || transaction.city) && (
                  <Row
                    label="Alamat"
                    value={[transaction.address, transaction.district, transaction.city]
                      .filter(Boolean)
                      .join(', ')}
                  />
                )}
                {transaction.postal_code && <Row label="Kode Pos" value={transaction.postal_code} />}
              </div>
            </section>
          )}

          {transaction.courier && (
            <section>
              <h2
                className="text-sm font-bold uppercase tracking-wide"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Kurir Pengiriman
              </h2>
              <div
                className="mt-4 inline-flex rounded-lg border-2 px-4 py-2.5 text-sm font-medium"
                style={{ borderColor: 'var(--brand-accent)', backgroundColor: 'var(--brand-bg)' }}
              >
                {transaction.courier}
              </div>
            </section>
          )}
        </div>

        {/* Kolom kanan: ringkasan + aksi (posisi sama dengan tombol Bayar di checkout) */}
        <aside
          className="h-fit rounded-xl border p-5 lg:sticky lg:top-24"
          style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
        >
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>
            Ringkasan
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt style={{ color: 'var(--brand-muted)' }}>{items.length} item</dt>
              <dd className="font-semibold">
                Rp {transaction.total_amount.toLocaleString('id-ID')}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: 'var(--brand-border)' }}>
              <dt className="font-semibold">Total</dt>
              <dd className="text-xl font-bold">
                Rp {transaction.total_amount.toLocaleString('id-ID')}
              </dd>
            </div>
            <div className="flex items-center justify-between pt-1">
              <dt style={{ color: 'var(--brand-muted)' }}>Tanggal</dt>
              <dd className="text-xs">{new Date(transaction.created_at).toLocaleString('id-ID')}</dd>
            </div>
          </dl>

          {needsPayment && transaction.checkout_url && (
            <a
              href={transaction.checkout_url}
              className="mt-5 flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.03] active:scale-95"
              style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
            >
              Lanjutkan Pembayaran
            </a>
          )}

          {needsPayment && !transaction.checkout_url && (
            <>
              <p className="mt-4 text-xs" style={{ color: 'var(--brand-muted)' }}>
                Link pembayaran belum berhasil dibuat sebelumnya.
              </p>
              <RetryPaymentButton transactionId={transaction.id} fullWidth label="Bayar Lagi" />
            </>
          )}

          {!needsPayment && (
            <p className="mt-5 rounded-lg border px-3 py-2 text-xs leading-relaxed" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}>
              {statusLabel}
            </p>
          )}

          <OrderActionButtons transactionId={transaction.id} status={transaction.status} />
        </aside>
      </div>
    </section>
  );
}

/** Tampilan order legacy (sebelum W2.8 — escrow di level order). */
function LegacyOrderView({ order }: { order: OrderDetail }) {
  return (
    <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div
        className="space-y-3 rounded-xl border p-5 text-sm"
        style={{ borderColor: 'var(--brand-border)' }}
      >
        <Row label="Produk" value={order.product?.name ?? order.product_id} />
        <Row label="Jumlah" value={String(order.quantity)} />
        <Row label="Total" value={`Rp ${order.total_amount.toLocaleString('id-ID')}`} />
        <Row
          label="Mode"
          value={order.payment_mode === 'ESCROW' ? 'Escrow' : 'Checkout Bagdja'}
        />
        <Row label="Status" value={STATUS_LABEL[order.status] ?? order.status} />
        <Row label="Tanggal" value={new Date(order.created_at).toLocaleString('id-ID')} />
      </div>

      {order.status === 'PENDING' && order.checkout_url && (
        <a
          href={order.checkout_url}
          className="mt-6 inline-flex rounded-full px-8 py-3 text-sm font-semibold uppercase tracking-wide"
          style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
        >
          Lanjutkan Pembayaran
        </a>
      )}
    </section>
  );
}
