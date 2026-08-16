import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getBlogPostBySlug } from '../../../../lib/api-client';
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
import { getTemplateRenderer } from '../../../../lib/template-registry';
import { resolveTenantLinkBase } from '../../../../lib/tenant-link-base';
import { extractTemplateTheme, sanitizeWebsiteTheme } from '../../../../lib/website-theme';

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

  const { website, products, locations, faqs, blogPosts } = tenant;

  const Renderer = website.template ? getTemplateRenderer(website.template.slug) : null;
  if (!Renderer) notFound();

  const sections: SectionEntry[] = [{ type: 'blog_article', content: { post: toBlogPostItem(post) } }];

  return (
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
      pages={website.pages.map(toNavPage)}
      blogPosts={blogPosts.map(toBlogPostItem)}
    />
  );
}
