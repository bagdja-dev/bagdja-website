import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getBlogPostBySlug } from '../../../../lib/api-client';
import { CartProvider } from '../../../../lib/cart';
import { getAuthViewState } from '../../../../lib/auth-view';
import { loadTenant } from '../../../../lib/tenant-loader';
import WebsiteInactiveNotice from '../../../../components/website-inactive-notice';
import {
  toBlogPostItem,
  toCatalogItem,
  toFaqItem,
  toLocationItem,
  toNavPage,
  type SectionEntry,
} from '../../../../lib/template-data';
import { getTemplateRenderer, type TemplateRenderProps } from '../../../../lib/template-registry';
import { renderPinnedTenantHeader } from '../../../../lib/template-runtime-route';
import { hostRendererSlug, templateOwnsPage, tenantRuntime, tenantTemplateTheme } from '../../../../lib/tenant-template';
import { resolveTenantLinkBase } from '../../../../lib/tenant-link-base';
import { sanitizeWebsiteTheme } from '../../../../lib/website-theme';

export const revalidate = 60;

interface BlogArticlePageProps {
  params: { website_slug: string; post_slug: string };
}

export async function generateMetadata({ params }: BlogArticlePageProps): Promise<Metadata> {
  const post = await getBlogPostBySlug(params.website_slug, params.post_slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
  };
}

export default async function BlogArticlePage({ params }: BlogArticlePageProps) {
  const [tenant, post] = await Promise.all([
    loadTenant(params.website_slug),
    getBlogPostBySlug(params.website_slug, params.post_slug),
  ]);
  if (!tenant || !post) notFound();
  if (tenant.subscription_inactive) return <WebsiteInactiveNotice />;
  const auth = await getAuthViewState(
    `${resolveTenantLinkBase(params.website_slug)}/blog/${params.post_slug}`,
    resolveTenantLinkBase(params.website_slug),
  );

  const { website, products, locations, faqs, blogPosts } = tenant;

  // Template package tidak merender halaman ini → konten memakai tampilan Bagdja,
  // header tetap milik designer bila manifest menyatakan `header`.
  const hostSlug = hostRendererSlug(website);
  const Renderer = hostSlug ? getTemplateRenderer(hostSlug) : null;
  if (!Renderer) notFound();

  const sections: SectionEntry[] = [{ type: 'blog_article', content: { post: toBlogPostItem(post) } }];

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
    pages: website.pages.map(toNavPage),
    blogPosts: blogPosts.map(toBlogPostItem),
    auth,
  };
  const runtime = tenantRuntime(website);
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
        <Renderer {...props} hideHeader={designerHeader.active} />
      </CartProvider>
    </>
  );
}
