'use client';

import { useMemo, useState } from 'react';

import { buildBlogPostHref, type BlogPostItem } from '../../lib/template-data';

function SearchIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

interface BarberClassicBlogSearchProps {
  title?: string;
  placeholder?: string;
  posts: BlogPostItem[];
  websiteSlug?: string;
}

export function BarberClassicBlogSearch({
  title,
  placeholder,
  posts,
  websiteSlug,
}: BarberClassicBlogSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const effectivePlaceholder = placeholder?.trim() || 'Cari artikel...';

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return posts
      .filter((p) => p.title.toLowerCase().includes(q) || p.excerpt?.toLowerCase().includes(q))
      .slice(0, 10);
  }, [query, posts]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <section className="mx-auto max-w-2xl px-4 py-12 text-center sm:px-6">
      {title && (
        <h2
          className="mb-4 text-xl font-semibold sm:text-2xl"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
        >
          {title}
        </h2>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto flex w-full max-w-md items-center gap-2 rounded-full border px-4 py-3 text-sm transition-colors hover:opacity-80"
        style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}
      >
        <SearchIcon />
        <span className="truncate">{effectivePlaceholder}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-start justify-center px-4 pb-4 pt-20 sm:pt-24">
          <button type="button" className="absolute inset-0 bg-black/60" aria-label="Tutup pencarian" onClick={close} />
          <div
            className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl shadow-2xl"
            style={{ backgroundColor: 'var(--brand-surface)' }}
          >
            <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--brand-border)' }}>
              <SearchIcon />
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={effectivePlaceholder}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: 'var(--brand-text)' }}
              />
              <button type="button" onClick={close} aria-label="Tutup" style={{ color: 'var(--brand-muted)' }}>
                <CloseIcon />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {query.trim() === '' ? (
                <p className="p-4 text-center text-sm" style={{ color: 'var(--brand-muted)' }}>
                  Ketik untuk mencari artikel…
                </p>
              ) : results.length === 0 ? (
                <p className="p-4 text-center text-sm" style={{ color: 'var(--brand-muted)' }}>
                  Tidak ada artikel ditemukan.
                </p>
              ) : (
                results.map((post) => (
                  <a
                    key={post.id}
                    href={websiteSlug ? buildBlogPostHref(websiteSlug, post.slug) : '#'}
                    onClick={close}
                    className="block rounded-xl p-3 transition-colors hover:opacity-80"
                  >
                    <p className="font-medium" style={{ color: 'var(--brand-text)' }}>
                      {post.title}
                    </p>
                    {post.excerpt && (
                      <p className="mt-0.5 line-clamp-1 text-sm" style={{ color: 'var(--brand-muted)' }}>
                        {post.excerpt}
                      </p>
                    )}
                  </a>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
