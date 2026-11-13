import type { TemplatePageObject } from './template-page-contract';
import type { ComponentType } from 'react';

import { BarberClassicView } from '../components/templates/barber-classic/barber-classic-view';
import { StoreClassicView } from '../components/templates/store-classic/store-classic-view';
import { WorkshopView } from '../components/templates/workshop/workshop-view';
import type {
  BlogPostItem,
  CatalogItem,
  CategoryItem,
  FaqItem,
  LocationItem,
  NavPage,
  SectionEntry,
} from './template-data';
import type { TemplateRuntimeOrderAction } from './template-runtime-bridge';
import {
  BUILT_TEMPLATE_MANIFESTS,
  UNSUPPORTED_TEMPLATE_DIGEST,
  isBuiltTemplateSlug,
  type BuiltTemplateSlug,
} from './template-manifests';
import type { WebsiteTheme } from './website-theme';

/**
 * Kontrak data yang sama untuk SEMUA template (data-layer, bukan concern
 * per-template) — dipakai `tenant-loader`/route handler untuk merender
 * template apa pun tanpa peduli implementasi internalnya. Setiap template
 * (barber-classic, store-classic, dst) bebas beda total dari sisi
 * komponen/CSS/dependency selama mengimplementasikan kontrak ini.
 */
export interface TemplateRenderProps {
  isPreview: boolean;
  profile: {
    name?: string;
    tagline?: string;
    logoUrl?: string;
    whatsapp?: string;
    phone?: string;
    email?: string;
    socialLinks?: Record<string, unknown>;
    /** `websites.footer_settings` mentah — dinormalisasi oleh renderer (lihat normalizeFooterBlocks) */
    footerSettings?: unknown;
  };
  templateTheme?: WebsiteTheme;
  websiteTheme?: WebsiteTheme;
  sections: SectionEntry[];
  products: CatalogItem[];
  categories?: CategoryItem[];
  locations: LocationItem[];
  faqs: FaqItem[];
  websiteSlug?: string;
  websiteId?: string;
  /** Slug asli tenant (BUKAN basePath link) — dipakai fetch client-side (pagination/filter) ke API publik, karena `websiteSlug` di atas kosong untuk custom domain/subdomain. */
  tenantSlug?: string;
  pages?: NavPage[];
  blogPosts?: BlogPostItem[];
  /**
   * Data halaman sistem untuk template package (`props.page`, kontrak
   * bagdja-website-template-runtime/contract/page-contract.d.ts). Divalidasi
   * `validateTemplatePage` sebelum dikirim ke runtime; yang tidak valid dibuang.
   */
  page?: TemplatePageObject;
  /** 1 = host menyediakan bridge intent untuk aksi di `page.actions` (template boleh mengaktifkan tombolnya). */
  bridgeVersion?: number;
  /** Hide the built-in header where a separately rendered designer header is present. */
  hideHeader?: boolean;
  /** Use the Store Classic cart presentation while keeping cart operations in the host. */
  cartDesign?: 'store-classic';
  /** Use the Store Classic checkout presentation while keeping checkout operations in the host. */
  checkoutDesign?: 'store-classic';
  /** Use the Store Classic transaction-list presentation while keeping transaction operations in the host. */
  ordersDesign?: 'store-classic';
  /** Use the Store Classic invoice-list presentation while keeping payment operations in the host. */
  tagihanDesign?: 'store-classic';
  /** Use the Store Classic calendar presentation while keeping calendar data and actions in the host. */
  calendarDesign?: 'store-classic';
  /** Use the Store Classic order-detail presentation while keeping order actions in the host. */
  orderDetailDesign?: 'store-classic';
  /** W1 auth renderer: state login buyer (dibaca server-side dari cookie). */
  auth?: {
    isLoggedIn: boolean;
    username?: string;
    email?: string;
    avatar?: string;
    loginHref?: string;
    logoutHref?: string;
    profileLogoutHref?: string;
    cartHref?: string;
    ordersHref?: string;
    tagihanHref?: string;
    calendarHref?: string;
    profileHref?: string;
    chatHref?: string;
  };
}

/**
 * Diketik `Record<BuiltTemplateSlug, ...>` → setiap manifest di
 * `BUILT_TEMPLATE_MANIFESTS` wajib punya View, dan sebaliknya (dicek compiler).
 */
const TEMPLATE_REGISTRY: Record<BuiltTemplateSlug, ComponentType<TemplateRenderProps>> = {
  'barber-classic': BarberClassicView,
  'store-classic': StoreClassicView,
  workshop: WorkshopView,
};

/**
 * Record API menunjuk template yang tidak ter-build di renderer ini
 * (template-contract.md §3). `digest` dipertahankan Next.js sampai ke error
 * boundary (`app/[website_slug]/error.tsx`) sehingga pengunjung melihat pesan
 * yang jelas, bukan 404 diam-diam; status HTTP 500 (galat konfigurasi).
 */
export class UnsupportedTemplateError extends Error {
  readonly digest = UNSUPPORTED_TEMPLATE_DIGEST;

  constructor(readonly templateSlug: string) {
    super(`Template "${templateSlug}" is not built into this renderer.`);
    this.name = 'UnsupportedTemplateError';
  }
}

/**
 * Slug ter-build → View template (perilaku lama). Slug tidak ter-build →
 * dicatat (hanya slug template + daftar yang tersedia, tanpa data tenant)
 * lalu melempar `UnsupportedTemplateError`.
 */
export function getTemplateRenderer(templateSlug: string): ComponentType<TemplateRenderProps> {
  if (isBuiltTemplateSlug(templateSlug)) return TEMPLATE_REGISTRY[templateSlug];

  const error = new UnsupportedTemplateError(templateSlug);
  console.error(
    `[template-registry] ${error.message} Built templates: ${Object.keys(BUILT_TEMPLATE_MANIFESTS).join(', ')}.`,
  );
  throw error;
}
