/** Client Public API (no-auth) untuk web renderer — lihat api/src/modules/public */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5003';

export interface ApiWebsiteTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  preview_image: string | null;
  structure: Record<string, unknown>;
}

export interface ApiWebsite {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  template_id: string | null;
  template: ApiWebsiteTemplate | null;
  tagline: string | null;
  logo_url: string | null;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  social_links: Record<string, unknown>;
  opening_hours: Record<string, unknown>;
  theme: Record<string, unknown>;
  is_active: boolean;
  pages: ApiWebsitePage[];
}

export interface ApiWebsiteSection {
  id: string;
  page_id: string;
  type: string;
  content: Record<string, unknown>;
  order: number;
}

export type ApiPagePlacement = 'regular' | 'header' | 'footer';

export interface ApiWebsitePage {
  id: string;
  website_id: string;
  title: string;
  slug: string;
  content: Record<string, unknown>;
  is_home: boolean;
  placement: ApiPagePlacement;
  order: number;
  /** hanya terisi kalau di-fetch via getHomePage()/getPageBySlug() */
  sections?: ApiWebsiteSection[];
}

export interface ApiWebsiteProduct {
  id: string;
  website_id: string;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  detail: string | null;
  price: number;
  images: string[];
  metadata: Record<string, unknown>;
  sort_order: number;
}

export interface ApiWebsiteLocation {
  id: string;
  website_id: string;
  name: string;
  type: string;
  is_primary: boolean;
  is_public: boolean;
  address_line: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  phone: string | null;
  whatsapp: string | null;
  opening_hours: Record<string, unknown>;
  maps_url: string | null;
  maps_embed: string | null;
  sort_order: number;
}

export interface ApiWebsiteFaq {
  id: string;
  website_id: string;
  question: string;
  answer: string;
  category: string | null;
  sort_order: number;
}

export interface ApiWebsiteBlogPost {
  id: string;
  website_id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  cover_image: string | null;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
}

async function fetchPublic<T>(path: string): Promise<T | null> {
  const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 60 } });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Bagdja API ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

export function getWebsiteBySlug(slug: string): Promise<ApiWebsite | null> {
  return fetchPublic<ApiWebsite>(`/api/public/sites/${encodeURIComponent(slug)}`);
}

export function getHomePage(slug: string): Promise<ApiWebsitePage | null> {
  return fetchPublic<ApiWebsitePage>(`/api/public/sites/${encodeURIComponent(slug)}/home`);
}

export function getPageBySlug(slug: string, pageSlug: string): Promise<ApiWebsitePage | null> {
  return fetchPublic<ApiWebsitePage>(
    `/api/public/sites/${encodeURIComponent(slug)}/pages/${encodeURIComponent(pageSlug)}`,
  );
}

export async function getProducts(slug: string, type?: string): Promise<ApiWebsiteProduct[]> {
  const qs = type ? `?type=${encodeURIComponent(type)}` : '';
  const result = await fetchPublic<ApiWebsiteProduct[]>(
    `/api/public/sites/${encodeURIComponent(slug)}/products${qs}`,
  );
  return result ?? [];
}

export async function getLocations(slug: string, type?: string): Promise<ApiWebsiteLocation[]> {
  const qs = type ? `?type=${encodeURIComponent(type)}` : '';
  const result = await fetchPublic<ApiWebsiteLocation[]>(
    `/api/public/sites/${encodeURIComponent(slug)}/locations${qs}`,
  );
  return result ?? [];
}

export async function getFaqs(slug: string, category?: string): Promise<ApiWebsiteFaq[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  const result = await fetchPublic<ApiWebsiteFaq[]>(
    `/api/public/sites/${encodeURIComponent(slug)}/faqs${qs}`,
  );
  return result ?? [];
}

export async function getBlogPosts(
  slug: string,
  options?: { search?: string; ids?: string[] },
): Promise<ApiWebsiteBlogPost[]> {
  const params = new URLSearchParams();
  if (options?.search) params.set('search', options.search);
  if (options?.ids?.length) params.set('ids', options.ids.join(','));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const result = await fetchPublic<ApiWebsiteBlogPost[]>(
    `/api/public/sites/${encodeURIComponent(slug)}/blog-posts${qs}`,
  );
  return result ?? [];
}

export function getBlogPostBySlug(slug: string, postSlug: string): Promise<ApiWebsiteBlogPost | null> {
  return fetchPublic<ApiWebsiteBlogPost>(
    `/api/public/sites/${encodeURIComponent(slug)}/blog-posts/${encodeURIComponent(postSlug)}`,
  );
}