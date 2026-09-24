'use client';

/**
 * Konten halaman Checkout — client component, dirender DI DALAM template
 * (section type `checkout`) supaya header/footer/theme konsisten.
 *
 * DUA FLOW, tergantung apakah website ini punya lokasi "shippable" (sudah
 * diisi `shipping_area_name` lewat admin > Lokasi) — lihat
 * plan/website-builder/integration-check-shipping-plan.md Fase 3:
 *
 * - `shippableLocations.length === 0` → flow LAMA dipertahankan apa adanya
 *   (kota/kecamatan free-text, tombol label kurir statis, ongkir "ditentukan
 *   penjual") — backward-compat wajib untuk tenant yang belum setup.
 * - `shippableLocations.length >= 1` → flow BARU: search-select tujuan,
 *   pilih lokasi asal (disembunyikan kalau cuma 1 lokasi shippable), cek
 *   ongkir real-time (`POST /api/shipping/cost`), pilih kurir dari hasil
 *   nyata, ongkir ikut ditagih (`shipping_cost`) — cost yang di-charge tetap
 *   divalidasi ULANG server-side saat submit (lihat transactions.service.ts).
 *
 * Sumber item: draft order server (`GET /api/orders?cart=true`) — SATU-
 * SATUNYA sumber kebenaran (revisi 2026-08-24). Submit: POST
 * /api/transactions/checkout (BFF) → website-api buat transaksi +
 * escrow/payment → redirect checkoutUrl.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShippingAreaSearch, type ShippingAreaValue } from './shipping-area-search';
import type { LocationItem } from '../lib/template-data';

interface DraftProduct {
  name?: string;
  images?: string[];
  price?: number;
  description?: string | null;
  /** fulfillment-praorder-plan.md §2.6/§0.1 (Q10) — independen dari `type`/vendor-routing. */
  requires_shipping?: boolean;
  uom?: { symbol?: string } | null;
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
  transaction_id: string | null;
  payment_mode: string;
}

interface ShippingForm {
  recipient_name: string;
  phone: string;
  address: string;
  /** Flow lama saja (free-text) — flow baru pakai `destinationArea`. */
  city: string;
  district: string;
  postal_code: string;
}

interface ShippingCostOption {
  courierCode: string;
  serviceName: string;
  cost: number;
  etdMinDays?: number;
  etdMaxDays?: number;
}

