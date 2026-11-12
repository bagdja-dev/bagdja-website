import { notFound } from 'next/navigation';

import { GatheringInvoicePage } from '../../../../../components/gathering-invoice-page';
import { getAuthViewState } from '../../../../../lib/auth-view';
import { buildSystemPageProps } from '../../../../../lib/system-page-props';
import { loadInvoiceDetailTemplatePage } from '../../../../../lib/template-page-loaders';
import { renderPinnedTenantTemplate } from '../../../../../lib/template-runtime-route';
import { resolveTenantLinkBase } from '../../../../../lib/tenant-link-base';
import { loadTenant } from '../../../../../lib/tenant-loader';
import { templateOwnsPage, tenantRuntime } from '../../../../../lib/tenant-template';

interface GatheringInvoiceRouteProps {
  params: { website_slug: string; registrationId: string };
}

export default async function GatheringInvoiceRoute({ params }: GatheringInvoiceRouteProps) {
  const tenant = await loadTenant(params.website_slug);
  if (!tenant) notFound();

  // Template package yang menyatakan `invoice_detail` merender halaman ini (data publik + sesi bila ada).
  const runtime = tenantRuntime(tenant.website);
  if (runtime && templateOwnsPage(tenant.website, 'invoice_detail')) {
    const loaded = await loadInvoiceDetailTemplatePage(params.registrationId);
    if (loaded && 'page' in loaded) {
      const basePath = resolveTenantLinkBase(params.website_slug);
      const auth = await getAuthViewState(
        `${basePath}/gathering/invoice/${encodeURIComponent(params.registrationId)}`,
        basePath,
      );
      const props = buildSystemPageProps(tenant, { basePath, auth, sections: [] });
      const templatePage = await renderPinnedTenantTemplate({
        templateSlug: runtime.slug,
        pinnedVersion: runtime.version,
        tenantSlug: tenant.website.slug,
        props: { ...props, page: loaded.page },
      });
      if (templatePage) return templatePage;
    }
  }

  return <GatheringInvoicePage registrationId={params.registrationId} websiteName={tenant.website.name} />;
}
