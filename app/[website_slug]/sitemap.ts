import type { MetadataRoute } from 'next';

import { getBlogPosts, getProducts, getWebsiteBySlug } from '../../lib/api-client';
import { tenantCanonicalUrl } from '../../lib/content-seo';

export const revalidate = 300;

interface SitemapProps {
  params: { website_slug: string };
}

export default async function sitemap({ params }: SitemapProps): Promise<MetadataRoute.Sitemap> {
  const slug = params.website_slug;
  const website = await getWebsiteBySlug(slug);
  if (!website) return [];

  const entries: MetadataRoute.Sitemap = [
    ...(!website.pages.some((page) => page.is_home && page.seo_no_index)
      ? [{ url: tenantCanonicalUrl(slug, '/', website) }]
      : []),
    ...website.pages
      .filter((page) => !page.is_home && !page.seo_no_index)
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

  entries.push(
    ...products
      .filter((product) => product.is_active !== false && !product.seo_no_index)
      .map((product) => ({
        url: tenantCanonicalUrl(slug, `/products/${product.slug}`, website),
      })),
    ...posts
      .filter((post) => post.is_published && !post.seo_no_index)
      .map((post) => ({
        url: tenantCanonicalUrl(slug, `/blog/${post.slug}`, website),
        lastModified: post.updated_at ? new Date(post.updated_at) : post.published_at ? new Date(post.published_at) : new Date(),
      })),
  );

  return entries;
}
