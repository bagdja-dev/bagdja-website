'use client';

/**
 * Tombol "Masukkan ke Keranjang" — cart server-side draft.
 * onClick async: panggil POST /api/orders (BFF → website-api draft). Server
 * draft ADALAH sumber kebenaran keranjang (lihat cart-content.tsx/
 * cart-badge.tsx, keduanya baca `GET /api/orders?cart=true` langsung) —
 * TIDAK ditulis dobel ke localStorage lagi (revisi 2026-08-24). Dulu ada
 * dual-write ke `useCart()` sebagai "fallback tampilan", tapi karena tidak
 * pernah dibersihkan setelah checkout, produk yang SUDAH dibeli bisa
 * muncul lagi seolah masih di keranjang begitu draft server-nya habis.
 * Error → onError.
 */
import { useState } from 'react';

export interface AddToCartButtonProps {
  slug: string;
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
  locationId?: string;
  paymentMode: 'ADD_TO_CART' | 'ESCROW';
  label?: string;
  /** Quantity yang ditambahkan (default 1). */
  quantity?: number;
  /** Dipanggil setelah sukses — bisa tampilkan pesan "Ditambahkan". */
  onAdded?: (orderId: string) => void;
  /** Dipanggil saat error — terima pesan dari server. */
  onError?: (message: string) => void;
  disabled?: boolean;
}

export function AddToCartButton({
  slug,
  websiteId,
  product,
  paymentMode,
  label = 'Masukkan ke Keranjang',
  quantity = 1,
  locationId,
  onAdded,
  onError,
  disabled = false,
}: AddToCartButtonProps) {
  const [busy, setBusy] = useState(false);
  const qty = Math.max(1, Math.floor(quantity || 1));
  const outOfStock = typeof product.stock === 'number' && product.stock <= 0;
  // Field `quotable` (website_products.quotable) adalah sumber kebenaran.
  // Rp 0 = sentinel "belum ada harga final" (fulfillment-praorder-plan.md
  // §2.1) dipertahankan sebagai fallback — CTA-nya minta penawaran, bukan
  // beli, walau paymentMode ESCROW.
  const isQuoteRequest = product.quotable === true || product.price <= 0;

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website_id: websiteId,
          product_id: product.id,
          quantity: qty,
          ...(locationId ? { location_id: locationId } : {}),
        }),
      });
      if (!res.ok) {
        let message = 'Gagal menambahkan ke keranjang';
        try {
          const body = await res.json();
          message = Array.isArray(body?.message)
            ? body.message.join(', ')
            : (body?.message ?? message);
        } catch {
          // keep default
        }
        onError?.(message);
        return;
      }
      const data = (await res.json()) as { id: string };
      // Beri tahu CartBadge (header) supaya count ikut refresh — dulu ini
      // otomatis lewat efek `items` di CartProvider (karena dual-write),
      // sekarang harus di-dispatch manual karena tidak ada lagi tulisan ke
      // cart lokal.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bagdja:cart-changed'));
      }
      onAdded?.(data.id);
    } catch {
      onError?.('Terjadi kesalahan jaringan. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={outOfStock || busy || disabled}
      onClick={handleClick}
      className="mt-3 inline-flex justify-center text-center rounded-full px-7 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
    >
      {outOfStock
        ? 'Stok Habis'
        : busy
          ? 'Menambah...'
          : isQuoteRequest
            ? 'Dapatkan Penawaran'
            : paymentMode === 'ESCROW'
              ? 'Beli (Escrow)'
              : label}
    </button>
  );
}
