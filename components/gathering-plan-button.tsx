'use client';

import { useState } from 'react';

interface GatheringPlanButtonProps {
  websiteId: string;
  productId: string;
  basePath?: string;
  loginHref?: string;
  className?: string;
  children: string;
}

export function GatheringPlanButton({
  websiteId,
  productId,
  basePath = '',
  loginHref,
  className,
  children,
}: GatheringPlanButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function createPlan() {
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/gathering/plans', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website_id: websiteId, product_id: productId }),
      });

      if (response.status === 401) {
        if (loginHref) window.location.href = loginHref;
        else setError('Silakan login untuk membuat rencana gathering.');
        return;
      }

      const payload = await response.json().catch(() => null) as { id?: string; order_id?: string | null; message?: string } | null;
      if (!response.ok || !payload?.order_id) {
        throw new Error(payload?.message || 'Gagal membuat praorder gathering.');
      }

      window.location.href = `${basePath}/cart/order/${encodeURIComponent(payload.order_id)}`;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal membuat praorder gathering.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button type="button" onClick={() => void createPlan()} disabled={loading} className={className}>
        {loading ? 'Membuat praorder...' : children}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}