import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import WebsiteInactiveNotice from '../../../../components/website-inactive-notice';
import { PortfolioProjectDetailSection } from '../../../../components/templates/shared/portfolio-sections';
import { CartProvider } from '../../../../lib/cart';
import { contentMetadata } from '../../../../lib/content-seo';
import { getPortfolioProject } from '../../../../lib/api-client';
import { toPortfolioProjectDetailItem } from '../../../../lib/template-data';
import { getTemplateRenderer } from '../../../../lib/template-registry';
import { loadTenantPageView } from '../../../../lib/tenant-page-view';
import { hostRendererSlug, templateOwnsPage, tenantRuntime } from '../../../../lib/tenant-template';
import { renderPinnedTenantHeader } from '../../../../lib/template-runtime-route';

export const revalidate = 60;

interface PortfolioProjectPageProps {
  params: { website_slug: string; project_slug: string };
}

async function loadPortfolioProject({ website_slug, project_slug }: PortfolioProjectPageProps['params']) {
  const acceptLanguage = (await headers()).get('accept-language') ?? undefined;
  const [view, project] = await Promise.all([
    loadTenantPageView(website_slug, undefined, { acceptLanguage }),
    getPortfolioProject(website_slug, project_slug, { acceptLanguage }),
  ]);
  return { view, project };
}

export async function generateMetadata({ params }: PortfolioProjectPageProps): Promise<Metadata> {
  const { view, project } = await loadPortfolioProject(params);
  if (view.status !== 'ok' || !project) return { robots: { index: false, follow: false } };

  return contentMetadata({
    slug: params.website_slug,
    path: `/portfolio/${encodeURIComponent(params.project_slug)}`,
    title: project.translation.seo_title?.trim() || project.translation.title,
    description: project.translation.seo_description?.trim() || project.translation.excerpt,
    image: project.translation.seo_image?.trim() || project.cover_image,
    noIndex: project.translation.seo_no_index || project.seo_no_index,
    website: view.tenant.website,
  });
}

export default async function PortfolioProjectPage({ params }: PortfolioProjectPageProps) {
  const { view, project } = await loadPortfolioProject(params);
  if (view.status === 'not_found' || !project) notFound();
  if (view.status === 'inactive') return <WebsiteInactiveNotice />;

  const projectDetail = toPortfolioProjectDetailItem(project);
  const website = view.tenant.website;

  if (website.template_runtime?.pageOverrides.includes('shell')) {
    return <PortfolioProjectDetailSection project={projectDetail} websiteSlug={view.props.websiteSlug} />;
  }

  const templateSlug = hostRendererSlug(website);
  if (!templateSlug) notFound();
  const Renderer = getTemplateRenderer(templateSlug);
  const sections = [{ type: 'portfolio_project_detail', content: {} }];
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
        props: view.props,
      })
    : { node: null, active: false };

  return (
    <CartProvider slug={params.website_slug}>
      {designerHeader.node}
      <Renderer
        {...view.props}
        sections={sections}
        portfolioProjectDetail={projectDetail}
        hideHeader={designerHeader.active}
      />
    </CartProvider>
  );
}
