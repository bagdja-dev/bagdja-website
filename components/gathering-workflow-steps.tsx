'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useRouter } from 'next/navigation';
import { GatheringInvitationManager } from './gathering-invitation-manager';
import { GatheringPlanControls } from './gathering-plan-controls';
import type { GatheringPlanDetail } from './order-detail-content';

const STEPS = [
  { key: 'PLAN', label: 'Atur rencana' },
  { key: 'INVITATIONS', label: 'Buat undangan' },
  { key: 'INVITATION_CONFIRMATION', label: 'Konfirmasi undangan' },
  { key: 'PAYMENT_CONFIRMATION', label: 'Konfirmasi pembayaran' },
] as const;

interface InvitationHistoryRow {
  id: string;
  invitee_name: string | null;
  email: string | null;
  whatsapp: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expires_at: string;
}

interface RegistrationRow {
  id: string;
  attendee_name: string;
  email: string;
  whatsapp: string | null;
  selected_options: Record<string, string>;
  selected_option_details?: Array<{
    option_group_key: string;
    option_key: string;
    label: string;
    description: string | null;
    venue_location: string | null;
  }>;
  registration_status: string;
  payment_status: string;
  rejection_message?: string | null;
  order_id?: string | null;
  created_at?: string;
}

type GatheringOptionSnapshot = GatheringPlanDetail['occurrence']['option_groups_snapshot'][number];

function formatDate(value?: string | null) {
  if (!value) return 'Belum ditentukan';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Belum ditentukan' : date.toLocaleString('id-ID');
}

