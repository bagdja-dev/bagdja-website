'use client';

/**
 * CartBadge — ikon keranjang + jumlah item di header template.
 * Hanya tampil saat user login (cart butuh session buyer).
 *
 * Jumlah item diambil LANGSUNG dari server (`GET /api/orders?cart=true`,
 * difilter di website-api) — SATU-SATUNYA sumber kebenaran, tanpa fallback
 * ke localStorage (revisi 2026-08-24). Fallback lokal yang lama membuat
 * badge menampilkan angka basi (produk yang sudah di-checkout dihitung
 * lagi) begitu draft server habis — lihat cart-button.tsx untuk detail.
 * Refresh otomatis lewat event `bagdja:cart-changed` (di-dispatch
 * cart-button.tsx setelah add-to-cart, dan cart-content.tsx setelah
 * qty/hapus di halaman /cart).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

export interface CartBadgeProps {
  href: string;
  isLoggedIn: boolean;
  label?: string;
}

interface ServerOrder {
  quantity: number;
}

export function CartBadge({ href, isLoggedIn, label = 'Keranjang' }: CartBadgeProps) {
  const [count, setCount] = useState(0);

  const loadServerCount = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?cart=true', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { data?: ServerOrder[] };
      const total = (data?.data ?? []).reduce((acc, o) => acc + Number(o.quantity), 0);
      setCount(total);
    } catch {
      // biarkan count apa adanya (nilai terakhir yang berhasil dimuat)
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    void loadServerCount();
    window.addEventListener('bagdja:cart-changed', loadServerCount);
    return () => window.removeEventListener('bagdja:cart-changed', loadServerCount);
  }, [isLoggedIn, loadServerCount]);

  if (!isLoggedIn) return null;

  return (
    <Link
      href={href}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:opacity-80"
      style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}
      aria-label={`${label}, ${count} item`}
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
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
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
