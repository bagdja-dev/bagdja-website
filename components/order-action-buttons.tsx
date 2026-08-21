'use client';

/**
 * Tombol aksi buyer di halaman detail transaksi — status menentukan tombol
 * mana yang tampil (lihat pemanggil di order-detail-content.tsx):
 * - CANCEL: transaksi PENDING_PAYMENT (belum diproses/dibayar).
 * - SELESAI: transaksi HELD — buyer konfirmasi terima barang → cairkan
 *   escrow ke penjual (aksi final, tidak bisa dibatalkan).
 * - AJUKAN KOMPLAIN: transaksi HELD — buka dispute (freeze escrow) kalau
 *   ada masalah dengan pesanan.
 *
 * Ketiganya memanggil endpoint yang bisa mengubah/mencairkan dana secara
 * permanen, jadi selalu minta konfirmasi lewat modal (`ConfirmDialog`) dulu
 * sebelum submit — satu instance modal dipakai bersama semua tombol di sini.
 */
import { useRouter } from 'next/navigation';
import { useState, type CSSProperties } from 'react';

import { ConfirmDialog } from './confirm-dialog';

type ActionKind = 'cancel' | 'complete' | 'dispute';

const ACTION_CONFIG: Record<
  ActionKind,
  {
    path: string;
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'primary' | 'danger';
    errorFallback: string;
  }
> = {
  cancel: {
    path: 'cancel',
    title: 'Batalkan Pesanan?',
    message: 'Pesanan ini akan dibatalkan dan tidak bisa diurungkan.',
    confirmLabel: 'Ya, Batalkan',
    variant: 'danger',
    errorFallback: 'Gagal membatalkan pesanan.',
  },
  complete: {
    path: 'complete',
    title: 'Konfirmasi Terima Barang?',
    message: 'Dana akan langsung dicairkan ke penjual dan tidak bisa dibatalkan.',
    confirmLabel: 'Ya, Barang Diterima',
    variant: 'primary',
    errorFallback: 'Gagal mengonfirmasi penerimaan barang.',
  },
  dispute: {
    path: 'dispute',
    title: 'Ajukan Komplain?',
    message: 'Dana akan ditahan sementara sampai komplain ini diselesaikan.',
    confirmLabel: 'Ya, Ajukan Komplain',
    variant: 'danger',
    errorFallback: 'Gagal mengajukan komplain.',
  },
};

const BUTTON_STYLE: Record<'primary' | 'danger' | 'ghost', CSSProperties> = {
  primary: { backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' },
  danger: { backgroundColor: 'transparent', color: 'crimson', border: '1px solid crimson' },
  ghost: { backgroundColor: 'transparent', color: 'var(--brand-text)', border: '1px solid var(--brand-border)' },
};

export function OrderActionButtons({
  transactionId,
  status,
}: {
  transactionId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<ActionKind | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!pending) return;
    const config = ACTION_CONFIG[pending];
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${transactionId}/${config.path}`, {
        method: 'POST',
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message ?? config.errorFallback);
      }
      setPending(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : ACTION_CONFIG[pending].errorFallback);
    } finally {
      setLoading(false);
    }
  }

  function handleCancelDialog() {
    if (loading) return;
    setPending(null);
    setError(null);
  }

  const dialogConfig = pending ? ACTION_CONFIG[pending] : null;

  const buttons =
    status === 'PENDING_PAYMENT' || status === 'PENDING' ? (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setPending('cancel')}
          className="flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-95"
          style={BUTTON_STYLE.danger}
        >
          Batalkan Pesanan
        </button>
      </div>
    ) : status === 'HELD' ? (
      <div className="mt-5 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setPending('complete')}
          className="flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-95"
          style={BUTTON_STYLE.primary}
        >
          Selesai — Terima Barang
        </button>
        <button
          type="button"
          onClick={() => setPending('dispute')}
          className="flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-95"
          style={BUTTON_STYLE.ghost}
        >
          Ajukan Komplain
        </button>
      </div>
    ) : null;

  return (
    <>
      {buttons}
      <ConfirmDialog
        open={pending !== null}
        title={dialogConfig?.title ?? ''}
        message={dialogConfig?.message ?? ''}
        error={error}
        confirmLabel={dialogConfig?.confirmLabel}
        variant={dialogConfig?.variant}
        loading={loading}
        onConfirm={handleConfirm}
        onCancel={handleCancelDialog}
      />
    </>
  );
}
