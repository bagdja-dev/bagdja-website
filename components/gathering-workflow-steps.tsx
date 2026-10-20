'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import QRCode from 'qrcode';
import { useRouter } from 'next/navigation';
import { GatheringInvitationManager } from './gathering-invitation-manager';
import { GatheringInvitationCard } from './gathering-invitation-card';
import { GatheringPlanControls } from './gathering-plan-controls';
import type { GatheringPlanDetail } from './order-detail-content';

const STEPS = [
  { key: 'PLAN', label: 'Atur rencana' },
  { key: 'INVITATIONS', label: 'Buat undangan' },
  { key: 'INVITATION_CONFIRMATION', label: 'Konfirmasi undangan' },
  { key: 'PAYMENT_CONFIRMATION', label: 'Konfirmasi pembayaran' },
] as const;

type WorkflowStep = GatheringPlanDetail['workflow_step'];

/** Urutan tahap — LOCKED dianggap setelah tahap terakhir. */
function workflowRank(step: WorkflowStep): number {
  return step === 'LOCKED' ? STEPS.length : STEPS.findIndex((item) => item.key === step);
}

interface PlanAdvance {
  workflow_step: WorkflowStep;
  status: string;
  occurrence_status: string;
}

interface InvitationHistoryRow {
  id: string;
  invitee_name: string | null;
  email: string | null;
  whatsapp: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expires_at: string;
}

type ParticipantFilter = 'ALL' | 'AWAITING' | 'UNPAID' | 'PENDING_PAYMENT' | 'PAID' | 'INACTIVE';

const PARTICIPANT_FILTERS: Array<{ key: ParticipantFilter; label: string }> = [
  { key: 'ALL', label: 'Semua' },
  { key: 'AWAITING', label: 'Belum RSVP' },
  { key: 'UNPAID', label: 'Belum dibayar' },
  { key: 'PENDING_PAYMENT', label: 'Menunggu pembayaran' },
  { key: 'PAID', label: 'Lunas' },
  { key: 'INACTIVE', label: 'Ditolak / batal / tidak aktif' },
];

function registrationFilterKey(registration: RegistrationRow): ParticipantFilter {
  if (registration.registration_status !== 'RSVP_CONFIRMED' || registration.payment_status === 'REFUNDED') return 'INACTIVE';
  if (registration.payment_status === 'PAID') return 'PAID';
  if (registration.payment_status === 'PENDING_PAYMENT') return 'PENDING_PAYMENT';
  return 'UNPAID';
}

function invitationFilterKey(invitation: InvitationHistoryRow): ParticipantFilter {
  return invitation.status === 'PENDING' && new Date(invitation.expires_at) > new Date() ? 'AWAITING' : 'INACTIVE';
}

function matchesParticipantQuery(query: string, ...values: Array<string | null | undefined>) {
  if (!query) return true;
  return values.some((value) => value?.toLowerCase().includes(query));
}

interface RegistrationRow {
  id: string;
  invitation_id?: string | null;
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
  invoice_amount?: number | string;
  rejection_message?: string | null;
  order_id?: string | null;
  created_at?: string;
}

interface GatheringOperationProgress {
  id: string;
  kind: 'INVOICE_ISSUANCE' | 'INVITATION_REVOCATION';
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  total_count: number;
  processed_count: number;
  success_count: number;
  failed_count: number;
  failed_items: string[];
  error_message: string | null;
}

type GatheringOptionSnapshot = GatheringPlanDetail['occurrence']['option_groups_snapshot'][number];

