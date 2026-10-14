'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface GatheringPlanOption {
  product_option_id: string;
  option_group_key: string;
  option_key: string;
  label: string;
  description?: string | null;
  venue_location?: string | null;
}

function toLocalParts(value?: string | null) {
  if (!value) return { date: '', time: '00:00' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '', time: '00:00' };
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  const localValue = local.toISOString();
  return { date: localValue.slice(0, 10), time: localValue.slice(11, 16) };
}

function toIso(date: string, time: string) {
  return date ? new Date(`${date}T${time || '00:00'}`).toISOString() : undefined;
}

export function GatheringPlanControls({
  groupId,
  websiteId,
  initialTitle,
  initialInvitePolicy,
  options,
  initialOpenedOptionIds,
  initialReservationDeadline,
  initialPaymentDeadline,
  initialEventAt,
  canCancel = false,
  cancelling = false,
  onCancel,
}: {
  groupId: string;
  websiteId: string;
  initialTitle: string;
  initialInvitePolicy: 'OPEN' | 'INVITE_ONLY';
  options: GatheringPlanOption[];
  initialOpenedOptionIds: string[];
  initialReservationDeadline?: string | null;
  initialPaymentDeadline?: string | null;
  initialEventAt?: string | null;
  canCancel?: boolean;
  cancelling?: boolean;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [invitePolicy, setInvitePolicy] = useState(initialInvitePolicy);
  const [openedOptionIds, setOpenedOptionIds] = useState(() => new Set(initialOpenedOptionIds));
  const [initialReservation] = useState(() => toLocalParts(initialReservationDeadline));
  const [initialPayment] = useState(() => toLocalParts(initialPaymentDeadline));
  const [initialEvent] = useState(() => toLocalParts(initialEventAt));
  const [reservationDate, setReservationDate] = useState(initialReservation.date);
  const [reservationTime, setReservationTime] = useState(initialReservation.time);
  const [paymentDate, setPaymentDate] = useState(initialPayment.date);
  const [paymentTime, setPaymentTime] = useState(initialPayment.time);
  const [eventDate, setEventDate] = useState(initialEvent.date);
  const [eventTime, setEventTime] = useState(initialEvent.time);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const optionsByGroup = new Map<string, GatheringPlanOption[]>();
  for (const option of options) {
    const groupOptions = optionsByGroup.get(option.option_group_key) ?? [];
    groupOptions.push(option);
    optionsByGroup.set(option.option_group_key, groupOptions);
  }

  function toggleOption(optionId: string) {
    setOpenedOptionIds((current) => {
      const next = new Set(current);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
    setSaved(false);
  }

  async function savePlan(submitPlan: boolean) {
    if (saving) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const response = await fetch(`/api/gathering/plans/${encodeURIComponent(groupId)}?website_id=${encodeURIComponent(websiteId)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          invite_policy: invitePolicy,
          opened_option_ids: [...openedOptionIds],
          reservation_deadline: toIso(reservationDate, reservationTime),
          payment_deadline: toIso(paymentDate, paymentTime),
          event_at: toIso(eventDate, eventTime),
          ...(submitPlan ? { submit_plan: true } : {}),
        }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || 'Gagal menyimpan rencana gathering.');
      setSaved(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan rencana gathering.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 border-y py-6" style={{ borderColor: 'var(--brand-border)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>1. Atur rencana</h2>
          <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>Tetapkan batas reservasi, pembayaran, tanggal acara, dan pilihan yang akan dibuka.</p>
        </div>
        <span className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}>Belum RSVP</span>
      </div>

      <label className="mt-5 block text-sm font-medium" htmlFor="gathering-plan-title">Nama rencana</label>
      <input
        id="gathering-plan-title"
        value={title}
        onChange={(event) => { setTitle(event.target.value); setSaved(false); }}
        maxLength={255}
        className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]"
        style={{ borderColor: 'var(--brand-border)' }}
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <fieldset className="space-y-2 text-xs font-medium">
          <legend>Terakhir reservasi</legend>
          <input aria-label="Tanggal terakhir reservasi" type="date" required value={reservationDate} onChange={(event) => { setReservationDate(event.target.value); setSaved(false); }} className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm" style={{ borderColor: 'var(--brand-border)' }} />
          <input aria-label="Jam terakhir reservasi" type="time" value={reservationTime} onChange={(event) => { setReservationTime(event.target.value || '00:00'); setSaved(false); }} className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm" style={{ borderColor: 'var(--brand-border)' }} />
        </fieldset>
        <fieldset className="space-y-2 text-xs font-medium">
          <legend>Terakhir pembayaran</legend>
          <input aria-label="Tanggal terakhir pembayaran" type="date" required value={paymentDate} onChange={(event) => { setPaymentDate(event.target.value); setSaved(false); }} className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm" style={{ borderColor: 'var(--brand-border)' }} />
          <input aria-label="Jam terakhir pembayaran" type="time" value={paymentTime} onChange={(event) => { setPaymentTime(event.target.value || '00:00'); setSaved(false); }} className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm" style={{ borderColor: 'var(--brand-border)' }} />
        </fieldset>
        <fieldset className="space-y-2 text-xs font-medium">
          <legend>Tanggal acara</legend>
          <input aria-label="Tanggal acara" type="date" required value={eventDate} onChange={(event) => { setEventDate(event.target.value); setSaved(false); }} className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm" style={{ borderColor: 'var(--brand-border)' }} />
          <input aria-label="Jam acara" type="time" value={eventTime} onChange={(event) => { setEventTime(event.target.value || '00:00'); setSaved(false); }} className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm" style={{ borderColor: 'var(--brand-border)' }} />
        </fieldset>
      </div>

      <label className="mt-5 block text-sm font-medium" htmlFor="gathering-invite-policy">Akses undangan</label>
      <select
        id="gathering-invite-policy"
        value={invitePolicy}
        onChange={(event) => { setInvitePolicy(event.target.value as 'OPEN' | 'INVITE_ONLY'); setSaved(false); }}
        className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)] sm:max-w-sm"
        style={{ borderColor: 'var(--brand-border)' }}
      >
        <option value="OPEN">Terbuka</option>
        <option value="INVITE_ONLY">Khusus undangan</option>
      </select>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium">Pilihan yang dibuka</legend>
        <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>Pilihan bersumber dari produk gathering dan tidak mengubah harga per peserta.</p>
        <div className="mt-4 space-y-5">
          {[...optionsByGroup.entries()].map(([groupKey, groupOptions]) => (
            <div key={groupKey}>
              <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>{groupKey}</h3>
              <ul className="mt-2 divide-y border-y" style={{ borderColor: 'var(--brand-border)' }}>
                {groupOptions.map((option) => (
                  <li key={option.product_option_id}>
                    <label className="flex cursor-pointer items-start gap-3 py-3">
                      <input
                        type="checkbox"
                        checked={openedOptionIds.has(option.product_option_id)}
                        onChange={() => toggleOption(option.product_option_id)}
                        className="mt-0.5 h-4 w-4 accent-[var(--brand-accent)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{option.label}</span>
                        {(option.description || option.venue_location) && (
                          <span className="mt-1 block text-xs" style={{ color: 'var(--brand-muted)' }}>
                            {[option.venue_location, option.description].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </fieldset>

      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {saved && <p role="status" className="mt-4 text-sm text-green-700">Perubahan rencana tersimpan.</p>}
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => void savePlan(false)} disabled={saving || title.trim().length < 3} className="rounded-full border px-6 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ borderColor: 'var(--brand-border)' }}>
          {saving ? 'Menyimpan…' : 'Simpan'}
        </button>
        <button type="button" onClick={() => void savePlan(true)} disabled={saving || title.trim().length < 3 || !reservationDate || !paymentDate || !eventDate} className="rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}>
          {saving ? 'Mengirim…' : 'Submit rencana'}
        </button>
        {canCancel && onCancel ? (
          <button type="button" onClick={onCancel} disabled={saving || cancelling} className="rounded-full border border-red-500 px-6 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50">
            {cancelling ? 'Membatalkan…' : 'Batalkan rencana'}
          </button>
        ) : null}
      </div>
    </section>
  );
}
