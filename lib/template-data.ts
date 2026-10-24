/** Mapping master data (API) -> shape yang dikonsumsi komponen template */

import type {
  ApiWebsiteBlogPost,
  ApiWebsiteCategory,
  ApiWebsiteFaq,
  ApiWebsiteLocation,
  ApiWebsitePage,
  ApiWebsiteProduct,
  ApiWebsiteTemplate,
} from './api-client';

export interface GatheringOptionGroup {
  key: string;
  label: string;
  options: Array<{
    id: string;
    label: string;
    description?: string;
    venueLocation?: string;
    availabilityNote?: string;
    benefits?: string[];
  }>;
}

export interface CatalogItem {
  id: string;
  /** Website (tenant) pemilik produk — dipakai POST /api/orders/draft.
   *  Opsional (sample/preview data tidak punya website nyata). */
  websiteId?: string;
  type: string;
  category?: string;
  name: string;
  slug: string;
  description?: string;
  detail?: string;
  gatheringMeta?: {
    eventDate?: string;
    eventTime?: string;
    location?: string;
    minAttendees?: number;
    maxAttendees?: number;
    depositAmountPerSeat?: number;
    optionGroups?: GatheringOptionGroup[];
    cancellationPolicy?: string;
  };
  specifications?: Record<string, string>;
  estimation?: Array<{ label: string; price: number | string }>;
  priceLabel: string;
  /** Produk butuh quotation dulu dari seller — sumber kebenaran utk CTA "Dapatkan Penawaran" (bukan tebak dari price<=0). */
  quotable?: boolean;
  uomSymbol?: string;
  image?: string;
  images?: string[];
  /** Video produk (opsional), diupload lewat bagdja-storage-service. */
  videoUrl?: string;
  /** Model 3D produk (opsional, glTF/GLB), diupload lewat bagdja-storage-service. */
  model3dUrl?: string;
  /** Kalau diisi, produk ini adalah varian (warna/ukuran) dari produk lain. */
  parentProductId?: string;
  /** Lokasi layanan yang diizinkan; kosong berarti semua lokasi. */
  locationIds?: string[];
  /** Tag pembeda varian, mis. `{ Warna: "Oil Green", Ukuran: "38" }` — dari `metadata.variant_attributes`. */
  variantAttributes?: Record<string, string>;
  /** Stok (dari metadata.stock) — opsional, dipakai guard quantity di UI. */
  stock?: number;
}

export interface CategoryItem {
  id: string;
  label: string;
  description?: string;
  images: string[];
  specifications?: Record<string, string>;
  estimation?: Array<{ label: string; price: number | string }>;
}

function normalizeCategorySpecifications(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;

  const entries = Object.entries(raw as Record<string, unknown>)
    .filter((entry): entry is [string, string | number | boolean] => typeof entry[0] === 'string')
    .map(([key, value]): [string, string] => [key.trim(), String(value)])
    .filter(([key, value]) => key.length > 0 && value.trim().length > 0);

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalizeCategoryEstimation(raw: unknown): Array<{ label: string; price: number | string }> | undefined {
  if (!Array.isArray(raw)) return undefined;

  const entries: Array<{ label: string; price: number | string }> = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;

    const label = typeof item.label === 'string' ? item.label.trim() : '';
    if (!label) continue;

    const priceValue = item.price;
    const numericPrice =
      typeof priceValue === 'number'
        ? priceValue
        : typeof priceValue === 'string'
          ? Number(String(priceValue).replace(/[^\d.-]/g, '')) || 0
          : 0;

    entries.push({ label, price: numericPrice });
  }

  return entries.length ? entries : undefined;
}

export function toCategoryItem(category: ApiWebsiteCategory): CategoryItem {
  return {
    id: category.id,
    label: category.label,
    description: category.description ?? undefined,
    images: category.images ?? [],
    specifications: normalizeCategorySpecifications(category.specifications),
    estimation: normalizeCategoryEstimation(category.estimation),
  };
}

