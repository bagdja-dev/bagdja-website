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
import { AddToCartButton } from './cart-button';

export interface PurchaseControlsProps {
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
}

export function PurchaseControls({ slug, websiteId, product, paymentMode }: PurchaseControlsProps) {
  const [qty, setQty] = useState(1);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const max = useMemo(() => {
    if (typeof product.stock === 'number' && product.stock > 0) return product.stock;
    return undefined; // tanpa stock: tidak ada batas atas dari UI (validasi server di checkout)
  }, [product.stock]);

  const outOfStock = typeof product.stock === 'number' && product.stock <= 0;
  const displayStock = typeof product.stock === 'number' ? product.stock : undefined;

  const minus = () => setQty((q) => Math.max(1, q - 1));
  const plus = () => setQty((q) => (max !== undefined ? Math.min(max, q + 1) : q + 1));

  const handleAdded = (orderId: string) => {
    setFeedback({ ok: true, message: 'Ditambahkan ke keranjang' });
  };
  const handleError = (message: string) => {
    setFeedback({ ok: false, message });
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
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

      <AddToCartButton
        slug={slug}
        websiteId={websiteId}
        product={product}
        paymentMode={paymentMode}
        quantity={qty}
        label={paymentMode === 'ESCROW' ? 'Beli (Escrow)' : '+ Keranjang'}
        onAdded={handleAdded}
        onError={handleError}
      />

      {feedback && (
        <p
          className="text-xs"
          style={{ color: feedback.ok ? 'var(--success, #16a34a)' : 'var(--destructive, #dc2626)' }}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
