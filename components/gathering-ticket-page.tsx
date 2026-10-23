'use client';

import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

interface PublicGatheringTicket {
  attendee_name: string;
  gathering_title: string;
  plan_number: string;
  event_date?: string | null;
  event_location?: string | null;
  gathering_status: string;
  ticket_status: 'VALID' | 'CHECKED_IN' | 'INVALID';
  checked_in_at?: string | null;
  ticket_url: string;
}

function formatLocalDate(value?: string | null) {
  if (!value) return 'Belum ditentukan';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Belum ditentukan'
    : date.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });
}

const STATUS_COPY: Record<PublicGatheringTicket['ticket_status'], { label: string; tone: string; note: string }> = {
  VALID: {
    label: 'Tiket aktif',
    tone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    note: 'Tunjukkan QR ini kepada panitia saat check-in. Satu QR hanya bisa dipakai sekali.',
  },
  CHECKED_IN: {
    label: 'Sudah check-in',
    tone: 'bg-sky-50 text-sky-800 border-sky-200',
    note: 'Kehadiran Anda sudah tercatat. Selamat menikmati acara!',
  },
  INVALID: {
    label: 'Tiket tidak berlaku',
    tone: 'bg-red-50 text-red-800 border-red-200',
    note: 'Seat untuk tiket ini tidak aktif (dibatalkan atau direfund). Hubungi penyelenggara bila menurut Anda ini keliru.',
  },
};

export function GatheringTicketPage({ token, websiteName }: { token: string; websiteName: string }) {
  const [ticket, setTicket] = useState<PublicGatheringTicket | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = () => fetch(`/api/public/gathering-tickets/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as PublicGatheringTicket | { message?: string } | null;
        if (!response.ok) throw new Error((payload as { message?: string } | null)?.message || 'Tiket tidak ditemukan.');
        if (!cancelled) setTicket(payload as PublicGatheringTicket);
      })
      .catch((error) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Tiket tidak dapat dimuat.'); });
    void load();
    // Status check-in diperbarui saat peserta kembali ke tab ini setelah di-scan panitia.
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token]);

  useEffect(() => {
    if (!ticket?.ticket_url) return;
    let cancelled = false;
    void QRCode.toDataURL(ticket.ticket_url, { width: 320, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => { if (!cancelled) setQrDataUrl(url); });
    return () => { cancelled = true; };
  }, [ticket?.ticket_url]);

  if (loadError) {
    return <main className="mx-auto max-w-xl px-5 py-16"><h1 className="text-xl font-semibold">Tiket tidak tersedia</h1><p className="mt-3 text-sm text-zinc-600">{loadError}</p></main>;
  }
  if (!ticket) return <main className="mx-auto max-w-xl px-5 py-16"><p className="text-sm text-zinc-500">Memuat tiket…</p></main>;

  const status = STATUS_COPY[ticket.ticket_status];

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white"><div className="mx-auto max-w-md px-5 py-4 text-sm font-semibold">{websiteName}</div></header>
      <article className="mx-auto max-w-md px-5 py-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Tiket masuk</p>
        <h1 className="mt-2 text-2xl font-semibold">{ticket.gathering_title}</h1>
        <section className="mt-6 border border-zinc-200 bg-white">
          <div className="flex flex-col items-center px-5 pb-6 pt-6">
            <div className={`mb-5 w-full border px-3 py-2 text-center text-sm font-semibold ${status.tone}`}>
              {status.label}
              {ticket.ticket_status === 'CHECKED_IN' && ticket.checked_in_at ? <span className="block text-xs font-normal">{formatLocalDate(ticket.checked_in_at)}</span> : null}
            </div>
            {ticket.ticket_status === 'INVALID' ? null : qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt={`QR tiket ${ticket.attendee_name}`} width={280} height={280} className={`h-auto w-full max-w-[280px] ${ticket.ticket_status === 'CHECKED_IN' ? 'opacity-40' : ''}`} />
            ) : (
              <div className="flex aspect-square w-full max-w-[280px] items-center justify-center bg-zinc-100 text-sm text-zinc-500">Menyiapkan QR…</div>
            )}
            <p className="mt-4 text-center text-lg font-semibold">{ticket.attendee_name}</p>
            <p className="mt-1 text-center text-xs text-zinc-500">{status.note}</p>
          </div>
          <dl className="grid gap-4 border-t border-zinc-200 px-5 py-5 sm:grid-cols-2">
            <div><dt className="text-xs text-zinc-500">Jadwal</dt><dd className="mt-1 text-sm font-medium">{formatLocalDate(ticket.event_date)}</dd></div>
            <div><dt className="text-xs text-zinc-500">Lokasi</dt><dd className="mt-1 text-sm font-medium">{ticket.event_location || 'Belum ditentukan'}</dd></div>
            <div><dt className="text-xs text-zinc-500">Nomor rencana</dt><dd className="mt-1 text-sm font-medium">{ticket.plan_number}</dd></div>
          </dl>
        </section>
        <p className="mt-4 text-xs leading-5 text-zinc-500">Tiket ini bersifat pribadi. Simpan tautannya atau tangkap layar QR sebelum berangkat.</p>
      </article>
    </main>
  );
}
