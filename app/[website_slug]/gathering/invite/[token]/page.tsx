import { notFound } from 'next/navigation';

import { GatheringInvitationPreview } from '../../../../../components/gathering-invitation-preview';
import { getAuthViewState } from '../../../../../lib/auth-view';
import { buildSystemPageProps } from '../../../../../lib/system-page-props';
import { loadGatheringInvitationTemplatePage } from '../../../../../lib/template-page-loaders';
import { renderPinnedTenantTemplate } from '../../../../../lib/template-runtime-route';
import { renderTenantChrome } from '../../../../../lib/tenant-chrome';
import { resolveTenantLinkBase } from '../../../../../lib/tenant-link-base';
import { loadTenant } from '../../../../../lib/tenant-loader';
import { templateOwnsPage, tenantRuntime } from '../../../../../lib/tenant-template';

export const dynamic = 'force-dynamic';

interface GatheringInvitePageProps {
  params: { website_slug: string; token: string };
}

export default async function GatheringInvitePage({ params }: GatheringInvitePageProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();
  const basePath = resolveTenantLinkBase(params.website_slug);
  const pagePath = `${basePath}/gathering/invite/${encodeURIComponent(params.token)}`;

  // Template package yang menyatakan `gathering_invitation` merender halaman ini (template-owned-system-pages-plan §8.8).
  const runtime = tenantRuntime(tenant.website);
  if (runtime && templateOwnsPage(tenant.website, 'gathering_invitation')) {
    const loaded = await loadGatheringInvitationTemplatePage(params.token, pagePath);
    if (loaded && 'page' in loaded) {
      const auth = await getAuthViewState(pagePath, basePath);
      const props = buildSystemPageProps(tenant, { basePath, auth, sections: [] });
      const templatePage = await renderPinnedTenantTemplate({
        templateSlug: runtime.slug,
        pinnedVersion: runtime.version,
        candidateDigest: runtime.candidateDigest,
        tenantSlug: tenant.website.slug,
        props: { ...props, page: loaded.page },
      });
      if (templatePage) return templatePage;
    }
  }

  // Tampilan Bagdja, tetap dengan header & navigasi bawah template bila ada.
  const chrome = await renderTenantChrome(tenant, { basePath, pagePath });
  return (
    <>
      {chrome.node}
      <GatheringInvitationPreview token={params.token} websiteName={tenant.website.name} hideHeader={chrome.active} />
    </>
  );
}
