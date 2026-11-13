/**
 * Loader server-side `props.page` untuk template package (P1). Data dimuat dengan
 * sesi pembeli (cookie → token di server) dari endpoint API yang sama dengan
 * komponen Bagdja, lalu dibentuk lewat lib/template-pages.ts.
 *
 * Hasil `null` = gagal memuat → route kembali ke tampilan Bagdja (pembeli tetap
 * melihat datanya). `unauthenticated` = route mengalihkan ke login.
 */
import { cookies, headers } from 'next/headers';

import { backendFetch, publicBackendFetch } from './backend-api';
import { getSession } from './session';
import {
  buildCalendarPage,
  buildCartPage,
  buildGatheringInvitationPage,
  buildGatheringPlanPage,
  buildInvoiceDetailPage,
  buildOrdersPage,
  buildTagihanPage,
  createPageKeyFactory,
  decodeInvitationGuestState,
  invitationCookieName,
  PUBLIC_PAGE_KEY_SCOPE,
  type InvitationPreviewInput,
  type InvitationPrivateStatusInput,
  type GatheringPlanInput,
  type PlanInvitationInput,
  type PlanOperationInput,
  type PlanRegistrationInput,
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

/** Origin publik request saat ini (di belakang proxy: X-Forwarded-Host/Proto). */
function requestOrigin(): string | undefined {
  try {
    const requestHeaders = headers();
    const host = requestHeaders.get('x-forwarded-host')?.split(',')[0]?.trim() || requestHeaders.get('host')?.trim();
    if (!host || !/^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(host)) return undefined;
    const forwardedProto = requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const proto = forwardedProto === 'http' || forwardedProto === 'https'
      ? forwardedProto
      : /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? 'http' : 'https';
    return `${proto}://${host}`;
  } catch {
    return undefined;
  }
}

export async function loadGatheringPlanTemplatePage(
  plan: GatheringPlanInput,
  websiteId: string,
  viewerRole: 'initiator' | 'invitee' | 'guest',
  basePath = '',
): Promise<TemplatePageLoadResult> {
  const key = await keyFactory();
  if (!key) return { unauthenticated: true };
  const planPath = `/api/gathering/plans/${encodeURIComponent(plan.id)}`;
  const query = `website_id=${encodeURIComponent(websiteId)}`;
  const loaded = await loadAll([`${planPath}/invitations?${query}`]);
  if (!loaded) return null;
  if ('unauthenticated' in loaded) return { unauthenticated: true };
  // Data tambahan untuk initiator; gagal dimuat = halaman tetap tampil tanpa bagian itu.
  const [registrations, operation] = viewerRole === 'initiator'
    ? await Promise.all([
      backendFetch<unknown>(`${planPath}/registrations?${query}`),
      backendFetch<{ operation?: PlanOperationInput | null }>(`${planPath}/invitations/operation?${query}`),
    ])
    : [null, null];
  return {
    page: buildGatheringPlanPage(plan, rowsOf<PlanInvitationInput>(loaded.data[0]), {
      key,
      viewerRole,
      basePath,
      registrations: registrations && registrations.status < 400 ? rowsOf<PlanRegistrationInput>(registrations.data) : [],
      operation: operation && operation.status < 400 ? operation.data?.operation ?? null : null,
      origin: requestOrigin(),
    }),
  };
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

/**
 * Halaman undangan gathering (publik). Undangan khusus memakai status akun (butuh login);
 * undangan terbuka memakai status tamu di cookie (RSVP/OTP tanpa login).
 */
export async function loadGatheringInvitationTemplatePage(token: string, pagePath: string): Promise<TemplatePageLoadResult> {
  const tokenPath = `/api/public/gathering-invitations/${encodeURIComponent(token)}`;
  const preview = await publicBackendFetch<InvitationPreviewInput>(tokenPath);
  if (!preview.data || preview.status >= 400) return null;
  const { user } = await getSession();
  const loggedIn = Boolean(user?.userId);
  const guest = decodeInvitationGuestState(cookies().get(invitationCookieName(token))?.value);

  let privateStatus: InvitationPrivateStatusInput | null | undefined;
  if (preview.data.group.invite_policy === 'INVITE_ONLY' && loggedIn) {
    const status = await backendFetch<InvitationPrivateStatusInput>(`${tokenPath}/private-status`);
    privateStatus = status.data && status.status < 400 ? status.data : null;
  }
  const registrationId = preview.data.group.invite_policy === 'INVITE_ONLY'
    ? privateStatus?.registration?.id
    : guest.registrationId;
  let paymentStatus: string | null = null;
  if (registrationId && loggedIn) {
    const receipt = await backendFetch<{ payment_status?: string }>(
      `/api/gathering/registrations/${encodeURIComponent(registrationId)}/receipt`,
    );
    paymentStatus = receipt.status < 400 ? receipt.data?.payment_status ?? null : null;
  }
  return {
    page: buildGatheringInvitationPage(preview.data, {
      key: createPageKeyFactory(PUBLIC_PAGE_KEY_SCOPE),
      token,
      pagePath,
      loggedIn,
      guest,
      privateStatus,
      paymentStatus,
    }),
  };
}
