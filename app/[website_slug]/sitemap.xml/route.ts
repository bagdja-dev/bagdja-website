import { getBlogPosts, getProducts, getWebsiteBySlug } from '../../../lib/api-client';
import { tenantCanonicalUrl } from '../../../lib/content-seo';
import { resolveExternalPageUrl } from '../../../lib/template-data';

export const revalidate = 300;

interface SitemapRouteContext {
  params: { website_slug: string };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(_request: Request, { params }: SitemapRouteContext): Promise<Response> {
  const slug = params.website_slug;
  const website = await getWebsiteBySlug(slug);
  if (!website) return new Response('Not Found', { status: 404 });

  const urls: Array<{ url: string; lastModified?: Date }> = [
    ...(!website.pages.some((page) => page.is_home && page.seo_no_index)
      ? [{ url: tenantCanonicalUrl(slug, '/', website) }]
      : []),
    ...website.pages
      // Halaman tautan eksternal hanya redirect keluar — bukan konten situs ini.
      .filter((page) => !page.is_home && !page.seo_no_index && !resolveExternalPageUrl(page))
      .map((page) => ({
        url: tenantCanonicalUrl(slug, `/${page.slug}`, website),
      })),
  ];

  const [firstProducts, posts] = await Promise.all([
    getProducts(slug, { page: 1, size: 100, topLevel: true }),
    getBlogPosts(slug),
  ]);
  const productPages = await Promise.all(
    Array.from({ length: Math.max(0, firstProducts.meta.totalPages - 1) }, (_, index) =>
      getProducts(slug, { page: index + 2, size: 100, topLevel: true }),
    ),
  );
  const products = [...firstProducts.data, ...productPages.flatMap((page) => page.data)];

  urls.push(
    ...products
      .filter((product) => product.is_active !== false && !product.seo_no_index)
      .map((product) => ({
        url: tenantCanonicalUrl(slug, `/products/${product.slug}`, website),
      })),
    ...posts
      .filter((post) => post.is_published && !post.seo_no_index)
      .map((post) => ({
        url: tenantCanonicalUrl(slug, `/blog/${post.slug}`, website),
        lastModified: post.updated_at
          ? new Date(post.updated_at)
          : post.published_at
            ? new Date(post.published_at)
            : undefined,
      })),
  );

  const entries = urls
    .map(({ url, lastModified }) => {
      const lastModifiedTag = lastModified && !Number.isNaN(lastModified.getTime())
        ? `<lastmod>${lastModified.toISOString()}</lastmod>`
        : '';
      return `<url><loc>${escapeXml(url)}</loc>${lastModifiedTag}</url>`;
    })
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
