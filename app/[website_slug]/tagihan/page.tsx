/**
 * Halaman "Tagihan" buyer — shortcut lintas-order untuk lihat/bayar Termin.
 *
 * Server Component: load tenant + auth, lalu render lewat template `Renderer`
 * dengan section type `tagihan` — header/footer/theme konsisten dengan
 * halaman lain. Konten interaktif di `components/tagihan-content.tsx` (client).
 * Route diprotect middleware (wajib login buyer, via PROTECTED_PATH_PATTERN).
 * Pola identik `app/[website_slug]/orders/page.tsx`.
 */
import { hostRendererSlug, templateOwnsPage, tenantRuntime, tenantTemplateTheme } from '../../../lib/tenant-template';
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
import { sanitizeWebsiteTheme } from '../../../lib/website-theme';
import { renderPinnedTenantHeader, renderPinnedTenantTemplate } from '../../../lib/template-runtime-route';
import { loadTagihanTemplatePage } from '../../../lib/template-page-loaders';

export const revalidate = 60;

interface TagihanPageProps {
  params: { website_slug: string };
}

export async function generateMetadata({ params }: TagihanPageProps): Promise<Metadata> {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) return {};
  return { title: `Tagihan — ${tenant.website.name}` };
}

export default async function TagihanPage({ params }: TagihanPageProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();
  if (tenant.subscription_inactive) return <WebsiteInactiveNotice />;
  const auth = await getAuthViewState(
    `${resolveTenantLinkBase(params.website_slug)}/tagihan`,
    resolveTenantLinkBase(params.website_slug),
  );

  const { website, products, locations, faqs, blogPosts } = tenant;

  const hostSlug = hostRendererSlug(website);
  const Renderer = hostSlug ? getTemplateRenderer(hostSlug) : null;
  if (!Renderer) notFound();

  const sections: SectionEntry[] = [
    { type: 'tagihan', content: { slug: params.website_slug } },
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
    templateTheme: tenantTemplateTheme(website),
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
  if (runtime && templateOwnsPage(website, 'tagihan')) {
    const basePath = resolveTenantLinkBase(params.website_slug);
    const loaded = await loadTagihanTemplatePage(website.id, basePath);
    if (loaded && 'unauthenticated' in loaded) {
      redirect(`/auth/login?next=${encodeURIComponent(`${basePath}/tagihan`)}`);
    }
    if (loaded) {
      const templatePage = await renderPinnedTenantTemplate({
        templateSlug: runtime.slug,
        pinnedVersion: runtime.version,
        candidateDigest: runtime.candidateDigest,
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
        candidateDigest: runtime.candidateDigest,
        bottomNav: templateOwnsPage(website, 'bottom_nav'),
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
          tagihanDesign={designerHeader.active ? 'store-classic' : undefined}
        />
      </CartProvider>
    </>
  );
}
