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
import { FulfillmentProgress } from './fulfillment-progress';
import { OrderActionButtons } from './order-action-buttons';
import { PraorderStepList } from './praorder-step-list';
import { RetryPaymentButton } from './retry-payment-button';

export interface TransactionProduct {
  name?: string;
  images?: string[];
  description?: string | null;
  uom?: { symbol?: string } | null;
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

/**
 * Order Handling Phase 3 (plan/website-builder/order-hanlde-plan.md §3.0.1)
 * — cermin tipe backend, dipakai untuk checklist step di `FulfillmentProgress`.
 */
export type FulfillmentStepFormFieldFilledBy = 'seller' | 'buyer';

export interface FulfillmentStepFormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'pdf' | 'foto' | 'video' | 'lokasi';
  required?: boolean;
  filled_by?: FulfillmentStepFormFieldFilledBy;
  options?: string[];
  max_files?: number;
}

export interface OrderFulfillmentStepProgress {
  stepName: string;
  /** fulfillment-praorder-plan.md §2.1 — PRAORDER (sebelum checkout) atau PASCAORDER (existing). */
  phase: 'PRAORDER' | 'PASCAORDER';
  /** Siapa yang menyelesaikan step ini — sumber kebenaran (bukan lagi field.filled_by di formSchema). */
  filledBy: 'admin' | 'buyer';
  description: string | null;
  processDay: number | null;
  releasePercentage: number | null;
  guarantyDays: number | null;
  formSchema: FulfillmentStepFormField[] | null;
  completed: boolean;
  formData: Record<string, unknown> | null;
  releaseApproved: boolean;
  releaseAmount: number | null;
  releaseApprovedBy: 'buyer' | 'seller_guaranty' | null;
  disputed: boolean;
}

/** 1 Termin (fulfillment-praorder-plan.md §2.4) — disisipkan di timeline lewat `anchorStepName`. */
export interface TerminSummary {
  id: string;
  sequence: number;
  label: string;
  amount: number;
  anchorStepName: string | null;
  status: 'SCHEDULED' | 'ISSUED' | 'PAID' | 'CANCELLED';
  transactionId: string | null;
}

export interface OrderFulfillmentProgress {
  flowName: string;
  steps: OrderFulfillmentStepProgress[];
  termins: TerminSummary[];
}

/** Tersimpan di `transaction.metadata.shipping` — hanya ada kalau checkout lewat flow baru (search-select + cek ongkir real, bukan tombol label statis). */
export interface TransactionShippingMetadata {
  location_id: string;
  destination_area_id: string;
  destination_area_name?: string;
  courier_code: string;
  courier_service_name?: string;
  /** Nama layanan hasil resolve server-side saat submit — sumber kebenaran tampilan kalau `courier_service_name` kosong. */
  resolved_service?: string;
}

/** Kode kurir (mis. 'jne') → label tampilan (mis. 'JNE'). Fallback: uppercase kode aslinya kalau tidak dikenali. */
const COURIER_LABELS: Record<string, string> = {
  jne: 'JNE',
  jnt: 'J&T Express',
  sicepat: 'SiCepat',
  pos: 'Pos Indonesia',
  tiki: 'TIKI',
  anteraja: 'AnterAja',
  wahana: 'Wahana',
  ninja: 'Ninja Xpress',
  lion: 'Lion Parcel',
  sap: 'SAP Express',
};
function formatCourierCode(code: string): string {
  return COURIER_LABELS[code.toLowerCase()] ?? code.toUpperCase();
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
  /** Biaya ongkir — kolom terpisah dari total_amount. Selalu berisi angka (default 0), BUKAN indikator "ongkir belum ditentukan" — pakai `metadata.shipping` untuk itu. */
  shipping_cost?: number | null;
  total_amount: number;
  currency: string;
  payment_mode: 'ADD_TO_CART' | 'ESCROW';
  status: string;
  /** Status BARANG, independen dari `status` (uang) di atas. */
  fulfillment_status: string;
  checkout_url: string | null;
  created_at: string;
  items?: TransactionItem[];
  /** `{ order_id: progress }` — hanya ada di response detail. */
  fulfillment?: Record<string, OrderFulfillmentProgress>;
  metadata?: { shipping?: TransactionShippingMetadata } | null;
}

