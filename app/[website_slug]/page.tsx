import { notFound } from 'next/navigation';

/**
 * Dynamic route untuk setiap website tenant.
 *
 * Phase 7 (target):
 *   1. Resolve `websiteSlug` → panggil API `GET /api/websites/by-slug/:slug`
 *   2. Ambil `template_id` dari record.
 *   3. Load komponen template dinamis dari `app/templates/[template_slug]/`.
 *   4. Inject data tenant (nama, layanan, alamat, FAQ, dst.) ke template.
 *
 * Phase 1: hanya placeholder yang menampilkan slug.
 */
export default function TenantPage({ params }: { params: { website_slug: string } }) {
  const slug = params.website_slug;
  if (!slug) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
        Placeholder
      </span>
      <h1 className="text-3xl font-semibold">
        Website: <span className="font-mono">{slug}</span>
      </h1>
      <p className="max-w-md text-zinc-600">
        Halaman ini akan me-resolve tenant berdasarkan slug dan me-render
        template yang dipilih. Diaktifkan pada Phase 7.
      </p>
      <a
        href="/"
        className="text-sm text-amber-600 hover:underline"
      >
        ← Kembali ke index
      </a>
    </main>
  );
}
