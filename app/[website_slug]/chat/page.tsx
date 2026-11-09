/**
 * Halaman Chat buyer — konsumen mengirimkan pertanyaan untuk website
 * tertentu dan melihat percakapan yang sudah dibuat. Route diprotect
 * middleware agar hanya buyer login yang bisa akses.
 *
 * Server Component: load tenant + auth, lalu render lewat template `Renderer`
 * dengan section type `chat` — header/footer/theme konsisten dengan home &
 * halaman lain (pola sama seperti `orders/page.tsx`). Konten interaktif ada
 * di `components/customer-chat-content.tsx` (client), dirender oleh masing-
 * masing `*-view.tsx` template lewat `case 'chat'`.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getAuthViewState } from '../../../lib/auth-view';
import { loadTenant } from '../../../lib/tenant-loader';
import WebsiteInactiveNotice from '../../../components/website-inactive-notice';
import { CartProvider } from '../../../lib/cart';
import {
  toBlogPostItem,
  toCatalogItem,
  toFaqItem,
  toLocationItem,
  toNavPage,
  type SectionEntry,
} from '../../../lib/template-data';
import { getTemplateRenderer } from '../../../lib/template-registry';
import type { TemplateRenderProps } from '../../../lib/template-registry';
import { resolveTenantLinkBase } from '../../../lib/tenant-link-base';
import { extractTemplateTheme, sanitizeWebsiteTheme } from '../../../lib/website-theme';
import { renderPinnedTenantHeader } from '../../../lib/template-runtime-route';

export const revalidate = 60;

interface ChatPageProps {
  params: { website_slug: string };
}

export async function generateMetadata({ params }: ChatPageProps): Promise<Metadata> {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) return {};
  return { title: `Inbox Chat — ${tenant.website.name}` };
}

export default async function ChatPage({ params }: ChatPageProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();
  if (tenant.subscription_inactive) return <WebsiteInactiveNotice />;

  const auth = await getAuthViewState(
    `${resolveTenantLinkBase(params.website_slug)}/chat`,
    resolveTenantLinkBase(params.website_slug),
  );
  const { website, products, locations, faqs, blogPosts } = tenant;
  const Renderer = website.template ? getTemplateRenderer(website.template.slug) : null;
  if (!Renderer) notFound();

  const sections: SectionEntry[] = [{ type: 'chat', content: {} }];
  const props: TemplateRenderProps = {
    isPreview: false,
    profile: {
      name: website.name,
      tagline: website.tagline ?? undefined,
      logoUrl: website.logo_url ?? undefined,
      whatsapp: website.whatsapp ?? undefined,
      phone: website.phone ?? undefined,
      email: website.email ?? undefined,
      socialLinks: website.social_links,
      footerSettings: website.footer_settings,
    },
    templateTheme: extractTemplateTheme(website.template?.structure),
    websiteTheme: sanitizeWebsiteTheme(website.theme),
    sections,
    products: products.map(toCatalogItem),
    locations: locations.map(toLocationItem),
    faqs: faqs.map(toFaqItem),
    websiteSlug: resolveTenantLinkBase(website.slug),
    websiteId: website.id,
    tenantSlug: website.slug,
    pages: website.pages.map(toNavPage),
    blogPosts: blogPosts.map(toBlogPostItem),
    auth,
  };
  const designerHeader = website.template?.slug === 'store-classic'
    ? await renderPinnedTenantHeader({
        templateSlug: website.template.slug,
        pinnedVersion: website.template_runtime_version,
        tenantSlug: website.slug,
        props,
      })
    : { node: null, active: false };

  return (
    <>
      {designerHeader.node}
      <CartProvider slug={params.website_slug}>
        <Renderer {...props} hideHeader={designerHeader.active} />
      </CartProvider>
    </>
  );
}
