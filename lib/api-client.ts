/** Client Public API (no-auth) untuk web renderer — lihat api/src/modules/public */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5003';

export interface ApiWebsiteTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  preview_image: string | null;
  structure: Record<string, unknown>;
  /** `builtin` = renderer React internal; `package` = template designer via runtime. */
  source?: 'builtin' | 'package';
  /** Manifest katalog (versi terbit terbaru untuk template package). */
  manifest?: { version?: string; isBuiltin?: boolean } | null;
}

export interface ApiWebsite {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  domain_verified_at?: string | null;
  template_id: string | null;
  /** Salinan versi package terpasang; null untuk template bawaan. Gunakan `template_runtime`. */
  template_runtime_version: string | null;
  /**
   * Keputusan runtime dari API: hanya terisi untuk template package yang ter-pin.
   * null = renderer bawaan (lib/tenant-template.ts).
   */
  template_runtime?: {
    slug: string;
    version: string;
    /** `candidate` = uji kandidat belum terbit, hanya untuk viewer yang berhak (lib/template-trial.ts). */
    status: 'published' | 'deprecated' | 'revoked' | 'candidate';
    pageOverrides: string[];
    /** Hanya untuk `candidate`: digest artefak di runtime `/v1/render-candidate`. */
    candidateDigest?: string;
    name?: string;
    viewerRole?: 'designer' | 'reviewer' | 'tester' | 'reviewer_team';
    /** Palet bawaan versi yang dipakai (`manifest.theme`); lihat tenantTemplateTheme. */
    theme?: Record<string, unknown>;
    /**
     * browser.js versi ini (R2/CDN) untuk mode client; tidak ada → SSR lewat runtime.
     * Renderer memverifikasi SHA-256 sebelum dijalankan (template-client-rendering-plan §6).
     */
    browserBundle?: { url: string; sha256: string };
  } | null;
  /** true bila website sedang menguji template kandidat (ID pengajuan tidak dibuka ke publik). */
  template_trial_active?: boolean;
  template: ApiWebsiteTemplate | null;
  tagline: string | null;
  logo_url: string | null;
  login_background_url?: string | null;
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  social_links: Record<string, unknown>;
  opening_hours: Record<string, unknown>;
  theme: Record<string, unknown>;
  footer_settings?: Record<string, unknown>;
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

export type ApiPagePlacement = 'regular' | 'header' | 'footer' | 'hidden';

export interface ApiWebsitePage {
  id: string;
  website_id: string;
  name: string;
  title: string;
  slug: string;
  seo_title?: string | null;
  seo_description?: string | null;
  seo_image?: string | null;
  seo_no_index?: boolean;
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
  seo_title?: string | null;
  seo_description?: string | null;
  seo_image?: string | null;
  seo_no_index?: boolean;
  type: string;
  category: string | null;
  parent_product_id: string | null;
  location_ids?: string[];
  description: string | null;
  detail: string | null;
  specifications?: Record<string, string> | null;
  estimation?: Array<{ label: string; price: number | string | null }> | null;
  price: number;
  /** Produk butuh quotation dulu dari seller (harga custom, bukan tetap) — fulfillment-praorder-plan.md §2.1. Kolom `website_products.quotable`, sudah ikut ke response ini (entity di-spread apa adanya di public.service.ts), cuma belum dideklarasikan di sini sebelumnya. */
  quotable?: boolean;
  uom?: { code: string; label: string; symbol: string } | null;
  images: string[];
  video_url?: string | null;
  /** Semua video produk (urut tampil); video_url = elemen pertama (API lama hanya mengirim video_url). */
  video_urls?: string[] | null;
  model3d_url?: string | null;
  metadata: Record<string, unknown>;
  is_active?: boolean;
  gathering_options?: Array<{
    id: string;
    option_group_key: string;
    option_key: string;
    label: string;
    description?: string | null;
    price_per_seat: number | string;
    deposit_amount_per_seat?: number | string;
    currency: string;
    min_attendees: number;
    max_attendees: number;
    availability_window?: Record<string, unknown>;
    venue_location?: string | null;
    venue_address?: string | null;
    venue_map_url?: string | null;
    benefits?: unknown[];
    images?: string[] | null;
    is_active: boolean;
    sort_order: number;
  }>;
  payment_meta?: PaymentMetaEntry[];
  sort_order: number;
}

export interface ApiFulfillmentFlow {
  id: string;
  name: string;
  description?: string | null;
  steps: Array<{
    sequence: number;
    status_name: string;
    description?: string | null;
    process_day?: number | null;
  }>;
}

export async function getFulfillmentFlow(
  slug: string,
  flowId: string,
  options?: PublicFetchOptions,
): Promise<ApiFulfillmentFlow | null> {
  return fetchPublic<ApiFulfillmentFlow>(
    `/api/public/sites/${encodeURIComponent(slug)}/fulfillment-flows/${encodeURIComponent(flowId)}`,
    options,
  );
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
  identity_name: string;
  label: string;
  description?: string | null;
  images: string[];
  specifications?: Record<string, string> | null;
  estimation?: Array<{ label: string; price: number | string | null }> | null;
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
  /** true kalau lokasi ini punya `shipping_area_name` terisi — bisa dipilih buyer sebagai asal pengiriman saat checkout. */
  shipping_enabled: boolean;
}

export interface ApiWebsitePortfolioCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface ApiWebsitePortfolioProject {
  id: string;
  slug: string;
  name: string;
  tags: string[];
  cover_image: string | null;
  photos: Array<{ url: string; alt: string; caption: string }>;
  project_url: string | null;
  project_type: string | null;
  year: number | null;
  created_at: string;
  categories: ApiWebsitePortfolioCategory[];
  client: { id: string; name: string; logo_url: string | null } | null;
  translation: {
    slug: string;
    title: string;
    excerpt: string | null;
    detail: string | null;
  } | null;
}

export interface ApiWebsiteClient {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  translation: {
    name: string;
    description: string | null;
  } | null;
  categories: Array<{ id: string; slug: string; name: string }>;
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
  seo_title?: string | null;
  seo_description?: string | null;
  seo_image?: string | null;
  seo_no_index?: boolean;
  excerpt: string | null;
  content: string | null;
  cover_image: string | null;
  related_products?: Array<{
    id: string;
    name: string;
    slug: string;
    price: number;
    images: string[];
  }>;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at?: string;
}

/**
 * `fresh: true` = tanpa cache (`cache: 'no-store'`) — hanya untuk route
 * preview Studio (S8). Default (route publik) tetap ISR `revalidate: 60`.
 */
export interface PublicFetchOptions {
  fresh?: boolean;
  locale?: string;
  acceptLanguage?: string;
}

async function fetchPublic<T>(path: string, options: PublicFetchOptions = {}): Promise<T | null> {
  const init: RequestInit & { next?: { revalidate: number } } = options.fresh
    ? { cache: 'no-store' }
    : { next: { revalidate: 60 } };
  const acceptLanguage = options.acceptLanguage
    ?? (typeof navigator !== 'undefined' ? navigator.languages.join(',') || navigator.language : undefined);
  if (acceptLanguage) init.headers = { 'Accept-Language': acceptLanguage };
  const localizedPath = options.locale
    ? `${path}${path.includes('?') ? '&' : '?'}locale=${encodeURIComponent(options.locale)}`
    : path;
  const res = await fetch(`${API_URL}${localizedPath}`, init);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Bagdja API ${res.status} on ${path}`);
  }
  return (await res.json()) as T;
}

export function getTemplateBySlug(slug: string): Promise<ApiWebsiteTemplate | null> {
  return fetchPublic<ApiWebsiteTemplate>(`/api/templates/${slug}`);
}

export function getWebsiteBySlug(slug: string, options?: PublicFetchOptions): Promise<ApiWebsite | null> {
  return fetchPublic<ApiWebsite>(`/api/public/sites/${encodeURIComponent(slug)}`, options);
}

export function getHomePage(slug: string, options?: PublicFetchOptions): Promise<ApiWebsitePage | null> {
  return fetchPublic<ApiWebsitePage>(`/api/public/sites/${encodeURIComponent(slug)}/home`, options);
}

export function getPageBySlug(
  slug: string,
  pageSlug: string,
  options?: PublicFetchOptions,
): Promise<ApiWebsitePage | null> {
  return fetchPublic<ApiWebsitePage>(
    `/api/public/sites/${encodeURIComponent(slug)}/pages/${encodeURIComponent(pageSlug)}`,
    options,
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
export async function getProducts(
  slug: string,
  opts: ProductsQuery = {},
  options?: PublicFetchOptions,
): Promise<GridResult<ApiWebsiteProduct>> {
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
    options,
  );
  return result ?? { data: [], meta: EMPTY_GRID_META };
}

export async function getCategories(slug: string, options?: PublicFetchOptions): Promise<ApiWebsiteCategory[]> {
  const result = await fetchPublic<ApiWebsiteCategory[]>(
    `/api/public/sites/${encodeURIComponent(slug)}/categories`,
    options,
  );
  return result ?? [];
}

export async function getPortfolioProjects(slug: string, options?: PublicFetchOptions): Promise<ApiWebsitePortfolioProject[]> {
  const result = await fetchPublic<ApiWebsitePortfolioProject[]>(
    `/api/public/sites/${encodeURIComponent(slug)}/portfolio-projects`,
    options,
  );
  return result ?? [];
}

export async function getPortfolioCategories(slug: string, options?: PublicFetchOptions): Promise<ApiWebsitePortfolioCategory[]> {
  const result = await fetchPublic<ApiWebsitePortfolioCategory[]>(
    `/api/public/sites/${encodeURIComponent(slug)}/portfolio-categories`,
    options,
  );
  return result ?? [];
}

export async function getWebsiteClients(slug: string, options?: PublicFetchOptions): Promise<ApiWebsiteClient[]> {
  const result = await fetchPublic<ApiWebsiteClient[]>(
    `/api/public/sites/${encodeURIComponent(slug)}/clients`,
    options,
  );
  return result ?? [];
}

export async function getLocations(
  slug: string,
  type?: string,
  options?: PublicFetchOptions,
): Promise<ApiWebsiteLocation[]> {
  const qs = type ? `?type=${encodeURIComponent(type)}` : '';
  const result = await fetchPublic<ApiWebsiteLocation[]>(
    `/api/public/sites/${encodeURIComponent(slug)}/locations${qs}`,
    options,
  );
  return result ?? [];
}

export async function getFaqs(
  slug: string,
  category?: string,
  options?: PublicFetchOptions,
): Promise<ApiWebsiteFaq[]> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  const result = await fetchPublic<ApiWebsiteFaq[]>(
    `/api/public/sites/${encodeURIComponent(slug)}/faqs${qs}`,
    options,
  );
  return result ?? [];
}

export async function getBlogPosts(
  slug: string,
  options?: { search?: string; ids?: string[] } & PublicFetchOptions,
): Promise<ApiWebsiteBlogPost[]> {
  const params = new URLSearchParams();
  if (options?.search) params.set('search', options.search);
  if (options?.ids?.length) params.set('ids', options.ids.join(','));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const result = await fetchPublic<ApiWebsiteBlogPost[]>(
    `/api/public/sites/${encodeURIComponent(slug)}/blog-posts${qs}`,
    { fresh: options?.fresh },
  );
  return result ?? [];
}

export function getBlogPostBySlug(slug: string, postSlug: string): Promise<ApiWebsiteBlogPost | null> {
  return fetchPublic<ApiWebsiteBlogPost>(
    `/api/public/sites/${encodeURIComponent(slug)}/blog-posts/${encodeURIComponent(postSlug)}`,
  );
}