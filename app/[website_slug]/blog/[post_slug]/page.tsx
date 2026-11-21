import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getBlogPostBySlug, getWebsiteBySlug } from '../../../../lib/api-client';
import { contentMetadata, jsonLd, tenantCanonicalUrl } from '../../../../lib/content-seo';
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
  const [post, website] = await Promise.all([
    getBlogPostBySlug(params.website_slug, params.post_slug),
    getWebsiteBySlug(params.website_slug),
  ]);
  if (!post || !website) return { robots: { index: false, follow: false } };

  return contentMetadata({
    slug: params.website_slug,
    path: `/blog/${post.slug}`,
    title: post.seo_title?.trim() || post.title,
    description: post.seo_description?.trim() || post.excerpt,
    image: post.seo_image?.trim() || post.cover_image || website.logo_url,
    noIndex: post.seo_no_index || !post.is_published,
    website,
  });
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
  const articleStructuredData = post.is_published
    ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.seo_title?.trim() || post.title,
        description: post.seo_description?.trim() || post.excerpt || undefined,
        image: post.seo_image?.trim() || post.cover_image || undefined,
        datePublished: post.published_at || undefined,
        dateModified: post.updated_at || undefined,
        author: { '@type': 'Organization', name: website.name },
        publisher: {
          '@type': 'Organization',
          name: website.name,
          ...(website.logo_url ? { logo: { '@type': 'ImageObject', url: website.logo_url } } : {}),
        },
        mainEntityOfPage: tenantCanonicalUrl(
          params.website_slug,
          `/blog/${post.slug}`,
          website,
        ),
      }
    : null;

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
        browserBundle: runtime.browserBundle,
        pageOverrides: runtime.pageOverrides,
        bottomNav: templateOwnsPage(website, 'bottom_nav'),
        tenantSlug: website.slug,
        props,
      })
    : { node: null, active: false };

  return (
    <>
      {articleStructuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(articleStructuredData) }} />}
      {designerHeader.node}
      <CartProvider slug={params.website_slug}>
        <Renderer {...props} hideHeader={designerHeader.active} />
      </CartProvider>
    </>
  );
}
