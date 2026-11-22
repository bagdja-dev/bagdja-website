'use client';

import { useCallback, useEffect, useState } from 'react';

import type { PortfolioProjectDetailItem } from '../../../lib/template-data';
import { resolveCtaHref } from '../../../lib/cta-href';
import { useTemplateText } from './template-locale';

interface GalleryPhoto {
  url: string;
  alt: string;
  caption: string;
}

/** Host tanpa `www.` untuk label tautan proyek, mis. `contoh.com`. */
function displayHost(href: string): string {
  try {
    return new URL(href).host.replace(/^www\./, '');
  } catch {
    return href;
  }
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' | 'up-right' }) {
  const d = direction === 'left'
    ? 'M15 18l-6-6 6-6'
    : direction === 'right'
      ? 'M9 18l6-6-6-6'
      : 'M7 17L17 7M8 7h9v9';
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function GalleryLightbox({
  photos,
  index,
  title,
  onClose,
  onNavigate,
}: {
  photos: GalleryPhoto[];
  index: number;
  title: string;
  onClose: () => void;
  onNavigate: (next: number) => void;
}) {
  const t = useTemplateText();
  const count = photos.length;
  const photo = photos[index];
  const go = useCallback((step: number) => onNavigate(((index + step) % count + count) % count), [count, index, onNavigate]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft') go(-1);
      else if (event.key === 'ArrowRight') go(1);
    };
    document.addEventListener('keydown', onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [go, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.alt || title}
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80 sm:px-6">
        <span>{index + 1} / {count}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-3 py-1.5 font-medium text-white transition-colors hover:bg-white/10"
        >
          {t('close')} ✕
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.alt || title}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        />
        {count > 1 ? (
          <>
            <button
              type="button"
              aria-label={t('previousImage')}
              onClick={(event) => { event.stopPropagation(); go(-1); }}
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-4"
            >
              <ArrowIcon direction="left" />
            </button>
            <button
              type="button"
              aria-label={t('nextImage')}
              onClick={(event) => { event.stopPropagation(); go(1); }}
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-4"
            >
              <ArrowIcon direction="right" />
            </button>
          </>
        ) : null}
      </div>
      {photo.caption ? (
        <p className="px-4 pb-6 text-center text-sm text-white/80 sm:px-6" onClick={(event) => event.stopPropagation()}>
          {photo.caption}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Halaman detail proyek portofolio bergaya studi kasus: judul besar, cover lebar,
 * ringkasan meta (tahun/jenis/tautan), cerita proyek, video, galeri dengan lightbox,
 * lalu ajakan penutup. Warna & font mengikuti token brand template (`--brand-*`).
 */
export function PortfolioProjectDetailSection({
  project,
  websiteSlug,
}: {
  project: PortfolioProjectDetailItem;
  websiteSlug?: string;
}) {
  const t = useTemplateText();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const visitLink = project.projectUrl ? resolveCtaHref({ button_url: project.projectUrl }, {}) : null;
  const externalVisit = visitLink?.external ? visitLink.href : undefined;
  const portfolioHref = `${websiteSlug ?? ''}/#portfolio-projects`;
  const coverImage = project.coverImage || project.photos[0]?.url;
  const galleryPhotos: GalleryPhoto[] = project.photos.filter((photo) => photo.url !== coverImage);
  // Cover ikut bisa dibuka di lightbox (slide pertama), galeri menyusul.
  const lightboxPhotos: GalleryPhoto[] = [
    ...(coverImage ? [{ url: coverImage, alt: project.title, caption: '' }] : []),
    ...galleryPhotos,
  ];
  const galleryOffset = coverImage ? 1 : 0;

  const meta: Array<{ label: string; value: string }> = [];
  if (project.year) meta.push({ label: t('projectYear'), value: String(project.year) });
  if (project.projectType) meta.push({ label: t('projectType'), value: project.projectType });
  const hasMeta = meta.length > 0 || Boolean(externalVisit);
  const hasStory = Boolean(project.detailHtml || project.detailText);

  return (
    <article className="pb-16 sm:pb-24">
      {/* Header */}
      <header className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-12">
        <a
          href={portfolioHref}
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-muted)] transition-colors hover:text-[var(--brand-text)]"
        >
          <span className="transition-transform group-hover:-translate-x-0.5"><ArrowIcon direction="left" /></span>
          {t('backToPortfolio')}
        </a>

        <div className="mt-8 max-w-4xl sm:mt-12">
          {project.projectType || project.year ? (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">
              {[project.projectType, project.year].filter(Boolean).join(' · ')}
            </p>
          ) : null}
          <h1
            className="mt-3 text-4xl font-bold leading-[1.08] tracking-tight text-[var(--brand-text)] sm:text-5xl lg:text-6xl"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {project.title}
          </h1>
          {project.excerpt ? (
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[var(--brand-muted)] sm:text-xl">
              {project.excerpt}
            </p>
          ) : null}
          {project.tags.length ? (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label={t('projectTags')}>
              {project.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-[var(--brand-border)] px-3 py-1 text-xs font-medium text-[var(--brand-text)] sm:text-sm"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      {/* Cover */}
      {coverImage ? (
        <div className="mx-auto mt-10 max-w-6xl px-4 sm:mt-14 sm:px-6">
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            aria-label={`${t('enlargeImage')}: ${project.title}`}
            className="group block w-full overflow-hidden rounded-2xl bg-[var(--brand-surface)] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.45)] sm:rounded-3xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImage}
              alt={project.title}
              className="h-auto max-h-[80vh] w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.02]"
            />
          </button>
        </div>
      ) : null}

      {/* Meta strip */}
      {hasMeta ? (
        <div className="mx-auto mt-8 max-w-6xl px-4 sm:mt-10 sm:px-6">
          <dl className="flex flex-wrap gap-px overflow-hidden rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-border)]">
            {meta.map((item) => (
              <div key={item.label} className="min-w-[140px] flex-1 bg-[var(--brand-bg)] px-5 py-4">
                <dt className="text-xs uppercase tracking-wider text-[var(--brand-muted)]">{item.label}</dt>
                <dd className="mt-1 font-semibold text-[var(--brand-text)]">{item.value}</dd>
              </div>
            ))}
            {externalVisit ? (
              <div className="min-w-[220px] flex-[2] bg-[var(--brand-bg)] px-5 py-4">
                <dt className="text-xs uppercase tracking-wider text-[var(--brand-muted)]">{t('projectLink')}</dt>
                <dd className="mt-1">
                  <a
                    href={externalVisit}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-1 font-semibold text-[var(--brand-accent)] hover:underline"
                  >
                    <span className="truncate">{displayHost(externalVisit)}</span>
                    <ArrowIcon direction="up-right" />
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {/* Story */}
      {hasStory ? (
        <section className="mx-auto mt-14 max-w-6xl px-4 sm:mt-20 sm:px-6" aria-labelledby="project-story-title">
          <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
            <h2
              id="project-story-title"
              className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-muted)] lg:sticky lg:top-24 lg:self-start"
            >
              {t('projectStory')}
            </h2>
            {project.detailHtml ? (
              <div
                className="max-w-3xl text-base leading-8 text-[var(--brand-text)] sm:text-lg sm:leading-8 [&_a]:text-[var(--brand-accent)] [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:my-8 [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--brand-accent)] [&_blockquote]:pl-5 [&_blockquote]:text-xl [&_blockquote]:italic [&_h2]:mb-4 [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-tight [&_h2:first-child]:mt-0 [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-semibold [&_img]:my-8 [&_img]:w-full [&_img]:rounded-2xl [&_li]:mb-2 [&_li]:ml-6 [&_ol]:mb-6 [&_ol]:list-decimal [&_p]:mb-6 [&_strong]:font-semibold [&_ul]:mb-6 [&_ul]:list-disc"
                dangerouslySetInnerHTML={{ __html: project.detailHtml }}
              />
            ) : (
              <p className="max-w-3xl whitespace-pre-line text-base leading-8 text-[var(--brand-text)] sm:text-lg">
                {project.detailText}
              </p>
            )}
          </div>
        </section>
      ) : null}

      {/* Video */}
      {project.videoUrl ? (
        <section className="mx-auto mt-14 max-w-6xl px-4 sm:mt-20 sm:px-6" aria-label={t('projectVideo')}>
          <video
            src={project.videoUrl}
            controls
            playsInline
            preload="metadata"
            poster={coverImage}
            className="aspect-video w-full rounded-2xl bg-black object-contain sm:rounded-3xl"
          />
        </section>
      ) : null}

      {/* Gallery */}
      {galleryPhotos.length ? (
        <section className="mx-auto mt-14 max-w-6xl px-4 sm:mt-20 sm:px-6" aria-labelledby="project-gallery-title">
          <h2
            id="project-gallery-title"
            className="mb-6 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-muted)]"
          >
            {t('projectGallery')}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            {galleryPhotos.map((photo, index) => {
              // Pola editorial: setiap foto ke-3 dibentang penuh agar ritme galeri tidak monoton.
              const wide = galleryPhotos.length > 2 && index % 3 === 2;
              return (
                <figure key={`${photo.url}-${index}`} className={wide ? 'sm:col-span-2' : undefined}>
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(index + galleryOffset)}
                    aria-label={`${t('enlargeImage')}: ${photo.alt || project.title}`}
                    className="group block w-full overflow-hidden rounded-2xl bg-[var(--brand-surface)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.alt || project.title}
                      loading="lazy"
                      className={`w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] object-top ${wide ? 'aspect-[16/9]' : 'aspect-[16/10]'}`}
                    />
                  </button>
                  {photo.caption ? (
                    <figcaption className="mt-3 text-sm text-[var(--brand-muted)]">{photo.caption}</figcaption>
                  ) : null}
                </figure>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Closing */}
      <footer className="mx-auto mt-16 max-w-6xl px-4 sm:mt-24 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-surface)] px-6 py-8 sm:flex-row sm:items-center sm:px-10 sm:py-10">
          <p
            className="max-w-xl text-2xl font-bold leading-snug text-[var(--brand-text)] sm:text-3xl"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            {project.title}
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            {externalVisit ? (
              <a
                href={externalVisit}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
              >
                {t('visitProject')}
                <ArrowIcon direction="up-right" />
              </a>
            ) : null}
            <a
              href={portfolioHref}
              className="inline-flex items-center justify-center rounded-full border border-[var(--brand-border)] px-6 py-3 font-semibold text-[var(--brand-text)] transition-colors hover:bg-[var(--brand-bg)]"
            >
              {t('projectMoreCta')}
            </a>
          </div>
        </div>
      </footer>

      {lightboxIndex !== null && lightboxPhotos[lightboxIndex] ? (
        <GalleryLightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          title={project.title}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      ) : null}
    </article>
  );
}
