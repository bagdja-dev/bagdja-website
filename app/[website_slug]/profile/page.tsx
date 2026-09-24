/**
 * Halaman Profil buyer — info akun, saldo wallet, dan riwayat transaksi.
 *
 * Server Component: load tenant + auth, lalu render lewat template `Renderer`
 * dengan section type `profile` — header/footer/theme konsisten dengan home &
 * halaman lain. Konten interaktif (fetch saldo & riwayat) di
 * `components/profile-content.tsx` (client).
 * Route diprotect middleware (wajib login buyer, via PROTECTED_PATH_PATTERN).
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
import { resolveTenantLinkBase } from '../../../lib/tenant-link-base';
import { extractTemplateTheme, sanitizeWebsiteTheme } from '../../../lib/website-theme';

export const revalidate = 60;

interface ProfilePageProps {
  params: { website_slug: string };
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) return {};
  return { title: `Profil Saya — ${tenant.website.name}` };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();
  if (tenant.subscription_inactive) return <WebsiteInactiveNotice />;
  const auth = await getAuthViewState(
    `${resolveTenantLinkBase(params.website_slug)}/profile`,
    resolveTenantLinkBase(params.website_slug),
  );

  const { website, products, locations, faqs, blogPosts } = tenant;

  const Renderer = website.template ? getTemplateRenderer(website.template.slug) : null;
  if (!Renderer) notFound();

  const sections: SectionEntry[] = [
    { type: 'profile', content: { slug: params.website_slug } },
  ];

  return (
    <CartProvider slug={params.website_slug}>
      <Renderer
        isPreview={false}
        profile={{
          name: website.name,
          tagline: website.tagline ?? undefined,
          logoUrl: website.logo_url ?? undefined,
          whatsapp: website.whatsapp ?? undefined,
          phone: website.phone ?? undefined,
          email: website.email ?? undefined,
          socialLinks: website.social_links,
        }}
        templateTheme={extractTemplateTheme(website.template?.structure)}
        websiteTheme={sanitizeWebsiteTheme(website.theme)}
        sections={sections}
        products={products.map(toCatalogItem)}
        locations={locations.map(toLocationItem)}
        faqs={faqs.map(toFaqItem)}
        websiteSlug={resolveTenantLinkBase(website.slug)}
        websiteId={website.id}
        tenantSlug={website.slug}
        pages={website.pages.map(toNavPage)}
        blogPosts={blogPosts.map(toBlogPostItem)}
        auth={auth}
      />
    </CartProvider>
  );
}
