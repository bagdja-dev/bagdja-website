/**
 * S8 — pratinjau halaman website untuk editor halaman Studio (iframe).
 *
 * URL: `/{website_slug}/__preview?page=<pageId|slug>&device=desktop|mobile`
 * (lokal / path-based) atau `https://{slug}.<platform>/__preview?...` (subdomain,
 * di-rewrite middleware). Folder `%5F%5Fpreview` = segmen URL `__preview`
 * (prefix `_` biasa menjadikan folder private di App Router). Tidak bisa
 * bentrok dengan slug halaman tenant: API membatasi slug ke
 * `^[a-z0-9]+(-[a-z0-9]+)*$` (tanpa underscore), dan segmen statis menang
 * atas `[page_slug]`.
 *
 * - Data: loader & View yang sama dengan route publik (`loadTenantPageView`),
 *   tetapi TANPA cache (`force-dynamic` + fetch `cache: 'no-store'` lewat `{ fresh: true }`).
 *   Hanya versi tersimpan lewat API publik — tidak ada data yang tidak
 *   ditampilkan route publik; draft TIDAK dibaca dari URL, hanya lewat
 *   postMessage dari origin admin (`components/preview/preview-shell.tsx`).
 * - Header `Content-Security-Policy: frame-ancestors <admin>` & `X-Robots-Tag`
 *   dipasang di next.config.js khusus path ini.
 * - `device` diterima tapi tidak dipakai: lebar iframe yang menentukan
 *   breakpoint; parameter ini hanya membedakan URL desktop/HP di Studio.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getWebsiteBySlug } from '../../../lib/api-client';
import { CartProvider } from '../../../lib/cart';
import { getAllowedAdminOrigins } from '../../../lib/preview-protocol';
import { resolveSections } from '../../../lib/template-data';
import { getTemplateRenderer } from '../../../lib/template-registry';
import { loadTenantPageView } from '../../../lib/tenant-page-view';
import { PreviewShell } from '../../../components/preview/preview-shell';
import WebsiteInactiveNotice from '../../../components/website-inactive-notice';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

interface PreviewPageProps {
  params: { website_slug: string };
  searchParams: { page?: string | string[]; device?: string | string[] };
}

function firstParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() || undefined;
}

const FRESH = { fresh: true } as const;

export const metadata: Metadata = {
  title: 'Pratinjau',
  robots: { index: false, follow: false, nocache: true },
};

export default async function TenantPreviewPage({ params, searchParams }: PreviewPageProps) {
  const website = await getWebsiteBySlug(params.website_slug, FRESH);
  if (!website) notFound();

  const pageRef = firstParam(searchParams.page);
  const target = pageRef
    ? website.pages.find((page) => page.id === pageRef || page.slug === pageRef)
    : website.pages.find((page) => page.is_home);
  if (pageRef && !target) notFound();

  const pageSlug = target && !target.is_home ? target.slug : undefined;
  const view = await loadTenantPageView(params.website_slug, pageSlug, FRESH);
  if (view.status === 'not_found') notFound();
  if (view.status === 'inactive') return <WebsiteInactiveNotice />;
  if (!view.templateSlug) notFound();

  // Validasi di server: template tidak ter-build → UnsupportedTemplateError
  // (ditangani app/[website_slug]/error.tsx), sama seperti route publik.
  getTemplateRenderer(view.templateSlug);

  const { tenant } = view;
  const flowStepsByFlowId: Record<string, unknown> = {};
  for (const section of tenant.page?.sections ?? []) {
    const flowId = section.content?.flow_id;
    if (section.type === 'service_process_section' && typeof flowId === 'string' && section.content.flow_steps) {
      flowStepsByFlowId[flowId] = section.content.flow_steps;
    }
  }

  return (
    <CartProvider slug={params.website_slug}>
      <PreviewShell
        templateSlug={view.templateSlug}
        pageSlug={tenant.page?.slug ?? target?.slug ?? ''}
        isHome={!pageSlug}
        viewProps={view.props}
        fallbackSections={pageSlug ? [] : resolveSections(null, tenant.website.template)}
        flowStepsByFlowId={flowStepsByFlowId}
        allowedOrigins={getAllowedAdminOrigins()}
      />
    </CartProvider>
  );
}