export interface OrderDetail {
  id: string;
  product_id: string;
  product?: { name: string; images?: string[]; quotable?: boolean; uom?: { symbol?: string } | null } | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  quoted_total_amount: number | null;
  currency: string;
  payment_mode: 'ADD_TO_CART' | 'ESCROW';
  status: string;
  checkout_url: string | null;
  created_at: string;
  quoteTermins?: Array<{
    sequence: number;
    label: string;
    amount: number;
    status: 'SCHEDULED' | 'ISSUED' | 'PAID' | 'CANCELLED';
  }>;
  /** fulfillment-praorder-plan.md §2.1 — cuma ada kalau produknya punya step Praorder & order belum checkout. */
  praorderProgress?: OrderFulfillmentProgress | null;
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

/** Semua step (kalau ada flow) sudah `STEP_COMPLETED` — gate tombol "Selesai — Terima Barang" (§3.0). */
function allFulfillmentStepsCompleted(transaction: TransactionDetail): boolean {
  if (!transaction.fulfillment) return true;
  return Object.values(transaction.fulfillment).every((progress) => progress.steps.every((s) => s.completed));
}

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

  // `metadata.shipping` cuma ada kalau checkout lewat flow baru (cek ongkir
  // real) — transaksi lama (tombol label statis) tidak punya ini sama sekali.
  const shippingDetail = transaction.metadata?.shipping ?? null;
  const itemsSubtotal = items.reduce((sum, i) => sum + Number(i.total_amount), 0);
  const shippingCost = transaction.shipping_cost ?? 0;

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
                          {item.quantity}{item.order?.product?.uom?.symbol ? ` ${item.order.product.uom.symbol}` : ''} × Rp {Number(item.unit_price).toLocaleString('id-ID')}{item.order?.product?.uom?.symbol ? `/${item.order.product.uom.symbol}` : ''}
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

          {transaction.fulfillment && Object.keys(transaction.fulfillment).length > 0 && (
            <FulfillmentProgress
              transactionId={transaction.id}
              items={items}
              fulfillment={transaction.fulfillment}
            />
          )}

