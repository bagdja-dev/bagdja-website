/**
 * (Sama dengan bagdja-website-admin studio/lib/flow-date-value.ts.)
 * Nilai field flow `tanggal` (`YYYY-MM-DD`) dan `tanggal_waktu` (`YYYY-MM-DDTHH:mm`, jam lokal bisnis).
 * Diformat tanpa konversi zona waktu agar tanggal/jam yang ditampilkan sama dengan yang diisi.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function formatFlowDateValue(type: string, value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const monthLabel = MONTHS[Number(month) - 1];
  if (!monthLabel) return null;
  const date = `${Number(day)} ${monthLabel} ${year}`;
  if (type === 'tanggal_waktu' && hour !== undefined) return `${date}, ${hour}.${minute}`;
  return date;
}
