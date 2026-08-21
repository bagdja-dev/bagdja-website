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
 * permanen, jadi selalu minta konfirmasi native (`window.confirm`) dulu
 * sebelum submit.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ActionKind = 'cancel' | 'complete' | 'dispute';

const ACTION_CONFIG: Record<
  ActionKind,
  { path: string; confirmMessage: string; errorFallback: string }
> = {
  cancel: {
    path: 'cancel',
    confirmMessage: 'Batalkan pesanan ini? Tindakan ini tidak bisa diurungkan.',
    errorFallback: 'Gagal membatalkan pesanan.',
  },
  complete: {
    path: 'complete',
    confirmMessage:
      'Konfirmasi barang sudah diterima? Dana akan langsung dicairkan ke penjual dan tidak bisa dibatalkan.',
    errorFallback: 'Gagal mengonfirmasi penerimaan barang.',
  },
  dispute: {
    path: 'dispute',
    confirmMessage:
      'Ajukan komplain untuk pesanan ini? Dana akan ditahan sementara sampai komplain diselesaikan.',
    errorFallback: 'Gagal mengajukan komplain.',
  },
};

function ActionButton({
  transactionId,
  kind,
  label,
  variant,
}: {
  transactionId: string;
  kind: ActionKind;
  label: string;
  variant: 'primary' | 'danger' | 'ghost';
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const config = ACTION_CONFIG[kind];

  async function handleClick() {
    if (!window.confirm(config.confirmMessage)) return;
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
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : config.errorFallback);
    } finally {
      setLoading(false);
    }
  }

  const style =
    variant === 'primary'
      ? { backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }
      : variant === 'danger'
        ? { backgroundColor: 'transparent', color: 'crimson', border: '1px solid crimson' }
        : { backgroundColor: 'transparent', color: 'var(--brand-text)', border: '1px solid var(--brand-border)' };

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        style={style}
      >
        {loading ? 'Memproses…' : label}
      </button>
      {error && (
        <p className="mt-2 text-xs" style={{ color: 'crimson' }}>
          {error}
        </p>
      )}
    </div>
  );
}

export function OrderActionButtons({
  transactionId,
  status,
}: {
  transactionId: string;
  status: string;
}) {
  if (status === 'PENDING_PAYMENT' || status === 'PENDING') {
    return (
      <div className="mt-3">
        <ActionButton transactionId={transactionId} kind="cancel" label="Batalkan Pesanan" variant="danger" />
      </div>
    );
  }

  if (status === 'HELD') {
    return (
      <div className="mt-5 flex flex-col gap-3">
        <ActionButton transactionId={transactionId} kind="complete" label="Selesai — Terima Barang" variant="primary" />
        <ActionButton transactionId={transactionId} kind="dispute" label="Ajukan Komplain" variant="ghost" />
      </div>
    );
  }

  return null;
}
