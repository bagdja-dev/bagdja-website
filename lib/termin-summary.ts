/**
 * Ringkasan tagihan 1 transaksi — mirror `TransactionTerminSummaryDto`
 * (bagdja-website-api). Tagihan 1 = DP (transaksi checkout itu sendiri),
 * Tagihan 2..N = Termin; CANCELLED tidak dihitung. `null` = tanpa Termin.
 */
export interface TagihanSummary {
  total: number;
  paid: number;
  /** Sudah diterbitkan seller, menunggu dibayar. */
  issued: number;
  /** Belum diterbitkan seller. */
  scheduled: number;
}

export function remainingTagihan(summary: TagihanSummary | null | undefined): number {
  return summary ? Math.max(0, summary.total - summary.paid) : 0;
}

/**
 * Checkout sudah COMPLETED tapi masih ada tagihan lanjutan yang belum lunas
 * (diterbitkan atau belum) — pesanan secara keseluruhan BELUM selesai.
 * Hanya untuk tampilan; `transaction.status` asli tidak diubah.
 */
export function hasOutstandingTagihan(status: string, summary: TagihanSummary | null | undefined): boolean {
  return status === 'COMPLETED' && remainingTagihan(summary) > 0;
}

/** Label pill status, mis. "Sisa 2 Tagihan". */
export function outstandingTagihanLabel(summary: TagihanSummary | null | undefined): string {
  return `Sisa ${remainingTagihan(summary)} Tagihan`;
}

/** Rincian progres, mis. "Lunas 1 dari 3 · 1 perlu dibayar · 1 belum diterbitkan". */
export function tagihanProgressText(summary: TagihanSummary): string {
  const parts = [`Lunas ${summary.paid} dari ${summary.total} tagihan`];
  if (summary.issued > 0) parts.push(`${summary.issued} perlu dibayar`);
  if (summary.scheduled > 0) parts.push(`${summary.scheduled} belum diterbitkan`);
  return parts.join(' · ');
}
