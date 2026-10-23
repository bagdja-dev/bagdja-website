'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type PlanRow = {
  id: string;
  plan_number: string;
  order_id: string | null;
  title: string;
  status: string;
  workflow_step: string;
  occurrence: {
    status: string;
    min_attendees: number;
    max_attendees: number;
    final_schedule?: string | null;
    payment_deadline?: string | null;
  };
};

const STEP_LABELS: Record<string, string> = {
  PLAN: 'Atur rencana',
  INVITATIONS: 'Buat undangan',
  INVITATION_CONFIRMATION: 'Konfirmasi peserta',
  PAYMENT_CONFIRMATION: 'Konfirmasi opsi & pembayaran',
  LOCKED: 'Terkunci',
};

const STATUS_LABELS: Record<string, string> = {
  PREORDER: 'Perencanaan',
  RSVP_OPEN: 'RSVP dibuka',
  PAYMENT_OPEN: 'Menunggu pembayaran seat',
  CONFIRMED: 'Acara dikonfirmasi',
  IN_PROGRESS: 'Acara berlangsung',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

const CALENDAR_TABS = [
  { key: 'all', label: 'Semua', matches: (_plan: PlanRow) => true },
  { key: 'planning', label: 'Perencanaan', matches: (plan: PlanRow) => plan.workflow_step === 'PLAN' && plan.status === 'PREORDER' },
  { key: 'rsvp', label: 'RSVP', matches: (plan: PlanRow) => plan.status === 'RSVP_OPEN' },
  { key: 'payment', label: 'Pembayaran', matches: (plan: PlanRow) => plan.status === 'PAYMENT_OPEN' },
  { key: 'confirmed', label: 'Dikonfirmasi', matches: (plan: PlanRow) => plan.status === 'CONFIRMED' || plan.status === 'IN_PROGRESS' },
  { key: 'completed', label: 'Selesai', matches: (plan: PlanRow) => plan.status === 'COMPLETED' },
  { key: 'cancelled', label: 'Dibatalkan', matches: (plan: PlanRow) => plan.status === 'CANCELLED' },
] as const;

function formatDate(value?: string | null) {
  if (!value) return 'Belum ditentukan';
  const date = new Date(value);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return Number.isNaN(date.getTime()) ? 'Belum ditentukan' : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone });
}

export function GatheringCalendarContent({ basePath, websiteId }: { basePath: string; websiteId: string }) {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/gathering/plans?website_id=${encodeURIComponent(websiteId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as PlanRow[] | { message?: string } | null;
        if (response.status === 401) throw new Error('Silakan login untuk melihat rencana acara.');
        if (!response.ok) throw new Error((payload as { message?: string } | null)?.message || 'Gagal memuat kalender acara.');
        return Array.isArray(payload) ? payload : [];
      })
      .then((rows) => { if (!cancelled) setPlans(rows); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Gagal memuat kalender acara.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [websiteId]);

  const selectedTab = CALENDAR_TABS.find((tab) => tab.key === activeTab) ?? CALENDAR_TABS[0];
  const filteredPlans = plans.filter(selectedTab.matches);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-accent-muted)' }}>Acara Anda</p>
          <h1 className="mt-1 text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>Kalender & Rencana Acara</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--brand-muted)' }}>Kelola rencana, peserta, voting, dan pembayaran seat di sini.</p>
        </div>
      </header>

      <nav className="mb-5 flex gap-2 overflow-x-auto border-b pb-3" aria-label="Filter status acara">
        {CALENDAR_TABS.map((tab) => {
          const selected = activeTab === tab.key;
          const count = plans.filter(tab.matches).length;
          return (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} aria-pressed={selected} className="flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium" style={{ borderColor: selected ? 'var(--brand-accent)' : 'transparent', color: selected ? 'var(--brand-text)' : 'var(--brand-muted)' }}>
              {tab.label}<span className="text-xs">{count}</span>
            </button>
          );
        })}
      </nav>

      {loading ? <p className="border-y py-8 text-sm" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}>Memuat rencana acara…</p> : null}
      {error ? <p role="alert" className="border-y py-5 text-sm text-red-700" style={{ borderColor: 'var(--brand-border)' }}>{error}</p> : null}
      {!loading && !error && filteredPlans.length === 0 ? (
        <section className="border-y py-10 text-center">
          <h2 className="text-lg font-semibold">{plans.length === 0 ? 'Belum ada rencana acara' : 'Tidak ada acara pada status ini'}</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--brand-muted)' }}>Rencana gathering yang Anda buat akan dikelola dari kalender ini.</p>
          <Link href={`${basePath}/`} className="mt-5 inline-flex rounded-full px-5 py-2.5 text-sm font-semibold" style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}>Jelajahi acara</Link>
        </section>
      ) : null}
      <div className="flex flex-col divide-y" style={{ borderColor: 'var(--brand-border)' }}>
        {filteredPlans.map((plan) => (
          <article key={plan.id} className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">{plan.title}</h2>
                <span className="border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}>{STATUS_LABELS[plan.status] ?? plan.status}</span>
              </div>
              <p className="mt-1 text-xs font-medium" style={{ color: 'var(--brand-muted)' }}>Nomor rencana: {plan.plan_number}</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--brand-muted)' }}>{STEP_LABELS[plan.workflow_step] ?? plan.workflow_step}</p>
              <p className="mt-2 text-xs" style={{ color: 'var(--brand-muted)' }}>Jadwal: {formatDate(plan.occurrence.final_schedule)} · Peserta: min. {plan.occurrence.min_attendees}, maks. {plan.occurrence.max_attendees}</p>
              {plan.occurrence.payment_deadline ? <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>Batas pembayaran: {formatDate(plan.occurrence.payment_deadline)}</p> : null}
            </div>
            <Link href={`${basePath}/cart/order/${encodeURIComponent(plan.order_id ?? plan.id)}`} className="inline-flex w-fit items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}>Lanjutkan rencana</Link>
          </article>
        ))}
      </div>
    </main>
  );
}
