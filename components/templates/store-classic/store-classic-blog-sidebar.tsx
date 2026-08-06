'use client';

import { useMemo, useState } from 'react';

import { buildBlogPostHref, type BlogPostItem } from '../../../lib/template-data';
import { SearchIcon } from './store-classic-icons';

/**
 * Sidebar blog (layout 2 kolom ala toko). Widget "Artikel Terbaru" + pencarian
 * inline dari data yang sudah di-fetch (client-side, tanpa round-trip server).
 * Kategori/tag sengaja tidak ada — skema `website_blog_posts` belum punya
 * kolom itu (lihat plan.md), jadi widget itu tidak ditampilkan dulu.
 */
export function StoreClassicBlogSidebar({
  posts,
  websiteSlug,
  excludeId,
}: {
  posts: BlogPostItem[];
  websiteSlug?: string;
  excludeId?: string;
}) {
  const [query, setQuery] = useState('');

  const latest = useMemo(() => posts.filter((p) => p.id !== excludeId).slice(0, 3), [posts, excludeId]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return posts.filter((p) => p.title.toLowerCase().includes(q) || p.excerpt?.toLowerCase().includes(q)).slice(0, 6);
  }, [posts, query]);

  return (
    <aside className="flex flex-col gap-8">
      <div>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--brand-muted)' }}>
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari artikel..."
            className="w-full rounded-lg border py-2.5 pl-10 pr-3 text-sm outline-none"
            style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}
          />
        </div>
        {query.trim() && (
          <div className="mt-3 flex flex-col gap-2">
            {results.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
                Tidak ada artikel yang cocok.
              </p>
            ) : (
              results.map((post) => (
                <a
                  key={post.id}
                  href={websiteSlug !== undefined ? buildBlogPostHref(websiteSlug, post.slug) : '#'}
                  className="rounded-lg px-3 py-2 text-sm transition-colors hover:opacity-80"
                  style={{ backgroundColor: 'var(--brand-surface)' }}
                >
                  {post.title}
                </a>
              ))
            )}
          </div>
        )}
      </div>

      {latest.length > 0 && (
        <div>
          <h3
            className="mb-3 text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--brand-accent-muted)' }}
          >
            Artikel Terbaru
          </h3>
          <div className="flex flex-col gap-3">
            {latest.map((post) => (
              <a
                key={post.id}
                href={websiteSlug !== undefined ? buildBlogPostHref(websiteSlug, post.slug) : '#'}
                className="flex items-center gap-3 rounded-lg transition-opacity hover:opacity-80"
              >
                {post.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.coverImage} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-lg"
                    style={{ backgroundColor: 'var(--brand-surface)' }}
                  >
                    📰
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-sm font-medium" style={{ fontFamily: 'var(--font-heading)' }}>
                    {post.title}
                  </span>
                  {post.publishedAtLabel && (
                    <span className="mt-0.5 block text-xs" style={{ color: 'var(--brand-muted)' }}>
                      {post.publishedAtLabel}
                    </span>
                  )}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
