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
  /** Fase 5 paywall: true kalau website milik owner yang subscription-nya tidak aktif. */
  subscription_inactive?: boolean;
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

/** Satu cara/link pembayaran checkout — polymorphic per `payment_mode`. Mode baru cukup nambah union di sini. */
export interface LynkPaymentMeta {
  payment_mode: 'LYNK';
  payment_link: string;
}

/** Flow internal Bagdja (escrow/cart) — tidak ada link eksternal. */
export interface AddToCartPaymentMeta {
  payment_mode: 'ADD_TO_CART';
}

/** Flow internal Bagdja escrow 1 termin — dana di-hold sampai konfirmasi terima. */
export interface EscrowPaymentMeta {
  payment_mode: 'ESCROW';
}

export type PaymentMetaEntry =
  | LynkPaymentMeta
  | AddToCartPaymentMeta
  | EscrowPaymentMeta;

export interface ApiWebsiteProduct {
  id: string;
  website_id: string;
  name: string;
  slug: string;
  type: string;
  category: string | null;
  parent_product_id: string | null;
  description: string | null;
  detail: string | null;
  price: number;
  images: string[];
  metadata: Record<string, unknown>;
  payment_meta?: PaymentMetaEntry[];
  sort_order: number;
}

export interface GridMeta {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

export interface GridResult<T> {
  data: T[];
  meta: GridMeta;
}

export interface ApiWebsiteCategory {
  id: string;
  website_id: string;
  label: string;
  images: string[];
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

export function getTemplateBySlug(slug: string): Promise<ApiWebsiteTemplate | null> {
  return fetchPublic<ApiWebsiteTemplate>(`/api/templates/${slug}`);
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

export interface ProductsQuery {
  page?: number;
  size?: number;
  type?: string;
  categoryId?: string;
  /** Format `kolom:asc|desc` — kolom yang didukung: name, price, sort_order, created_at. */
  sort?: string;
  /** Kalau true, hanya produk top-level (bukan varian warna/ukuran) — dipakai grid/listing supaya 1 keluarga varian cuma tampil 1 kartu. */
  topLevel?: boolean;
}

const EMPTY_GRID_META: GridMeta = { totalItems: 0, itemCount: 0, itemsPerPage: 0, totalPages: 1, currentPage: 1 };

/**
 * List produk/layanan publik — paginated & filterable (lihat
 * `common/grid/grid-query.util.ts` di API). Dipakai untuk fetch awal (SSR,
 * `size` besar) maupun "Muat Lebih Banyak"/filter kategori dari browser.
 */
export async function getProducts(slug: string, opts: ProductsQuery = {}): Promise<GridResult<ApiWebsiteProduct>> {
  const params = new URLSearchParams();
  if (opts.page) params.set('page', String(opts.page));
  if (opts.size) params.set('size', String(opts.size));
  if (opts.type) params.set('filter[type]', opts.type);
  if (opts.categoryId) params.set('filter[category_id]', opts.categoryId);
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.topLevel) params.set('filter[top_level]', 'true');
  const qs = params.toString() ? `?${params.toString()}` : '';

  const result = await fetchPublic<GridResult<ApiWebsiteProduct>>(
    `/api/public/sites/${encodeURIComponent(slug)}/products${qs}`,
  );
  return result ?? { data: [], meta: EMPTY_GRID_META };
}

export async function getCategories(slug: string): Promise<ApiWebsiteCategory[]> {
  const result = await fetchPublic<ApiWebsiteCategory[]>(
    `/api/public/sites/${encodeURIComponent(slug)}/categories`,
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