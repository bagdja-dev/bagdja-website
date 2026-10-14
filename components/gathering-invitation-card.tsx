import type { GatheringPlanDetail } from './order-detail-content';

export function GatheringInvitationCard({
  plan,
  bannerUrl,
  description,
}: {
  plan: GatheringPlanDetail;
  bannerUrl: string;
  description: string;
}) {
  const occurrence = plan.occurrence;
  const openedOptions = occurrence.option_groups_snapshot.filter((option) =>
    (occurrence.opened_option_ids_snapshot ?? []).includes(option.product_option_id),
  );
  const price = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: occurrence.currency || 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(occurrence.price_per_seat));

  return (
    <section className="mt-6" aria-label="Preview kartu undangan">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">Preview kartu undangan</h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>Seperti inilah informasi utama yang akan dilihat penerima undangan.</p>
      </div>
      <article className="mx-auto max-w-2xl overflow-hidden border bg-white text-zinc-900 shadow-sm" style={{ borderColor: 'var(--brand-border)' }}>
        {bannerUrl ? (
          <img src={bannerUrl} alt={`Banner ${plan.title}`} className="aspect-[16/7] w-full object-cover" />
        ) : (
          <div className="flex aspect-[16/7] w-full items-center justify-center bg-zinc-50 text-xs text-zinc-400">Banner belum ditambahkan</div>
        )}
        <div className="p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase text-zinc-500">Undangan gathering</p>
          <h3 className="mt-2 text-xl font-semibold">{plan.title}</h3>
          {description ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{description}</p> : <p className="mt-3 text-sm text-zinc-400">Deskripsi belum ditambahkan.</p>}
          <dl className="mt-5 grid gap-4 border-y border-zinc-200 py-4 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-zinc-500">Harga per peserta</dt><dd className="mt-1 font-semibold">{price}</dd></div>
            <div><dt className="text-xs text-zinc-500">Batas peserta</dt><dd className="mt-1 font-semibold">Min. {occurrence.min_attendees} · Maks. {occurrence.max_attendees}</dd></div>
            <div><dt className="text-xs text-zinc-500">Jadwal</dt><dd className="mt-1 font-semibold">{occurrence.final_schedule ? new Date(occurrence.final_schedule).toLocaleString('id-ID') : 'Belum ditentukan'}</dd></div>
            <div><dt className="text-xs text-zinc-500">Batas RSVP</dt><dd className="mt-1 font-semibold">{occurrence.rsvp_close_at ? new Date(occurrence.rsvp_close_at).toLocaleString('id-ID') : 'Belum ditentukan'}</dd></div>
          </dl>
          {openedOptions.length ? (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-zinc-600">Pilihan acara</h4>
              <ul className="mt-2 flex flex-wrap gap-2">
                {openedOptions.map((option) => <li key={option.product_option_id} className="border border-zinc-200 px-3 py-1.5 text-xs">{option.label}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      </article>
    </section>
  );
}