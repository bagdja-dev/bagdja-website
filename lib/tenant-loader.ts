/** Loader bersama untuk halaman tenant (home & halaman lain) — dipakai [website_slug]/page.tsx & [website_slug]/[page_slug]/page.tsx */

import {
  getBlogPosts,
  getFaqs,
  getHomePage,
  getLocations,
  getPageBySlug,
  getProducts,
  getWebsiteBySlug,
  type ApiWebsite,
  type ApiWebsiteBlogPost,
  type ApiWebsiteFaq,
  type ApiWebsiteLocation,
  type ApiWebsitePage,
  type ApiWebsiteProduct,
} from './api-client';

export interface TenantData {
  website: ApiWebsite;
  page: ApiWebsitePage | null;
  products: ApiWebsiteProduct[];
  locations: ApiWebsiteLocation[];
  faqs: ApiWebsiteFaq[];
  blogPosts: ApiWebsiteBlogPost[];
}

export async function loadTenant(slug: string, pageSlug?: string): Promise<TenantData | null> {
  const website = await getWebsiteBySlug(slug);
  if (!website) return null;

  const [page, products, locations, faqs, blogPosts] = await Promise.all([
    pageSlug ? getPageBySlug(slug, pageSlug) : getHomePage(slug),
    getProducts(slug),
    getLocations(slug),
    getFaqs(slug),
    getBlogPosts(slug),
  ]);

  return { website, page, products, locations, faqs, blogPosts };
}
