'use client';

import { useRef, useState, type TouchEvent } from 'react';

import type { GalleryImageItem } from '../../../lib/template-data';
import { ModelViewerElement } from '../../model-viewer-element';

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

function FullscreenIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 3.75H4.5a.75.75 0 0 0-.75.75v3.75m16.5 0V4.5a.75.75 0 0 0-.75-.75h-3.75m0 16.5h3.75a.75.75 0 0 0 .75-.75v-3.75M3.75 15.75v3.75c0 .414.336.75.75.75h3.75"
      />
    </svg>
  );
}

type Slide =
  | { type: 'image'; url: string; alt?: string; caption?: string }
  | { type: 'video'; url: string }
  | { type: 'model'; url: string };

/**
 * Video/model 3D (opsional, masing-masing satu) jadi slide tambahan di
 * akhir carousel — dinavigasi sama seperti foto (swipe/tombol/dot). Slide
 * video/model dapat tombol "fullscreen" tambahan (Fullscreen API browser)
 * karena carousel ini tidak punya lightbox seperti di store-classic. Swipe
 * carousel di-nonaktifkan saat slide model aktif supaya drag dipakai
 * model-viewer sendiri untuk rotate.
 */
export function BarberClassicGalleryCarousel({
  images,
  videoUrl,
  model3dUrl,
}: {
  images: GalleryImageItem[];
  videoUrl?: string;
  model3dUrl?: string;
}) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const modelWrapperRef = useRef<HTMLDivElement | null>(null);

  const slides: Slide[] = [
    ...images.map((image): Slide => ({ type: 'image', ...image })),
    ...(videoUrl ? [{ type: 'video', url: videoUrl } as Slide] : []),
    ...(model3dUrl ? [{ type: 'model', url: model3dUrl } as Slide] : []),
  ];

  if (!slides.length) return null;

  const count = slides.length;
  const isInteractive3d = slides[index]?.type === 'model';
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
        onTouchStart={isInteractive3d ? undefined : handleTouchStart}
        onTouchEnd={isInteractive3d ? undefined : handleTouchEnd}
      >
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {slides.map((slide, i) => (
            <figure key={i} className="relative w-full shrink-0">
              {slide.type === 'video' && (
                <>
                  <video
                    ref={i === index ? videoRef : undefined}
                    src={slide.url}
                    className="aspect-[16/9] w-full object-cover"
                    controls
                    autoPlay={i === index}
                    loop
                    playsInline
                  />
                  <button
                    type="button"
                    onClick={() => videoRef.current?.requestFullscreen?.()}
                    aria-label="Fullscreen video"
                    className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full shadow-md transition-transform hover:scale-105"
                    style={{ backgroundColor: 'var(--brand-bg)', color: 'var(--brand-text)' }}
                  >
                    <FullscreenIcon />
                  </button>
                </>
              )}
              {slide.type === 'model' && (
                <div ref={i === index ? modelWrapperRef : undefined} className="relative aspect-[16/9] w-full">
                  <ModelViewerElement src={slide.url} className="h-full w-full" cameraControls autoRotate />
                  <button
                    type="button"
                    onClick={() => modelWrapperRef.current?.requestFullscreen?.()}
                    aria-label="Fullscreen model 3D"
                    className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full shadow-md transition-transform hover:scale-105"
                    style={{ backgroundColor: 'var(--brand-bg)', color: 'var(--brand-text)' }}
                  >
                    <FullscreenIcon />
                  </button>
                </div>
              )}
              {slide.type === 'image' && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.url}
                    alt={slide.alt ?? ''}
                    className="aspect-[16/9] w-full object-cover"
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                  {slide.caption && (
                    <figcaption className="p-3 text-sm" style={{ color: 'var(--brand-muted)' }}>
                      {slide.caption}
                    </figcaption>
                  )}
                </>
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
            aria-label="Slide sebelumnya"
            className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition-transform hover:scale-105"
            style={{ backgroundColor: 'var(--brand-bg)', color: 'var(--brand-text)' }}
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Slide berikutnya"
            className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition-transform hover:scale-105"
            style={{ backgroundColor: 'var(--brand-bg)', color: 'var(--brand-text)' }}
          >
            <ChevronRightIcon />
          </button>

          <div className="mt-3 flex items-center justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Ke slide ${i + 1}`}
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
