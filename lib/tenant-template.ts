import type { ApiWebsite } from './api-client';
import { extractTemplateTheme, sanitizeWebsiteTheme, type WebsiteTheme } from './website-theme';

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
  /** Navigasi bawah (HP) di halaman yang isinya dikelola Bagdja. */
  | 'bottom_nav'
  | 'cart'
  | 'orders'
  | 'order_detail'
  | 'tagihan'
  | 'invoice_detail'
  | 'calendar'
  | 'gathering_plan'
  /** Detail produk gathering (contractVersion 1); produk lain tetap tampilan Bagdja. */
  | 'product_detail'
  /** Halaman undangan gathering (RSVP, OTP, voting opsi, bayar kursi). */
  | 'gathering_invitation';

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

/**
 * Palet bawaan template untuk website ini: dari manifest **versi yang dipakai** (pin atau uji
 * kandidat, `template_runtime.theme`), baru fallback ke `structure.theme` katalog. Dengan begitu
 * "Reset ke warna template" dan halaman milik Bagdja memakai warna versi yang sama dengan template.
 */
export function tenantTemplateTheme(website: WebsiteTemplateFields): WebsiteTheme {
  const runtimeTheme = sanitizeWebsiteTheme(website.template_runtime?.theme);
  return Object.keys(runtimeTheme).length ? runtimeTheme : extractTemplateTheme(website.template?.structure);
}
