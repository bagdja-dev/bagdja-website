import { notFound } from 'next/navigation';

import { GatheringTicketPage } from '../../../../../components/gathering-ticket-page';
import { renderTenantChrome } from '../../../../../lib/tenant-chrome';
import { resolveTenantLinkBase } from '../../../../../lib/tenant-link-base';
import { loadTenant } from '../../../../../lib/tenant-loader';

interface GatheringTicketRouteProps {
  params: { website_slug: string; token: string };
}

export default async function GatheringTicketRoute({ params }: GatheringTicketRouteProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();
  const basePath = resolveTenantLinkBase(params.website_slug);
  const chrome = await renderTenantChrome(tenant, { basePath, pagePath: `${basePath}/gathering/ticket/${encodeURIComponent(params.token)}` });
  return (
    <>
      {chrome.node}
      <GatheringTicketPage token={params.token} websiteName={tenant.website.name} hideHeader={chrome.active} />
    </>
  );
}
