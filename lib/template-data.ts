/** Mapping master data (API) -> shape yang dikonsumsi komponen template */

import type {
  ApiWebsiteBlogPost,
  ApiWebsiteFaq,
  ApiWebsiteLocation,
  ApiWebsitePage,
  ApiWebsiteProduct,
  ApiWebsiteTemplate,
} from './api-client';

export interface CatalogItem {
  id: string;
  type: string;
  name: string;
  slug: string;
  description?: string;
  detail?: string;
  priceLabel: string;
  image?: string;
  images?: string[];
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

export function buildPageHref(websiteSlug: string, page: NavPage): string {
  return page.isHome ? `/${websiteSlug}` : `/${websiteSlug}/${page.slug}`;
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

export function toCatalogItem(product: ApiWebsiteProduct): CatalogItem {
  return {
    id: product.id,
    type: product.type,
    name: product.name,
    slug: product.slug,
    description: product.description ?? undefined,
    detail: product.detail ?? undefined,
    priceLabel: formatIDR(product.price),
    image: product.images?.[0],
    images: product.images,
  };
}

export function buildProductHref(websiteSlug: string, productSlug: string): string {
  return `/${websiteSlug}/products/${productSlug}`;
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
  };
}

export function buildBlogPostHref(websiteSlug: string, postSlug: string): string {
  return `/${websiteSlug}/blog/${postSlug}`;
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