export interface LocationItem {
  id: string;
  name: string;
  type: string;
  isPrimary: boolean;
  addressLine?: string;
  city?: string;
  province?: string;
  phone?: string;
  whatsapp?: string;
  openingHoursNote?: string;
  mapsUrl?: string;
  latitude?: number | string;
  longitude?: number | string;
  /** true = lokasi ini bisa dipilih buyer sebagai asal pengiriman saat checkout (lihat CheckoutContent). */
  shippingEnabled: boolean;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

export interface SectionEntry {
  type: string;
  content: Record<string, unknown>;
}

export interface WebsiteFooterSettings {
  enabled?: boolean;
  show_logo?: boolean;
  show_business_name?: boolean;
  show_tagline?: boolean;
  show_social_links?: boolean;
  show_pages?: boolean;
  show_address?: boolean;
  show_whatsapp?: boolean;
  show_phone?: boolean;
  show_email?: boolean;
  show_copyright?: boolean;
  contact_heading?: string;
  pages_heading?: string;
  copyright_text?: string;
}

export function normalizeWebsiteFooterSettings(raw: unknown): WebsiteFooterSettings | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;

  const input = raw as Record<string, unknown>;
  const settings: WebsiteFooterSettings = {};
  const booleanKeys = [
    'enabled',
    'show_logo',
    'show_business_name',
    'show_tagline',
    'show_social_links',
    'show_pages',
    'show_address',
    'show_whatsapp',
    'show_phone',
    'show_email',
    'show_copyright',
  ] as const;
  const stringLimits = {
    contact_heading: 80,
    pages_heading: 80,
    copyright_text: 160,
  } as const;

  for (const key of booleanKeys) {
    if (typeof input[key] === 'boolean') settings[key] = input[key];
  }
  for (const key of ['contact_heading', 'pages_heading', 'copyright_text'] as const) {
    const value = input[key];
    if (typeof value === 'string') settings[key] = value.slice(0, stringLimits[key]);
  }

  return settings;
}

export interface GalleryImageItem {
  url: string;
  alt?: string;
  caption?: string;
}

export function parseGalleryImages(raw: unknown): GalleryImageItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map((item) => ({
      url: typeof item.url === 'string' ? item.url : '',
      alt: typeof item.alt === 'string' ? item.alt : undefined,
      caption: typeof item.caption === 'string' ? item.caption : undefined,
    }))
    .filter((img) => img.url);
}

export interface NavPage {
  slug: string;
  title: string;
  isHome: boolean;
  placement: string;
}

export function toNavPage(page: ApiWebsitePage): NavPage {
  return {
    slug: page.slug,
    title: page.title,
    isHome: page.is_home,
    placement: page.placement,
  };
}

/**
 * `basePath` sudah pre-computed oleh caller (lihat `resolveTenantLinkBase`) —
 * kosong ('') untuk subdomain/custom domain, `/{slug}` untuk path-based
 * (local dev). Jangan diisi raw slug tanpa lewat situ, supaya tidak dobel
 * slug di URL (`{slug}.sites.bagdja.com/{slug}/...`).
 */
export function buildPageHref(basePath: string, page: NavPage): string {
  if (page.isHome) return basePath || '/';
  return `${basePath}/${page.slug}`;
}

export function formatIDR(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Sinonim label axis varian yang umum ketik beda-beda antar produk (beda
 * bahasa/kapitalisasi) — supaya "Size"/"SIZE"/"Ukuran" dianggap 1 axis yang
 * sama, bukan pecah jadi baris terpisah di VariantSwitcher. Dicek via
 * lowercase-trim, jadi tidak case-sensitive.
 */
const AXIS_LABEL_ALIASES: Record<string, string> = {
  warna: 'Warna',
  color: 'Warna',
  colour: 'Warna',
  ukuran: 'Ukuran',
  size: 'Ukuran',
  bahan: 'Bahan',
  material: 'Bahan',
};

/** Satukan variasi kapitalisasi ("size" vs "Size" vs "SIZE", "MERAH" vs "Merah") jadi 1 bentuk baku, per kata. */
function toTitleCase(text: string): string {
  return text
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ');
}

function normalizeAxisLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  const alias = AXIS_LABEL_ALIASES[trimmed.toLowerCase()];
  return alias ?? toTitleCase(trimmed);
}

/**
 * Sama seperti label, VALUE atribut (mis. "MERAH" vs "Merah") juga perlu
 * disatukan biar tidak dianggap 2 pilihan warna/ukuran berbeda di
 * VariantTreeSelector — cukup normalisasi kapitalisasi, BUKAN terjemahan
 * sinonim lintas bahasa (mis. "Red" vs "Merah" tetap dianggap beda, karena
 * itu perlu kamus istilah yang riskan salah kelompok, mis. "Merah Muda").
 */
