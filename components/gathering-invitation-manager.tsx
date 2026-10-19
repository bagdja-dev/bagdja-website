'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import { useRouter } from 'next/navigation';
import { GatheringInvitationAppearance } from './gathering-invitation-appearance';
import { ConfirmDialog } from './confirm-dialog';

interface InvitationRow {
  id: string;
  invitee_name: string | null;
  email: string | null;
  whatsapp: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expires_at: string;
  use_count: number;
  max_uses: number;
  email_delivery_status?: 'NOT_SENT' | 'SENT' | 'FAILED' | 'MANUAL';
  delivery_error?: string | null;
}

interface InvitationOperationProgress {
  id: string;
  kind: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  total_count: number;
  processed_count: number;
  success_count: number;
  failed_count: number;
  failed_items: string[];
  error_message: string | null;
}

type PendingContact = {
  invitee_name?: string;
  email?: string;
  whatsapp?: string;
};

function invitationLabel(invitation: InvitationRow) {
  return invitation.invitee_name || invitation.email || invitation.whatsapp || 'Undangan';
}

function invitationStatus(invitation: InvitationRow) {
  if (invitation.status === 'PENDING' && new Date(invitation.expires_at) <= new Date()) return 'Kedaluwarsa';
  if (invitation.status === 'PENDING') return 'Belum RSVP';
  if (invitation.status === 'ACCEPTED') return 'Diterima';
  if (invitation.status === 'REVOKED') return 'Dicabut';
  return 'Kedaluwarsa';
}

