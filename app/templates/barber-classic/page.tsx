/**
 * Template: Barber Classic (placeholder Phase 1).
 *
 * Phase 7 akan:
 *   - Menerima data tenant via props/searchParams
 *   - Section: Hero, Product/Service Grid, Location, FAQ
 *   - CTA WhatsApp
 *   - Tema dark premium (zinc-950 + amber)
 *
 * Untuk Phase 1 kita hanya render shell HTML5 semantik + Tailwind supaya
 * routing terverifikasi dan tim design bisa mulai mengisi konten.
 */
export default function BarberClassicTemplate() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="text-lg font-semibold tracking-widest text-amber-400">
            BAGDJA · BARBER
          </span>
          <span className="text-xs uppercase tracking-wider text-zinc-500">
            Template Preview
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-24 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-500">
          Barber Classic
        </p>
        <h1 className="mt-4 text-4xl font-semibold sm:text-6xl">
          Premium Barbershop Template
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-zinc-400">
          Section Hero, layanan, lokasi, dan FAQ akan diisi otomatis dari data
          tenant pada Phase 7. Halaman ini berfungsi sebagai shell untuk
          memverifikasi routing dan tema.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <a
            href="#"
            aria-disabled
            className="rounded-full bg-amber-500 px-6 py-3 text-sm font-medium text-zinc-950 opacity-70"
          >
            Booking via WhatsApp
          </a>
          <a
            href="/"
            className="rounded-full border border-zinc-700 px-6 py-3 text-sm text-zinc-300 hover:border-amber-500 hover:text-amber-400"
          >
            ← Kembali
          </a>
        </div>
      </section>

      <footer className="border-t border-zinc-800/60 py-6 text-center text-xs text-zinc-600">
        © Bagdja Website Builder — placeholder template
      </footer>
    </div>
  );
}