function normalizeAxisValue(value: string): string {
  return toTitleCase(value.trim());
}

function parseVariantAttributes(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([key, value]): [string, string] => [normalizeAxisLabel(key), normalizeAxisValue(value)]);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalizeProductSpecifications(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;

  const entries = Object.entries(raw as Record<string, unknown>)
    .filter((entry): entry is [string, string | number | boolean] => typeof entry[0] === 'string')
    .map(([key, value]): [string, string] => [key.trim(), String(value)])
    .filter(([key, value]) => key.length > 0 && value.trim().length > 0);

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalizeProductEstimation(raw: unknown): Array<{ label: string; price: number | string }> | undefined {
  if (!Array.isArray(raw)) return undefined;

  const entries: Array<{ label: string; price: number | string }> = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;

    const label = typeof item.label === 'string' ? item.label.trim() : '';
    if (!label) continue;

    const priceValue = item.price;
    const numericPrice =
      typeof priceValue === 'number'
        ? priceValue
        : typeof priceValue === 'string'
          ? Number(String(priceValue).replace(/[^\d.-]/g, '')) || 0
          : 0;

    entries.push({ label, price: numericPrice });
  }

  return entries.length ? entries : undefined;
}

/**
 * Rp 0 di katalog = sentinel "belum ada harga final, tunggu quotation admin"
 * (fulfillment-praorder-plan.md §2.1) — bukan produk gratis. Kembalikan
 * priceLabel kosong (falsy) supaya template pakai fallback "KONSULTASI"
 * yang sudah ada, bukan menampilkan "Rp 0" yang membingungkan.
 */
function normalizeGatheringMeta(
  raw: unknown,
  optionRows: ApiWebsiteProduct['gathering_options'] = [],
): CatalogItem['gatheringMeta'] | undefined {
  const meta = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  const groups = new Map<string, GatheringOptionGroup>();

  for (const option of optionRows ?? []) {
    if (!option.is_active) continue;
    const group = groups.get(option.option_group_key) ?? {
      key: option.option_group_key,
      label: option.option_group_key.replace(/[-_]+/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase()),
      options: [],
    };
    group.options.push({
      id: option.id,
      label: option.label,
      description: option.description ?? undefined,
      venueLocation: option.venue_location ?? undefined,
      availabilityNote: typeof option.availability_window?.note === 'string'
        ? option.availability_window.note
        : undefined,
      benefits: option.benefits?.filter((benefit): benefit is string => typeof benefit === 'string'),
    });
    groups.set(group.key, group);
  }

  const legacyOptions = Array.isArray(meta.option_groups)
    ? meta.option_groups.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : typeof meta.option_groups === 'string'
      ? meta.option_groups.split(/\n|;/).map((entry) => entry.trim()).filter(Boolean)
      : [];
  for (const [index, legacyOption] of legacyOptions.entries()) {
    const separator = legacyOption.indexOf(':');
    const groupLabel = separator > 0 ? legacyOption.slice(0, separator).trim() : 'Pilihan';
    const label = separator > 0 ? legacyOption.slice(separator + 1).trim() : legacyOption;
    const key = groupLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `legacy-${index + 1}`;
    if (!groups.has(key)) {
      groups.set(key, { key, label: groupLabel, options: [] });
    }
    const group = groups.get(key)!;
    if (!group.options.some((option) => option.label === label)) {
      group.options.push({ id: `${key}-${index}`, label });
    }
  }

  const min = typeof meta.min_attendees === 'number' ? meta.min_attendees : Number(meta.min_attendees ?? 0);
  const max = typeof meta.max_attendees === 'number' ? meta.max_attendees : Number(meta.max_attendees ?? 0);
  const depositAmount = typeof meta.deposit_amount_per_seat === 'number'
    ? meta.deposit_amount_per_seat
    : Number(meta.deposit_amount_per_seat ?? 0);
  const optionGroups = [...groups.values()];
  const rawPolicy = meta.cancellation_policy && typeof meta.cancellation_policy === 'object'
    ? meta.cancellation_policy as Record<string, unknown>
    : {};
  let cancellationPolicy = typeof meta.cancellation_policy === 'string'
    ? meta.cancellation_policy
    : typeof rawPolicy.summary === 'string' ? rawPolicy.summary : '';
  if (!cancellationPolicy && Object.keys(rawPolicy).length > 0) {
    const cutoff = Number(rawPolicy.cutoff_days_before_event ?? 0);
    const prepare = Number(rawPolicy.prepare_days_before_event ?? cutoff);
    const penaltyType = String(rawPolicy.penalty_type ?? 'NONE');
    const penaltyValue = Number(rawPolicy.penalty_value ?? 0);
    const prepareText = prepare > 0
      ? `Persiapan acara dimulai ${prepare} hari sebelum acara`
      : 'Persiapan acara dimulai pada hari acara';
    const cutoffText = cutoff > 0
      ? `cutoff pembatalan adalah ${cutoff} hari sebelum acara`
      : 'cutoff pembatalan adalah hari acara';
    const penaltyText = penaltyType === 'FIXED'
      ? `penalti Rp${new Intl.NumberFormat('id-ID').format(penaltyValue)} per peserta`
      : penaltyType === 'PERCENTAGE' ? `penalti ${penaltyValue}% per peserta` : 'tanpa penalti';
    cancellationPolicy = `${prepareText}. Initiator dapat membatalkan sebelum persiapan tanpa penalti. Pembatalan sejak persiapan dimulai hingga ${cutoffText} dikenai ${penaltyText}. Setelah cutoff, pembatalan oleh initiator tidak tersedia. Pembatalan seat oleh peserta mengikuti aturan terpisah.`;
  }
  const hasAny = optionGroups.length > 0 || meta.min_attendees != null || meta.max_attendees != null || Boolean(cancellationPolicy);
  if (!hasAny) return undefined;

  return {
    minAttendees: Number.isFinite(min) && min >= 0 ? min : undefined,
    maxAttendees: Number.isFinite(max) && max >= 0 ? max : undefined,
    depositAmountPerSeat: Number.isFinite(depositAmount) && depositAmount >= 0 ? depositAmount : undefined,
    optionGroups: optionGroups.length ? optionGroups : undefined,
    cancellationPolicy: cancellationPolicy || undefined,
  };
}

