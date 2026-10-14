'use client';

/**
 * Tombol bayar / lanjutkan pembayaran untuk transaksi PENDING_PAYMENT.
 * Selalu minta link baru lewat `retry-checkout` alih-alih membuka
 * `checkout_url` tersimpan: sesi checkout Pay UI punya TTL dan disimpan
 * in-memory di payment-service, jadi link lama bisa sudah mati
 * ("Checkout session expired or not found"). Backend menerbitkan ulang
 * sesi + token untuk payment request yang masih pending.
 * Tidak mengirim provider/paymentMethod — itu dipilih buyer di halaman
 * Pay UI (pay.bagdja.com) setelah redirect.
 */
import { useState } from 'react';

export function RetryPaymentButton({
  transactionId,
  label = 'Coba Lagi',
  fullWidth = false,
  wrapperClassName,
  buttonClassName,
}: {
  transactionId: string;
  label?: string;
  fullWidth?: boolean;
  /** Override class wrapper (default: margin atas, lebar penuh bila `fullWidth`). */
  wrapperClassName?: string;
  /** Override class tombol (default: tombol pill besar). */
  buttonClassName?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transactions/${encodeURIComponent(transactionId)}/retry-checkout`, {
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
    <div className={wrapperClassName ?? (fullWidth ? 'mt-5 w-full' : 'mt-6')}>
      <button
        type="button"
        onClick={handleRetry}
        disabled={loading}
        className={buttonClassName ?? `${fullWidth ? 'flex w-full' : 'inline-flex'} items-center justify-center rounded-full px-8 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.03] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50`}
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
