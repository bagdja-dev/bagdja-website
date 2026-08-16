/** Loader bersama untuk halaman tenant (home & halaman lain) — dipakai [website_slug]/page.tsx & [website_slug]/[page_slug]/page.tsx */

import {
  getBlogPosts,
  getCategories,
  getFaqs,
  getHomePage,
  getLocations,
  getPageBySlug,
  getProducts,
  getWebsiteBySlug,
  type ApiWebsite,
  type ApiWebsiteBlogPost,
  type ApiWebsiteCategory,
  type ApiWebsiteFaq,
  type ApiWebsiteLocation,
  type ApiWebsitePage,
  type ApiWebsiteProduct,
} from './api-client';

export interface TenantData {
  website: ApiWebsite;
  page: ApiWebsitePage | null;
  products: ApiWebsiteProduct[];
  categories: ApiWebsiteCategory[];
  locations: ApiWebsiteLocation[];
  faqs: ApiWebsiteFaq[];
  blogPosts: ApiWebsiteBlogPost[];
  /** Fase 5 paywall: true kalau subscription owner tidak aktif. */
  subscription_inactive: boolean;
}

export async function loadTenant(slug: string, pageSlug?: string): Promise<TenantData | null> {
  const website = await getWebsiteBySlug(slug);
  if (!website) return null;

  const [page, productsResult, categories, locations, faqs, blogPosts] = await Promise.all([
    pageSlug ? getPageBySlug(slug, pageSlug) : getHomePage(slug),
    // `size` besar = praktis "semua produk" untuk kebutuhan lain di halaman
    // (category_grid, related products, featured_product). Grid produk/layanan
    // sendiri fetch ulang halaman berikutnya dari client saat "Muat Lebih Banyak".
    getProducts(slug, { size: 100 }),
    getCategories(slug),
    getLocations(slug),
    getFaqs(slug),
    getBlogPosts(slug),
  ]);

  return {
    website,
    page,
    products: productsResult.data,
    categories,
    locations,
    faqs,
    blogPosts,
    subscription_inactive: website.subscription_inactive ?? false,
  };
}
