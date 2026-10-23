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

type InvitationAction =
  | 'RSVP'
  | 'WAITING_INVOICE'
  | 'PAY'
  | 'PAYMENT_PENDING'
  | 'WAITING_CONFIRMATION'
  | 'TICKET'
  | 'ATTENDED'
  | 'NONE';

type InvitationRow = {
  id: string;
  kind: 'INVITATION' | 'REGISTRATION';
  group_id: string;
  gathering_title: string;
  plan_number: string;
  initiator_name: string;
  event_date: string | null;
  event_location: string | null;
  gathering_status: string;
  attendee_name: string | null;
  registration_status: string | null;
  payment_status: string | null;
  checked_in_at: string | null;
  is_attendee: boolean;
  action: InvitationAction;
  action_path: string | null;
};

type MainTab = 'plans' | 'invitations';

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

/** Tombol utama per status seat; label tanpa tombol bila tidak ada tindakan. */
const ACTION_COPY: Record<InvitationAction, { button?: string; label?: string }> = {
  RSVP: { button: 'Jawab undangan' },
  WAITING_INVOICE: { label: 'Menunggu tagihan' },
  PAY: { button: 'Bayar seat' },
  PAYMENT_PENDING: { button: 'Lanjutkan pembayaran' },
  WAITING_CONFIRMATION: { label: 'Lunas · menunggu konfirmasi acara', button: 'Lihat tagihan' },
  TICKET: { button: 'Lihat tiket' },
  ATTENDED: { label: 'Hadir', button: 'Lihat tiket' },
  NONE: {},
};

const NEEDS_ATTENTION: InvitationAction[] = ['RSVP', 'PAY', 'PAYMENT_PENDING'];

function formatDate(value?: string | null) {
  if (!value) return 'Belum ditentukan';
  const date = new Date(value);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return Number.isNaN(date.getTime()) ? 'Belum ditentukan' : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone });
}

function isPastInvitation(row: InvitationRow, startOfToday: number) {
  if (['COMPLETED', 'CANCELLED'].includes(row.gathering_status)) return true;
  if (row.registration_status === 'CANCELLED' || row.payment_status === 'REFUNDED') return true;
  if (row.gathering_status === 'IN_PROGRESS') return false;
  return Boolean(row.event_date && new Date(row.event_date).getTime() < startOfToday);
}

function noneLabel(row: InvitationRow) {
  if (row.gathering_status === 'CANCELLED' || row.registration_status === 'CANCELLED') return 'Dibatalkan';
  if (row.payment_status === 'REFUNDED') return 'Direfund';
  if (row.payment_status === 'PAID' && !row.is_attendee) return 'Lunas · dibayar oleh Anda';
  return STATUS_LABELS[row.gathering_status] ?? row.gathering_status;
}

function useJson<T>(url: string, unauthorizedMessage: string, fallbackMessage: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetch(url, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as T[] | { message?: string } | null;
        if (response.status === 401) throw new Error(unauthorizedMessage);
        if (!response.ok) throw new Error((payload as { message?: string } | null)?.message || fallbackMessage);
        return Array.isArray(payload) ? payload : [];
      })
      .then((rows) => { if (!cancelled) setData(rows); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : fallbackMessage); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fallbackMessage, unauthorizedMessage, url]);

  return { data, loading, error };
}

function StatusLine({ loading, error, loadingText }: { loading: boolean; error: string; loadingText: string }) {
  if (loading) return <p className="border-y py-8 text-sm" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}>{loadingText}</p>;
  if (error) return <p role="alert" className="border-y py-5 text-sm text-red-700" style={{ borderColor: 'var(--brand-border)' }}>{error}</p>;
  return null;
}

function PlansTab({ basePath, plans, loading, error }: { basePath: string; plans: PlanRow[]; loading: boolean; error: string }) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const selectedTab = CALENDAR_TABS.find((tab) => tab.key === activeTab) ?? CALENDAR_TABS[0];
  const filteredPlans = plans.filter(selectedTab.matches);

  return (
    <>
      <nav className="mb-5 flex gap-2 overflow-x-auto pb-1" aria-label="Filter status rencana">
        {CALENDAR_TABS.map((tab) => {
          const selected = activeTab === tab.key;
          const count = plans.filter(tab.matches).length;
          return (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} aria-pressed={selected} className="flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium" style={{ borderColor: selected ? 'var(--brand-accent)' : 'var(--brand-border)', color: selected ? 'var(--brand-text)' : 'var(--brand-muted)' }}>
              {tab.label}<span>{count}</span>
            </button>
          );
        })}
      </nav>

      <StatusLine loading={loading} error={error} loadingText="Memuat rencana acara…" />
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
    </>
  );
}

function InvitationCard({ basePath, row }: { basePath: string; row: InvitationRow }) {
  const copy = ACTION_COPY[row.action];
  const label = row.action === 'NONE' ? noneLabel(row) : copy.label;
  const primary = NEEDS_ATTENTION.includes(row.action) || row.action === 'TICKET';
  return (
    <article className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{row.gathering_title}</h3>
          {row.kind === 'INVITATION' ? (
            <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}>Undangan baru</span>
          ) : null}
        </div>
        <p className="mt-1 text-sm" style={{ color: 'var(--brand-muted)' }}>
          {formatDate(row.event_date)}{row.event_location ? ` · ${row.event_location}` : ''}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>
          Diundang oleh {row.initiator_name} · {row.plan_number}
          {!row.is_attendee && row.attendee_name ? ` · Seat untuk ${row.attendee_name}` : ''}
        </p>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        {label ? <span className="text-xs font-medium" style={{ color: row.action === 'ATTENDED' ? 'var(--brand-accent)' : 'var(--brand-muted)' }}>{label}</span> : null}
        {copy.button && row.action_path ? (
          <Link
            href={`${basePath}${row.action_path}`}
            className="inline-flex w-fit items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold"
            style={primary
              ? { backgroundColor: 'var(--brand-accent)', borderColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }
              : { borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}
          >
            {copy.button}
          </Link>
        ) : null}
        {row.action === 'NONE' && row.action_path ? (
          <Link href={`${basePath}${row.action_path}`} className="text-xs font-semibold underline" style={{ color: 'var(--brand-text)' }}>Lihat tagihan</Link>
        ) : null}
      </div>
    </article>
  );
}

