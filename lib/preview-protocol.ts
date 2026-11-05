/**
 * Protokol preview v1 (template-contract.md §4) — sisi renderer (iframe).
 * Dipakai route `[website_slug]/__preview` + `components/preview/*`. Tidak
 * spesifik template: penanda section dipasang di level host
 * (`components/templates/shared/section-frame.tsx`).
 *
 * Semua pesan berbentuk `{ type, protocol: 1, ... }`; pesan dengan versi lain
 * atau `type` tak dikenal diabaikan.
 */

export const PREVIEW_PROTOCOL_VERSION = 1;

export const PREVIEW_MESSAGE = {
  ready: 'bagdja:preview:ready',
  sections: 'bagdja:preview:sections',
  highlight: 'bagdja:preview:highlight',
  select: 'bagdja:preview:select',
} as const;

/** Atribut penanda section di DOM preview (hanya dirender di route preview). */
export const PREVIEW_SECTION_ATTR = 'data-bagdja-section-id';

/** Batas jumlah section per pesan draft — sekadar pagar terhadap payload tak wajar. */
const MAX_DRAFT_SECTIONS = 200;
const MAX_ID_LENGTH = 128;

export interface PreviewDraftSection {
  id: string;
  type: string;
  content: Record<string, unknown>;
}

export type PreviewInboundMessage =
  | {
      type: typeof PREVIEW_MESSAGE.sections;
      pageSlug: string;
      sections: PreviewDraftSection[];
      theme?: Record<string, unknown>;
    }
  | { type: typeof PREVIEW_MESSAGE.highlight; sectionId: string | null };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isShortString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_ID_LENGTH;
}

function parseDraftSections(raw: unknown): PreviewDraftSection[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_DRAFT_SECTIONS) return null;
  const sections: PreviewDraftSection[] = [];
  for (const item of raw) {
    if (!isPlainObject(item)) return null;
    if (!isShortString(item.id) || !isShortString(item.type) || !isPlainObject(item.content)) return null;
    sections.push({ id: item.id, type: item.type, content: item.content });
  }
  return sections;
}

/**
 * Validasi bentuk pesan parent → iframe. `null` = abaikan (versi lain, type
 * tak dikenal, atau payload rusak). Origin divalidasi terpisah oleh pemanggil.
 */
export function parsePreviewInboundMessage(data: unknown): PreviewInboundMessage | null {
  if (!isPlainObject(data) || data.protocol !== PREVIEW_PROTOCOL_VERSION) return null;

  if (data.type === PREVIEW_MESSAGE.sections) {
    if (typeof data.pageSlug !== 'string') return null;
    const sections = parseDraftSections(data.sections);
    if (!sections) return null;
    if (data.theme !== undefined && !isPlainObject(data.theme)) return null;
    return {
      type: PREVIEW_MESSAGE.sections,
      pageSlug: data.pageSlug,
      sections,
      ...(data.theme ? { theme: data.theme } : {}),
    };
  }

  if (data.type === PREVIEW_MESSAGE.highlight) {
    if (data.sectionId !== null && !isShortString(data.sectionId)) return null;
    return { type: PREVIEW_MESSAGE.highlight, sectionId: data.sectionId };
  }

  return null;
}

/** Normalisasi satu origin (`scheme://host[:port]`); nilai tidak valid → null. */
function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Origin admin yang boleh menyematkan & mengirim pesan ke preview.
 * Env `NEXT_PUBLIC_ADMIN_ORIGIN` (dipisah koma). Kosong: di development
 * default `http://localhost:5004`, di production tidak ada (preview tertutup).
 * Logika yang sama diduplikasi di next.config.js (header frame-ancestors).
 */
export function getAllowedAdminOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_ORIGIN ?? '';
  const origins = raw
    .split(',')
    .map((entry) => normalizeOrigin(entry))
    .filter((entry): entry is string => Boolean(entry));
  if (origins.length > 0) return Array.from(new Set(origins));
  return process.env.NODE_ENV === 'production' ? [] : ['http://localhost:5004'];
}
