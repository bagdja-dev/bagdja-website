'use client';

/**
 * Konten halaman Checkout — client component, dirender DI DALAM template
 * (section type `checkout`) supaya header/footer/theme konsisten.
 *
 * Berisi:
 * - Detail pemesanan: produk (foto, nama, deskripsi, qty, harga).
 * - Form alamat pengiriman (input baru): penerima, no. HP, alamat, kota,
 *   kecamatan, kode pos.
 * - Pilihan kurir (input baru): JNE / J&T / SiCepat / GoSend / AnterAja /
 *   Lainnya.
 * - Ringkasan + tombol bayar.
 *
 * Sumber item: ORDER DRAFT server-side (PENDING). Fallback cart lokal.
 * Submit: POST /api/orders/checkout (BFF) → website-api konversi draft
 * (escrow + payment) → redirect checkoutUrl. Alamat + kurir dikirim dan
 * disimpan server ke `order.metadata` (tanpa kolom DB baru).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useCart } from '../lib/cart';

interface DraftProduct {
  name?: string;
  images?: string[];
  price?: number;
  description?: string | null;
}

interface ServerOrder {
  id: string;
  product_id: string;
  website_id: string;
  product?: DraftProduct;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: string;
  transaction_id: string | null;  payment_mode: string;
}

interface ShippingForm {
  recipient_name: string;
  phone: string;
  address: string;
  city: string;
  district: string;
  postal_code: string;
}

const COURIERS = ['JNE', 'J&T', 'SiCepat', 'GoSend', 'AnterAja', 'Lainnya'] as const;

const EMPTY_SHIPPING: ShippingForm = {
  recipient_name: '',
  phone: '',
  address: '',
  city: '',
  district: '',
  postal_code: '',
};

function inputClass(): string {
  return 'w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:opacity-100';
}

export function CheckoutContent({
  slug,
  websiteId,
  initialOrderIds = [],
}: {
  slug: string;
  websiteId: string;
  initialOrderIds?: string[];
}) {
  const { items } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ServerOrder[] | null>(null);

  const [shipping, setShipping] = useState<ShippingForm>(EMPTY_SHIPPING);
  const [courier, setCourier] = useState<string | null>(null);

  const loadDrafts = useCallback(async () => {
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { data?: ServerOrder[] };
      const pending = (data?.data ?? []).filter(
        (o) => o.status === 'PENDING' && !o.transaction_id,
      );
      setDrafts(pending);
    } catch {
      // fallback ke cart lokal
    }
  }, []);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  // Sumber utama: order terpilih dari cart (initialOrderIds) — multi-item.
  // Kalau kosong: draft server pertama (perilaku lama). Fallback: cart lokal.
  const selectedOrders = useMemo(() => {
    if (!Array.isArray(drafts)) return null;
    if (initialOrderIds.length > 0) {
      const wanted = new Set(initialOrderIds);
      return drafts.filter((o) => wanted.has(o.id));
    }
    return drafts;
  }, [drafts, initialOrderIds]);

  const draftOrders = useMemo(() => {
    if (!selectedOrders || selectedOrders.length === 0) return [];
    return selectedOrders;
  }, [selectedOrders]);

  const draftOrder = draftOrders[0] ?? null;

  const localItem = items[0];

  const hasAny = draftOrders.length > 0 || Boolean(localItem);
  const extraCount = draftOrders.length > 0 ? 0 : Math.max(0, items.length - 1);

  // Detail pemesanan: SEMUA order terpilih (multi-item).
  const displayItems = useMemo(() => {
    if (draftOrders.length > 0) {
      return draftOrders.map((o) => ({
        id: o.id,
        name: o.product?.name ?? 'Produk',
        image: o.product?.images?.[0],
        description: o.product?.description ?? undefined,
        qty: o.quantity,
        price: Number(o.unit_price),
        mode: o.payment_mode,
      }));
    }
    if (localItem) {
      return [
        {
          id: localItem.productId,
          name: localItem.name,
          image: localItem.image,
          description: undefined,
          qty: localItem.quantity,
          price: localItem.price,
          mode: localItem.paymentMode ?? 'ADD_TO_CART',
        },
      ];
    }
    return [];
  }, [draftOrders, localItem]);

  const total = displayItems.reduce((acc, d) => acc + d.price * d.qty, 0);

  // Validasi: item terpilih harus ketemu semua (kalau ada yang sudah
  // di-checkout/dihapus, backend menolak).
  const missingSelection =
    initialOrderIds.length > 0 &&
    draftOrders.length !== initialOrderIds.length;
  const hasAnyItem = displayItems.length > 0;
  const isMulti = displayItems.length > 1;

  const setField = useCallback((field: keyof ShippingForm, value: string) => {
    setShipping((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Validasi client: data pengiriman wajib lengkap sebelum bayar.
  const shippingInvalid = useMemo(() => {
    return !(
      shipping.recipient_name.trim() &&
      shipping.phone.trim() &&
      shipping.address.trim() &&
      shipping.city.trim()
    );
  }, [shipping]);

  const canPay =
    hasAnyItem &&
    !missingSelection &&
    !shippingInvalid &&
    Boolean(courier) &&
    !loading;

  if (!hasAnyItem) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          Checkout
        </h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--brand-muted)' }}>
          {missingSelection
            ? 'Item yang dipilih sudah tidak tersedia (sudah di-checkout atau dihapus).'
            : 'Keranjang Anda masih kosong.'}
        </p>
        <Link
          href={`/${slug}`}
          className="mt-6 inline-flex rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-wide transition-transform hover:scale-105"
          style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
        >
          Lihat Produk
        </Link>
      </main>
    );
  }

  async function handlePay() {
    if (!canPay) return;
    setLoading(true);
    setError(null);
    try {
      // Item transaksi = id order (cart) PENDING milik buyer. Tanpa draft
      // (fallback cart lokal), buat order draft dulu → id-nya jadi item.
      let orderIds: string[] = draftOrders.map((o) => o.id);
      if (orderIds.length === 0 && localItem) {
        const draftRes = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            website_id: websiteId,
            product_id: localItem.productId,
            quantity: localItem.quantity,
          }),
        });
        const draftJson = await draftRes.json();
        if (!draftRes.ok) {
          throw new Error(draftJson?.message ?? 'Gagal menyiapkan pesanan.');
        }
        orderIds = [draftJson?.id as string];
      }
      if (orderIds.length === 0) throw new Error('Tidak ada item untuk di-checkout.');

      const res = await fetch('/api/transactions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_ids: orderIds,
          shipping_address: {
            recipient_name: shipping.recipient_name.trim(),
            phone: shipping.phone.trim(),
            address: shipping.address.trim(),
            city: shipping.city.trim(),
            district: shipping.district.trim() || undefined,
            postal_code: shipping.postal_code.trim() || undefined,
          },
          courier,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message ?? json?.error ?? 'Checkout gagal, coba lagi.');
      }
      if (!json?.checkout_url) {
        throw new Error('Gagal mendapatkan link pembayaran.');
      }
      window.location.href = json.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout gagal, coba lagi.');
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
        Checkout
      </h1>

      {extraCount > 0 && (
        <p
          className="mt-3 rounded-lg border px-4 py-3 text-xs"
          style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}
        >
          {extraCount} item lain di keranjang Anda tidak ikut di-checkout
          transaksi ini.
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Kolom kiri: detail pemesanan + alamat + kurir */}
        <div className="flex flex-col gap-8">
          {/* Detail pemesanan */}
          <section>
            <h2
              className="text-sm font-bold uppercase tracking-wide"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Detail Pemesanan ({displayItems.length} item)
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              {displayItems.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 rounded-xl border p-4"
                  style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
                >
                  {item.image ? (
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div
                      className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg text-lg font-bold uppercase"
                      style={{ backgroundColor: 'var(--brand-muted)', color: 'var(--brand-on-accent)' }}
                    >
                      {item.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium" style={{ fontFamily: 'var(--font-heading)' }}>
                      {item.name}
                    </p>
                    {item.description && (
                      <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--brand-muted)' }}>
                        {item.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>
                      {item.mode === 'ESCROW'
                        ? 'Escrow — dana ditahan sampai Anda konfirmasi terima barang'
                        : 'Checkout Bagdja'}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">
                        {item.qty} × Rp {item.price.toLocaleString('id-ID')}
                      </span>
                      <span className="text-sm font-bold" style={{ color: 'var(--brand-accent-muted)' }}>
                        Rp {(item.price * item.qty).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Alamat pengiriman */}
          <section>
            <h2
              className="text-sm font-bold uppercase tracking-wide"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Alamat Pengiriman
            </h2>
            <div
              className="mt-4 grid gap-4 rounded-xl border p-5 sm:grid-cols-2"
              style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
            >
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--brand-muted)' }}>
                  Nama Penerima <span style={{ color: 'var(--brand-accent)' }}>*</span>
                </span>
                <input
                  type="text"
                  value={shipping.recipient_name}
                  onChange={(e) => setField('recipient_name', e.target.value)}
                  placeholder="Nama penerima"
                  className={inputClass()}
                  style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-bg)' }}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--brand-muted)' }}>
                  No. HP <span style={{ color: 'var(--brand-accent)' }}>*</span>
                </span>
                <input
                  type="tel"
                  value={shipping.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className={inputClass()}
                  style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-bg)' }}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--brand-muted)' }}>
                  Alamat Lengkap <span style={{ color: 'var(--brand-accent)' }}>*</span>
                </span>
                <input
                  type="text"
                  value={shipping.address}
                  onChange={(e) => setField('address', e.target.value)}
                  placeholder="Jalan, nomor rumah, RT/RW, patokan"
                  className={inputClass()}
                  style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-bg)' }}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--brand-muted)' }}>
                  Kota/Kabupaten <span style={{ color: 'var(--brand-accent)' }}>*</span>
                </span>
                <input
                  type="text"
                  value={shipping.city}
                  onChange={(e) => setField('city', e.target.value)}
                  placeholder="Kota"
                  className={inputClass()}
                  style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-bg)' }}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--brand-muted)' }}>
                  Kecamatan
                </span>
                <input
                  type="text"
                  value={shipping.district}
                  onChange={(e) => setField('district', e.target.value)}
                  placeholder="Kecamatan (opsional)"
                  className={inputClass()}
                  style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-bg)' }}
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--brand-muted)' }}>
                  Kode Pos
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={shipping.postal_code}
                  onChange={(e) => setField('postal_code', e.target.value)}
                  placeholder="Kode pos (opsional)"
                  className={inputClass()}
                  style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-bg)' }}
                />
              </label>
            </div>
          </section>

          {/* Kurir pengiriman */}
          <section>
            <h2
              className="text-sm font-bold uppercase tracking-wide"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Kurir Pengiriman
            </h2>
            <div
              className="mt-4 grid grid-cols-2 gap-2 rounded-xl border p-5 sm:grid-cols-3"
              style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
            >
              {COURIERS.map((c) => {
                const active = courier === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCourier(c)}
                    aria-pressed={active}
                    className={`rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                      active ? '' : 'hover:opacity-80'
                    }`}
                    style={{
                      borderColor: active ? 'var(--brand-accent)' : 'var(--brand-border)',
                      backgroundColor: 'var(--brand-bg)',
                      color: 'var(--brand-text)',
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--brand-muted)' }}>
              Biaya ongkir ditentukan penjual setelah pesanan diproses.
            </p>
          </section>
        </div>

        {/* Kolom kanan: ringkasan */}
        <aside
          className="h-fit rounded-xl border p-5 lg:sticky lg:top-24"
          style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
        >
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>
            Ringkasan
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt style={{ color: 'var(--brand-muted)' }}>
                {displayItems.length > 1
                  ? `${displayItems.length} item`
                  : `${displayItems[0]?.qty} × ${displayItems[0]?.name ?? 'Produk'}`}
              </dt>
              <dd className="font-semibold">Rp {total.toLocaleString('id-ID')}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt style={{ color: 'var(--brand-muted)' }}>Ongkir</dt>
              <dd style={{ color: 'var(--brand-muted)' }}>Ditentukan penjual</dd>
            </div>
            <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: 'var(--brand-border)' }}>
              <dt className="font-semibold">Total</dt>
              <dd className="text-xl font-bold">Rp {total.toLocaleString('id-ID')}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={handlePay}
            disabled={!canPay}
            className="mt-5 w-full rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
          >
            {loading ? 'Memproses…' : 'Bayar Sekarang'}
          </button>

          {shippingInvalid && (
            <p className="mt-3 text-xs" style={{ color: 'var(--brand-muted)' }}>
              Lengkapi alamat pengiriman (nama, HP, alamat, kota) dulu.
            </p>
          )}
          {!shippingInvalid && !courier && (
            <p className="mt-3 text-xs" style={{ color: 'var(--brand-muted)' }}>
              Pilih kurir pengiriman dulu.
            </p>
          )}
          {missingSelection && (
            <p className="mt-3 text-xs" style={{ color: 'crimson' }}>
              Sebagian item yang dipilih sudah tidak tersedia (sudah di-checkout
              atau dihapus). Kembali ke keranjang untuk memilih ulang.
            </p>
          )}

          {error && (
            <p className="mt-3 text-sm" style={{ color: 'crimson' }}>
              {error}
            </p>
          )}

          <p
            className="mt-4 rounded-lg border px-3 py-2 text-xs leading-relaxed"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}
          >
            Item terpilih di-checkout dalam satu transaksi ({displayItems.length} item).
            Item lain tetap di keranjang sampai transaksi ini selesai.
          </p>
        </aside>
      </div>
    </main>
  );
}
