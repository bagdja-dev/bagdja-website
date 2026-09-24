'use client';

/**
 * TagihanBadge — ikon Tagihan + jumlah Termin/Tagihan `ISSUED` (perlu
 * dibayar) di header template. Model dari `cart-badge.tsx`. Hanya tampil
 * saat user login. Refresh otomatis lewat event `bagdja:tagihan-changed`
 * (di-dispatch `tagihan-content.tsx` dan `fulfillment-progress.tsx` setelah
 * bayar Termin sukses).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

export interface TagihanBadgeProps {
  href: string;
  isLoggedIn: boolean;
  label?: string;
}

export function TagihanBadge({ href, isLoggedIn, label = 'Tagihan' }: TagihanBadgeProps) {
  const [count, setCount] = useState(0);

  const loadCount = useCallback(async () => {
    try {
      const res = await fetch('/api/transactions/termins/count?status=ISSUED', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { count?: number };
      setCount(Number(data?.count ?? 0));
    } catch {
      // biarkan count apa adanya (nilai terakhir yang berhasil dimuat)
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    void loadCount();
    window.addEventListener('bagdja:tagihan-changed', loadCount);
    window.addEventListener('focus', loadCount);
    return () => {
      window.removeEventListener('bagdja:tagihan-changed', loadCount);
      window.removeEventListener('focus', loadCount);
    };
  }, [isLoggedIn, loadCount]);

  if (!isLoggedIn) return null;

  return (
    <Link
      href={href}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:opacity-80"
      style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}
      aria-label={`${label}, ${count} perlu dibayar`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <path d="M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-3 7h3m-3 4h3M6 12h.01M6 16h.01" />
      </svg>
      {count > 0 && (
        <span
          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
          style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
