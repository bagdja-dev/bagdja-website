'use client';

/**
 * Tombol "Masukkan ke Keranjang" — W1b/W2 cart server-side draft.
 * onClick async: panggil POST /api/orders (BFF → website-api draft), lalu
 * tambahkan item ke cart lokal dengan orderId dari server. Error → onError.
 */
import { useState } from 'react';
import { useCart } from '../lib/cart';

export interface AddToCartButtonProps {
  slug: string;
  websiteId: string;
  product: {
    id: string;
    slug: string;
    name: string;
    price: number;
    image?: string;
    stock?: number;
  };
  paymentMode: 'ADD_TO_CART' | 'ESCROW';
  label?: string;
  /** Quantity yang ditambahkan (default 1). */
  quantity?: number;
  /** Dipanggil setelah sukses — bisa tampilkan pesan "Ditambahkan". */
  onAdded?: (orderId: string) => void;
  /** Dipanggil saat error — terima pesan dari server. */
  onError?: (message: string) => void;
}

export function AddToCartButton({
  slug,
  websiteId,
  product,
  paymentMode,
  label = 'Masukkan ke Keranjang',
  quantity = 1,
  onAdded,
  onError,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [busy, setBusy] = useState(false);
  const qty = Math.max(1, Math.floor(quantity || 1));
  const outOfStock = typeof product.stock === 'number' && product.stock <= 0;

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
      addItem(
        {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          price: product.price,
          image: product.image,
          stock: product.stock,
          paymentMode,
        },
        qty,
        data.id,
      );
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
      disabled={outOfStock || busy}
      onClick={handleClick}
      className="mt-3 inline-flex rounded-full px-7 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
    >
      {outOfStock
        ? 'Stok Habis'
        : busy
          ? 'Menambah...'
          : paymentMode === 'ESCROW'
            ? 'Beli (Escrow)'
            : label}
    </button>
  );
}
