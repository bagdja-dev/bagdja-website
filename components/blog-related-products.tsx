import { buildProductHref, type BlogPostItem } from '../lib/template-data';

export function BlogRelatedProducts({
  products,
  websiteSlug,
}: {
  products: NonNullable<BlogPostItem['relatedProducts']>;
  websiteSlug?: string;
}) {
  if (products.length === 0) return null;

  return (
    <section className="mt-12 border-y py-8 sm:mt-16 sm:py-10" style={{ borderColor: 'var(--brand-border)' }}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--brand-accent)]">Siap wujudkan rencana Anda?</p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl" style={{ fontFamily: 'var(--font-heading)' }}>Temukan produk yang tepat</h2>
        </div>
        <span className="text-sm font-medium text-[var(--brand-muted)]">Lihat pilihan, lalu mulai langkah pertama hari ini.</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <a
            key={product.id}
            href={websiteSlug !== undefined ? buildProductHref(websiteSlug, product.slug) : '#'}
            className="group flex min-w-0 items-center gap-3 border p-3 transition-colors hover:bg-[var(--brand-surface)]"
            style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-bg)' }}
          >
            {product.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image} alt="" className="h-16 w-20 shrink-0 object-cover" />
            ) : (
              <span className="flex h-16 w-20 shrink-0 items-center justify-center bg-[var(--brand-surface)] text-xs text-[var(--brand-muted)]">Produk</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block line-clamp-2 text-sm font-semibold text-[var(--brand-text)]">{product.name}</span>
              <span className="mt-1 block text-xs text-[var(--brand-muted)]">{product.priceLabel}</span>
              <span className="mt-2 inline-block text-xs font-bold text-[var(--brand-accent)] group-hover:underline">Lihat produk →</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}