function ReadOnlyPlan({ plan }: { plan: GatheringPlanDetail }) {
  const occurrence = plan.occurrence;
  const openedOptionIds = new Set(occurrence.opened_option_ids_snapshot ?? []);
  const openedOptions = occurrence.option_groups_snapshot.filter((option) => openedOptionIds.has(option.product_option_id));

  return (
    <section className="mt-8 border-y py-6" style={{ borderColor: 'var(--brand-border)' }}>
      <h2 className="text-sm font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>1. Atur rencana</h2>
      <dl className="mt-4 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
        <div><dt style={{ color: 'var(--brand-muted)' }}>Nama rencana</dt><dd className="mt-1 font-medium">{plan.title}</dd></div>
        <div><dt style={{ color: 'var(--brand-muted)' }}>Akses undangan</dt><dd className="mt-1 font-medium">{plan.invite_policy === 'INVITE_ONLY' ? 'Khusus undangan' : 'Terbuka'}</dd></div>
        <div><dt style={{ color: 'var(--brand-muted)' }}>Terakhir reservasi</dt><dd className="mt-1 font-medium">{formatDate(occurrence.rsvp_close_at)}</dd></div>
        <div><dt style={{ color: 'var(--brand-muted)' }}>Terakhir pembayaran</dt><dd className="mt-1 font-medium">{formatDate(occurrence.payment_deadline)}</dd></div>
        <div><dt style={{ color: 'var(--brand-muted)' }}>Tanggal acara</dt><dd className="mt-1 font-medium">{formatDate(occurrence.final_schedule)}</dd></div>
      </dl>
      <h3 className="mt-6 text-sm font-semibold">Pilihan yang dibuka</h3>
      {openedOptions.length ? (
        <ul className="mt-2 divide-y border-y" style={{ borderColor: 'var(--brand-border)' }}>
          {openedOptions.map((option) => (
            <li key={option.product_option_id} className="py-3">
              <p className="text-sm font-medium">{option.label}</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>
                {[option.option_group_key, option.venue_location, option.description].filter(Boolean).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-sm" style={{ color: 'var(--brand-muted)' }}>Belum ada pilihan yang dibuka.</p>}
      <p className="mt-4 text-xs" style={{ color: 'var(--brand-muted)' }}>Tampilan baca saja untuk tahap yang sudah dilewati.</p>
    </section>
  );
}

function ReadOnlyInvitationHistory({
  groupId,
  websiteId,
  basePath,
  invitePolicy,
  options = [],
  includeRegistrations = false,
  canConfirmReservations = false,
  minAttendees = 0,
  paymentDeadline,
  stageNumber = 2,
  canConfirmEvent = false,
}: {
  groupId: string;
  websiteId: string;
  basePath: string;
  invitePolicy: 'OPEN' | 'INVITE_ONLY';
  options?: GatheringOptionSnapshot[];
  includeRegistrations?: boolean;
  canConfirmReservations?: boolean;
  minAttendees?: number;
  paymentDeadline?: string | null;
  stageNumber?: 2 | 3 | 4;
  canConfirmEvent?: boolean;
}) {
  const router = useRouter();
  const [invitations, setInvitations] = useState<InvitationHistoryRow[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState<string[]>([]);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [viewingRegistrationId, setViewingRegistrationId] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/gathering/plans/${encodeURIComponent(groupId)}/invitations?website_id=${encodeURIComponent(websiteId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as InvitationHistoryRow[] | { message?: string } | null;
        if (!response.ok) throw new Error((payload as { message?: string } | null)?.message || 'Gagal memuat daftar undangan.');
        if (!cancelled) setInvitations(Array.isArray(payload) ? payload : []);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Gagal memuat daftar undangan.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [groupId, websiteId]);

  useEffect(() => {
    if (!includeRegistrations) return;
    let cancelled = false;
    void fetch(`/api/gathering/plans/${encodeURIComponent(groupId)}/registrations?website_id=${encodeURIComponent(websiteId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as RegistrationRow[] | { message?: string } | null;
        if (!response.ok) throw new Error((payload as { message?: string } | null)?.message || 'Gagal memuat daftar peserta.');
        if (!cancelled) setRegistrations(Array.isArray(payload) ? payload : []);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Gagal memuat daftar peserta.');
      });
    return () => { cancelled = true; };
  }, [groupId, websiteId, includeRegistrations]);

  useEffect(() => {
    let cancelled = false;
    if (!shareUrl) {
      setQrDataUrl('');
      return;
    }
    void QRCode.toDataURL(shareUrl, { width: 220, margin: 1 })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(''); });
    return () => { cancelled = true; };
  }, [shareUrl]);

  async function copyPublicLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function confirmReservations() {
    const activeCount = registrations.filter((registration) => registration.registration_status === 'RSVP_CONFIRMED').length;
    if (confirming || activeCount < minAttendees) return;
    setConfirming(true);
    setError('');
    try {
      const response = await fetch(`/api/gathering/plans/${encodeURIComponent(groupId)}/confirm-reservations?website_id=${encodeURIComponent(websiteId)}`, { method: 'POST' });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || 'Gagal membuka pembayaran peserta.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal membuka pembayaran peserta.');
    } finally {
      setConfirming(false);
    }
  }

  async function rejectSelectedRegistrations(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = rejectionMessage.trim();
    if (rejecting || !selectedRegistrationIds.length || !message) return;
    setRejecting(true);
    setError('');
    try {
      const response = await fetch(`/api/gathering/plans/${encodeURIComponent(groupId)}/registrations/reject?website_id=${encodeURIComponent(websiteId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_ids: selectedRegistrationIds, message }),
      });
      const payload = await response.json().catch(() => null) as { rejected_count?: number; email_failed_count?: number; failed_emails?: string[]; message?: string } | null;
      if (!response.ok || payload?.rejected_count === undefined) throw new Error(payload?.message || 'Gagal menolak reservasi.');
      const rejectedIds = new Set(selectedRegistrationIds);
      setRegistrations((current) => current.map((registration) => rejectedIds.has(registration.id)
        ? { ...registration, registration_status: 'REJECTED', rejection_message: message }
        : registration));
      setSelectedRegistrationIds([]);
      setRejectionMessage('');
      setShowRejectDialog(false);
      if (payload.email_failed_count) {
        setError(`Sebanyak ${payload.rejected_count} reservasi ditolak, tetapi ${payload.email_failed_count} email gagal dikirim: ${(payload.failed_emails ?? []).join(', ')}.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menolak reservasi.');
    } finally {
      setRejecting(false);
    }
  }

  function canRejectRegistration(registration: RegistrationRow) {
    return canConfirmReservations
      && registration.registration_status === 'RSVP_CONFIRMED'
      && registration.payment_status === 'UNPAID'
      && !registration.order_id;
  }

  const rejectableRegistrations = registrations.filter(canRejectRegistration);
  const activeRegistrations = registrations.filter((registration) => registration.registration_status === 'RSVP_CONFIRMED');
  const optionGroups = new Map<string, GatheringOptionSnapshot[]>();
  options.forEach((option) => optionGroups.set(option.option_group_key, [...(optionGroups.get(option.option_group_key) ?? []), option]));

  async function confirmEvent() {
    const paidSeats = registrations.filter((registration) => registration.payment_status === 'PAID').length;
    if (finalizing || paidSeats < minAttendees) return;
    setFinalizing(true);
    setError('');
    try {
      const response = await fetch(`/api/gathering/plans/${encodeURIComponent(groupId)}/confirm-event?website_id=${encodeURIComponent(websiteId)}`, { method: 'POST' });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || 'Gagal mengonfirmasi acara.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mengonfirmasi acara.');
    } finally {
      setFinalizing(false);
    }
  }

  const publicInvitation = invitations.find((invitation) => !invitation.email && !invitation.whatsapp);
  const publicInvitationId = publicInvitation?.id;

  useEffect(() => {
    if (invitePolicy !== 'OPEN' || !publicInvitationId) return;
    const path = `${basePath}/gathering/invite/${encodeURIComponent(publicInvitationId)}`;
    setShareUrl(`${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`);
  }, [basePath, invitePolicy, publicInvitationId]);

  function statusLabel(invitation: InvitationHistoryRow) {
    if (invitation.status === 'PENDING' && new Date(invitation.expires_at) <= new Date()) return 'Kedaluwarsa';
    if (invitation.status === 'PENDING') return 'Belum RSVP';
    if (invitation.status === 'ACCEPTED') return 'Diterima';
    if (invitation.status === 'REVOKED') return 'Dicabut';
    return 'Kedaluwarsa';
  }

  return (
    <section className="mt-8 border-y py-6" style={{ borderColor: 'var(--brand-border)' }}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>{stageNumber === 3 ? '3. Konfirmasi undangan' : stageNumber === 4 ? '4. Konfirmasi pembayaran' : '2. Buat undangan'}</h2>
          <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>{includeRegistrations ? (canConfirmReservations ? 'Ringkasan undangan dan RSVP peserta.' : `Status order seat peserta. Batas pembayaran: ${formatDate(paymentDeadline)}`) : 'Riwayat undangan, hanya baca.'}</p>
        </div>
        {!loading && <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>{invitations.length} undangan</span>}
      </div>
      {loading ? <p className="mt-4 text-sm" style={{ color: 'var(--brand-muted)' }}>Memuat undangan…</p> : null}
      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
      {invitePolicy === 'OPEN' ? (
        <div className="mt-4 border-y py-4" style={{ borderColor: 'var(--brand-border)' }}>
          <p className="text-sm font-medium">Undangan terbuka</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>Link dan QR memakai ID undangan yang tersimpan dan tetap sama saat Anda berpindah tahap.</p>
          {!publicInvitation && !loading ? <p className="mt-3 text-sm" style={{ color: 'var(--brand-muted)' }}>Belum ada undangan publik yang bisa ditautkan.</p> : null}
          {shareUrl ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center">
              <div className="flex min-h-40 items-center justify-center border p-2" style={{ borderColor: 'var(--brand-border)' }}>
                {qrDataUrl ? <img src={qrDataUrl} alt="QR undangan terbuka" className="h-36 w-36 bg-white p-1" /> : <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>Memuat QR…</span>}
              </div>
              <div className="min-w-0">
                <label className="text-[11px] uppercase" style={{ color: 'var(--brand-muted)' }}>Link undangan</label>
                <input readOnly value={shareUrl} onClick={(event) => event.currentTarget.select()} aria-label="Link undangan terbuka" className="mt-1 w-full min-w-0 rounded border bg-transparent px-2 py-2 text-xs" style={{ borderColor: 'var(--brand-border)' }} />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void copyPublicLink()} className="rounded border px-3 py-2 text-xs font-semibold" style={{ borderColor: 'var(--brand-border)' }}>{copied ? 'Tersalin' : 'Salin link'}</button>
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="rounded border px-3 py-2 text-xs font-semibold" style={{ borderColor: 'var(--brand-border)' }}>Buka link</a>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {!loading && !error && invitations.length === 0 ? <p className="mt-4 text-sm" style={{ color: 'var(--brand-muted)' }}>Belum ada undangan.</p> : null}
      {invitePolicy === 'INVITE_ONLY' && invitations.length > 0 ? (
        <ul className="mt-4 divide-y border-y" style={{ borderColor: 'var(--brand-border)' }}>
          {invitations.map((invitation) => (
            <li key={invitation.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:gap-4">
              <span className="font-medium">{invitation.invitee_name || invitation.email || invitation.whatsapp || 'Undangan'}</span>
              <span style={{ color: 'var(--brand-muted)' }}>{[invitation.email, invitation.whatsapp].filter(Boolean).join(' · ') || '-'}</span>
              <span className="flex items-center gap-3 text-xs" style={{ color: 'var(--brand-muted)' }}>
                {statusLabel(invitation)}
                <a href={`${basePath}/gathering/invite/id/${encodeURIComponent(invitation.id)}`} className="font-semibold underline">Buka /id</a>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {includeRegistrations ? (
        <section className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">Daftar peserta</h3>
            <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>
              {stageNumber === 4
                ? `${registrations.filter((registration) => registration.payment_status === 'PAID' && registration.registration_status === 'RSVP_CONFIRMED').length} seat lunas / minimum ${minAttendees}`
                  : `${activeRegistrations.length} RSVP aktif`}
            </span>
          </div>
            {canConfirmReservations && rejectableRegistrations.length ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-y py-3" style={{ borderColor: 'var(--brand-border)' }}>
                <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--brand-muted)' }}>
                  <input
                    type="checkbox"
                    checked={selectedRegistrationIds.length === rejectableRegistrations.length}
                    onChange={(event) => setSelectedRegistrationIds(event.target.checked ? rejectableRegistrations.map((registration) => registration.id) : [])}
                    className="h-4 w-4 accent-current"
                  />
                  Pilih semua reservasi yang memenuhi syarat
                </label>
                {selectedRegistrationIds.length ? (
                  <button type="button" onClick={() => setShowRejectDialog(true)} className="rounded border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                    Tolak {selectedRegistrationIds.length} reservasi
                  </button>
                ) : null}
              </div>
            ) : null}
          {registrations.length ? (
            <ul className="mt-3 divide-y border-y" style={{ borderColor: 'var(--brand-border)' }}>
              {registrations.map((registration) => (
                <li key={registration.id} className="flex flex-col gap-3 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    {canRejectRegistration(registration) ? (
                      <input
                        type="checkbox"
                        aria-label={`Pilih reservasi ${registration.attendee_name}`}
                        checked={selectedRegistrationIds.includes(registration.id)}
                        onChange={(event) => setSelectedRegistrationIds((current) => event.target.checked
                          ? [...current, registration.id]
                          : current.filter((id) => id !== registration.id))}
                        className="h-4 w-4 shrink-0 accent-current"
                      />
                    ) : <span className="w-4 shrink-0" />}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{registration.attendee_name}</p>
                      <p className="mt-1 text-xs" style={{ color: registration.registration_status === 'REJECTED' ? '#b91c1c' : 'var(--brand-muted)' }}>
                        {registration.registration_status === 'REJECTED' ? 'Ditolak' : registration.registration_status === 'CANCELLED' ? 'Dibatalkan' : registration.payment_status === 'PAID' ? 'Lunas' : registration.payment_status === 'PENDING_PAYMENT' ? 'Menunggu pembayaran' : 'Belum dibayar'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
                    {canRejectRegistration(registration) ? (
                      <button type="button" onClick={() => { setSelectedRegistrationIds([registration.id]); setShowRejectDialog(true); }} className="rounded border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                        Tolak
                      </button>
                    ) : null}
                    <button type="button" onClick={() => setViewingRegistrationId(registration.id)} className="rounded border px-3 py-2 text-xs font-semibold" style={{ borderColor: 'var(--brand-border)' }}>
                      Lihat
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm" style={{ color: 'var(--brand-muted)' }}>Belum ada peserta yang mengirim RSVP.</p>}
          {options.length ? (
            <details className="mt-4 border-y" style={{ borderColor: 'var(--brand-border)' }}>
              <summary className="cursor-pointer py-3 text-sm font-semibold">Ringkasan pilihan peserta <span className="ml-1 text-xs font-normal" style={{ color: 'var(--brand-muted)' }}>{optionGroups.size} kategori</span></summary>
              <div className="grid gap-x-6 gap-y-5 pb-4 sm:grid-cols-2" aria-label="Statistik pilihan peserta">
                {[...optionGroups.entries()].map(([groupKey, groupOptions]) => (
                  <div key={groupKey}>
                    <h5 className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>{groupKey}</h5>
                    <ul className="mt-2 space-y-3">
                      {groupOptions.map((option) => {
                        const count = activeRegistrations.filter((registration) => registration.selected_options?.[groupKey] === option.product_option_id).length;
                        const percentage = activeRegistrations.length ? Math.round((count / activeRegistrations.length) * 100) : 0;
                        return (
                          <li key={option.product_option_id}>
                            <div className="flex items-baseline justify-between gap-3 text-xs">
                              <span className="min-w-0 font-medium">{option.label}</span>
                              <span className="shrink-0 tabular-nums" style={{ color: 'var(--brand-muted)' }}>{count} peserta · {percentage}%</span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden bg-zinc-100" role="progressbar" aria-label={`${option.label}: ${count} peserta, ${percentage}%`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
                              <div className="h-full transition-[width]" style={{ width: `${percentage}%`, backgroundColor: 'var(--brand-accent)' }} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
          {viewingRegistrationId ? (() => {
            const registration = registrations.find((item) => item.id === viewingRegistrationId);
            if (!registration) return null;
            const status = registration.registration_status === 'REJECTED'
              ? 'Ditolak'
              : registration.registration_status === 'CANCELLED'
                ? 'Dibatalkan'
                : registration.payment_status === 'PAID'
                  ? 'Lunas'
                  : registration.payment_status === 'PENDING_PAYMENT'
                    ? 'Menunggu pembayaran'
                    : 'Belum dibayar';
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewingRegistrationId(''); }}>
                <section role="dialog" aria-modal="true" aria-labelledby="registration-detail-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto border bg-white p-5 text-zinc-900 shadow-xl sm:p-6" style={{ borderColor: 'var(--brand-border)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 id="registration-detail-title" className="text-base font-semibold">Detail peserta</h3>
                      <p className="mt-1 text-sm text-zinc-600">{registration.attendee_name}</p>
                    </div>
                    <button type="button" onClick={() => setViewingRegistrationId('')} aria-label="Tutup detail peserta" className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-semibold">Tutup</button>
                  </div>
                  <dl className="mt-5 grid gap-4 border-y border-zinc-200 py-4 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs text-zinc-500">Status</dt><dd className="mt-1 font-medium">{status}</dd></div>
                    <div><dt className="text-xs text-zinc-500">Email</dt><dd className="mt-1 break-all font-medium">{registration.email}</dd></div>
                    <div><dt className="text-xs text-zinc-500">WhatsApp</dt><dd className="mt-1 font-medium">{registration.whatsapp || 'Tidak diisi'}</dd></div>
                    {registration.created_at ? <div><dt className="text-xs text-zinc-500">Waktu reservasi</dt><dd className="mt-1 font-medium">{formatDate(registration.created_at)}</dd></div> : null}
                  </dl>
                  <section className="mt-5">
                    <h4 className="text-sm font-semibold">Opsi yang dipilih</h4>
                    {registration.selected_option_details?.length ? (
                      <ul className="mt-2 divide-y border-y border-zinc-200">
                        {registration.selected_option_details.map((option, index) => (
                          <li key={`${option.option_group_key}-${index}`} className="py-3">
                            <p className="text-xs text-zinc-500">{option.option_group_key}</p>
                            <p className="mt-1 text-sm font-medium">{option.label}</p>
                            {option.venue_location ? <p className="mt-1 text-xs text-zinc-600">{option.venue_location}</p> : null}
                            {option.description ? <p className="mt-1 text-xs text-zinc-600">{option.description}</p> : null}
                          </li>
                        ))}
                      </ul>
                    ) : <p className="mt-2 text-sm text-zinc-600">Tidak ada opsi pilihan.</p>}
                  </section>
                  {registration.registration_status === 'REJECTED' ? (
                    <section className="mt-5 border-t border-zinc-200 pt-4">
                      <h4 className="text-sm font-semibold text-red-700">Pesan penolakan</h4>
                      <p className="mt-2 whitespace-pre-line text-sm text-zinc-700">{registration.rejection_message || 'Pesan penolakan tidak tersedia.'}</p>
                    </section>
                  ) : null}
                </section>
              </div>
            );
          })() : null}
          {canConfirmReservations ? (
            <div className="mt-5">
              <button type="button" onClick={() => void confirmReservations()} disabled={confirming || activeRegistrations.length === 0} className="rounded-full px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}>
                {confirming ? 'Membuka pembayaran…' : 'Tutup RSVP & buka pembayaran'}
              </button>
              {activeRegistrations.length === 0 ? <p className="mt-2 text-xs" style={{ color: 'var(--brand-muted)' }}>Setidaknya satu RSVP aktif diperlukan sebelum pembayaran seat dibuka.</p> : <p className="mt-2 text-xs" style={{ color: 'var(--brand-muted)' }}>Batas minimum dihitung dari seat yang telah dibayar, bukan jumlah RSVP.</p>}
            </div>
          ) : canConfirmEvent ? (
            <div className="mt-5">
              <button type="button" onClick={() => void confirmEvent()} disabled={finalizing || registrations.filter((registration) => registration.payment_status === 'PAID').length < minAttendees} className="rounded-full px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}>
                {finalizing ? 'Mengonfirmasi acara…' : 'Konfirmasi acara & selesaikan escrow'}
              </button>
              {registrations.filter((registration) => registration.payment_status === 'PAID').length < minAttendees ? <p className="mt-2 text-xs" style={{ color: 'var(--brand-muted)' }}>Minimum {minAttendees} seat lunas diperlukan.</p> : <p className="mt-2 text-xs" style={{ color: 'var(--brand-muted)' }}>Dana escrow seat peserta akan dilepas satu kali setelah konfirmasi.</p>}
            </div>
          ) : <p className="mt-4 text-xs" style={{ color: 'var(--brand-muted)' }}>Tampilan baca saja untuk tahap yang sudah dilewati.</p>}
          {showRejectDialog ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !rejecting) setShowRejectDialog(false); }}>
              <form onSubmit={rejectSelectedRegistrations} role="dialog" aria-modal="true" aria-labelledby="reject-reservations-title" className="w-full max-w-lg border bg-white p-5 text-zinc-900 shadow-xl sm:p-6" style={{ borderColor: 'var(--brand-border)' }}>
                <h3 id="reject-reservations-title" className="text-base font-semibold">Tolak dan hapus reservasi</h3>
                <p className="mt-2 text-sm text-zinc-600">{selectedRegistrationIds.length} reservasi akan ditandai ditolak. Pesan ini akan dikirim melalui email kepada setiap peserta.</p>
                <label htmlFor="rejection-message" className="mt-5 block text-sm font-medium">Pesan penolakan</label>
                <textarea id="rejection-message" required maxLength={2000} rows={5} value={rejectionMessage} onChange={(event) => setRejectionMessage(event.target.value)} className="mt-2 block w-full resize-y rounded border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-600 focus:outline-none" />
                <p className="mt-1 text-right text-xs text-zinc-500">{rejectionMessage.length}/2000</p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button type="button" disabled={rejecting} onClick={() => setShowRejectDialog(false)} className="rounded border border-zinc-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Batal</button>
                  <button type="submit" disabled={rejecting || !rejectionMessage.trim()} className="rounded bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{rejecting ? 'Memproses…' : 'Tolak reservasi & kirim email'}</button>
                </div>
              </form>
            </div>
          ) : null}
        </section>
      ) : <p className="mt-4 text-xs" style={{ color: 'var(--brand-muted)' }}>Tampilan baca saja untuk tahap yang sudah dilewati.</p>}
    </section>
  );
}

export function GatheringWorkflowSteps({
  plan,
  websiteId,
  basePath,
}: {
  plan: GatheringPlanDetail;
  websiteId: string;
  basePath: string;
}) {
  const workflowIndex = STEPS.findIndex((step) => step.key === plan.workflow_step);
  const currentIndex = plan.workflow_step === 'LOCKED'
    ? STEPS.length - 1
    : Math.max(0, workflowIndex);
  const [selectedIndex, setSelectedIndex] = useState(currentIndex);

  useEffect(() => setSelectedIndex(currentIndex), [currentIndex]);

  const occurrence = plan.occurrence;

  return (
    <>
      <ol className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Tahapan gathering">
        {STEPS.map((step, index) => {
          const complete = index < currentIndex;
          const active = index === selectedIndex;
          const available = index <= currentIndex;
          return (
            <li key={step.key} className="border-t-2" style={{ borderColor: active || complete ? 'var(--brand-accent)' : 'var(--brand-border)' }}>
              <button
                type="button"
                onClick={() => setSelectedIndex(index)}
                disabled={!available}
                aria-current={active ? 'step' : undefined}
                className="w-full py-2 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                style={{ color: active ? 'var(--brand-text)' : 'var(--brand-muted)' }}
              >
                <span className="mr-1">{complete ? '✓' : `${index + 1}.`}</span>{step.label}
              </button>
            </li>
          );
        })}
      </ol>

      {selectedIndex < currentIndex && selectedIndex === 0 ? <ReadOnlyPlan plan={plan} /> : null}
      {selectedIndex < currentIndex && selectedIndex === 1 ? <ReadOnlyInvitationHistory groupId={plan.id} websiteId={websiteId} basePath={basePath} invitePolicy={plan.invite_policy} /> : null}
      {selectedIndex === currentIndex && plan.workflow_step === 'PLAN' ? (
        <GatheringPlanControls
          groupId={plan.id}
          websiteId={websiteId}
          initialTitle={plan.title}
          initialInvitePolicy={plan.invite_policy}
          options={occurrence.option_groups_snapshot}
          initialOpenedOptionIds={occurrence.opened_option_ids_snapshot ?? []}
          initialReservationDeadline={occurrence.rsvp_close_at}
          initialPaymentDeadline={occurrence.payment_deadline}
          initialEventAt={occurrence.final_schedule}
        />
      ) : null}
      {selectedIndex === currentIndex && plan.workflow_step === 'INVITATIONS' ? (
        <GatheringInvitationManager groupId={plan.id} websiteId={websiteId} basePath={basePath} invitePolicy={plan.invite_policy} />
      ) : null}
      {selectedIndex === 2 && currentIndex >= 2 ? (
        <ReadOnlyInvitationHistory
          groupId={plan.id}
          websiteId={websiteId}
          basePath={basePath}
          invitePolicy={plan.invite_policy}
          options={occurrence.option_groups_snapshot.filter((option) => (occurrence.opened_option_ids_snapshot ?? []).includes(option.product_option_id))}
          includeRegistrations
          canConfirmReservations={selectedIndex === currentIndex && plan.workflow_step === 'INVITATION_CONFIRMATION'}
          minAttendees={occurrence.min_attendees}
          stageNumber={3}
        />
      ) : null}
      {selectedIndex === 3 && currentIndex >= 3 ? (
        <ReadOnlyInvitationHistory
          groupId={plan.id}
          websiteId={websiteId}
          basePath={basePath}
          invitePolicy={plan.invite_policy}
          options={occurrence.option_groups_snapshot.filter((option) => (occurrence.opened_option_ids_snapshot ?? []).includes(option.product_option_id))}
          includeRegistrations
          minAttendees={occurrence.min_attendees}
          paymentDeadline={occurrence.payment_deadline}
          stageNumber={4}
          canConfirmEvent={plan.workflow_step === 'PAYMENT_CONFIRMATION' && plan.status === 'PAYMENT_OPEN'}
        />
      ) : null}
    </>
  );
}