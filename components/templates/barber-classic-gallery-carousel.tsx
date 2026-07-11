'use client';

import { useRef, useState, type TouchEvent } from 'react';

import type { GalleryImageItem } from '../../lib/template-data';

const SWIPE_THRESHOLD_PX = 40;

function ChevronLeftIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
    </svg>
  );
}

export function BarberClassicGalleryCarousel({ images }: { images: GalleryImageItem[] }) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  if (!images.length) return null;

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

  return (
    <div className="relative">
      <div
        className="overflow-hidden rounded-xl"
        style={{ backgroundColor: 'var(--brand-surface)' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {images.map((image, i) => (
            <figure key={i} className="w-full shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.url}
                alt={image.alt ?? ''}
                className="aspect-[16/9] w-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
              />
              {image.caption && (
                <figcaption className="p-3 text-sm" style={{ color: 'var(--brand-muted)' }}>
                  {image.caption}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Foto sebelumnya"
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition-transform hover:scale-105"
            style={{ backgroundColor: 'var(--brand-bg)', color: 'var(--brand-text)' }}
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Foto berikutnya"
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition-transform hover:scale-105"
            style={{ backgroundColor: 'var(--brand-bg)', color: 'var(--brand-text)' }}
          >
            <ChevronRightIcon />
          </button>

          <div className="mt-3 flex items-center justify-center gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ke foto ${i + 1}`}
                className="h-2 rounded-full transition-all"
                style={{
                  width: i === index ? '1.25rem' : '0.5rem',
                  backgroundColor: i === index ? 'var(--brand-accent)' : 'var(--brand-border)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
