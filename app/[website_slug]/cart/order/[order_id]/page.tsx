import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import DraftOrderPageContent from '../../../../../components/draft-order-page-content';
import { loadTenant } from '../../../../../lib/tenant-loader';

export const revalidate = 60;

interface DraftOrderPageProps {
  params: { website_slug: string; order_id: string };
}

export async function generateMetadata({ params }: DraftOrderPageProps): Promise<Metadata> {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) return {};
  return { title: `Detail Pesanan Draft — ${tenant.website.name}` };
}

export default async function DraftOrderPage({ params }: DraftOrderPageProps) {
  return <DraftOrderPageContent websiteSlug={params.website_slug} orderId={params.order_id} />;
}
