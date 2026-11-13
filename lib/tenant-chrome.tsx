import { getAuthViewState } from './auth-view';
import { buildSystemPageProps } from './system-page-props';
import { renderPinnedTenantHeader, type PinnedTenantHeaderResult } from './template-runtime-route';
import type { TenantData } from './tenant-loader';
import { templateOwnsPage, tenantRuntime } from './tenant-template';

/**
 * Header + navigasi bawah template package untuk halaman Bagdja yang berdiri sendiri
 * (undangan, tiket, reservasi, invoice gathering) — supaya tidak terasa keluar dari website.
 * Website tanpa template package / tanpa `header` → `{ node: null, active: false }` (tampilan lama).
 */
export async function renderTenantChrome(
  tenant: TenantData,
  options: { basePath: string; pagePath: string },
): Promise<PinnedTenantHeaderResult> {
  const runtime = tenantRuntime(tenant.website);
  if (!runtime || !templateOwnsPage(tenant.website, 'header')) return { node: null, active: false };
  const auth = await getAuthViewState(options.pagePath, options.basePath);
  return renderPinnedTenantHeader({
    templateSlug: runtime.slug,
    pinnedVersion: runtime.version,
    candidateDigest: runtime.candidateDigest,
    bottomNav: templateOwnsPage(tenant.website, 'bottom_nav'),
    tenantSlug: tenant.website.slug,
    props: buildSystemPageProps(tenant, { basePath: options.basePath, auth, sections: [] }),
  });
}
