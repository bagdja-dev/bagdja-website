import type { ComponentType } from 'react';

import { BarberClassicView } from '../components/templates/barber-classic/barber-classic-view';
import { StoreClassicView } from '../components/templates/store-classic/store-classic-view';
import type {
  BlogPostItem,
  CatalogItem,
  CategoryItem,
  FaqItem,
  LocationItem,
  NavPage,
  SectionEntry,
} from './template-data';
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
  };
  templateTheme?: WebsiteTheme;
  websiteTheme?: WebsiteTheme;
  sections: SectionEntry[];
  products: CatalogItem[];
  categories?: CategoryItem[];
  locations: LocationItem[];
  faqs: FaqItem[];
  websiteSlug?: string;
  /** Slug asli tenant (BUKAN basePath link) — dipakai fetch client-side (pagination/filter) ke API publik, karena `websiteSlug` di atas kosong untuk custom domain/subdomain. */
  tenantSlug?: string;
  pages?: NavPage[];
  blogPosts?: BlogPostItem[];
}

const TEMPLATE_REGISTRY: Record<string, ComponentType<TemplateRenderProps>> = {
  'barber-classic': BarberClassicView,
  'store-classic': StoreClassicView,
};

export function getTemplateRenderer(templateSlug: string): ComponentType<TemplateRenderProps> | null {
  return TEMPLATE_REGISTRY[templateSlug] ?? null;
}
