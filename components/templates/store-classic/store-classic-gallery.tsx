'use client';

import { useEffect, useRef, useState, type MouseEvent, type TouchEvent } from 'react';

const SWIPE_THRESHOLD_PX = 40;
const ZOOM_SCALE = 2.2;

import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, SearchIcon } from './store-classic-icons';

/** Galeri produk: gambar utama besar + strip thumbnail — dipakai di halaman detail produk. */
export function StoreClassicProductGallery({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const count = images.length;
  const goTo = (next: number) => setIndex(((next % count) + count) % count);
  const goPrev = () => goTo(index - 1);
  const goNext = () => goTo(index + 1);

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (delta > SWIPE_THRESHOLD_PX) goPrev();
    else if (delta < -SWIPE_THRESHOLD_PX) goNext();
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setZoomPos({ x, y });
  };

  useEffect(() => {
    if (!isLightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLightboxOpen(false);
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
    };
    document.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLightboxOpen, index]);

  if (!images.length) return null;

  return (
    <div className={`grid gap-3 ${count > 1 ? 'sm:grid-cols-[80px_1fr]' : ''}`}>
      {count > 1 && (
        <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:flex-col sm:overflow-visible">
          {images.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className="shrink-0 overflow-hidden rounded-lg border-2 transition-opacity"
              style={{
                borderColor: i === index ? 'var(--brand-accent)' : 'var(--brand-border)',
                opacity: i === index ? 1 : 0.7,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-16 w-16 object-cover sm:h-20 sm:w-20" />
            </button>
          ))}
        </div>
      )}

      <div
        className="relative order-1 cursor-zoom-in overflow-hidden rounded-xl sm:order-2"
        style={{ backgroundColor: 'var(--brand-surface)' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={() => setIsZooming(true)}
        onMouseLeave={() => setIsZooming(false)}
        onMouseMove={handleMouseMove}
        onClick={() => setIsLightboxOpen(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[index]} alt="" className="aspect-square w-full object-cover" />

        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 transition-opacity duration-150 ${
            isZooming ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            backgroundImage: `url(${images[index]})`,
            backgroundSize: `${ZOOM_SCALE * 100}%`,
            backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
          }}
        />

        <div
          className="pointer-events-none absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full shadow-md transition-opacity duration-150"
          style={{
            backgroundColor: 'var(--brand-bg)',
            color: 'var(--brand-text)',
            opacity: isZooming ? 1 : 0.85,
          }}
        >
          <SearchIcon />
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              aria-label="Gambar sebelumnya"
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition-transform hover:scale-105"
              style={{ backgroundColor: 'var(--brand-bg)', color: 'var(--brand-text)' }}
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              aria-label="Gambar berikutnya"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition-transform hover:scale-105"
              style={{ backgroundColor: 'var(--brand-bg)', color: 'var(--brand-text)' }}
            >
              <ChevronRightIcon />
            </button>
          </>
        )}
      </div>

      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            aria-label="Tutup preview"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <CloseIcon />
          </button>

          <div
            className="relative flex max-h-full max-w-4xl items-center justify-center"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[index]} alt="" className="max-h-[85vh] max-w-full rounded-lg object-contain" />

            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Gambar sebelumnya"
                  className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:-left-14"
                >
                  <ChevronLeftIcon />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Gambar berikutnya"
                  className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:-right-14"
                >
                  <ChevronRightIcon />
                </button>
                <div className="absolute -bottom-8 left-0 right-0 text-center text-sm text-white/70">
                  {index + 1} / {count}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
