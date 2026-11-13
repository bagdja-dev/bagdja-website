import { NextResponse } from 'next/server';

import { cookies } from 'next/headers';

import { backendFetch, backendFetchFormData, publicBackendFetch } from '../../../lib/backend-api';
import { getSession } from '../../../lib/session';
import {
  createPageKeyFactory,
  decodeInvitationGuestState,
  executeTemplateIntent,
  invitationCookieName,
  PUBLIC_PAGE_KEY_SCOPE,
} from '../../../lib/template-pages';
import { INVITATION_BANNER_MAX_BYTES, parseTemplateRuntimeIntent } from '../../../lib/template-runtime-bridge';
import { resolveTenantLinkBase } from '../../../lib/tenant-link-base';
import { toCatalogItem } from '../../../lib/template-data';
import { loadTenant } from '../../../lib/tenant-loader';
import { templateOwnsPage, type TemplateSystemPage } from '../../../lib/tenant-template';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_BODY_BYTES = 16 * 1024;
/** Multipart (banner undangan): payload JSON + satu file gambar. */
const MAX_MULTIPART_BYTES = INVITATION_BANNER_MAX_BYTES + MAX_BODY_BYTES;
const TENANT_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const SYSTEM_PAGES: readonly TemplateSystemPage[] = [
  'cart', 'orders', 'order_detail', 'tagihan', 'invoice_detail', 'calendar', 'gathering_plan', 'product_detail',
  'gathering_invitation',
];
/** Undangan terbuka: RSVP & OTP tanpa login (status tamu di cookie httpOnly). */
const ANONYMOUS_INTENTS = new Set(['gathering.invitation.rsvp', 'gathering.invitation.verify_otp', 'gathering.invitation.resend_otp']);
const INVITATION_PATH = /\/gathering\/invite\/(?:id\/)?([^/?#]{1,200})\/?$/;

function respond(
  body: { ok: boolean; redirect?: string; message?: string },
  status: number,
  cookie?: { name: string; value: string | null; maxAge: number },
) {
  const response = NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (cookie) {
    response.cookies.set(cookie.name, cookie.value ?? '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: cookie.value === null ? 0 : cookie.maxAge,
    });
  }
  return response;
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;
  const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    || new URL(request.url).protocol.slice(0, -1);
  try {
    return origin === new URL(`${protocol}://${host}`).origin;
  } catch {
    return false;
  }
}

/**
 * Intent dari template package (keranjang, bayar, RSVP, kelola rencana gathering) — dikirim oleh frame host
 * setelah memvalidasi pesan iframe. Plan: template-owned-system-pages-plan.md §4.3.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return respond({ ok: false, message: 'Origin tidak diizinkan.' }, 403);

  let body: unknown;
  let bannerFile: File | undefined;
  const multipart = (request.headers.get('content-type') ?? '').toLowerCase().startsWith('multipart/form-data');
  try {
    if (multipart) {
      const declaredLength = Number(request.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
        return respond({ ok: false, message: 'Ukuran banner maksimal 5 MB.' }, 413);
      }
      const form = await request.formData();
      const payload = form.get('payload');
      const banner = form.get('banner');
      if (typeof payload !== 'string' || Buffer.byteLength(payload, 'utf8') > MAX_BODY_BYTES || !(banner instanceof File)) {
        return respond({ ok: false, message: 'Permintaan tidak valid.' }, 400);
      }
      if (banner.size > INVITATION_BANNER_MAX_BYTES) return respond({ ok: false, message: 'Ukuran banner maksimal 5 MB.' }, 413);
      body = JSON.parse(payload);
      bannerFile = banner;
    } else {
      const raw = await request.text();
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return respond({ ok: false, message: 'Permintaan terlalu besar.' }, 413);
      body = JSON.parse(raw);
    }
  } catch {
    return respond({ ok: false, message: 'Permintaan tidak valid.' }, 400);
  }
  const record = body !== null && typeof body === 'object' ? body as Record<string, unknown> : {};
  const tenantSlug = typeof record.tenantSlug === 'string' ? record.tenantSlug : '';
  const pageType = SYSTEM_PAGES.find((page) => page === record.pageType);
  const rawIntent = record.intent !== null && typeof record.intent === 'object' ? record.intent as Record<string, unknown> : null;
  // File hanya boleh menyertai intent banner; divalidasi ulang oleh parser (tipe gambar & ukuran).
  const intent = parseTemplateRuntimeIntent(rawIntent && bannerFile ? { ...rawIntent, bannerFile } : rawIntent);
  if (!TENANT_SLUG_PATTERN.test(tenantSlug) || !pageType || !intent) {
    return respond({ ok: false, message: 'Permintaan tidak valid.' }, 400);
  }
  if (bannerFile && intent.action !== 'gathering.invitation.content.save' && intent.action !== 'gathering.invitations.submit') {
    return respond({ ok: false, message: 'Permintaan tidak valid.' }, 400);
  }

  // Halaman undangan: token dari path halaman (key intent diverifikasi terhadapnya oleh executor).
  let invitationToken: string | undefined;
  if (pageType === 'gathering_invitation') {
    const pagePath = typeof record.pagePath === 'string' && record.pagePath.length <= 512 ? record.pagePath : '';
    const match = INVITATION_PATH.exec(pagePath);
    try {
      invitationToken = match ? decodeURIComponent(match[1]) : undefined;
    } catch {
      invitationToken = undefined;
    }
    if (!invitationToken) return respond({ ok: false, message: 'Permintaan tidak valid.' }, 400);
  }

  const { user } = await getSession();
  if (!user?.userId && !(pageType === 'gathering_invitation' && ANONYMOUS_INTENTS.has(intent.action))) {
    return respond({ ok: false, message: 'Login diperlukan.' }, 401);
  }

  const tenant = await loadTenant(tenantSlug);
  if (!tenant) return respond({ ok: false, message: 'Website tidak ditemukan.' }, 404);
  if (!templateOwnsPage(tenant.website, pageType)) {
    return respond({ ok: false, message: 'Halaman ini tidak dikelola template.' }, 403);
  }

  const result = await executeTemplateIntent(intent, {
    pageType,
    websiteId: tenant.website.id,
    basePath: resolveTenantLinkBase(tenantSlug),
    // Key sesi pembeli; tanpa login hanya intent undangan terbuka (yang memakai publicKey).
    key: user?.userId ? createPageKeyFactory(user.userId) : createPageKeyFactory(PUBLIC_PAGE_KEY_SCOPE),
    origin: request.headers.get('origin') ?? undefined,
    fetch: (path, init) => backendFetch(path, {
      method: init?.method ?? 'GET',
      ...(init?.body ? { body: init.body } : {}),
      ...(init?.headers ? { headers: init.headers } : {}),
    }),
    upload: (path, form) => backendFetchFormData(path, form),
    products: tenant.products.map(toCatalogItem),
    publicKey: createPageKeyFactory(PUBLIC_PAGE_KEY_SCOPE),
    ...(invitationToken
      ? {
        invitationToken,
        invitationGuest: decodeInvitationGuestState(cookies().get(invitationCookieName(invitationToken))?.value),
        publicFetch: (path, init) => publicBackendFetch(path, { method: init?.method, body: init?.body }),
      }
      : {}),
  });
  return respond(result.body, result.status, result.cookie);
}
