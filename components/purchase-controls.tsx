'use client';

/**
 * PurchaseControls — quantity stepper + stok + tombol cart untuk halaman
 * detail produk store-classic. Client component: memakai useCart.
 *
 * Urutan di halaman detail (sesuai arahan):
 *   [Varian] (di luar komponen ini)
 *   [Quantity - 1 +] Stok: N
 *   [+ Keranjang / Beli (Escrow)]
 *   (WhatsApp & Lynk dirender di luar, setelah komponen ini)
 *
 * Tombol cart async: POST /api/orders (BFF → website-api draft) lalu add ke
 * cart lokal dengan orderId. Pesan hasil/error ditampilkan inline.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AddToCartButton } from './cart-button';
import type { LocationItem } from '../lib/template-data';

export interface PurchaseControlsProps {
  slug: string;
  /** Base path untuk link internal (root-relative kalau via subdomain/custom domain) — lihat `resolveTenantLinkBase`. Dipakai buat link "lihat progres penawaran". */
  basePath?: string;
  websiteId: string;
  product: {
    id: string;
    slug: string;
    name: string;
    price: number;
    /** Sumber kebenaran produk quotation (`website_products.quotable`) — dipakai bareng `price<=0` sebagai fallback. */
    quotable?: boolean;
    image?: string;
    stock?: number;
  };
  paymentMode: 'ADD_TO_CART' | 'ESCROW';
  locationIds?: string[];
  locations?: LocationItem[];
  cartLabel?: string;
}

export function PurchaseControls({ slug, basePath, websiteId, product, paymentMode, locationIds = [], locations = [], cartLabel = '+ Keranjang' }: PurchaseControlsProps) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string; href?: string } | null>(null);
  // Field `quotable` (dari website_products) adalah sumber kebenaran —
  // `price<=0` dipertahankan sebagai fallback untuk produk lama yang belum
  // eksplisit ditandai quotable tapi harganya memang belum diisi.
  const isQuoteRequest = product.quotable === true || product.price <= 0;

  const max = useMemo(() => {
    if (typeof product.stock === 'number' && product.stock > 0) return product.stock;
    return undefined; // tanpa stock: tidak ada batas atas dari UI (validasi server di checkout)
  }, [product.stock]);

  const outOfStock = typeof product.stock === 'number' && product.stock <= 0;
  const displayStock = typeof product.stock === 'number' ? product.stock : undefined;
  const availableLocations = locations.filter((location) => locationIds.includes(location.id));

  const minus = () => setQty((q) => Math.max(1, q - 1));
  const plus = () => setQty((q) => (max !== undefined ? Math.min(max, q + 1) : q + 1));

  // `cartLabel` default ('+ Keranjang') = niat tambah banyak produk sekaligus
  // sebelum checkout, jadi tetap silent add-to-cart. `cartLabel` lain (mis.
  // "Pesan" di template workshop) = niat order 1 produk ini langsung, jadi
  // harus langsung diarahkan ke halaman detail order setelah draft dibuat —
  // sebelumnya cuma redirect untuk isQuoteRequest, produk harga tetap dengan
  // cartLabel non-default diam saja (bug: tombol "Pesan" terasa tidak berefek).
  const isDirectOrder = isQuoteRequest || cartLabel !== '+ Keranjang';

  const handleAdded = (orderId: string) => {
    if (isDirectOrder) {
      router.push(`${basePath ?? ''}/order/${orderId}`);
      return;
    }
    setFeedback({ ok: true, message: 'Ditambahkan ke keranjang' });
  };
  const handleError = (message: string) => {
    setFeedback({ ok: false, message });
  };

  const requiresLocation = locationIds.length > 0;

  return (
    <div className="mt-4 flex flex-col gap-3">
      {isQuoteRequest && (
        <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
          Harga belum ditentukan — kirim permintaan penawaran, tim kami akan menghubungi Anda.
        </p>
      )}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
          Jumlah
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={minus}
            className="flex h-9 w-9 items-center justify-center rounded-full border text-base transition-colors hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}
            aria-label="Kurangi jumlah"
            disabled={qty <= 1 || outOfStock}
          >
            −
          </button>
          <span className="w-10 text-center text-base font-bold" style={{ color: 'var(--brand-text)' }}>
            {qty}
          </span>
          <button
            type="button"
            onClick={plus}
            className="flex h-9 w-9 items-center justify-center rounded-full border text-base transition-colors hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}
            aria-label="Tambah jumlah"
            disabled={outOfStock || (max !== undefined && qty >= max)}
          >
            +
          </button>
        </div>
        {displayStock !== undefined && (
          <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>
            {outOfStock ? 'Stok habis' : `Stok: ${displayStock}`}
          </span>
        )}
      </div>

      {requiresLocation && (
        <label className="flex flex-col gap-1 text-sm" style={{ color: 'var(--brand-text)' }}>
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
            Lokasi layanan
          </span>
          <select
            value={selectedLocationId}
            onChange={(event) => setSelectedLocationId(event.target.value)}
            className="rounded-lg border px-3 py-2"
            style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-bg)' }}
          >
            <option value="">Pilih lokasi layanan</option>
            {availableLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}{location.city ? ` — ${location.city}` : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      <AddToCartButton
        slug={slug}
        websiteId={websiteId}
        product={product}
        paymentMode={paymentMode}
        quantity={qty}
        locationId={selectedLocationId || undefined}
        label={paymentMode === 'ESCROW' ? 'Beli (Escrow)' : cartLabel}
        onAdded={handleAdded}
        onError={handleError}
        disabled={requiresLocation && !selectedLocationId}
      />

      {feedback && (
        <p
          className="text-xs"
          style={{ color: feedback.ok ? 'var(--success, #16a34a)' : 'var(--destructive, #dc2626)' }}
        >
          {feedback.message}
          {feedback.href && (
            <>
              {' '}
              <a href={feedback.href} className="underline">
                Lihat progres penawaran →
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
