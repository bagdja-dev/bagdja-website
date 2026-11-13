/**
 * Uji template kandidat untuk viewer yang berhak
 * (plan/website-builder/template-candidate-trial-plan.md, keputusan T1/T4).
 *
 * API publik `sites/:slug` hanya memberi tahu `template_trial_active`. Bila aktif dan
 * pengunjung login, runtime kandidat diminta dengan token sesi; API mengembalikan
 * `runtime: null` untuk akun yang tidak berhak, sehingga pengunjung lain tetap melihat
 * template terpasang. Route tenant sudah dirender per-request (membaca sesi), jadi hasil
 * ini tidak pernah masuk cache halaman publik.
 */
import { backendFetch } from './backend-api';
import type { ApiWebsite } from './api-client';
import { getSession } from './session';

type TrialRuntime = NonNullable<ApiWebsite['template_runtime']>;

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;

export function parseTemplateTrialRuntime(value: unknown): TrialRuntime | null {
  if (!value || typeof value !== 'object') return null;
  const runtime = value as Record<string, unknown>;
  if (
    runtime.status !== 'candidate' ||
    typeof runtime.slug !== 'string' || !SLUG_PATTERN.test(runtime.slug) ||
    typeof runtime.version !== 'string' || !VERSION_PATTERN.test(runtime.version) ||
    typeof runtime.candidateDigest !== 'string' || !DIGEST_PATTERN.test(runtime.candidateDigest) ||
    !Array.isArray(runtime.pageOverrides)
  ) {
    return null;
  }
  return {
    slug: runtime.slug,
    version: runtime.version,
    status: 'candidate',
    pageOverrides: runtime.pageOverrides.filter((page): page is string => typeof page === 'string'),
    candidateDigest: runtime.candidateDigest,
    ...(typeof runtime.name === 'string' ? { name: runtime.name } : {}),
    ...(['designer', 'reviewer', 'tester', 'reviewer_team'].includes(String(runtime.viewerRole))
      ? { viewerRole: runtime.viewerRole as NonNullable<TrialRuntime['viewerRole']> }
      : {}),
    ...(runtime.theme && typeof runtime.theme === 'object' && !Array.isArray(runtime.theme)
      ? { theme: runtime.theme as Record<string, unknown> }
      : {}),
  };
}

/** Ganti `template_runtime` dengan kandidat bila viewer ini berhak; selain itu website apa adanya. */
export async function applyViewerTemplateTrial(website: ApiWebsite): Promise<ApiWebsite> {
  if (!website.template_trial_active) return website;
  const { token } = await getSession();
  if (!token) return website;
  const result = await backendFetch<{ runtime?: unknown }>(
    `/api/public/sites/${encodeURIComponent(website.slug)}/template-trial`,
  );
  const runtime = result.status < 400 ? parseTemplateTrialRuntime(result.data?.runtime) : null;
  return runtime ? { ...website, template_runtime: runtime } : website;
}
