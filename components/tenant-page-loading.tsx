/**
 * Indikator memuat isi halaman tenant (shell persisten D8 / render langsung). Warna mengikuti aksen template
 * bila tersedia (`--kt-accent` Kumpul), selain itu netral. Tanpa hook → bisa dipakai di Server Component
 * (`loading.tsx`) maupun Client Component.
 */
export function TenantPageLoading({ label = 'Memuat halaman…', compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-full flex-col items-center justify-center gap-3 px-4 ${compact ? 'py-6' : 'min-h-[50dvh] py-16'}`}
    >
      <span
        aria-hidden="true"
        className="h-9 w-9 animate-spin rounded-full border-[3px] border-zinc-200"
        style={{ borderTopColor: 'var(--kt-accent, #3f3f46)' }}
      />
      <span className="text-sm text-zinc-500">{label}</span>
    </div>
  );
}
