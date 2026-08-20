'use client';

/**
 * Tombol retry untuk transaksi PENDING_PAYMENT yang belum punya
 * `checkout_url` (mis. checkout sempat gagal di tengah jalan — escrow atau
 * payment-service error). Tidak mengirim provider/paymentMethod — itu
 * dipilih buyer di halaman Pay UI (pay.bagdja.com) setelah redirect.
 */
import { useState } from 'react';

export function RetryPaymentButton({
  transactionId,
  label = 'Coba Lagi',
  fullWidth = false,
}: {
  transactionId: string;
  label?: string;
  fullWidth?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${transactionId}/retry-checkout`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message ?? 'Gagal mencoba ulang pembayaran.');
      }
      if (!json?.checkout_url) {
        throw new Error('Gagal mendapatkan link pembayaran.');
      }
      window.location.href = json.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mencoba ulang pembayaran.');
      setLoading(false);
    }
  }

  return (
    <div className={fullWidth ? 'mt-5 w-full' : 'mt-6'}>
      <button
        type="button"
        onClick={handleRetry}
        disabled={loading}
        className={`${fullWidth ? 'flex w-full' : 'inline-flex'} items-center justify-center rounded-full px-8 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50`}
        style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
      >
        {loading ? 'Memproses…' : label}
      </button>
      {error && (
        <p className="mt-3 text-sm" style={{ color: 'crimson' }}>
          {error}
        </p>
      )}
    </div>
  );
}
