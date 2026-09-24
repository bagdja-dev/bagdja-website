'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ConfirmDialog } from './confirm-dialog';

export function DraftOrderCancelButton({ orderId, ordersHref }: { orderId: string; ordersHref: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelDraft = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}`, { method: 'DELETE' });
      const body = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(body?.message ?? 'Gagal membatalkan penawaran.');
      setOpen(false);
      router.push(ordersHref);
      router.refresh();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : 'Gagal membatalkan penawaran.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 flex w-full items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-opacity hover:opacity-80"
        style={{ borderColor: 'crimson', color: 'crimson' }}
      >
        Batalkan Penawaran
      </button>
      <ConfirmDialog
        open={open}
        title="Batalkan Penawaran?"
        message="Penawaran ini akan dibatalkan dan tidak bisa diurungkan."
        error={error}
        confirmLabel="Ya, Batalkan"
        variant="danger"
        loading={loading}
        onConfirm={() => void cancelDraft()}
        onCancel={() => {
          if (!loading) {
            setOpen(false);
            setError(null);
          }
        }}
      />
    </>
  );
}