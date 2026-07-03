import Link from 'next/link';

export default function IndexPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="space-y-3">
        <span className="inline-block rounded-full border border-amber-400/40 bg-amber-50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-amber-700">
          Phase 1 · Scaffold
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Bagdja Website
        </h1>
        <p className="mx-auto max-w-lg text-zinc-600">
          Public renderer untuk website tenant. Halaman ini akan digantikan
          sistem multi-template dinamis pada Phase 7.
        </p>
      </div>

      <div className="grid w-full gap-4 sm:grid-cols-2">
        <Link
          href="/demo-barber"
          className="group rounded-2xl border border-zinc-200 bg-white p-6 text-left transition hover:border-amber-400 hover:shadow-md"
        >
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Dynamic Route
          </p>
          <h2 className="mt-1 text-lg font-medium">
            /demo-barber
            <span className="ml-2 text-zinc-400 transition group-hover:text-amber-500">
              →
            </span>
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Placeholder <code className="font-mono">[website_slug]</code> —
            memuat data tenant berdasarkan slug (Phase 7).
          </p>
        </Link>

        <Link
          href="/templates/barber-classic"
          className="group rounded-2xl border border-zinc-200 bg-white p-6 text-left transition hover:border-amber-400 hover:shadow-md"
        >
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Template Preview
          </p>
          <h2 className="mt-1 text-lg font-medium">
            Barber Classic
            <span className="ml-2 text-zinc-400 transition group-hover:text-amber-500">
              →
            </span>
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            Preview template pertama dengan HTML5 semantik + Tailwind (Phase 7).
          </p>
        </Link>
      </div>
    </main>
  );
}
