'use client';

import { useEffect, useState, type ReactNode } from 'react';

interface StoreClassicStickyCtaProps {
  /** id elemen container CTA di halaman detail produk yang dipantau */
  targetId: string;
  /** Aksi sekunder berbentuk ikon (WhatsApp, Tanya Produk) di samping CTA utama */
  secondaryActions?: ReactNode;
}

/** Elemen CTA utama di dalam container: ditandai `data-primary-cta` (bisa pembungkus atau tombolnya sendiri). */
function findPrimaryCta(container: HTMLElement): HTMLElement | null {
  const holder = container.querySelector<HTMLElement>('[data-primary-cta]');
  if (!holder) return null;
  return holder.matches('a, button') ? holder : holder.querySelector<HTMLElement>('a, button');
}

/**
 * Action bar melayang (mobile saja) yang muncul setelah container CTA produk
 * ter-scroll ke atas layar. Tombol utama memicu tombol CTA asli supaya state
 * (jumlah, lokasi, login, loading) tetap satu sumber — tidak diduplikasi.
 */
export function StoreClassicStickyCta({ targetId, secondaryActions }: StoreClassicStickyCtaProps) {
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState('');

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      // Tampil hanya saat CTA sudah lewat ke atas, bukan saat belum di-scroll sampai
      const scrolledPast = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      if (scrolledPast) setLabel(findPrimaryCta(target)?.textContent?.trim() ?? '');
      setVisible(scrolledPast);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  const handlePrimary = () => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const cta = findPrimaryCta(target);
    // Tombol nonaktif (mis. lokasi belum dipilih) → bawa user ke form CTA dulu
    if (cta && !(cta instanceof HTMLButtonElement && cta.disabled)) cta.click();
    // Tampilkan lagi container supaya feedback/error/pilihan jumlah terlihat
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <>
      {/* Spacer agar konten paling bawah tidak tertutup action bar */}
      <div className="h-20 sm:hidden" aria-hidden="true" />
      <div
        className={`fixed inset-x-0 bottom-0 z-20 border-t px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] transition-transform duration-200 sm:hidden ${
          visible ? 'translate-y-0' : 'pointer-events-none translate-y-full'
        }`}
        style={{ backgroundColor: 'var(--brand-bg)', borderColor: 'var(--brand-border)' }}
        aria-hidden={!visible}
      >
        <div className="flex items-center gap-2">
          {secondaryActions}
          {label && (
            <button
              type="button"
              onClick={handlePrimary}
              tabIndex={visible ? 0 : -1}
              className="min-w-0 flex-1 truncate rounded-full px-5 py-3 text-sm font-semibold uppercase tracking-wide"
              style={{ backgroundColor: 'var(--c-btn-primary-bg)', color: 'var(--c-btn-primary-text)' }}
            >
              {label}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
