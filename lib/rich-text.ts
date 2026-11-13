/**
 * Rich text keterangan opsi gathering (HTML ringan dari editor Studio, disanitasi Website API saat simpan —
 * bagdja-website-api/src/common/rich-text.ts). Aman dipakai di client & server (tanpa node:*).
 *
 * Halaman Bagdja menampilkan versi teks polos (tanpa innerHTML). Versi HTML hanya diteruskan ke template
 * package sebagai `descriptionHtml`.
 */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' };

/** Batas panjang HTML yang diteruskan ke template — sama dengan DTO opsi (5000). */
export const RICH_TEXT_MAX_LENGTH = 5000;

export function richTextToPlainText(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  return value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|h[1-6]|blockquote|tr|pre)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
      const lower = entity.toLowerCase();
      if (ENTITIES[lower] !== undefined) return ENTITIES[lower];
      const code = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : lower.startsWith('#') ? parseInt(lower.slice(1), 10) : NaN;
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * HTML untuk template: hanya keluaran editor (diawali tag) yang sudah melewati sanitasi API.
 * Teks polos lama tidak dikirim sebagai HTML — template memakai `description`.
 */
export function richTextHtml(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const html = value.trim();
  if (!html.startsWith('<') || html.length > RICH_TEXT_MAX_LENGTH || !richTextToPlainText(html)) return undefined;
  return html;
}
