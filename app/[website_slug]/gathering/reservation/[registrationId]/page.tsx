import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { GatheringReservationDetail } from '../../../../../components/gathering-reservation-detail';
import { loadTenant } from '../../../../../lib/tenant-loader';
import { resolveTenantLinkBase } from '../../../../../lib/tenant-link-base';

export const revalidate = 0;

interface GatheringReservationRouteProps {
  params: { website_slug: string; registrationId: string };
}

export async function generateMetadata({ params }: GatheringReservationRouteProps): Promise<Metadata> {
  const tenant = await loadTenant(params.website_slug);
  return tenant ? { title: `Detail Reservasi — ${tenant.website.name}` } : {};
}

export default async function GatheringReservationRoute({ params }: GatheringReservationRouteProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();
  return (
    <GatheringReservationDetail
      registrationId={params.registrationId}
      websiteId={tenant.website.id}
      websiteName={tenant.website.name}
      basePath={resolveTenantLinkBase(params.website_slug)}
    />
  );
}
