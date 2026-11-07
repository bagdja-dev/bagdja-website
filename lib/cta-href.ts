/**
 * Menyelesaikan tautan tombol section `cta` (schemaVersion 2) dari `content`.
 *
 * `button_action`: whatsapp | phone | email | link. Content lama (v1) tanpa
 * `button_action` diperlakukan sebagai `link` yang memakai `button_url`.
 * Mengembalikan `null` bila tidak ada target yang valid (tombol disembunyikan).
 */

export interface CtaHref {
  href: string;
  /** true: buka di tab baru (`target="_blank" rel="noopener noreferrer"`). */
  external: boolean;
}

export interface CtaProfile {
  whatsapp?: string;
}

const MIN_PHONE_DIGITS = 9;
const MAX_PHONE_DIGITS = 15;

function readString(content: Record<string, unknown>, key: string): string {
  const value = content[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** 08…/62…/+62…/8… → 62… (hanya digit); null bila panjangnya tidak wajar. */
export function normalizeIndonesianPhone(raw: string | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('62')) {
    // "620812…" (0 ikut tertulis setelah kode negara) → buang 0 itu.
    if (digits.startsWith('620')) digits = `62${digits.slice(3)}`;
  } else if (digits.startsWith('0')) {
    digits = `62${digits.slice(1)}`;
  } else {
    digits = `62${digits}`;
  }
  return digits.length >= MIN_PHONE_DIGITS && digits.length <= MAX_PHONE_DIGITS ? digits : null;
}

/** https://… (otomatis ditambah bila hilang) atau path internal `/…`; skema lain ditolak. */
function resolveLink(raw: string): CtaHref | null {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;
  if (value.startsWith('/') && !value.startsWith('//')) return { href: value, external: false };
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/\//, '')}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname || (url.protocol !== 'https:' && url.protocol !== 'http:')) return null;
    return { href: url.toString(), external: true };
  } catch {
    return null;
  }
}

function resolveWhatsapp(content: Record<string, unknown>, profile: CtaProfile): CtaHref | null {
  const number = normalizeIndonesianPhone(readString(content, 'button_whatsapp')) ?? normalizeIndonesianPhone(profile.whatsapp);
  if (!number) return null;
  const message = readString(content, 'button_message');
  const query = message ? `?text=${encodeURIComponent(message)}` : '';
  return { href: `https://wa.me/${number}${query}`, external: true };
}

function resolveEmail(content: Record<string, unknown>): CtaHref | null {
  const email = readString(content, 'button_email');
  if (!/^[^\s@,;?&]+@[^\s@,;?&]+\.[^\s@,;?&]+$/.test(email)) return null;
  const subject = readString(content, 'button_subject');
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : '';
  return { href: `mailto:${email}${query}`, external: false };
}

export function resolveCtaHref(content: Record<string, unknown>, profile: CtaProfile): CtaHref | null {
  switch (readString(content, 'button_action')) {
    case 'whatsapp':
      return resolveWhatsapp(content, profile);
    case 'phone': {
      const number = normalizeIndonesianPhone(readString(content, 'button_phone'));
      return number ? { href: `tel:+${number}`, external: false } : null;
    }
    case 'email':
      return resolveEmail(content);
    default:
      // `link` dan content lama (tanpa button_action): memakai button_url.
      return resolveLink(readString(content, 'button_url'));
  }
}
