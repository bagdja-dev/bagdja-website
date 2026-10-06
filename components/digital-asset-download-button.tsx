'use client';

import { useState } from 'react';

export function DigitalAssetDownloadButton({ transactionId, deliveryId }: { transactionId: string; deliveryId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/transactions/${transactionId}/assets/${deliveryId}/download-url`, {
        method: 'POST',
        cache: 'no-store',
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.url) {
        throw new Error(result.message ?? result.error ?? 'Link download belum tersedia');
      }
      window.location.assign(result.url as string);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal membuat link download');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void download()}
        disabled={loading}
        className="rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
        style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
      >
        {loading ? 'Menyiapkan…' : 'Download'}
      </button>
      {error && <span role="alert" className="text-right text-xs text-red-600">{error}</span>}
    </div>
  );
}