import type { ApiWebsite } from './api-client';

/**
 * Keputusan template per website (plan/website-builder/template-owned-system-pages-plan.md §5).
 *
 * Sumber kebenaran = `website.template_runtime` dari Website API: hanya terisi bila
 * template bersumber dari package designer DAN website ter-pin ke versi terbitnya.
 * Template bawaan (mis. `store-classic`) tidak pernah dirender lewat runtime eksternal,
 * apa pun isi `TEMPLATE_RUNTIME_VERSION_MAP` atau sisa pin lama.
 */

/** Tampilan Bagdja untuk halaman yang tidak dinyatakan template package. */
export const HOST_FALLBACK_TEMPLATE_SLUG = 'store-classic';

export type TemplateSystemPage =
  | 'header'
  | 'cart'
  | 'orders'
  | 'order_detail'
  | 'tagihan'
  | 'invoice_detail'
  | 'calendar'
  | 'gathering_plan';

type WebsiteTemplateFields = Pick<ApiWebsite, 'template' | 'template_runtime'>;

export function tenantRuntime(website: WebsiteTemplateFields): NonNullable<ApiWebsite['template_runtime']> | null {
  return website.template_runtime ?? null;
}

/** Template package menyatakan halaman ini di manifest versi terpasang. */
export function templateOwnsPage(website: WebsiteTemplateFields, page: TemplateSystemPage): boolean {
  return Boolean(website.template_runtime?.pageOverrides.includes(page));
}

/** Slug renderer bawaan untuk konten halaman yang dikelola Bagdja. */
export function hostRendererSlug(website: WebsiteTemplateFields): string | null {
  if (website.template_runtime) return HOST_FALLBACK_TEMPLATE_SLUG;
  return website.template?.slug ?? null;
}
