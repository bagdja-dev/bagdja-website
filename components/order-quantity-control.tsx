'use client';

import { useState } from 'react';

interface OrderQuantityControlProps {
  orderId: string;
  initialQuantity: number;
  locked: boolean;
}

export function OrderQuantityControl({ orderId, initialQuantity, locked }: OrderQuantityControlProps) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeQuantity = async (nextQuantity: number) => {
    if (locked || busy || nextQuantity < 1) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: nextQuantity }),
      });
      const body = (await response.json().catch(() => null)) as { quantity?: number; message?: string } | null;
      if (!response.ok) {
        throw new Error(body?.message ?? 'Gagal mengubah jumlah');
      }
      setQuantity(typeof body?.quantity === 'number' ? body.quantity : nextQuantity);
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'Gagal mengubah jumlah');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold">Jumlah</span>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void changeQuantity(quantity - 1)}
              disabled={locked || busy || quantity <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-full border text-base transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: 'var(--brand-border)' }}
              aria-label="Kurangi jumlah"
            >
              −
            </button>
            <span className="w-8 text-center text-sm font-semibold" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => void changeQuantity(quantity + 1)}
              disabled={locked || busy}
              className="flex h-8 w-8 items-center justify-center rounded-full border text-base transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: 'var(--brand-border)' }}
              aria-label="Tambah jumlah"
            >
              +
            </button>
          </div>
          {locked ? <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>Terkunci setelah quotation</span> : null}
        </div>
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}