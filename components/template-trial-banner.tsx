/**
 * Penanda "Mode uji" untuk template kandidat belum terbit
 * (plan/website-builder/template-candidate-trial-plan.md, keputusan T1).
 * Ringkas di tengah atas (pojok kiri/kanan biasanya berisi logo & ikon akun template); penjelasan lengkap muncul saat kursor diarahkan atau saat
 * disentuh/difokus (HP & keyboard). Hanya dirender untuk viewer yang berhak.
 */
export function TemplateTrialBanner({ slug, version }: { slug: string; version: string }) {
  return (
    <div
      role="status"
      tabIndex={0}
      aria-label={`Mode uji ${slug} ${version}. Belum terbit, hanya terlihat oleh akun penguji; pengunjung lain melihat template terpasang.`}
      className="group fixed left-1/2 top-1 z-[2147483646] max-w-[calc(100vw-16px)] -translate-x-1/2 cursor-default rounded-full bg-zinc-900/90 px-2 py-0.5 text-center text-[11px] leading-snug text-zinc-50 shadow-lg outline-none transition-all hover:rounded-lg hover:px-2.5 hover:py-1 focus-visible:rounded-lg focus-visible:px-2.5 focus-visible:py-1 focus-visible:ring-2 focus-visible:ring-amber-400"
    >
      <span className="font-semibold text-amber-400">Mode uji</span> · {slug} {version}
      <span className="hidden max-w-xs group-hover:block group-focus:block">
        Belum terbit — hanya terlihat oleh Anda. Pengunjung lain melihat template terpasang.
      </span>
    </div>
  );
}
