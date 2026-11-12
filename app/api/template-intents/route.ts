import { NextResponse } from 'next/server';

import { backendFetch } from '../../../lib/backend-api';
import { getSession } from '../../../lib/session';
import { createPageKeyFactory, executeTemplateIntent } from '../../../lib/template-pages';
import { parseTemplateRuntimeIntent } from '../../../lib/template-runtime-bridge';
import { resolveTenantLinkBase } from '../../../lib/tenant-link-base';
import { loadTenant } from '../../../lib/tenant-loader';
import { templateOwnsPage, type TemplateSystemPage } from '../../../lib/tenant-template';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_BODY_BYTES = 16 * 1024;
const TENANT_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const SYSTEM_PAGES: readonly TemplateSystemPage[] = [
  'cart', 'orders', 'order_detail', 'tagihan', 'invoice_detail', 'calendar', 'gathering_plan',
];

function respond(body: { ok: boolean; redirect?: string; message?: string }, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
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
 * Intent dari template package (keranjang, bayar, RSVP) — dikirim oleh frame host
 * setelah memvalidasi pesan iframe. Plan: template-owned-system-pages-plan.md §4.3.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return respond({ ok: false, message: 'Origin tidak diizinkan.' }, 403);

  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return respond({ ok: false, message: 'Permintaan terlalu besar.' }, 413);
    body = JSON.parse(raw);
  } catch {
    return respond({ ok: false, message: 'Permintaan tidak valid.' }, 400);
  }
  const record = body !== null && typeof body === 'object' ? body as Record<string, unknown> : {};
  const tenantSlug = typeof record.tenantSlug === 'string' ? record.tenantSlug : '';
  const pageType = SYSTEM_PAGES.find((page) => page === record.pageType);
  const intent = parseTemplateRuntimeIntent(record.intent);
  if (!TENANT_SLUG_PATTERN.test(tenantSlug) || !pageType || !intent) {
    return respond({ ok: false, message: 'Permintaan tidak valid.' }, 400);
  }

  const { user } = await getSession();
  if (!user?.userId) return respond({ ok: false, message: 'Login diperlukan.' }, 401);

  const tenant = await loadTenant(tenantSlug);
  if (!tenant) return respond({ ok: false, message: 'Website tidak ditemukan.' }, 404);
  if (!templateOwnsPage(tenant.website, pageType)) {
    return respond({ ok: false, message: 'Halaman ini tidak dikelola template.' }, 403);
  }

  const result = await executeTemplateIntent(intent, {
    pageType,
    websiteId: tenant.website.id,
    basePath: resolveTenantLinkBase(tenantSlug),
    key: createPageKeyFactory(user.userId),
    fetch: (path, init) => backendFetch(path, { method: init?.method ?? 'GET', ...(init?.body ? { body: init.body } : {}) }),
  });
  return respond(result.body, result.status);
}
