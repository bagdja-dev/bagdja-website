/**
 * Halaman Cart (keranjang) — W1b/W2/W2.5 cart server-side draft.
 *
 * Server Component: load tenant + auth, lalu render lewat template `Renderer`
 * dengan section type `cart`. Untuk Store Classic yang aktif di runtime,
 * header dan presentasi sample dipakai sementara operasi order tetap di host.
 * Route diprotect middleware (wajib login buyer).
 */
import { hostRendererSlug, templateOwnsPage, tenantRuntime } from '../../../lib/tenant-template';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

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
import { renderPinnedTenantHeader, renderPinnedTenantTemplate } from '../../../lib/template-runtime-route';
import { loadCartTemplatePage } from '../../../lib/template-page-loaders';

export const revalidate = 60;

interface CartPageProps {
  params: { website_slug: string };
}

export async function generateMetadata({ params }: CartPageProps): Promise<Metadata> {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) return {};
  return { title: `Keranjang — ${tenant.website.name}` };
}

export default async function CartPage({ params }: CartPageProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();
  if (tenant.subscription_inactive) return <WebsiteInactiveNotice />;
  const auth = await getAuthViewState(
    `${resolveTenantLinkBase(params.website_slug)}/cart`,
    resolveTenantLinkBase(params.website_slug),
  );

  const { website, products, locations, faqs, blogPosts } = tenant;

  const hostSlug = hostRendererSlug(website);
  const Renderer = hostSlug ? getTemplateRenderer(hostSlug) : null;
  if (!Renderer) notFound();

  const sections: SectionEntry[] = [
    { type: 'cart', content: { slug: params.website_slug } },
  ];

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
  const runtime = tenantRuntime(website);
  if (runtime && templateOwnsPage(website, 'cart')) {
    const basePath = resolveTenantLinkBase(params.website_slug);
    const loaded = await loadCartTemplatePage(website.id, basePath);
    if (loaded && 'unauthenticated' in loaded) {
      redirect(`/auth/login?next=${encodeURIComponent(`${basePath}/cart`)}`);
    }
    if (loaded) {
      const templatePage = await renderPinnedTenantTemplate({
        templateSlug: runtime.slug,
        pinnedVersion: runtime.version,
        tenantSlug: website.slug,
        props: { ...props, sections: [], page: loaded.page },
      });
      if (templatePage) return templatePage;
    }
  }
  const designerHeader = runtime && templateOwnsPage(website, 'header')
    ? await renderPinnedTenantHeader({
        templateSlug: runtime.slug,
        pinnedVersion: runtime.version,
        tenantSlug: website.slug,
        props,
      })
    : { node: null, active: false };

  return (
    <>
      {designerHeader.node}
      <CartProvider slug={params.website_slug}>
        <Renderer
          {...props}
          hideHeader={designerHeader.active}
          cartDesign={designerHeader.active ? 'store-classic' : undefined}
        />
      </CartProvider>
    </>
  );
}
