import { notFound } from 'next/navigation';

import { GatheringInvoicePage } from '../../../../../components/gathering-invoice-page';
import { loadTenant } from '../../../../../lib/tenant-loader';

interface GatheringInvoiceRouteProps {
  params: { website_slug: string; registrationId: string };
}

export default async function GatheringInvoiceRoute({ params }: GatheringInvoiceRouteProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();
  return <GatheringInvoicePage registrationId={params.registrationId} websiteName={tenant.website.name} />;
}
