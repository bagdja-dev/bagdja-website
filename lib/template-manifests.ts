/**
 * R1 — daftar template yang BENAR-BENAR ter-build di renderer ini
 * (plan/website-builder/template-contract.md §3).
 *
 * Harus identik (slug, version, rendererApiVersion, sections) dengan
 * `BUILTIN_TEMPLATE_MANIFESTS` di bagdja-website-api
 * (`src/modules/templates/template-manifest.ts`) dan dengan `switch`
 * section di masing-masing View. Diverifikasi oleh
 * `npm run check:contract` (scripts/check-template-contract.mjs).
 *
 * `sections` = section editor yang dirender View (tanpa section sistem yang
 * disuntik route, lihat `SYSTEM_SECTION_TYPES`). barber-classic sengaja tidak
 * mendeklarasikan `hero` karena blok hero-nya tidak dirender (R0 §5.2).
 */

export const RENDERER_API_VERSION = 1;

export interface BuiltTemplateManifest {
  slug: string;
  version: string;
  rendererApiVersion: typeof RENDERER_API_VERSION;
  sections: readonly string[];
}

/**
 * Section sistem: disuntik route `app/[website_slug]/**`, bukan dari DB,
 * dan tidak termasuk katalog Studio (template-contract.md §5.1).
 */
export const SYSTEM_SECTION_TYPES = [
  'product_detail',
  'category_listing',
  'blog_article',
  'cart',
  'checkout',
  'orders',
  'order_detail',
  'profile',
  'chat',
  'tagihan',
  'gathering_calendar',
] as const;

export const BUILT_TEMPLATE_MANIFESTS = {
  'barber-classic': {
    slug: 'barber-classic',
    version: '1.0.0',
    rendererApiVersion: RENDERER_API_VERSION,
    sections: [
      'text_block',
      'rich_text',
      'about',
      'gallery',
      'testimonial',
      'services_grid',
      'products_grid',
      'category_grid',
      'cta',
      'contact',
      'locations_list',
      'faq_list',
      'blog_list',
      'blog_search',
      'blog_collection',
    ],
  },
  'store-classic': {
    slug: 'store-classic',
    version: '1.0.0',
    rendererApiVersion: RENDERER_API_VERSION,
    sections: [
      'hero',
      'text_block',
      'rich_text',
      'about',
      'gallery',
      'features_grid',
      'logo_wall',
      'testimonial',
      'services_grid',
      'products_grid',
      'category_grid',
      'featured_product',
      'cta',
      'contact',
      'locations_list',
      'faq_list',
      'blog_list',
      'blog_search',
      'blog_collection',
    ],
  },
  workshop: {
    slug: 'workshop',
    version: '1.0.0',
    rendererApiVersion: RENDERER_API_VERSION,
    sections: [
      'hero',
      'about',
      'gallery',
      'features_grid',
      'testimonial',
      'services_grid',
      'category_grid',
      'service_process_section',
      'contact',
      'faq_list',
      'blog_list',
      'blog_search',
      'blog_collection',
    ],
  },
} as const satisfies Record<string, BuiltTemplateManifest>;

export type BuiltTemplateSlug = keyof typeof BUILT_TEMPLATE_MANIFESTS;

export function isBuiltTemplateSlug(slug: string): slug is BuiltTemplateSlug {
  return Object.prototype.hasOwnProperty.call(BUILT_TEMPLATE_MANIFESTS, slug);
}

export function getBuiltTemplateManifest(slug: string): BuiltTemplateManifest | null {
  return isBuiltTemplateSlug(slug) ? BUILT_TEMPLATE_MANIFESTS[slug] : null;
}

/**
 * `digest` error untuk template yang tidak ter-build (`UnsupportedTemplateError`
 * di template-registry). Ditaruh di modul tanpa dependensi View ini agar bisa
 * diimpor error boundary client.
 */
export const UNSUPPORTED_TEMPLATE_DIGEST = 'BAGDJA_UNSUPPORTED_TEMPLATE';

const warnedUnknownSections = new Set<string>();

/**
 * Dipanggil dari `default:` switch section di tiap View: type tak dikenal
 * dilewati (tanpa fallback visual) dan dicatat SEKALI per (template, type)
 * per proses/tab. Hanya type + slug template yang dicatat (tanpa data tenant).
 */
export function warnUnknownSection(templateSlug: BuiltTemplateSlug, sectionType: string): void {
  const key = `${templateSlug}:${sectionType}`;
  if (warnedUnknownSections.has(key)) return;
  warnedUnknownSections.add(key);
  console.warn(`[template:${templateSlug}] Unknown section type "${sectionType}" skipped.`);
}