export function GatheringInvitationManager({
  groupId,
  websiteId,
  basePath,
  invitePolicy,
  initialBannerUrl,
  initialDescription,
  onInvitationContentSaved,
  canCancel = false,
  cancelling = false,
  onCancel,
}: {
  groupId: string;
  websiteId: string;
  basePath: string;
  invitePolicy: 'OPEN' | 'INVITE_ONLY';
  initialBannerUrl: string;
  initialDescription: string;
  onInvitationContentSaved: (content: { bannerUrl: string; description: string }) => void;
  canCancel?: boolean;
  cancelling?: boolean;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [inviteeName, setInviteeName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [shareWhatsapp, setShareWhatsapp] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [revokeOperationId, setRevokeOperationId] = useState('');
  const [revokeOperation, setRevokeOperation] = useState<InvitationOperationProgress | null>(null);
  const [dispatchOperationId, setDispatchOperationId] = useState('');
  const [dispatchOperation, setDispatchOperation] = useState<InvitationOperationProgress | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingContacts, setPendingContacts] = useState<PendingContact[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [draftContact, setDraftContact] = useState<PendingContact>({
    invitee_name: '',
    email: '',
    whatsapp: '',
  });

  const collectionUrl = `/api/gathering/plans/${encodeURIComponent(groupId)}/invitations?website_id=${encodeURIComponent(websiteId)}`;
  const loadInvitations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(collectionUrl, { cache: 'no-store' });
      const payload = await response.json().catch(() => null) as InvitationRow[] | { message?: string } | null;
      if (!response.ok) throw new Error((payload as { message?: string } | null)?.message || 'Gagal memuat undangan.');
      setInvitations(Array.isArray(payload) ? payload : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal memuat undangan.');
    } finally {
      setLoading(false);
    }
  }, [collectionUrl]);

  useEffect(() => { void loadInvitations(); }, [loadInvitations]);

  useEffect(() => {
    let cancelled = false;
    const operationUrl = `/api/gathering/plans/${encodeURIComponent(groupId)}/invitations/operation?website_id=${encodeURIComponent(websiteId)}`;

    async function loadActiveDispatch() {
      try {
        const response = await fetch(operationUrl, { cache: 'no-store' });
        const payload = await response.json().catch(() => null) as { operation?: InvitationOperationProgress | null; message?: string } | null;
        if (!response.ok) {
          throw new Error(payload?.message || 'Gagal memuat progres pengiriman undangan.');
        }
        if (cancelled || !payload?.operation) return;

        setDispatchOperation(payload.operation);
        setDispatchOperationId(payload.operation.id);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Gagal memuat progres pengiriman undangan.');
        }
      }
    }

    void loadActiveDispatch();
    return () => { cancelled = true; };
  }, [groupId, websiteId]);

  useEffect(() => {
    if (!revokeOperationId) return;
    const source = new EventSource(`/api/gathering/plans/${encodeURIComponent(groupId)}/operations/${encodeURIComponent(revokeOperationId)}/events?website_id=${encodeURIComponent(websiteId)}`);
    source.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data) as InvitationOperationProgress;
        setRevokeOperation(progress);
        if (progress.status === 'COMPLETED' || progress.status === 'FAILED') source.close();
      } catch {
        source.close();
      }
    };
    source.onerror = () => source.close();
    return () => source.close();
  }, [groupId, websiteId, revokeOperationId]);

  useEffect(() => {
    if (!dispatchOperationId) return;
    const source = new EventSource(`/api/gathering/plans/${encodeURIComponent(groupId)}/operations/${encodeURIComponent(dispatchOperationId)}/events?website_id=${encodeURIComponent(websiteId)}`);
    source.onmessage = (event) => {
      try {
        const progress = JSON.parse(event.data) as InvitationOperationProgress;
        setDispatchOperation(progress);
        if (progress.status === 'COMPLETED' || progress.status === 'FAILED') {
          source.close();
          void loadInvitations();
          if (progress.status === 'COMPLETED') {
            router.refresh();
          } else {
            const failedRecipients = progress.failed_items.length
              ? ` Penerima gagal: ${progress.failed_items.join(', ')}.`
              : '';
            setError(`${progress.error_message || `Pengiriman undangan gagal untuk ${progress.failed_count} penerima.`}${failedRecipients} Perbaiki kontak lalu submit kembali.`);
          }
        }
      } catch {
        source.close();
        setError('Tidak dapat membaca progres pengiriman undangan.');
      }
    };
    source.onerror = () => {
      source.close();
      setError('Koneksi progres pengiriman undangan terputus. Muat ulang halaman untuk memeriksa status terbaru.');
    };
    return () => source.close();
  }, [dispatchOperationId, groupId, loadInvitations, router, websiteId]);

  useEffect(() => {
    let cancelled = false;
    if (!shareUrl) { setQrDataUrl(''); return; }
    void QRCode.toDataURL(shareUrl, { width: 220, margin: 1 }).then((url) => {
      if (!cancelled) setQrDataUrl(url);
    }).catch(() => { if (!cancelled) setQrDataUrl(''); });
    return () => { cancelled = true; };
  }, [shareUrl]);

  function makeShareUrl(invitationId: string, isPrivate = invitePolicy === 'INVITE_ONLY') {
    const privatePath = isPrivate ? '/id' : '';
    const path = `${basePath}/gathering/invite${privatePath}/${encodeURIComponent(invitationId)}`;
    return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async function createInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setShareUrl('');
    setShareEmail('');
    setShareWhatsapp('');
    setCopied(false);
    try {
      const response = await fetch(collectionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitee_name: inviteeName.trim() || undefined,
          email: email.trim() || undefined,
          whatsapp: whatsapp.trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => null) as (InvitationRow & { message?: string }) | null;
      if (!response.ok || !payload?.id) throw new Error(payload?.message || 'Gagal membuat undangan.');
      setShareUrl(makeShareUrl(payload.id, invitePolicy === 'INVITE_ONLY'));
      setShareEmail(email.trim());
      setShareWhatsapp(whatsapp.trim());
      setInviteeName('');
      setEmail('');
      setWhatsapp('');
      await loadInvitations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal membuat undangan.');
    } finally {
      setSaving(false);
    }
  }

  function addDraftContact() {
    const contact = {
      invitee_name: draftContact.invitee_name?.trim() || undefined,
      email: draftContact.email?.trim() || undefined,
      whatsapp: draftContact.whatsapp?.trim() || undefined,
    };

    if (!contact.email && !contact.whatsapp) {
      setError('Isi email atau nomor WhatsApp dulu.');
      return;
    }

    setPendingContacts((current) => [...current, contact]);
    setDraftContact({ invitee_name: '', email: '', whatsapp: '' });
    setIsAddModalOpen(false);
    setError('');
  }

  async function importContacts(file?: File) {
    if (!file) return;
    setError('');
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      const contacts = rows.map((row) => {
        const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim().toLowerCase(), String(value).trim()]));
        return {
          invitee_name: normalized.invitee_name || normalized.nama || undefined,
          email: normalized.email || undefined,
          whatsapp: normalized.whatsapp || normalized.wa || normalized.nomor_whatsapp || undefined,
        };
      }).filter((contact) => contact.email || contact.whatsapp);
      if (!contacts.length) throw new Error('File tidak berisi email atau nomor WhatsApp yang valid.');
      setPendingContacts((current) => [...current, ...contacts]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal membaca file undangan.');
    }
  }

  function downloadTemplate(type: 'csv' | 'xlsx') {
    const rows = [
      ['invitee_name', 'email', 'whatsapp'],
      ['Contoh Nama', 'nama@example.com', '+6281234567890'],
    ];
    if (type === 'csv') {
      const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'template-undangan-gathering.csv'; anchor.click(); URL.revokeObjectURL(url);
      return;
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Undangan');
    XLSX.writeFile(workbook, 'template-undangan-gathering.xlsx');
  }

  /** Simpan antrean kontak; `true` bila semua tersimpan. Kontak yang sudah tersimpan dikeluarkan dari antrean supaya retry tidak menggandakan undangan. */
  async function savePendingContacts(): Promise<boolean> {
    if (pendingContacts.length === 0) {
      setError('Belum ada peserta untuk disimpan.');
      return false;
    }

    setError('');
    let remaining = pendingContacts;
    try {
      for (const contact of pendingContacts) {
        const response = await fetch(collectionUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(contact),
        });
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        if (!response.ok) throw new Error(payload?.message || 'Gagal menyimpan daftar penerima.');
        remaining = remaining.slice(1);
      }
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan daftar penerima.');
      return false;
    } finally {
      setPendingContacts(remaining);
      await loadInvitations();
    }
  }

  async function submitInvitationStage() {
    if (submitting) return;
    setSubmitting(true); setError(''); setShareUrl('');
    setDispatchOperationId('');
    setDispatchOperation(null);
    try {
      if (invitePolicy === 'INVITE_ONLY' && pendingContacts.length) {
        // Jangan baca `pendingContacts` di sini — nilainya masih snapshot render sebelum disimpan.
        const saved = await savePendingContacts();
        if (!saved) return;
      }
      const response = await fetch(`/api/gathering/plans/${encodeURIComponent(groupId)}/invitations/submit?website_id=${encodeURIComponent(websiteId)}`, { method: 'POST' });
      const payload = await response.json().catch(() => null) as {
        submitted?: boolean;
        public_invitation?: { id?: string };
        operation_id?: string;
        operation_status?: InvitationOperationProgress['status'];
        total_count?: number;
        processed_count?: number;
        success_count?: number;
        failed_count?: number;
        failed_items?: string[];
        error_message?: string | null;
        message?: string;
      } | null;
      if (!response.ok || !payload?.submitted) throw new Error(payload?.message || 'Undangan belum berhasil disubmit.');
      if (payload.public_invitation?.id) setShareUrl(makeShareUrl(payload.public_invitation.id, false));
      await loadInvitations();
      if (payload.operation_id) {
        setDispatchOperationId(payload.operation_id);
        setDispatchOperation({
          id: payload.operation_id,
          kind: 'INVITATION_DISPATCH',
          status: payload.operation_status ?? 'QUEUED',
          total_count: payload.total_count ?? 0,
          processed_count: payload.processed_count ?? 0,
          success_count: payload.success_count ?? 0,
          failed_count: payload.failed_count ?? 0,
          failed_items: payload.failed_items ?? [],
          error_message: payload.error_message ?? null,
        });
        if (payload.operation_status === 'FAILED') {
          setError(payload.error_message || 'Pengiriman undangan gagal dimulai.');
        }
      } else {
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal submit undangan.');
    } finally {
      setSubmitting(false);
    }
  }

  async function revokeInvitation(invitationId: string) {
    setBusyId(invitationId);
    setError('');
    try {
      const response = await fetch(`/api/gathering/plans/${encodeURIComponent(groupId)}/invitations/${encodeURIComponent(invitationId)}?website_id=${encodeURIComponent(websiteId)}`, {
        method: 'DELETE',
      });
      const payload = await response.json().catch(() => null) as { message?: string; operation_id?: string; operation_status?: InvitationOperationProgress['status'] } | null;
      if (!response.ok) throw new Error(payload?.message || 'Gagal mencabut undangan.');
      if (payload?.operation_id) {
        setRevokeOperationId(payload.operation_id);
        setRevokeOperation({
          id: payload.operation_id,
          kind: 'INVITATION_REVOCATION',
          status: payload.operation_status ?? 'QUEUED',
          total_count: 1,
          processed_count: 0,
          success_count: 0,
          failed_count: 0,
          failed_items: [],
          error_message: null,
        });
      }
      await loadInvitations();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mencabut undangan.');
    } finally {
      setBusyId(null);
    }
  }

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const inviteMessage = `Anda diundang ke rencana gathering. Lihat detail: ${shareUrl}`;
  const whatsappDigits = shareWhatsapp.replace(/\D/g, '');
  const whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(inviteMessage)}` : '';
  const emailHref = shareEmail
    ? `mailto:${encodeURIComponent(shareEmail)}?subject=${encodeURIComponent('Undangan gathering')}&body=${encodeURIComponent(inviteMessage)}`
    : '';

  const openShareUrl = shareUrl;

  return (
    <section className="mt-8 border-y py-6" style={{ borderColor: 'var(--brand-border)' }}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>2. Buat undangan</h2>
          <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>{invitePolicy === 'OPEN' ? 'Buat tautan dan QR yang dapat dibagikan.' : 'Kelola penerima, lalu submit untuk mengirim undangan ke email.'}</p>
        </div>
        <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>{invitations.length} undangan</span>
      </div>

      <GatheringInvitationAppearance
        groupId={groupId}
        websiteId={websiteId}
        initialBannerUrl={initialBannerUrl}
        initialDescription={initialDescription}
        onSaved={onInvitationContentSaved}
      />

      {invitePolicy === 'INVITE_ONLY' ? (
        <>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setIsAddModalOpen(true)} className="rounded-full px-4 py-2 text-sm font-semibold" style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}>
                + Tambah
              </button>
              <label className="cursor-pointer rounded border px-3 py-2 text-xs font-semibold" style={{ borderColor: 'var(--brand-border)' }}>
                Import Excel/CSV
                <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(event) => { void importContacts(event.target.files?.[0]); event.currentTarget.value = ''; }} />
              </label>
              <button type="button" onClick={() => downloadTemplate('xlsx')} className="text-xs font-semibold underline">Template Excel</button>
              <button type="button" onClick={() => downloadTemplate('csv')} className="text-xs font-semibold underline">Template CSV</button>
            </div>
            {pendingContacts.length ? <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>{pendingContacts.length} kontak siap disimpan</span> : null}
          </div>

          <div className="mt-5 rounded-xl border" style={{ borderColor: 'var(--brand-border)' }}>
            <div className="grid grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[1.2fr_1.2fr_1fr_auto] md:items-center">
              <div>
                <div className="text-sm font-semibold">{invitations[0]?.invitee_name || pendingContacts[0]?.invitee_name || 'Belum ada peserta'}</div>
                <div className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>{invitations[0]?.email || pendingContacts[0]?.email || 'Email belum diisi'}</div>
              </div>
              <div className="text-sm">{invitations[0]?.whatsapp || pendingContacts[0]?.whatsapp || '-'}</div>
              <div className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                {invitations[0] ? (new Date(invitations[0].expires_at) <= new Date() ? 'Kedaluwarsa' : 'Menunggu RSVP') : 'Belum disimpan'}
              </div>
              <div className="flex gap-2 md:justify-end">
                {invitations[0] ? (
                  <>
                    <a href={makeShareUrl(invitations[0].id, invitePolicy === 'INVITE_ONLY')} target="_blank" rel="noopener noreferrer" className="rounded border px-3 py-2 text-xs font-semibold" style={{ borderColor: 'var(--brand-border)' }}>Buka undangan</a>
                    <button type="button" onClick={() => void revokeInvitation(invitations[0].id)} disabled={busyId === invitations[0].id} className="rounded border px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ borderColor: 'var(--brand-border)' }}>Cabut</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setIsAddModalOpen(true)} className="rounded border px-3 py-2 text-xs font-semibold" style={{ borderColor: 'var(--brand-border)' }}>Tambah</button>
                )}
              </div>
            </div>
          </div>

          {isAddModalOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-lg rounded-2xl border bg-white p-5 shadow-xl" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-bold">Tambah peserta undangan</h3>
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="text-sm font-semibold">Tutup</button>
                </div>
                <div className="mt-4 space-y-4">
                  <label className="block text-xs font-medium">
                    Nama peserta
                    <input value={draftContact.invitee_name ?? ''} onChange={(event) => setDraftContact((current) => ({ ...current, invitee_name: event.target.value }))} className="mt-1.5 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm" style={{ borderColor: 'var(--brand-border)' }} />
                  </label>
                  <label className="block text-xs font-medium">
                    Email
                    <input type="email" value={draftContact.email ?? ''} onChange={(event) => setDraftContact((current) => ({ ...current, email: event.target.value }))} className="mt-1.5 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm" style={{ borderColor: 'var(--brand-border)' }} />
                  </label>
                  <label className="block text-xs font-medium">
                    WhatsApp
                    <input type="tel" value={draftContact.whatsapp ?? ''} onChange={(event) => setDraftContact((current) => ({ ...current, whatsapp: event.target.value }))} placeholder="+62…" className="mt-1.5 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm" style={{ borderColor: 'var(--brand-border)' }} />
                  </label>
                  <p className="text-[11px]" style={{ color: 'var(--brand-muted)' }}>Masa berlaku undangan mengikuti tanggal terakhir reservasi di tahap 1.</p>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--brand-border)' }}>Batal</button>
                  <button type="button" onClick={addDraftContact} className="rounded-full px-4 py-2 text-sm font-semibold" style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}>Simpan</button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {revokeOperation ? (
        <div className="mt-3 border-y py-3 text-xs" style={{ borderColor: 'var(--brand-border)' }} role="status">
          <span className="font-semibold">{revokeOperation.status === 'QUEUED' ? 'Pencabutan antre' : revokeOperation.status === 'RUNNING' ? 'Memproses pencabutan' : revokeOperation.status === 'COMPLETED' ? 'Undangan berhasil dicabut' : 'Pencabutan gagal'}</span>
          <span className="ml-2" style={{ color: 'var(--brand-muted)' }}>{revokeOperation.processed_count}/{revokeOperation.total_count} diproses</span>
          {revokeOperation.error_message ? <p className="mt-1 text-red-700">{revokeOperation.error_message}</p> : null}
        </div>
      ) : null}
      {dispatchOperation ? (
        <div className="mt-3 border-y py-3 text-xs" style={{ borderColor: 'var(--brand-border)' }} role="status" aria-live="polite">
          <span className="font-semibold">
            {dispatchOperation.status === 'QUEUED' ? 'Pengiriman undangan mengantre'
              : dispatchOperation.status === 'RUNNING' ? 'Mengirim undangan'
              : dispatchOperation.status === 'COMPLETED' ? 'Pengiriman undangan selesai'
              : 'Pengiriman undangan gagal'}
          </span>
          <span className="ml-2" style={{ color: 'var(--brand-muted)' }}>
            {dispatchOperation.processed_count}/{dispatchOperation.total_count} diproses · {dispatchOperation.success_count} terkirim · {dispatchOperation.failed_count} gagal
          </span>
          {dispatchOperation.error_message ? <p className="mt-1 text-red-700">{dispatchOperation.error_message}</p> : null}
          {dispatchOperation.failed_items.length > 0 ? (
            <p className="mt-1 text-red-700">Gagal: {dispatchOperation.failed_items.join(', ')}</p>
          ) : null}
        </div>
      ) : null}

      <ul className="mt-5 divide-y border-y" style={{ borderColor: 'var(--brand-border)' }}>
        {loading ? <li className="py-3 text-sm" style={{ color: 'var(--brand-muted)' }}>Memuat undangan…</li> : invitations.length === 0 ? <li className="py-3 text-sm" style={{ color: 'var(--brand-muted)' }}>Belum ada penerima yang diundang.</li> : invitations.map((invitation) => {
          const expired = invitation.status === 'PENDING' && new Date(invitation.expires_at) <= new Date();
          const status = expired ? 'Kedaluwarsa' : invitation.status === 'PENDING' ? 'Menunggu RSVP' : invitation.status === 'ACCEPTED' ? 'Diterima' : invitation.status === 'REVOKED' ? 'Dicabut' : 'Kedaluwarsa';
          const contact = [invitation.email, invitation.whatsapp].filter(Boolean).join(' · ');
          return (
            <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{invitation.invitee_name || contact}</span>
                {invitation.invitee_name ? <span className="block truncate text-xs" style={{ color: 'var(--brand-muted)' }}>{contact}</span> : null}
                <span className="mt-1 block text-xs" style={{ color: 'var(--brand-muted)' }}>{status} · sampai {new Date(invitation.expires_at).toLocaleDateString('id-ID')}{invitation.email ? ` · email ${invitation.email_delivery_status === 'SENT' ? 'terkirim' : invitation.email_delivery_status === 'FAILED' ? 'gagal' : 'belum dikirim'}` : invitation.whatsapp ? ' · bagikan lewat WhatsApp' : ' · tautan terbuka'}</span>
              </span>
              <span className="flex shrink-0 gap-2">
                {invitation.status === 'PENDING' && !expired ? (
                  <>
                    <a href={makeShareUrl(invitation.id, invitePolicy === 'INVITE_ONLY')} target="_blank" rel="noopener noreferrer" className="rounded border px-3 py-2 text-xs font-semibold" style={{ borderColor: 'var(--brand-border)' }}>Buka undangan</a>
                    <button type="button" onClick={() => void revokeInvitation(invitation.id)} disabled={busyId === invitation.id} className="rounded border px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ borderColor: 'var(--brand-border)' }}>Cabut</button>
                  </>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => void savePendingContacts()} disabled={pendingContacts.length === 0} className="rounded-full border px-6 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ borderColor: 'var(--brand-border)' }}>
          Simpan
        </button>
        <button type="button" onClick={() => void submitInvitationStage()} disabled={submitting || dispatchOperation?.status === 'QUEUED' || dispatchOperation?.status === 'RUNNING' || (invitePolicy === 'INVITE_ONLY' && invitations.length === 0 && pendingContacts.length === 0)} className="rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}>
          {submitting ? 'Menyiapkan undangan…' : dispatchOperation?.status === 'QUEUED' || dispatchOperation?.status === 'RUNNING' ? 'Mengirim undangan…' : 'Submit'}
        </button>
        {canCancel && onCancel ? (
          <button type="button" onClick={onCancel} disabled={submitting || cancelling} className="rounded-full border border-red-500 px-6 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50">
            {cancelling ? 'Membatalkan…' : 'Batalkan rencana'}
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-[11px]" style={{ color: 'var(--brand-muted)' }}>WhatsApp belum memiliki engine pengiriman. Kontak WhatsApp menggunakan tautan manual.</p>
      <ConfirmDialog
        open={Boolean(error)}
        title="Terjadi Kesalahan"
        message={error}
        confirmLabel="Tutup"
        showCancel={false}
        variant="danger"
        onConfirm={() => setError('')}
        onCancel={() => setError('')}
      />
    </section>
  );
}