function formatDate(value?: string | null) {
  if (!value) return 'Belum ditentukan';
  const date = new Date(value);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return Number.isNaN(date.getTime()) ? 'Belum ditentukan' : date.toLocaleString('id-ID', { timeZone });
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
        <div><dt style={{ color: 'var(--brand-muted)' }}>Nomor rencana</dt><dd className="mt-1 font-medium">{plan.plan_number}</dd></div>
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
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{option.label}</p>
                {option.is_final_selection ? <span className="border px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ borderColor: 'var(--brand-accent)', color: 'var(--brand-accent-muted)' }}>Opsi final</span> : null}
              </div>
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
  maxAttendees = 0,
  depositAmountPerSeat = 0,
  votingResults = {},
  initialFinalSelections = {},
  paymentDeadline,
  stageNumber = 2,
  invitationPreview,
  canConfirmEvent = false,
  canCancelGathering = false,
  cancelling = false,
  onCancelGathering,
  onReservationsConfirmed,
}: {
  groupId: string;
  websiteId: string;
  basePath: string;
  invitePolicy: 'OPEN' | 'INVITE_ONLY';
  options?: GatheringOptionSnapshot[];
  includeRegistrations?: boolean;
  canConfirmReservations?: boolean;
  minAttendees?: number;
  maxAttendees?: number;
  depositAmountPerSeat?: number;
  votingResults?: Record<string, { total_votes: number; options: Record<string, { votes: number; percentage: number }> }>;
  initialFinalSelections?: Record<string, string>;
  paymentDeadline?: string | null;
  stageNumber?: 2 | 3 | 4;
  invitationPreview?: ReactNode;
  canConfirmEvent?: boolean;
  canCancelGathering?: boolean;
  cancelling?: boolean;
  onCancelGathering?: () => void;
  /** Dipanggil setelah RSVP ditutup — memajukan tahap langsung dari respons API tanpa menunggu router.refresh(). */
  onReservationsConfirmed?: (advance: PlanAdvance) => void;
}) {
  const router = useRouter();
  const [invitations, setInvitations] = useState<InvitationHistoryRow[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [participantQuery, setParticipantQuery] = useState('');
  const [participantFilter, setParticipantFilter] = useState<ParticipantFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [collectivePaying, setCollectivePaying] = useState(false);
  const [showCollectivePaymentDialog, setShowCollectivePaymentDialog] = useState(false);
  const [refundTarget, setRefundTarget] = useState<RegistrationRow | null>(null);
  const [refundingRegistrationId, setRefundingRegistrationId] = useState('');
  const [cancellingCheckoutId, setCancellingCheckoutId] = useState('');
  const [resendingInvoices, setResendingInvoices] = useState(false);
  const [failedInvoiceEmails, setFailedInvoiceEmails] = useState<string[]>([]);
  const [invoiceResendNotice, setInvoiceResendNotice] = useState('');
  const [invoiceOperationId, setInvoiceOperationId] = useState('');
  const [invoiceOperation, setInvoiceOperation] = useState<GatheringOperationProgress | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState<string[]>([]);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [viewingRegistrationId, setViewingRegistrationId] = useState('');
  const [finalSelections, setFinalSelections] = useState<Record<string, string>>(initialFinalSelections);

  useEffect(() => setFinalSelections(initialFinalSelections), [initialFinalSelections]);

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
    if (stageNumber !== 4) return;
    const storageKey = `gathering-invoice-result:${groupId}`;
    const stored = window.sessionStorage.getItem(storageKey);
    if (!stored) return;
    window.sessionStorage.removeItem(storageKey);
    try {
      const result = JSON.parse(stored) as {
        operation_id: string;
        status: GatheringOperationProgress['status'];
        total_count: number;
        processed_count: number;
        success_count: number;
        failed_count: number;
        failed_items: string[];
        error_message: string | null;
      };
      setInvoiceOperationId(result.operation_id);
      setInvoiceOperation({
        id: result.operation_id,
        kind: 'INVOICE_ISSUANCE',
        status: result.status,
        total_count: result.total_count,
        processed_count: result.processed_count,
        success_count: result.success_count,
        failed_count: result.failed_count,
        failed_items: result.failed_items,
        error_message: result.error_message,
      });
      setFailedInvoiceEmails(result.failed_items);
    } catch {
      window.sessionStorage.removeItem(storageKey);
    }
  }, [groupId, stageNumber]);

  useEffect(() => {
    if (!invoiceOperationId) return;
    const source = new EventSource(`/api/gathering/plans/${encodeURIComponent(groupId)}/operations/${encodeURIComponent(invoiceOperationId)}/events?website_id=${encodeURIComponent(websiteId)}`);
    source.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data) as GatheringOperationProgress;
        setInvoiceOperation(progress);
        setFailedInvoiceEmails(progress.failed_items ?? []);
        if (progress.status === 'COMPLETED' || progress.status === 'FAILED') {
          setInvoiceResendNotice(progress.status === 'COMPLETED'
            ? `Email tagihan terkirim ke ${progress.success_count} peserta.`
            : `Pengiriman selesai: ${progress.success_count} terkirim, ${progress.failed_count} gagal.`);
          source.close();
        }
      } catch {
        source.close();
      }
    };
    source.onerror = () => source.close();
    return () => source.close();
  }, [groupId, websiteId, invoiceOperationId]);

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
      const payload = await response.json().catch(() => null) as { message?: string; workflow_step?: WorkflowStep; status?: string; occurrence?: { status?: string } | null; failed_invoice_emails?: string[]; invoice_operation_id?: string; invoice_operation_status?: GatheringOperationProgress['status']; invoice_email_total?: number; invoice_email_success_count?: number; invoice_email_failed_count?: number; invoice_email_error?: string | null } | null;
      if (!response.ok) throw new Error(payload?.message || 'Gagal membuka pembayaran peserta.');
      setFailedInvoiceEmails(payload?.failed_invoice_emails ?? []);
      if (payload?.invoice_operation_id) {
        const operationResult = {
          operation_id: payload.invoice_operation_id,
          status: payload.invoice_operation_status ?? 'COMPLETED',
          total_count: payload.invoice_email_total ?? 0,
          processed_count: 0,
          success_count: payload.invoice_email_success_count ?? 0,
          failed_count: payload.invoice_email_failed_count ?? 0,
          failed_items: payload.failed_invoice_emails ?? [],
          error_message: payload.invoice_email_error ?? null,
        };
        window.sessionStorage.setItem(`gathering-invoice-result:${groupId}`, JSON.stringify(operationResult));
        setInvoiceOperationId(payload.invoice_operation_id);
        setInvoiceOperation({
          id: payload.invoice_operation_id,
          kind: 'INVOICE_ISSUANCE',
          status: operationResult.status,
          total_count: operationResult.total_count,
          processed_count: operationResult.processed_count,
          success_count: operationResult.success_count,
          failed_count: operationResult.failed_count,
          failed_items: operationResult.failed_items,
          error_message: operationResult.error_message,
        });
      }
      setSelectedRegistrationIds([]);
      onReservationsConfirmed?.({
        workflow_step: payload?.workflow_step ?? 'PAYMENT_CONFIRMATION',
        status: payload?.status ?? 'PAYMENT_OPEN',
        occurrence_status: payload?.occurrence?.status ?? 'PAYMENT_OPEN',
      });
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal membuka pembayaran peserta.');
    } finally {
      setConfirming(false);
    }
  }

  async function resendInvoiceEmails() {
    if (resendingInvoices) return;
    setResendingInvoices(true);
    setError('');
    setInvoiceResendNotice('');
    try {
      const response = await fetch(`/api/gathering/plans/${encodeURIComponent(groupId)}/resend-invoices?website_id=${encodeURIComponent(websiteId)}`, { method: 'POST' });
      const payload = await response.json().catch(() => null) as ({ operation_id?: string; operation_status?: GatheringOperationProgress['status']; total_count?: number; processed_count?: number; success_count?: number; failed_count?: number; failed_items?: string[]; error_message?: string | null; sent_count?: number; failed_emails?: string[]; message?: string }) | null;
      if (!response.ok) throw new Error(payload?.message || 'Gagal mengirim ulang email tagihan.');
      if (payload?.operation_id) {
        setInvoiceOperationId(payload.operation_id);
        setInvoiceOperation({
          id: payload.operation_id,
          kind: 'INVOICE_ISSUANCE',
          status: payload.operation_status ?? 'QUEUED',
          total_count: payload.total_count ?? 0,
          processed_count: payload.processed_count ?? 0,
          success_count: payload.success_count ?? 0,
          failed_count: payload.failed_count ?? 0,
          failed_items: payload.failed_items ?? [],
          error_message: payload.error_message ?? null,
        });
        setFailedInvoiceEmails(payload.failed_items ?? []);
        setInvoiceResendNotice('Pengiriman ulang invoice sedang diproses di antrean.');
      } else {
        setFailedInvoiceEmails(payload?.failed_emails ?? []);
        setInvoiceResendNotice(`Tidak ada invoice yang perlu dikirim ulang (${payload?.sent_count ?? 0} terkirim).`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mengirim ulang email tagihan.');
    } finally {
      setResendingInvoices(false);
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
  const paidActiveRegistrations = registrations.filter((registration) => registration.registration_status === 'RSVP_CONFIRMED' && registration.payment_status === 'PAID');
  const collectivelyPayableRegistrations = registrations.filter((registration) => canConfirmEvent
    && registration.registration_status === 'RSVP_CONFIRMED'
    && registration.payment_status === 'UNPAID');
  const selectedCollectiveTotal = collectivelyPayableRegistrations
    .filter((registration) => selectedRegistrationIds.includes(registration.id))
    .reduce((total, registration) => total + Number(registration.invoice_amount ?? 0), 0);
  const optionGroups = new Map<string, GatheringOptionSnapshot[]>();
  options.forEach((option) => optionGroups.set(option.option_group_key, [...(optionGroups.get(option.option_group_key) ?? []), option]));
  const paidSeatCount = paidActiveRegistrations.reduce((total, registration) => total + Number(registration.order_id ? 1 : 0), 0);
  const plannedBookingDeposit = depositAmountPerSeat * paidSeatCount;

  async function confirmEvent() {
    if (finalizing || paidSeatCount < minAttendees || Object.keys(finalSelections).length !== optionGroups.size) return;
    setFinalizing(true);
    setError('');
    try {
      const response = await fetch(`/api/gathering/plans/${encodeURIComponent(groupId)}/confirm-event?website_id=${encodeURIComponent(websiteId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          final_selections: [...optionGroups.keys()].map((option_group_key) => ({
            option_group_key,
            option_id: finalSelections[option_group_key],
          })),
        }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || 'Gagal mengonfirmasi acara.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mengonfirmasi acara.');
    } finally {
      setFinalizing(false);
    }
  }

  async function paySelectedInvoicesCollectively() {
    if (collectivePaying || !selectedRegistrationIds.length) return;
    setCollectivePaying(true);
    setError('');
    try {
      const payableIds = selectedRegistrationIds.filter((id) => collectivelyPayableRegistrations.some((registration) => registration.id === id));
      const response = await fetch(`/api/gathering/plans/${encodeURIComponent(groupId)}/registrations/collective-checkout?website_id=${encodeURIComponent(websiteId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_ids: payableIds }),
      });
      const payload = await response.json().catch(() => null) as { checkout_url?: string; checkoutUrl?: string; message?: string } | null;
      const checkoutUrl = payload?.checkout_url ?? payload?.checkoutUrl;
      if (!response.ok || !checkoutUrl) throw new Error(payload?.message || 'Gagal menyiapkan pembayaran kolektif.');
      setShowCollectivePaymentDialog(false);
      window.location.assign(checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyiapkan pembayaran kolektif.');
      setCollectivePaying(false);
    }
  }

  async function refundSeat() {
    if (!refundTarget) return;
    if (refundingRegistrationId) return;
    setRefundingRegistrationId(refundTarget.id);
    setError('');
    try {
      const response = await fetch(`/api/gathering/plans/${encodeURIComponent(groupId)}/registrations/${encodeURIComponent(refundTarget.id)}/refund?website_id=${encodeURIComponent(websiteId)}`, { method: 'POST' });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || 'Refund seat gagal.');
      setRegistrations((current) => current.map((item) => item.id === refundTarget.id
        ? { ...item, registration_status: 'CANCELLED', payment_status: 'REFUNDED' }
        : item));
      setRefundTarget(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Refund seat gagal.');
    } finally {
      setRefundingRegistrationId('');
    }
  }

  async function cancelParticipantCheckout(registration: RegistrationRow) {
    if (cancellingCheckoutId) return;
    setCancellingCheckoutId(registration.id);
    setError('');
    try {
      const response = await fetch(`/api/gathering/plans/${encodeURIComponent(groupId)}/registrations/${encodeURIComponent(registration.id)}/cancel-checkout?website_id=${encodeURIComponent(websiteId)}`, { method: 'POST' });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || 'Gagal membatalkan checkout peserta.');
      setRegistrations((current) => current.map((item) => item.id === registration.id
        ? { ...item, payment_status: 'UNPAID' }
        : item));
      setInvoiceResendNotice('Checkout peserta dibatalkan. Seat ini sekarang bisa dipilih untuk pembayaran kolektif.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal membatalkan checkout peserta.');
    } finally {
      setCancellingCheckoutId('');
    }
  }

  const publicInvitation = invitations.find((invitation) => !invitation.email && !invitation.whatsapp);
  const publicInvitationId = publicInvitation?.id;

  useEffect(() => {
    if (invitePolicy !== 'OPEN' || !publicInvitationId) return;
    const path = `${basePath}/gathering/invite/${encodeURIComponent(publicInvitationId)}`;
    setShareUrl(`${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`);
  }, [basePath, invitePolicy, publicInvitationId]);

  // Undangan privat yang belum punya registrasi digabung ke daftar peserta,
  // supaya status undangan & RSVP tiap orang tampil di satu baris.
  const registeredInvitationIds = new Set(registrations.flatMap((registration) => registration.invitation_id ? [registration.invitation_id] : []));
  const awaitingInvitations = invitePolicy === 'INVITE_ONLY' && includeRegistrations
    ? invitations.filter((invitation) => !registeredInvitationIds.has(invitation.id) && invitation.status !== 'ACCEPTED')
    : [];
  const participantCounts = PARTICIPANT_FILTERS.reduce<Record<ParticipantFilter, number>>((counts, filter) => ({ ...counts, [filter.key]: 0 }), {} as Record<ParticipantFilter, number>);
  for (const registration of registrations) participantCounts[registrationFilterKey(registration)] += 1;
  for (const invitation of awaitingInvitations) participantCounts[invitationFilterKey(invitation)] += 1;
  participantCounts.ALL = registrations.length + awaitingInvitations.length;
  const normalizedParticipantQuery = participantQuery.trim().toLowerCase();
  const visibleRegistrations = registrations.filter((registration) => (
    (participantFilter === 'ALL' || registrationFilterKey(registration) === participantFilter)
    && matchesParticipantQuery(normalizedParticipantQuery, registration.attendee_name, registration.email, registration.whatsapp)
  ));
  const visibleInvitations = awaitingInvitations.filter((invitation) => (
    (participantFilter === 'ALL' || invitationFilterKey(invitation) === participantFilter)
    && matchesParticipantQuery(normalizedParticipantQuery, invitation.invitee_name, invitation.email, invitation.whatsapp)
  ));
  const participantFilterActive = participantFilter !== 'ALL' || Boolean(normalizedParticipantQuery);

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
      {invitationPreview ? <div className="mt-4">{invitationPreview}</div> : null}
      {loading ? <p className="mt-4 text-sm" style={{ color: 'var(--brand-muted)' }}>Memuat undangan…</p> : null}
      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
      {stageNumber === 3 && invitePolicy === 'OPEN' ? (
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
      {invitePolicy === 'INVITE_ONLY' && !includeRegistrations && invitations.length > 0 ? (
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
                  : invitePolicy === 'INVITE_ONLY'
                    ? `${activeRegistrations.length} dari ${invitations.length} undangan sudah RSVP`
                    : `${activeRegistrations.length} RSVP aktif`}
            </span>
          </div>
          {participantCounts.ALL > 0 ? (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="search"
                value={participantQuery}
                onChange={(event) => setParticipantQuery(event.target.value)}
                placeholder="Cari nama, email, atau WhatsApp"
                aria-label="Cari peserta"
                className="w-full min-w-0 rounded border bg-transparent px-3 py-2 text-sm sm:flex-1"
                style={{ borderColor: 'var(--brand-border)' }}
              />
              <select
                value={participantFilter}
                onChange={(event) => setParticipantFilter(event.target.value as ParticipantFilter)}
                aria-label="Filter status peserta"
                className="w-full rounded border bg-transparent px-3 py-2 text-sm sm:w-auto"
                style={{ borderColor: 'var(--brand-border)' }}
              >
                {PARTICIPANT_FILTERS
                  .filter((filter) => filter.key !== 'AWAITING' || invitePolicy === 'INVITE_ONLY')
                  .map((filter) => <option key={filter.key} value={filter.key}>{filter.label} ({participantCounts[filter.key]})</option>)}
              </select>
            </div>
          ) : null}
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
          {canConfirmEvent && collectivelyPayableRegistrations.length ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-y py-3" style={{ borderColor: 'var(--brand-border)' }}>
              <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--brand-muted)' }}>
                <input
                  type="checkbox"
                  checked={collectivelyPayableRegistrations.every((registration) => selectedRegistrationIds.includes(registration.id))}
                  onChange={(event) => setSelectedRegistrationIds((current) => {
                    const payableIds = new Set(collectivelyPayableRegistrations.map((registration) => registration.id));
                    return event.target.checked
                      ? [...new Set([...current.filter((id) => !payableIds.has(id)), ...payableIds])]
                      : current.filter((id) => !payableIds.has(id));
                  })}
                  className="h-4 w-4 accent-current"
                />
                Pilih tagihan belum dibayar
              </label>
              <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>Refund pembayaran kolektif kembali ke dompet initiator.</span>
              {collectivelyPayableRegistrations.some((registration) => selectedRegistrationIds.includes(registration.id)) ? (
                <button type="button" onClick={() => setShowCollectivePaymentDialog(true)} disabled={collectivePaying} className="rounded px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--brand-accent)' }}>
                  {collectivePaying ? 'Menyiapkan checkout…' : `Bayar kolektif · ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(selectedCollectiveTotal)}`}
                </button>
              ) : null}
            </div>
          ) : null}
          {canConfirmEvent && registrations.some((registration) => registration.registration_status === 'RSVP_CONFIRMED' && !['PAID', 'REFUNDED'].includes(registration.payment_status)) ? (
            <div className={`mt-3 flex flex-wrap items-center justify-between gap-3 border-y px-3 py-3 text-xs ${failedInvoiceEmails.length ? 'border-amber-200 bg-amber-50 text-amber-900' : ''}`} style={!failedInvoiceEmails.length ? { borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' } : undefined}>
              <span>{failedInvoiceEmails.length ? `Email tagihan gagal dikirim ke: ${failedInvoiceEmails.join(', ')}` : invoiceResendNotice || 'Belum menerima email? Kirim ulang tautan tagihan ke peserta yang belum lunas.'}</span>
              <button type="button" onClick={() => void resendInvoiceEmails()} disabled={resendingInvoices} className={`rounded border px-3 py-2 font-semibold disabled:opacity-50 ${failedInvoiceEmails.length ? 'border-amber-300' : ''}`} style={!failedInvoiceEmails.length ? { borderColor: 'var(--brand-border)' } : undefined}>
                {resendingInvoices ? 'Mengirim…' : 'Kirim ulang email tagihan'}
              </button>
            </div>
          ) : null}
          {invoiceOperation ? (
            <div className="mt-3 border-y py-3" style={{ borderColor: 'var(--brand-border)' }} role="status">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold">{invoiceOperation.status === 'QUEUED' ? 'Menunggu pengiriman tagihan' : invoiceOperation.status === 'RUNNING' ? 'Mengirim email tagihan' : invoiceOperation.status === 'COMPLETED' ? 'Proses invoice selesai' : 'Proses invoice gagal'}</span>
                <span style={{ color: 'var(--brand-muted)' }}>{invoiceOperation.processed_count}/{invoiceOperation.total_count} diproses · {invoiceOperation.success_count} terkirim · {invoiceOperation.failed_count} gagal</span>
              </div>
              {invoiceOperation.total_count > 0 ? (
                <div className="mt-2 h-1.5 overflow-hidden bg-zinc-100" role="progressbar" aria-label="Progres pengiriman email invoice" aria-valuemin={0} aria-valuemax={invoiceOperation.total_count} aria-valuenow={invoiceOperation.processed_count}>
                  <div className="h-full transition-[width]" style={{ width: `${Math.min(100, (invoiceOperation.processed_count / invoiceOperation.total_count) * 100)}%`, backgroundColor: 'var(--brand-accent)' }} />
                </div>
              ) : null}
              {invoiceOperation.error_message ? <p className="mt-2 text-xs text-red-700">{invoiceOperation.error_message}</p> : null}
            </div>
          ) : null}
          {visibleRegistrations.length || visibleInvitations.length ? (
            <ul className="mt-3 divide-y border-y" style={{ borderColor: 'var(--brand-border)' }}>
              {visibleRegistrations.map((registration, index) => (
                <li key={registration.id} className="flex flex-col gap-3 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-6 shrink-0 text-right text-xs tabular-nums" style={{ color: 'var(--brand-muted)' }}>{index + 1}.</span>
                    {canRejectRegistration(registration) || collectivelyPayableRegistrations.some((item) => item.id === registration.id) ? (
                      <input
                        type="checkbox"
                        aria-label={`Pilih reservasi ${registration.attendee_name}`}
                        checked={selectedRegistrationIds.includes(registration.id)}
                        onChange={(event) => setSelectedRegistrationIds((current) => event.target.checked
                          ? [...new Set([...current, registration.id])]
                          : current.filter((id) => id !== registration.id))}
                        className="h-4 w-4 shrink-0 accent-current"
                      />
                    ) : <span className="w-4 shrink-0" />}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{registration.attendee_name}</p>
                      <p className="truncate text-xs" style={{ color: 'var(--brand-muted)' }}>{registration.email}</p>
                      <p className="mt-1 text-xs" style={{ color: registration.registration_status === 'REJECTED' ? '#b91c1c' : 'var(--brand-muted)' }}>
                        {registration.registration_status === 'REJECTED' ? 'Ditolak' : registration.registration_status === 'CANCELLED' ? 'Dibatalkan' : `RSVP diterima · ${registration.payment_status === 'PAID' ? 'Lunas' : registration.payment_status === 'PENDING_PAYMENT' ? 'Menunggu pembayaran' : registration.payment_status === 'REFUNDED' ? 'Direfund' : 'Belum dibayar'}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 pl-16 sm:pl-0">
                    {canConfirmEvent && registration.registration_status === 'RSVP_CONFIRMED' && registration.payment_status === 'PENDING_PAYMENT' && registration.order_id ? (
                      <button type="button" onClick={() => void cancelParticipantCheckout(registration)} disabled={Boolean(cancellingCheckoutId)} className="rounded border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50">
                        {cancellingCheckoutId === registration.id ? 'Membatalkan…' : 'Batalkan pembayaran'}
                      </button>
                    ) : null}
                    {canConfirmEvent && registration.registration_status === 'RSVP_CONFIRMED' && registration.payment_status === 'PAID' ? (
                      <button type="button" onClick={() => setRefundTarget(registration)} disabled={refundingRegistrationId === registration.id} className="rounded border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50">
                        {refundingRegistrationId === registration.id ? 'Memproses…' : 'Refund seat'}
                      </button>
                    ) : null}
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
              {visibleInvitations.map((invitation, index) => (
                <li key={`invitation-${invitation.id}`} className="flex flex-col gap-3 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-6 shrink-0 text-right text-xs tabular-nums" style={{ color: 'var(--brand-muted)' }}>{visibleRegistrations.length + index + 1}.</span>
                    <span className="w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{invitation.invitee_name || invitation.email || invitation.whatsapp || 'Undangan'}</p>
                      <p className="truncate text-xs" style={{ color: 'var(--brand-muted)' }}>{[invitation.email, invitation.whatsapp].filter(Boolean).join(' · ') || '-'}</p>
                      <p className="mt-1 text-xs" style={{ color: invitation.status === 'REVOKED' ? '#b91c1c' : 'var(--brand-muted)' }}>{statusLabel(invitation)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2 pl-16 sm:pl-0">
                    {invitation.status !== 'REVOKED' ? (
                      <a href={`${basePath}/gathering/invite/id/${encodeURIComponent(invitation.id)}`} target="_blank" rel="noopener noreferrer" className="rounded border px-3 py-2 text-xs font-semibold" style={{ borderColor: 'var(--brand-border)' }}>
                        Buka undangan
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : participantFilterActive && participantCounts.ALL > 0 ? (
            <p className="mt-3 text-sm" style={{ color: 'var(--brand-muted)' }}>
              Tidak ada peserta yang cocok.{' '}
              <button type="button" onClick={() => { setParticipantQuery(''); setParticipantFilter('ALL'); }} className="font-semibold underline">Reset pencarian</button>
            </p>
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
            <div className="mt-5 flex flex-wrap items-start gap-2">
              <div>
              <button type="button" onClick={() => void confirmReservations()} disabled={confirming || activeRegistrations.length < minAttendees || activeRegistrations.length > maxAttendees} className="rounded-full px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}>
                {confirming ? 'Membuka pembayaran…' : 'Tutup RSVP & buka pembayaran'}
              </button>
              <p className="mt-2 text-xs" style={{ color: 'var(--brand-muted)' }}>RSVP aktif: {activeRegistrations.length} · Minimum {minAttendees} · Maksimum {maxAttendees}</p>
              </div>
              {canCancelGathering && onCancelGathering ? (
                <button type="button" onClick={onCancelGathering} disabled={cancelling} className="rounded-full border border-red-500 px-4 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50">
                  {cancelling ? 'Membatalkan…' : 'Batalkan rencana'}
                </button>
              ) : null}
            </div>
          ) : canConfirmEvent ? (
            <div className="mt-5 flex flex-wrap items-start gap-2">
              <section className="w-full border-y py-5" style={{ borderColor: 'var(--brand-border)' }}>
                <h3 className="text-sm font-semibold">Pilih opsi final dari hasil voting</h3>
                <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>Pilih satu opsi untuk setiap kelompok. Hasil vote menjadi referensi; pilihan akhir dikunci saat Anda mengonfirmasi.</p>
                <div className="mt-4 space-y-4">
                  {[...optionGroups.entries()].map(([groupKey, groupOptions]) => {
                    const result = votingResults[groupKey];
                    return (
                      <fieldset key={groupKey} className="space-y-2">
                        <legend className="mb-2 text-sm font-medium">{groupKey}</legend>
                        {groupOptions.map((option) => {
                          const vote = result?.options[String(option.product_option_id)];
                          return (
                            <label key={option.product_option_id} className="flex cursor-pointer items-start gap-3 border px-3 py-3 text-sm" style={{ borderColor: finalSelections[groupKey] === String(option.product_option_id) ? 'var(--brand-accent)' : 'var(--brand-border)' }}>
                              <input type="radio" name={`final-option-${groupKey}`} value={option.product_option_id} checked={finalSelections[groupKey] === String(option.product_option_id)} onChange={() => setFinalSelections((current) => ({ ...current, [groupKey]: String(option.product_option_id) }))} className="mt-1 accent-[var(--brand-accent)]" />
                              <span className="min-w-0 flex-1">
                                <span className="block font-medium">{option.label}</span>
                                {option.venue_location ? <span className="mt-1 block text-xs" style={{ color: 'var(--brand-muted)' }}>{option.venue_location}</span> : null}
                              </span>
                              <span className="shrink-0 text-right text-xs" style={{ color: 'var(--brand-muted)' }}>{vote ? `${vote.votes} suara · ${vote.percentage}%` : '0 suara'}</span>
                            </label>
                          );
                        })}
                        <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>Total suara: {result?.total_votes ?? 0}</p>
                      </fieldset>
                    );
                  })}
                </div>
                <div className="mt-5 border-t pt-4" style={{ borderColor: 'var(--brand-border)' }}>
                  <p className="text-sm font-medium">DP booking (tetap ditahan di escrow)</p>
                  <p className="mt-1 text-lg font-bold" style={{ color: 'var(--brand-accent-muted)' }}>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(plannedBookingDeposit)}</p>
                  <p className="mt-1 text-xs leading-5" style={{ color: 'var(--brand-muted)' }}>{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(depositAmountPerSeat)} × {paidSeatCount} seat lunas. Seluruh dana tetap ditahan sampai admin memulai persiapan acara.</p>
                </div>
                <button type="button" onClick={() => void confirmEvent()} disabled={finalizing || paidSeatCount < minAttendees || paidSeatCount > maxAttendees || Object.keys(finalSelections).length !== optionGroups.size} className="mt-4 rounded-full px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}>
                  {finalizing ? 'Menyimpan konfirmasi…' : 'Konfirmasi acara'}
                </button>
                <p className="mt-2 text-xs" style={{ color: 'var(--brand-muted)' }}>Seat lunas: {paidSeatCount} · Minimum {minAttendees} · Maksimum {maxAttendees}. Opsi pilihan Anda akan dikunci. Admin akan memproses persiapan dan pencairan DP pada tahap berikutnya.</p>
              </section>
              {canCancelGathering && onCancelGathering ? (
                <button type="button" onClick={onCancelGathering} disabled={cancelling} className="rounded-full border border-red-500 px-4 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50">
                  {cancelling ? 'Membatalkan…' : 'Batalkan rencana'}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: 'var(--brand-border)' }}>
              <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>Tampilan baca saja untuk tahap yang sudah dilewati.</p>
              {canCancelGathering && onCancelGathering ? (
                <button type="button" onClick={onCancelGathering} disabled={cancelling} className="rounded-full border border-red-500 px-4 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50">
                  {cancelling ? 'Membatalkan…' : 'Batalkan rencana'}
                </button>
              ) : null}
            </div>
          )}
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
          {showCollectivePaymentDialog ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !collectivePaying) setShowCollectivePaymentDialog(false); }}>
              <section role="dialog" aria-modal="true" aria-labelledby="collective-payment-title" className="w-full max-w-lg border bg-white p-5 text-zinc-900 shadow-xl sm:p-6" style={{ borderColor: 'var(--brand-border)' }}>
                <h3 id="collective-payment-title" className="text-base font-semibold">Konfirmasi pembayaran kolektif</h3>
                <p className="mt-2 text-sm text-zinc-600">Bayar {collectivelyPayableRegistrations.filter((registration) => selectedRegistrationIds.includes(registration.id)).length} tagihan gathering dalam satu escrow?</p>
                <p className="mt-3 text-xl font-semibold">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(selectedCollectiveTotal)}</p>
                <p className="mt-3 text-xs leading-5 text-zinc-500">Jika refund diperlukan, dana akan kembali ke dompet akun initiator yang membayar.</p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button type="button" disabled={collectivePaying} onClick={() => setShowCollectivePaymentDialog(false)} className="rounded border border-zinc-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Batal</button>
                  <button type="button" disabled={collectivePaying || selectedCollectiveTotal <= 0} onClick={() => void paySelectedInvoicesCollectively()} className="rounded px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: 'var(--brand-accent)' }}>{collectivePaying ? 'Menyiapkan checkout…' : 'Lanjutkan pembayaran'}</button>
                </div>
              </section>
            </div>
          ) : null}
          {refundTarget ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !refundingRegistrationId) setRefundTarget(null); }}>
              <section role="dialog" aria-modal="true" aria-labelledby="refund-seat-title" className="w-full max-w-lg border bg-white p-5 text-zinc-900 shadow-xl sm:p-6" style={{ borderColor: 'var(--brand-border)' }}>
                <h3 id="refund-seat-title" className="text-base font-semibold">Konfirmasi refund seat</h3>
                <p className="mt-2 text-sm text-zinc-600">Refund seat untuk {refundTarget.attendee_name}?</p>
                <p className="mt-3 text-xs leading-5 text-zinc-500">Dana akan kembali ke dompet akun yang membayar escrow, bukan selalu ke dompet peserta.</p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button type="button" disabled={Boolean(refundingRegistrationId)} onClick={() => setRefundTarget(null)} className="rounded border border-zinc-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Batal</button>
                  <button type="button" disabled={Boolean(refundingRegistrationId)} onClick={() => void refundSeat()} className="rounded bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{refundingRegistrationId ? 'Memproses refund…' : 'Refund seat'}</button>
                </div>
              </section>
            </div>
          ) : null}
        </section>
      ) : <p className="mt-4 text-xs" style={{ color: 'var(--brand-muted)' }}>Tampilan baca saja untuk tahap yang sudah dilewati.</p>}
    </section>
  );
}

export function GatheringWorkflowSteps({
  plan: planProp,
  websiteId,
  basePath,
}: {
  plan: GatheringPlanDetail;
  websiteId: string;
  basePath: string;
}) {
  // Tahap yang sudah dimajukan dari respons API aksi. Dipakai selama data server
  // (router.refresh) belum menyusul; begitu props sudah di tahap yang sama/lebih
  // jauh, props kembali jadi sumber kebenaran.
  const [planAdvance, setPlanAdvance] = useState<PlanAdvance | null>(null);
  const plan: GatheringPlanDetail = planAdvance && workflowRank(planAdvance.workflow_step) > workflowRank(planProp.workflow_step)
    ? {
      ...planProp,
      workflow_step: planAdvance.workflow_step,
      status: planAdvance.status,
      occurrence: { ...planProp.occurrence, status: planAdvance.occurrence_status },
    }
    : planProp;
  const workflowIndex = STEPS.findIndex((step) => step.key === plan.workflow_step);
  const currentIndex = plan.workflow_step === 'LOCKED'
    ? STEPS.length - 1
    : Math.max(0, workflowIndex);
  const [selectedIndex, setSelectedIndex] = useState(currentIndex);
  const [cancelling, setCancelling] = useState(false);
  const [invitationBannerUrl, setInvitationBannerUrl] = useState(plan.invitation_banner_url ?? '');
  const [invitationDescription, setInvitationDescription] = useState(plan.invitation_description ?? '');
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('Dibatalkan oleh initiator');
  const [cancelError, setCancelError] = useState('');

  useEffect(() => setSelectedIndex(currentIndex), [currentIndex]);

  async function cancelGathering(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (cancelling) return;
    setCancelling(true);
    setCancelError('');
    try {
      const response = await fetch(`/api/gathering/plans/${encodeURIComponent(plan.id)}/cancel?website_id=${encodeURIComponent(websiteId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason.trim() || 'Dibatalkan oleh initiator' }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || 'Gagal membatalkan acara.');
      window.location.reload();
    } catch (cause) {
      setCancelError(cause instanceof Error ? cause.message : 'Gagal membatalkan acara.');
    } finally {
      setCancelling(false);
    }
  }

  const occurrence = plan.occurrence;

  return (
    <>
      <ol
        className="sticky top-[72px] z-30 mt-6 grid grid-cols-4 gap-1 bg-[var(--brand-bg)] py-2 shadow-sm sm:gap-2"
        aria-label="Tahapan gathering"
      >
        {STEPS.map((step, index) => {
          const complete = index < currentIndex;
          const active = index === selectedIndex;
          const available = index <= currentIndex;
          return (
            <li key={step.key} className="min-w-0 border-t-2" style={{ borderColor: active || complete ? 'var(--brand-accent)' : 'var(--brand-border)' }}>
              <button
                type="button"
                onClick={() => setSelectedIndex(index)}
                disabled={!available}
                aria-current={active ? 'step' : undefined}
                className="flex w-full min-w-0 items-center py-2 text-left text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                style={{ color: active ? 'var(--brand-text)' : 'var(--brand-muted)' }}
                title={`${index + 1}. ${step.label}`}
              >
                <span className="mr-1 shrink-0">{complete ? '✓' : `${index + 1}.`}</span>
                <span className="truncate">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {selectedIndex < currentIndex && selectedIndex === 0 ? <ReadOnlyPlan plan={plan} /> : null}
      {selectedIndex < currentIndex && selectedIndex === 1 ? (
        <ReadOnlyInvitationHistory
          groupId={plan.id}
          websiteId={websiteId}
          basePath={basePath}
          invitePolicy={plan.invite_policy}
          invitationPreview={(
            <GatheringInvitationCard
              plan={plan}
              bannerUrl={invitationBannerUrl}
              description={invitationDescription}
            />
          )}
        />
      ) : null}
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
          canCancel={selectedIndex === currentIndex && plan.status !== 'CANCELLED' && plan.status !== 'COMPLETED'}
          cancelling={cancelling}
          onCancel={() => { setCancelError(''); setShowCancelDialog(true); }}
        />
      ) : null}
      {selectedIndex === currentIndex && plan.workflow_step === 'INVITATIONS' ? (
        <GatheringInvitationManager
          groupId={plan.id}
          websiteId={websiteId}
          basePath={basePath}
          invitePolicy={plan.invite_policy}
          initialBannerUrl={invitationBannerUrl}
          initialDescription={invitationDescription}
          onInvitationContentSaved={(content) => {
            setInvitationBannerUrl(content.bannerUrl);
            setInvitationDescription(content.description);
          }}
          canCancel={plan.status !== 'CANCELLED' && plan.status !== 'COMPLETED'}
          cancelling={cancelling}
          onCancel={() => { setCancelError(''); setShowCancelDialog(true); }}
        />
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
          canCancelGathering={selectedIndex === currentIndex && plan.status !== 'CANCELLED' && plan.status !== 'COMPLETED'}
          cancelling={cancelling}
          onCancelGathering={() => { setCancelError(''); setShowCancelDialog(true); }}
          minAttendees={occurrence.min_attendees}
          maxAttendees={occurrence.max_attendees}
          stageNumber={3}
          onReservationsConfirmed={setPlanAdvance}
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
          maxAttendees={occurrence.max_attendees}
          paymentDeadline={occurrence.payment_deadline}
          depositAmountPerSeat={occurrence.deposit_amount_per_seat}
          votingResults={occurrence.voting_results}
          initialFinalSelections={Object.fromEntries(
            occurrence.option_groups_snapshot
              .filter((option) => option.is_final_selection)
              .map((option) => [option.option_group_key, option.product_option_id]),
          )}
          stageNumber={4}
          canConfirmEvent={plan.workflow_step === 'PAYMENT_CONFIRMATION' && plan.status === 'PAYMENT_OPEN'}
          canCancelGathering={selectedIndex === currentIndex && plan.status !== 'CANCELLED' && plan.status !== 'COMPLETED'}
          cancelling={cancelling}
          onCancelGathering={() => { setCancelError(''); setShowCancelDialog(true); }}
        />
      ) : null}
      {showCancelDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !cancelling) setShowCancelDialog(false); }}>
          <form onSubmit={(event) => void cancelGathering(event)} role="dialog" aria-modal="true" aria-labelledby="cancel-gathering-title" className="w-full max-w-lg border bg-white p-5 text-zinc-900 shadow-xl sm:p-6" style={{ borderColor: 'var(--brand-border)' }}>
            <h2 id="cancel-gathering-title" className="text-base font-semibold">Batalkan acara</h2>
            <p className="mt-2 text-sm text-zinc-600">
              {plan.status === 'CONFIRMED'
                ? 'Acara akan dibatalkan. Seluruh dana peserta yang masih ditahan di escrow akan direfund; DP belum dicairkan.'
                : 'Acara akan dibatalkan dan proses refund akan dijalankan sesuai kebijakan.'}
            </p>
            <label htmlFor="cancel-gathering-reason" className="mt-5 block text-sm font-medium">Alasan pembatalan (opsional)</label>
            <input id="cancel-gathering-reason" type="text" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="mt-2 block w-full rounded border border-zinc-300 px-3 py-2.5 text-sm focus:border-zinc-600 focus:outline-none" />
            {cancelError ? <p role="alert" className="mt-2 text-sm text-red-700">{cancelError}</p> : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={cancelling} onClick={() => setShowCancelDialog(false)} className="rounded border border-zinc-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Batal</button>
              <button type="submit" disabled={cancelling} className="rounded bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{cancelling ? 'Membatalkan…' : 'Batalkan acara'}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}