import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import DraftOrderPageContent from '../../../../components/draft-order-page-content';
import { resolvePlatformSubdomain } from '../../../../lib/tenant-host';
import { loadTenant } from '../../../../lib/tenant-loader';

interface DraftOrderPageProps {
  params: { order_id: string };
}

function getTenantSlugFromRequest(): string | null {
  const requestHeaders = headers();
  const host =
    requestHeaders.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    requestHeaders.get('host') ||
    '';
  return resolvePlatformSubdomain(host.split(':')[0].toLowerCase());
}

export async function generateMetadata({ params }: DraftOrderPageProps): Promise<Metadata> {
  const tenantSlug = getTenantSlugFromRequest();
  if (!tenantSlug) return {};

  const tenant = await loadTenant(tenantSlug);
  if (!tenant) return {};
  return { title: `Detail Pesanan Draft — ${tenant.website.name}` };
}

export default function DraftOrderPage({ params }: DraftOrderPageProps) {
  const tenantSlug = getTenantSlugFromRequest();
  if (!tenantSlug) notFound();

  return <DraftOrderPageContent websiteSlug={tenantSlug} orderId={params.order_id} />;
}