'use client';

/**
 * CartBadge (W1c/W2.6) — ikon keranjang + jumlah item di header template.
 * Client component: memakai useCart (CartProvider harus membungkus header —
 * di halaman-halaman renderer `[website_slug]/*`).
 * Hanya tampil saat user login (cart butuh session buyer).
 *
 * Jumlah item diambil dari SERVER (GET /api/orders → draft PENDING), bukan
 * localStorage — sumber utama cart adalah draft server (W1b). Fallback ke
 * cart lokal saat API gagal / server kosong. Refresh otomatis lewat event
 * `bagdja:cart-changed` (di-dispatch CartProvider saat items berubah).
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart } from '../lib/cart';

export interface CartBadgeProps {
  href: string;
  isLoggedIn: boolean;
}

interface ServerOrder {
  quantity: number;
  status: string;
  transaction_id: string | null;
}

export function CartBadge({ href, isLoggedIn }: CartBadgeProps) {
  const { count: localCount } = useCart();
  /** Jumlah draft PENDING dari server; null = belum dimuat/gagal. */
  const [serverCount, setServerCount] = useState<number | null>(null);

  const loadServerCount = useCallback(async () => {
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' });
      if (!res.ok) {
        setServerCount(null);
        return;
      }
      const data = (await res.json()) as { data?: ServerOrder[] };
      const pending = (data?.data ?? []).filter(
        (o) => o.status === 'PENDING' && !o.transaction_id,
      );
      const total = pending.reduce((acc, o) => acc + Number(o.quantity), 0);
      setServerCount(total);
    } catch {
      setServerCount(null);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    void loadServerCount();
    window.addEventListener('bagdja:cart-changed', loadServerCount);
    return () => window.removeEventListener('bagdja:cart-changed', loadServerCount);
  }, [isLoggedIn, loadServerCount]);

  // Server draft sebagai sumber utama; fallback cart lokal saat server
  // kosong (0 pending) atau gagal dimuat.
  const count = serverCount !== null && serverCount > 0 ? serverCount : localCount;

  if (!isLoggedIn) return null;

  return (
    <Link
      href={href}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:opacity-80"
      style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}
      aria-label={`Keranjang, ${count} item`}
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