export function toCatalogItem(product: ApiWebsiteProduct): CatalogItem {
  return {
    id: product.id,
    websiteId: product.website_id,
    type: product.type,
    category: product.category ?? undefined,
    name: product.name,
    slug: product.slug,
    description: product.description ?? undefined,
    detail: product.detail ?? undefined,
    gatheringMeta: normalizeGatheringMeta(product.metadata, product.gathering_options),
    specifications: normalizeProductSpecifications(product.specifications),
    estimation: normalizeProductEstimation(product.estimation),
    priceLabel: product.price > 0
      ? `${formatIDR(product.price)}${product.type === 'gathering' ? ' / peserta' : product.uom?.symbol ? `/${product.uom.symbol}` : ''}`
      : '',
    quotable: product.quotable,
    uomSymbol: product.uom?.symbol,
    image: product.images?.[0],
    images: product.images,
    videoUrl: product.video_url ?? undefined,
    model3dUrl: product.model3d_url ?? undefined,
    parentProductId: product.parent_product_id ?? undefined,
    locationIds: product.location_ids ?? [],
    variantAttributes: parseVariantAttributes(product.metadata?.variant_attributes),
    stock: parseStock(product.metadata?.stock),
  };
}

/** Ambil nilai stok dari metadata.stock — return undefined kalau bukan angka non-negatif. */
function parseStock(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

interface MasterDefaultsCatalogItem {
  key?: string;
  parent_key?: string;
  name: string;
  price: number;
  category?: string;
  description?: string;
  images?: string[];
  image?: string;
  variant_attributes?: Record<string, string>;
  inherit_description?: boolean;
}

interface MasterDefaultsCategoryItem {
  label: string;
  images?: string[];
}

interface MasterDefaultsFaqItem {
  question: string;
  answer: string;
  category?: string;
}

export interface TemplateDefaultsPreview {
  sections: SectionEntry[];
  products: CatalogItem[];
  categories: CategoryItem[];
  faqs: FaqItem[];
}

function buildCatalogFromSeed(
  items: MasterDefaultsCatalogItem[] | undefined,
  type: 'service' | 'product',
): CatalogItem[] {
  if (!items?.length) return [];
  return items.map((item, index) => {
    const id = item.key ?? `${type}-${index}`;
    const parent = item.parent_key ? items.find((candidate) => candidate.key === item.parent_key) : undefined;
    const description = item.inherit_description && parent ? parent.description : item.description;
    const images = item.images ?? (item.image ? [item.image] : undefined);
    return {
      id,
      type,
      category: item.category,
      name: item.name,
      slug: id,
      description,
      priceLabel: item.price > 0 ? formatIDR(item.price) : '',
      image: images?.[0],
      images,
      parentProductId: parent ? (parent.key ?? undefined) : undefined,
      variantAttributes: parseVariantAttributes(item.variant_attributes),
    };
  });
}

/**
 * Bangun data preview template (sections + katalog + kategori + faq) langsung dari
 * `structure.master_defaults`/`structure.sections` template — dipakai halaman
 * `/templates/[slug]` supaya preview live di admin selalu mengikuti default data
 * yang sungguhan tersimpan di DB, bukan sample statis yang bisa basi.
 */
export function buildTemplateDefaultsPreview(structure: Record<string, unknown> | null | undefined): TemplateDefaultsPreview {
  const master = (structure?.master_defaults ?? {}) as {
    services?: MasterDefaultsCatalogItem[];
    products?: MasterDefaultsCatalogItem[];
    categories?: MasterDefaultsCategoryItem[];
    faqs?: MasterDefaultsFaqItem[];
  };
  const sectionsDef = (structure?.sections ?? []) as { type: string; defaults?: Record<string, unknown> }[];

  return {
    sections: sectionsDef.map((s) => ({ type: s.type, content: s.defaults ?? {} })),
    products: [...buildCatalogFromSeed(master.services, 'service'), ...buildCatalogFromSeed(master.products, 'product')],
    categories: (master.categories ?? []).map((c, index) => ({
      id: `cat-${index}`,
      label: c.label,
      images: c.images ?? [],
    })),
    faqs: (master.faqs ?? []).map((f, index) => ({
      id: `faq-${index}`,
      question: f.question,
      answer: f.answer,
      category: f.category,
    })),
  };
}

/** Slug URL dari label kategori — tidak disimpan di DB (kategori cuma punya `label`), dihitung on-the-fly di kedua sisi (link & resolve halaman). */
export function slugifyLabel(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** `basePath` — lihat catatan di `buildPageHref`. */
export function buildCategoryHref(basePath: string, categoryLabel: string): string {
  return `${basePath}/kategori/${slugifyLabel(categoryLabel)}`;
}

/** `basePath` — lihat catatan di `buildPageHref`. */
export function buildProductHref(basePath: string, productSlug: string): string {
  return `${basePath}/products/${productSlug}`;
}

export function toLocationItem(location: ApiWebsiteLocation): LocationItem {
  const note =
    location.opening_hours && typeof location.opening_hours === 'object'
      ? (location.opening_hours as Record<string, unknown>).note
      : undefined;
  return {
    id: location.id,
    name: location.name,
    type: location.type,
    isPrimary: location.is_primary,
    addressLine: location.address_line ?? undefined,
    city: location.city ?? undefined,
    province: location.province ?? undefined,
    latitude: location.latitude ?? undefined,
    longitude: location.longitude ?? undefined,
    phone: location.phone ?? undefined,
    whatsapp: location.whatsapp ?? undefined,
    openingHoursNote: typeof note === 'string' ? note : undefined,
    mapsUrl: location.maps_url ?? undefined,
    shippingEnabled: Boolean(location.shipping_enabled),
  };
}

export function toFaqItem(faq: ApiWebsiteFaq): FaqItem {
  return {
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
    category: faq.category ?? undefined,
  };
}

export interface BlogPostItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  coverImage?: string;
  publishedAtLabel?: string;
  relatedProducts?: Array<{
    id: string;
    name: string;
    slug: string;
    priceLabel: string;
    image?: string;
  }>;
}

export function toBlogPostItem(post: ApiWebsiteBlogPost): BlogPostItem {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? undefined,
    content: post.content ?? '',
    coverImage: post.cover_image ?? undefined,
    publishedAtLabel: post.published_at
      ? new Date(post.published_at).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : undefined,
      relatedProducts: post.related_products?.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        priceLabel: product.price > 0 ? formatIDR(product.price) : 'Konsultasi',
        image: product.images?.[0],
      })),
  };
}