          {(transaction.courier || shippingDetail) && (
            <section>
              <h2
                className="text-sm font-bold uppercase tracking-wide"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Kurir Pengiriman
              </h2>
              {shippingDetail ? (
                <div
                  className="mt-4 space-y-2 rounded-xl border p-5 text-sm"
                  style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
                >
                  <Row
                    label="Kurir"
                    value={
                      formatCourierCode(shippingDetail.courier_code) +
                      (shippingDetail.courier_service_name || shippingDetail.resolved_service
                        ? ` — ${shippingDetail.courier_service_name ?? shippingDetail.resolved_service}`
                        : '')
                    }
                  />
                  <Row label="Biaya Ongkir" value={`Rp ${shippingCost.toLocaleString('id-ID')}`} />
                  {shippingDetail.destination_area_name && (
                    <Row label="Area Tujuan" value={shippingDetail.destination_area_name} />
                  )}
                </div>
              ) : (
                <div
                  className="mt-4 inline-flex rounded-lg border-2 px-4 py-2.5 text-sm font-medium"
                  style={{ borderColor: 'var(--brand-accent)', backgroundColor: 'var(--brand-bg)' }}
                >
                  {transaction.courier}
                </div>
              )}
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
                Rp {itemsSubtotal.toLocaleString('id-ID')}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt style={{ color: 'var(--brand-muted)' }}>Ongkir</dt>
              <dd className="font-semibold">
                {shippingDetail ? `Rp ${shippingCost.toLocaleString('id-ID')}` : 'Ditentukan penjual'}
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

          <OrderActionButtons
            transactionId={transaction.id}
            status={transaction.status}
            fulfillmentComplete={allFulfillmentStepsCompleted(transaction)}
          />
        </aside>
      </div>
    </section>
  );
}

/** Tampilan order legacy (sebelum W2.8 — escrow di level order). */
function LegacyOrderView({ order }: { order: OrderDetail }) {
  // fulfillment-praorder-plan.md Q5 — harga 0 = belum ada penawaran (seller
  // belum isi harga final), tampilkan "-" dulu, jangan "Rp 0" mentah
  // (terlihat seperti gratis/rusak).
  const finalQuoteAmount = order.quoted_total_amount ?? order.total_amount;
  const awaitingQuote = Boolean(order.product?.quotable && order.quoted_total_amount == null);
  const image = order.product?.images?.[0];

  return (
    <section className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div
        className="flex gap-4 rounded-xl border p-5 text-sm"
        style={{ borderColor: 'var(--brand-border)' }}
      >
        {image ? (
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="h-full w-full object-cover" />
          </div>
        ) : (
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg text-lg font-bold uppercase"
            style={{ backgroundColor: 'var(--brand-muted)', color: 'var(--brand-on-accent)' }}
          >
            {(order.product?.name ?? 'P').charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-3">
          <Row label="Produk" value={order.product?.name ?? order.product_id} />
          <Row label="Jumlah" value={String(order.quantity)} />
          <Row
            label="Total"
            value={awaitingQuote ? '-' : `Rp ${finalQuoteAmount.toLocaleString('id-ID')}`}
          />
          <Row
            label="Mode"
            value={order.payment_mode === 'ESCROW' ? 'Escrow' : 'Checkout Bagdja'}
          />
          <Row label="Status" value={STATUS_LABEL[order.status] ?? order.status} />
          <Row label="Tanggal" value={new Date(order.created_at).toLocaleString('id-ID')} />
        </div>
      </div>

      {order.praorderProgress && (
        <PraorderStepList orderId={order.id} progress={order.praorderProgress} />
      )}

      {order.praorderProgress && (
        <section
          className="mt-6 rounded-xl border p-5"
          style={{
            borderColor: 'var(--brand-accent)',
            backgroundColor: 'var(--brand-surface)',
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>
                Harga Penawaran
              </h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>
                Harga final setelah proses survey dan quotation.
              </p>
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--brand-accent-muted)' }}>
              {awaitingQuote ? '-' : `Rp ${finalQuoteAmount.toLocaleString('id-ID')}`}
            </p>
          </div>
          {!awaitingQuote && order.quantity > 1 && (
            <p className="mt-2 text-right text-xs" style={{ color: 'var(--brand-muted)' }}>
              Rp {order.unit_price.toLocaleString('id-ID')}{order.product?.uom?.symbol ? `/${order.product.uom.symbol}` : ''} × {order.quantity}{order.product?.uom?.symbol ? ` ${order.product.uom.symbol}` : ''}
            </p>
          )}
          {!awaitingQuote && (
            <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--brand-border)' }}>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span style={{ color: 'var(--brand-muted)' }}>Skema pembayaran</span>
                <span className="font-semibold">
                  {order.quoteTermins && order.quoteTermins.length > 1
                    ? `Termin (${order.quoteTermins.length} tahap)`
                    : 'Bayar penuh'}
                </span>
              </div>
              {order.quoteTermins && order.quoteTermins.length > 1 && (
                <div className="mt-3 space-y-2 text-xs">
                  {order.quoteTermins.map((termin) => (
                    <div key={termin.sequence} className="flex items-center justify-between gap-4">
                      <span style={{ color: 'var(--brand-muted)' }}>{termin.label}</span>
                      <span className="font-semibold">Rp {termin.amount.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {order.status === 'PENDING' && order.checkout_url && !awaitingQuote && (
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