function InvitationSection({ title, hint, rows, basePath }: { title: string; hint: string; rows: InvitationRow[]; basePath: string }) {
  if (!rows.length) return null;
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-muted)' }}>{title} <span className="font-normal">({rows.length})</span></h2>
      <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>{hint}</p>
      <div className="flex flex-col divide-y" style={{ borderColor: 'var(--brand-border)' }}>
        {rows.map((row) => <InvitationCard key={`${row.kind}-${row.id}`} basePath={basePath} row={row} />)}
      </div>
    </section>
  );
}

function InvitationsTab({ basePath, rows, loading, error }: { basePath: string; rows: InvitationRow[]; loading: boolean; error: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfToday = today.getTime();
  const past = rows.filter((row) => isPastInvitation(row, startOfToday))
    .sort((a, b) => new Date(b.event_date ?? 0).getTime() - new Date(a.event_date ?? 0).getTime());
  const active = rows.filter((row) => !isPastInvitation(row, startOfToday));
  // API sudah mengurutkan tanggal acara naik; yang tanpa tanggal dipisah.
  const upcoming = active.filter((row) => row.event_date);
  const unscheduled = active.filter((row) => !row.event_date);

  return (
    <>
      <StatusLine loading={loading} error={error} loadingText="Memuat undangan…" />
      {!loading && !error && rows.length === 0 ? (
        <section className="border-y py-10 text-center">
          <h2 className="text-lg font-semibold">Belum ada undangan</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--brand-muted)' }}>Undangan acara yang dikirim ke email akun Anda akan muncul di sini, lengkap dengan tagihan dan tiket masuk.</p>
        </section>
      ) : null}
      <InvitationSection title="Akan datang" hint="Diurutkan dari acara terdekat." rows={upcoming} basePath={basePath} />
      <InvitationSection title="Belum dijadwalkan" hint="Masih dalam tahap RSVP atau voting; tanggal final belum ditentukan." rows={unscheduled} basePath={basePath} />
      {past.length ? (
        <details className="mb-8">
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-muted)' }}>Sudah lewat ({past.length})</summary>
          <div className="flex flex-col divide-y" style={{ borderColor: 'var(--brand-border)' }}>
            {past.map((row) => <InvitationCard key={`${row.kind}-${row.id}`} basePath={basePath} row={row} />)}
          </div>
        </details>
      ) : null}
    </>
  );
}

export function GatheringCalendarContent({ basePath, websiteId }: { basePath: string; websiteId: string }) {
  const [mainTab, setMainTab] = useState<MainTab>('plans');
  const plans = useJson<PlanRow>(
    `/api/gathering/plans?website_id=${encodeURIComponent(websiteId)}`,
    'Silakan login untuk melihat rencana acara.',
    'Gagal memuat kalender acara.',
  );
  const invitations = useJson<InvitationRow>(
    `/api/gathering/invitations/mine?website_id=${encodeURIComponent(websiteId)}`,
    'Silakan login untuk melihat undangan acara.',
    'Gagal memuat undangan acara.',
  );

  // Tautan langsung ke tab undangan, mis. dari email: /calendar?tab=undangan
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'undangan') setMainTab('invitations');
  }, []);

  const attentionCount = invitations.data.filter((row) => NEEDS_ATTENTION.includes(row.action)).length;
  const mainTabs: Array<{ key: MainTab; label: string; badge?: number }> = [
    { key: 'plans', label: 'Rencana Saya' },
    { key: 'invitations', label: 'Undangan', badge: attentionCount },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--brand-accent-muted)' }}>Acara Anda</p>
        <h1 className="mt-1 text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>Kalender Acara</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--brand-muted)' }}>
          {mainTab === 'plans'
            ? 'Kelola rencana, peserta, voting, dan pembayaran seat acara yang Anda buat.'
            : 'Acara yang mengundang Anda: jawab undangan, bayar seat, dan buka tiket masuk.'}
        </p>
      </header>

      <div className="mb-6 flex border-b" role="tablist" aria-label="Kalender acara" style={{ borderColor: 'var(--brand-border)' }}>
        {mainTabs.map((tab) => {
          const selected = mainTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setMainTab(tab.key)}
              className="-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold"
              style={{ borderColor: selected ? 'var(--brand-accent)' : 'transparent', color: selected ? 'var(--brand-text)' : 'var(--brand-muted)' }}
            >
              {tab.label}
              {tab.badge ? (
                <span className="min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold" style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }} aria-label={`${tab.badge} perlu tindakan`}>
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {mainTab === 'plans'
        ? <PlansTab basePath={basePath} plans={plans.data} loading={plans.loading} error={plans.error} />
        : <InvitationsTab basePath={basePath} rows={invitations.data} loading={invitations.loading} error={invitations.error} />}
    </main>
  );
}