/** `basePath` — lihat catatan di `buildPageHref`. */
export function buildBlogPostHref(basePath: string, postSlug: string): string {
  return `${basePath}/blog/${postSlug}`;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Embed Google Maps tanpa API key — pakai koordinat kalau ada (lebih akurat),
 * fallback ke pencarian teks alamat/kota. Return undefined kalau tidak ada
 * data lokasi sama sekali untuk ditampilkan.
 */
export function buildMapEmbedUrl(location: LocationItem): string | undefined {
  if (location.latitude != null && location.longitude != null) {
    return `https://www.google.com/maps?q=${location.latitude},${location.longitude}&z=15&output=embed`;
  }
  const query = [location.addressLine, location.city].filter(Boolean).join(', ');
  if (!query) return undefined;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

export function buildWhatsAppHref(number: string | undefined): string | undefined {
  if (!number?.trim()) return undefined;
  const digits = digitsOnly(number);
  return digits ? `https://wa.me/${digits}` : undefined;
}

export interface SocialLink {
  platform: string;
  url: string;
}

const SOCIAL_URL_TEMPLATES: Record<string, (handle: string) => string> = {
  instagram: (h) => `https://instagram.com/${h.replace(/^@/, '')}`,
  facebook: (h) => `https://facebook.com/${h}`,
  tiktok: (h) => `https://tiktok.com/@${h.replace(/^@/, '')}`,
  youtube: (h) => `https://youtube.com/${h}`,
  linkedin: (h) => `https://linkedin.com/company/${h}`,
  twitter: (h) => `https://twitter.com/${h.replace(/^@/, '')}`,
  x: (h) => `https://x.com/${h.replace(/^@/, '')}`,
};

/** `website.social_links` isinya bisa handle polos (mis. "jhonsbarbershop") atau URL penuh */
export function parseSocialLinks(raw: Record<string, unknown> | null | undefined): SocialLink[] {
  if (!raw || typeof raw !== 'object') return [];
  const links: SocialLink[] = [];
  for (const [platform, value] of Object.entries(raw)) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const trimmed = value.trim();
    const url = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : (SOCIAL_URL_TEMPLATES[platform.toLowerCase()]?.(trimmed) ?? trimmed);
    links.push({ platform: platform.toLowerCase(), url });
  }
  return links;
}

const DEFAULT_SECTIONS: SectionEntry[] = [
  { type: 'hero', content: {} },
  { type: 'services_grid', content: { title: 'Layanan Kami', filter_type: 'service' } },
  { type: 'products_grid', content: { title: 'Produk Kami', filter_type: 'product' } },
  { type: 'locations_list', content: { title: 'Kunjungi Kami' } },
  { type: 'faq_list', content: { title: 'Pertanyaan Umum' } },
];

/**
 * Urutan & konfigurasi section untuk sebuah halaman.
 * `allowTemplateFallback` (default true, dipakai untuk halaman home) fallback ke
 * `template.structure.sections` (lalu default hardcoded) supaya renderer tetap
 * tampil wajar meski website belum punya home page/sections (seharusnya jarang
 * terjadi karena WebsitesService.create() auto-seed). Untuk halaman non-home,
 * caller mengirim `false` — halaman baru yang belum diisi section memang wajar
 * tampil kosong, bukan ikut-ikutan tampilan default template (hero+grid home).
 */
export function resolveSections(
  page: ApiWebsitePage | null,
  template: ApiWebsiteTemplate | null | undefined,
  allowTemplateFallback = true,
): SectionEntry[] {
  if (page?.sections?.length) {
    return [...page.sections]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ type: s.type, content: s.content ?? {} }));
  }

  if (!allowTemplateFallback) return [];

  const templateSections = (template?.structure as { sections?: unknown } | undefined)?.sections;
  if (Array.isArray(templateSections)) {
    return templateSections.map((s) => {
      const entry = s as { type?: unknown; defaults?: unknown };
      return {
        type: String(entry.type ?? ''),
        content: (entry.defaults as Record<string, unknown>) ?? {},
      };
    });
  }

  return DEFAULT_SECTIONS;
}