/** Flow lama saja — dipakai kalau website belum punya lokasi shippable. */
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
  basePath,
  websiteId,
  initialOrderIds = [],
  locations = [],
}: {
  /** Kosong ('') di subdomain/custom domain, `/{slug}` di path-based (local dev) — lihat `resolveTenantLinkBase`. */
  basePath: string;
  websiteId: string;
  initialOrderIds?: string[];
  locations?: LocationItem[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ServerOrder[] | null>(null);
  const [draftsError, setDraftsError] = useState(false);

  const [shipping, setShipping] = useState<ShippingForm>(EMPTY_SHIPPING);
  const [courier, setCourier] = useState<string | null>(null);

  // ─── Flow baru: lokasi asal + tujuan search-select + cost real ──────────
  const shippableLocations = useMemo(
    () => locations.filter((l) => l.shippingEnabled),
    [locations],
  );
  const websiteHasShippableLocations = shippableLocations.length > 0;

  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [destinationArea, setDestinationArea] = useState<ShippingAreaValue | null>(null);
  const [costOptions, setCostOptions] = useState<ShippingCostOption[] | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState<string | null>(null);
  const [selectedCourierOption, setSelectedCourierOption] = useState<ShippingCostOption | null>(null);

  // Cuma 1 lokasi shippable → auto-pakai, jangan tampilkan picker (poin #1).
  useEffect(() => {
    if (shippableLocations.length === 1) {
      setSelectedLocationId(shippableLocations[0].id);
    }
  }, [shippableLocations]);

  const loadDrafts = useCallback(async () => {
    setDraftsError(false);
    try {
      const res = await fetch(`/api/orders?cart=true&website_id=${encodeURIComponent(websiteId)}`, { cache: 'no-store' });
      if (!res.ok) {
        setDraftsError(true);
        return;
      }
      const data = (await res.json()) as { data?: ServerOrder[] };
      setDrafts(data?.data ?? []);
    } catch {
      setDraftsError(true);
    }
  }, [websiteId]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  // Sumber utama: order terpilih dari cart (initialOrderIds) — multi-item.
  // Kalau kosong (akses langsung tanpa lewat cart): tampilkan semua draft.
  const selectedOrders = useMemo(() => {
    if (!Array.isArray(drafts)) return null;
    if (initialOrderIds.length > 0) {
      const wanted = new Set(initialOrderIds);
      return drafts.filter((o) => wanted.has(o.id));
    }
    return drafts;
  }, [drafts, initialOrderIds]);

  // Masih menunggu fetch draft server selesai (belum sukses ATAU gagal) —
  // JANGAN jatuh ke tampilan "kosong" dulu sebelum ini selesai.
  const draftsLoading = drafts === null && !draftsError;

  const draftOrders = useMemo(() => selectedOrders ?? [], [selectedOrders]);

  // fulfillment-praorder-plan.md §2.6/§0.1 (Q10) — kalau SEMUA item yang mau
  // di-checkout ini requires_shipping=false (mis. jasa on-site/digital), flow
  // ongkir (baik lama maupun baru) tidak relevan sama sekali, terlepas dari
  // apakah website ini punya lokasi shippable untuk produk fisiknya yang lain.
  const cartNeedsShipping = draftOrders.some((o) => o.product?.requires_shipping !== false);
  const shippingEnabled = websiteHasShippableLocations && cartNeedsShipping;

  // Item yang sengaja TIDAK dicentang di cart tetap tinggal di keranjang.
  const extraCount =
    initialOrderIds.length > 0 && Array.isArray(drafts)
      ? Math.max(0, drafts.length - draftOrders.length)
      : 0;

  // Detail pemesanan: SEMUA order terpilih (multi-item).
  const displayItems = useMemo(
    () =>
      draftOrders.map((o) => ({
        id: o.id,
        name: o.product?.name ?? 'Produk',
        image: o.product?.images?.[0],
        description: o.product?.description ?? undefined,
        qty: o.quantity,
        price: Number(o.unit_price),
        uomSymbol: o.product?.uom?.symbol,
        mode: o.payment_mode,
      })),
    [draftOrders],
  );

  const subtotal = displayItems.reduce((acc, d) => acc + d.price * d.qty, 0);
  const shippingCost = shippingEnabled ? selectedCourierOption?.cost ?? 0 : 0;
  const total = subtotal + shippingCost;

  const orderIdsKey = useMemo(
    () => draftOrders.map((o) => o.id).slice().sort().join(','),
    [draftOrders],
  );

  // Cek ongkir real-time begitu lokasi + tujuan + item terpilih siap.
  useEffect(() => {
    if (!shippingEnabled) return;
    if (!selectedLocationId || !destinationArea || draftOrders.length === 0) {
      setCostOptions(null);
      setSelectedCourierOption(null);
      setCostError(null);
      return;
    }
    let cancelled = false;
    setCostLoading(true);
    setCostError(null);
    (async () => {
      try {
        const res = await fetch('/api/shipping/cost', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            websiteId,
            order_ids: draftOrders.map((o) => o.id),
            location_id: selectedLocationId,
            destination_area_id: destinationArea.id,
          }),
        });
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setCostOptions(null);
          setSelectedCourierOption(null);
          setCostError(json?.message ?? 'Gagal menghitung ongkir untuk tujuan ini.');
          return;
        }
        const options: ShippingCostOption[] = Array.isArray(json) ? json : [];
        setCostOptions(options);
        setSelectedCourierOption((prev) => {
          const stillValid = prev && options.find((o) => o.courierCode === prev.courierCode);
          return stillValid ? (stillValid as ShippingCostOption) : null;
        });
      } catch {
        if (!cancelled) {
          setCostOptions(null);
          setSelectedCourierOption(null);
          setCostError('Layanan pengiriman tidak bisa dihubungi, coba lagi.');
        }
      } finally {
        if (!cancelled) setCostLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingEnabled, selectedLocationId, destinationArea?.id, orderIdsKey, websiteId]);

  // Validasi: item terpilih harus ketemu semua (kalau ada yang sudah
  // di-checkout/dihapus, backend menolak).
  const missingSelection =
    initialOrderIds.length > 0 && draftOrders.length !== initialOrderIds.length;
  const hasAnyItem = displayItems.length > 0;

  const setField = useCallback((field: keyof ShippingForm, value: string) => {
    setShipping((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Validasi client: data pengiriman wajib lengkap sebelum bayar.
  const shippingInvalid = useMemo(() => {
    // Cart 100% requires_shipping=false (jasa on-site/digital) — alamat &
    // kurir memang tidak relevan, jangan blokir checkout gara-gara ini
    // (§2.6/§0.1 fulfillment-praorder-plan.md, Q10).
    if (!cartNeedsShipping) return false;
    const baseValid = Boolean(
      shipping.recipient_name.trim() && shipping.phone.trim() && shipping.address.trim(),
    );
    if (shippingEnabled) {
      return !(baseValid && destinationArea);
    }
    return !(baseValid && shipping.city.trim());
  }, [shipping, shippingEnabled, destinationArea, cartNeedsShipping]);

  const canPay =
    hasAnyItem &&
    !missingSelection &&
    !shippingInvalid &&
    (!cartNeedsShipping || (shippingEnabled ? Boolean(selectedCourierOption) : Boolean(courier))) &&
    !loading;

  if (draftsLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          Checkout
        </h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--brand-muted)' }}>
          Memuat pesanan…
        </p>
      </main>
    );
  }

  if (!hasAnyItem) {
    const showRetry = draftsError;
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          Checkout
        </h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--brand-muted)' }}>
          {showRetry
            ? 'Gagal memuat pesanan dari server. Coba lagi sebelum melanjutkan.'
            : missingSelection
              ? 'Item yang dipilih sudah tidak tersedia (sudah di-checkout atau dihapus).'
              : 'Keranjang Anda masih kosong.'}
        </p>
        {showRetry ? (
          <button
            type="button"
            onClick={() => void loadDrafts()}
            className="mt-6 inline-flex rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-wide transition-transform hover:scale-105"
            style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
          >
            Coba Lagi
          </button>
        ) : (
          <Link
            href={basePath || '/'}
            className="mt-6 inline-flex rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-wide transition-transform hover:scale-105"
            style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
          >
            Lihat Produk
          </Link>
        )}
      </main>
    );
  }

  async function handlePay() {
    if (!canPay) return;
    setLoading(true);
    setError(null);
    try {
      const orderIds = draftOrders.map((o) => o.id);
      const payload: Record<string, unknown> = {
        order_ids: orderIds,
        shipping_address: {
          recipient_name: shipping.recipient_name.trim(),
          phone: shipping.phone.trim(),
          address: shipping.address.trim(),
          city: shippingEnabled ? destinationArea?.name : shipping.city.trim(),
          district: shippingEnabled ? undefined : shipping.district.trim() || undefined,
          postal_code: shipping.postal_code.trim() || undefined,
        },
      };
      if (shippingEnabled && selectedCourierOption && selectedLocationId && destinationArea) {
        payload.shipping = {
          location_id: selectedLocationId,
          destination_area_id: destinationArea.id,
          destination_area_name: destinationArea.name,
          courier_code: selectedCourierOption.courierCode,
          courier_service_name: selectedCourierOption.serviceName,
        };
      } else {
        payload.courier = courier;
      }

      const res = await fetch('/api/transactions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
                        {item.qty}{item.uomSymbol ? ` ${item.uomSymbol}` : ''} × Rp {item.price.toLocaleString('id-ID')}{item.uomSymbol ? `/${item.uomSymbol}` : ''}
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

          {/* Lokasi asal pengiriman — cuma tampil kalau >1 lokasi shippable (poin #1) */}
          {shippingEnabled && shippableLocations.length > 1 && (
            <section>
              <h2
                className="text-sm font-bold uppercase tracking-wide"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Kirim Dari
              </h2>
              <div
                className="mt-4 grid grid-cols-1 gap-2 rounded-xl border p-5 sm:grid-cols-2"
                style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
              >
                {shippableLocations.map((loc) => {
                  const active = selectedLocationId === loc.id;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => setSelectedLocationId(loc.id)}
                      aria-pressed={active}
                      className="rounded-lg border-2 px-3 py-2.5 text-left text-sm font-medium transition-colors hover:opacity-80"
                      style={{
                        borderColor: active ? 'var(--brand-accent)' : 'var(--brand-border)',
                        backgroundColor: 'var(--brand-bg)',
                        color: 'var(--brand-text)',
                      }}
                    >
                      {loc.name}
                      {loc.city && (
                        <span className="mt-0.5 block text-xs" style={{ color: 'var(--brand-muted)' }}>
                          {loc.city}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

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

              {shippingEnabled ? (
                <div className="sm:col-span-2">
                  <ShippingAreaSearch value={destinationArea} onChange={setDestinationArea} />
                </div>
              ) : (
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
              )}

              {!shippingEnabled && (
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
              )}
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

            {shippingEnabled ? (
              <div
                className="mt-4 rounded-xl border p-5"
                style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
              >
                {!selectedLocationId || !destinationArea ? (
                  <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                    Isi kota/kecamatan tujuan dulu untuk lihat pilihan kurir & ongkir.
                  </p>
                ) : costLoading ? (
                  <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                    Menghitung ongkir…
                  </p>
                ) : costError ? (
                  <p className="text-xs" style={{ color: 'crimson' }}>
                    {costError}
                  </p>
                ) : costOptions && costOptions.length > 0 ? (
                  <div className="grid gap-2">
                    {costOptions.map((opt) => {
                      const active = selectedCourierOption?.courierCode === opt.courierCode &&
                        selectedCourierOption?.serviceName === opt.serviceName;
                      return (
                        <button
                          key={`${opt.courierCode}-${opt.serviceName}`}
                          type="button"
                          onClick={() => setSelectedCourierOption(opt)}
                          aria-pressed={active}
                          className="flex items-center justify-between rounded-lg border-2 px-4 py-3 text-left text-sm transition-colors hover:opacity-80"
                          style={{
                            borderColor: active ? 'var(--brand-accent)' : 'var(--brand-border)',
                            backgroundColor: 'var(--brand-bg)',
                            color: 'var(--brand-text)',
                          }}
                        >
                          <span>
                            <span className="font-semibold uppercase">{opt.courierCode}</span>{' '}
                            {opt.serviceName}
                            {(opt.etdMinDays || opt.etdMaxDays) && (
                              <span className="ml-2 text-xs" style={{ color: 'var(--brand-muted)' }}>
                                Estimasi {opt.etdMinDays ?? '?'}-{opt.etdMaxDays ?? '?'} hari
                              </span>
                            )}
                          </span>
                          <span className="font-bold">Rp {opt.cost.toLocaleString('id-ID')}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                    Tidak ada kurir tersedia untuk tujuan ini.
                  </p>
                )}
              </div>
            ) : (
              <>
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
              </>
            )}
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
              <dd className="font-semibold">Rp {subtotal.toLocaleString('id-ID')}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt style={{ color: 'var(--brand-muted)' }}>Ongkir</dt>
              <dd style={{ color: selectedCourierOption ? undefined : 'var(--brand-muted)' }}>
                {shippingEnabled
                  ? selectedCourierOption
                    ? `Rp ${selectedCourierOption.cost.toLocaleString('id-ID')}`
                    : 'Pilih kurir dulu'
                  : 'Ditentukan penjual'}
              </dd>
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
              {shippingEnabled
                ? 'Lengkapi alamat pengiriman (nama, HP, alamat, kota/kecamatan tujuan) dulu.'
                : 'Lengkapi alamat pengiriman (nama, HP, alamat, kota) dulu.'}
            </p>
          )}
          {!shippingInvalid && shippingEnabled && !selectedCourierOption && (
            <p className="mt-3 text-xs" style={{ color: 'var(--brand-muted)' }}>
              Pilih kurir pengiriman dulu.
            </p>
          )}
          {!shippingInvalid && !shippingEnabled && !courier && (
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
