import { notFound } from 'next/navigation';

import { GatheringTicketPage } from '../../../../../components/gathering-ticket-page';
import { loadTenant } from '../../../../../lib/tenant-loader';

interface GatheringTicketRouteProps {
  params: { website_slug: string; token: string };
}

export default async function GatheringTicketRoute({ params }: GatheringTicketRouteProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();
  return <GatheringTicketPage token={params.token} websiteName={tenant.website.name} />;
}
