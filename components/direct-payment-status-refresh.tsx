'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function DirectPaymentStatusRefresh() {
  const router = useRouter();

  useEffect(() => {
    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      router.refresh();
      if (attempts >= 36) window.clearInterval(interval);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [router]);

  return (
    <p className="mt-4 text-sm" style={{ color: 'var(--brand-muted)' }} aria-live="polite">
      Kami sedang mengonfirmasi pembayaran. Halaman ini akan diperbarui otomatis.
    </p>
  );
}