import { notFound } from 'next/navigation';
import { GatheringInvitationPreview } from '../../../../../../components/gathering-invitation-preview';
import { loadTenant } from '../../../../../../lib/tenant-loader';

interface PrivateGatheringInvitePageProps {
  params: { website_slug: string; token: string };
}

export default async function PrivateGatheringInvitePage({ params }: PrivateGatheringInvitePageProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();
  return <GatheringInvitationPreview token={params.token} websiteName={tenant.website.name} />;
}