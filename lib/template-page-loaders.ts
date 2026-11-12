/**
 * Loader server-side `props.page` untuk template package (P1). Data dimuat dengan
 * sesi pembeli (cookie → token di server) dari endpoint API yang sama dengan
 * komponen Bagdja, lalu dibentuk lewat lib/template-pages.ts.
 *
 * Hasil `null` = gagal memuat → route kembali ke tampilan Bagdja (pembeli tetap
 * melihat datanya). `unauthenticated` = route mengalihkan ke login.
 */
import { backendFetch, publicBackendFetch } from './backend-api';
import { getSession } from './session';
import {
  buildCalendarPage,
  buildCartPage,
  buildGatheringPlanPage,
  buildInvoiceDetailPage,
  buildOrdersPage,
  buildTagihanPage,
  createPageKeyFactory,
  type GatheringPlanInput,
  type PlanInvitationInput,
  type PublicGatheringInvoiceInput,
  type CalendarInvitationInput,
  type CartOrderInput,
  type CartPlanInput,
  type CalendarPlanInput,
  type GatheringInvoiceInput,
  type TerminRowInput,
  type TransactionRowInput,
} from './template-pages';
import type { TemplatePageObject } from './template-page-contract';

export type TemplatePageLoadResult = { page: TemplatePageObject } | { unauthenticated: true } | null;

function rowsOf<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: T[] }).data;
  }
  return [];
}

async function keyFactory() {
  const { user } = await getSession();
  return user?.userId ? createPageKeyFactory(user.userId) : null;
}

async function loadAll(paths: string[]): Promise<{ unauthenticated: true } | { data: unknown[] } | null> {
  const results = await Promise.all(paths.map((path) => backendFetch<unknown>(path)));
  if (results.some((result) => result.status === 401)) return { unauthenticated: true };
  const failed = results.find((result) => result.status >= 400);
  if (failed) {
    console.error(`[template-page] load failed (${failed.status}) ${failed.error ?? ''}`);
    return null;
  }
  return { data: results.map((result) => result.data) };
}

export async function loadOrdersTemplatePage(websiteId: string, basePath: string): Promise<TemplatePageLoadResult> {
  const key = await keyFactory();
  if (!key) return { unauthenticated: true };
  const loaded = await loadAll([`/api/transactions?size=100&website_id=${encodeURIComponent(websiteId)}`]);
  if (!loaded) return null;
  if ('unauthenticated' in loaded) return { unauthenticated: true };
  return { page: buildOrdersPage(rowsOf<TransactionRowInput>(loaded.data[0]), { basePath, key }) };
}

export async function loadTagihanTemplatePage(websiteId: string, basePath: string): Promise<TemplatePageLoadResult> {
  const key = await keyFactory();
  if (!key) return { unauthenticated: true };
  const query = encodeURIComponent(websiteId);
  const loaded = await loadAll([
    `/api/transactions/termins?size=100&website_id=${query}`,
    `/api/gathering/invoices?website_id=${query}`,
  ]);
  if (!loaded) return null;
  if ('unauthenticated' in loaded) return { unauthenticated: true };
  return {
    page: buildTagihanPage(
      rowsOf<TerminRowInput>(loaded.data[0]),
      rowsOf<GatheringInvoiceInput>(loaded.data[1]),
      { basePath, key },
    ),
  };
}

export async function loadCalendarTemplatePage(websiteId: string, basePath: string): Promise<TemplatePageLoadResult> {
  const key = await keyFactory();
  if (!key) return { unauthenticated: true };
  const query = encodeURIComponent(websiteId);
  const loaded = await loadAll([
    `/api/gathering/plans?website_id=${query}`,
    `/api/gathering/invitations/mine?website_id=${query}`,
  ]);
  if (!loaded) return null;
  if ('unauthenticated' in loaded) return { unauthenticated: true };
  return {
    page: buildCalendarPage(
      rowsOf<CalendarPlanInput>(loaded.data[0]),
      rowsOf<CalendarInvitationInput>(loaded.data[1]),
      { basePath, key },
    ),
  };
}

export async function loadInvoiceDetailTemplatePage(registrationId: string): Promise<TemplatePageLoadResult> {
  const result = await publicBackendFetch<PublicGatheringInvoiceInput>(
    `/api/public/gathering-invoices/${encodeURIComponent(registrationId)}`,
  );
  if (!result.data || result.status >= 400) return null;
  const { user } = await getSession();
  return {
    page: buildInvoiceDetailPage(result.data, {
      key: createPageKeyFactory(user?.userId ?? 'guest'),
      loggedIn: Boolean(user?.userId),
    }),
  };
}

export async function loadGatheringPlanTemplatePage(
  plan: GatheringPlanInput,
  websiteId: string,
  viewerRole: 'initiator' | 'invitee' | 'guest',
): Promise<TemplatePageLoadResult> {
  const key = await keyFactory();
  if (!key) return { unauthenticated: true };
  const loaded = await loadAll([
    `/api/gathering/plans/${encodeURIComponent(plan.id)}/invitations?website_id=${encodeURIComponent(websiteId)}`,
  ]);
  if (!loaded) return null;
  if ('unauthenticated' in loaded) return { unauthenticated: true };
  return { page: buildGatheringPlanPage(plan, rowsOf<PlanInvitationInput>(loaded.data[0]), { key, viewerRole }) };
}

export async function loadCartTemplatePage(websiteId: string, basePath: string): Promise<TemplatePageLoadResult> {
  const key = await keyFactory();
  if (!key) return { unauthenticated: true };
  const query = encodeURIComponent(websiteId);
  const loaded = await loadAll([`/api/orders?cart=true&website_id=${query}`, `/api/gathering/plans?website_id=${query}`]);
  if (!loaded) return null;
  if ('unauthenticated' in loaded) return { unauthenticated: true };
  return {
    page: buildCartPage(rowsOf<CartOrderInput>(loaded.data[0]), rowsOf<CartPlanInput>(loaded.data[1]), { basePath, key }),
  };
}
