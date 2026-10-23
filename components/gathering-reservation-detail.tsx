'use client';

import QRCode from 'qrcode';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type ReservationAction = 'WAITING_INVOICE' | 'PAY' | 'PAYMENT_PENDING' | 'WAITING_CONFIRMATION' | 'TICKET' | 'ATTENDED' | 'NONE';

interface ReservationDetail {
  id: string;
  gathering_title: string;
  plan_number: string;
  initiator_name: string;
  event_date: string | null;
  event_location: string | null;
  gathering_status: string;
  final_options: string[];
  attendee_name: string | null;
  is_attendee: boolean;
  registration_status: string | null;
  payment_status: string | null;
  checked_in_at: string | null;
  action: ReservationAction;
  price_per_seat: number;
  currency: string;
  payment_deadline: string | null;
  invoice_path: string | null;
  ticket: { url: string; status: 'VALID' | 'CHECKED_IN' } | null;
}

const GATHERING_STATUS: Record<string, string> = {
  PREORDER: 'Perencanaan',
  RSVP_OPEN: 'RSVP dibuka',
  PAYMENT_OPEN: 'Pembayaran seat dibuka',
  CONFIRMED: 'Acara dikonfirmasi',
  IN_PROGRESS: 'Acara berlangsung',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

const PAYMENT_STATUS: Record<string, string> = {
  UNPAID: 'Belum dibayar',
  PENDING_PAYMENT: 'Pembayaran diproses',
  PAID: 'Lunas',
  REFUNDED: 'Direfund',
};

/** Penjelasan di area tiket saat QR belum/tidak tersedia. */
const TICKET_NOTE: Record<ReservationAction, string> = {
  WAITING_INVOICE: 'Tiket tersedia setelah tagihan terbit, dibayar, dan acara dikonfirmasi.',
  PAY: 'Selesaikan pembayaran seat. Tiket tersedia setelah acara dikonfirmasi penyelenggara.',
  PAYMENT_PENDING: 'Pembayaran sedang diproses. Tiket tersedia setelah lunas dan acara dikonfirmasi.',
  WAITING_CONFIRMATION: 'Seat Anda sudah lunas. Tiket QR muncul di sini setelah penyelenggara mengonfirmasi acara.',
  TICKET: '',
  ATTENDED: '',
  NONE: 'Tiket tidak tersedia untuk reservasi ini.',
};

function formatDate(value?: string | null) {
  if (!value) return 'Belum ditentukan';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Belum ditentukan' : date.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'short' });
}

export function GatheringReservationDetail({ registrationId, websiteId, websiteName, basePath }: {
  registrationId: string;
  websiteId: string;
  websiteName: string;
  basePath: string;
}) {
  const [detail, setDetail] = useState<ReservationDetail | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const backHref = `${basePath}/calendar?tab=undangan`;

  useEffect(() => {
    let cancelled = false;
    const load = () => fetch(`/api/gathering/reservations/${encodeURIComponent(registrationId)}?website_id=${encodeURIComponent(websiteId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as ReservationDetail | { message?: string } | null;
        if (response.status === 401) {
          if (!cancelled) setNeedsLogin(true);
          return;
        }
        if (!response.ok) throw new Error((payload as { message?: string } | null)?.message || 'Reservasi tidak ditemukan.');
        if (!cancelled) setDetail(payload as ReservationDetail);
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Reservasi tidak dapat dimuat.'); });
    void load();
    // Status check-in diperbarui saat peserta kembali ke tab ini setelah di-scan panitia.
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [registrationId, websiteId]);

  useEffect(() => {
    if (!detail?.ticket?.url) return;
    let cancelled = false;
    void QRCode.toDataURL(detail.ticket.url, { width: 320, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => { if (!cancelled) setQrDataUrl(url); });
    return () => { cancelled = true; };
  }, [detail?.ticket?.url]);

  const shell = (children: React.ReactNode) => (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-5 py-4">
          <span className="text-sm font-semibold">{websiteName}</span>
          <Link href={backHref} className="text-xs font-medium text-zinc-600 underline">Kembali ke undangan</Link>
        </div>
      </header>
      <article className="mx-auto max-w-2xl px-5 py-8">{children}</article>
    </main>
  );

  if (needsLogin) {
    const next = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '';
    return shell(
      <>
        <h1 className="text-xl font-semibold">Masuk untuk melihat reservasi</h1>
        <p className="mt-3 text-sm text-zinc-600">Gunakan akun Bagdja dengan email yang sama seperti saat RSVP.</p>
        <a href={`/auth/login?next=${encodeURIComponent(next)}`} className="mt-5 inline-flex rounded bg-zinc-900 px-5 py-3 text-sm font-semibold text-white">Masuk</a>
      </>,
    );
  }
  if (error) return shell(<><h1 className="text-xl font-semibold">Reservasi tidak tersedia</h1><p className="mt-3 text-sm text-zinc-600">{error}</p></>);
  if (!detail) return shell(<p className="text-sm text-zinc-500">Memuat reservasi…</p>);

  const price = new Intl.NumberFormat('id-ID', { style: 'currency', currency: detail.currency || 'IDR', maximumFractionDigits: 0 }).format(detail.price_per_seat);
  const paymentLabel = detail.payment_status ? PAYMENT_STATUS[detail.payment_status] ?? detail.payment_status : '-';
  const cancelled = detail.registration_status === 'CANCELLED' || detail.gathering_status === 'CANCELLED';

  return shell(
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Detail reservasi</p>
      <h1 className="mt-2 text-2xl font-semibold">{detail.gathering_title}</h1>
      <p className="mt-1 text-sm text-zinc-600">{GATHERING_STATUS[detail.gathering_status] ?? detail.gathering_status} · Diundang oleh {detail.initiator_name}</p>

      <section aria-labelledby="ticket-heading" className="mt-6 border border-zinc-200 bg-white px-5 py-6">
        <h2 id="ticket-heading" className="text-sm font-semibold">Tiket masuk</h2>
        {detail.ticket ? (
          <div className="mt-4 flex flex-col items-center">
            <div className={`mb-4 w-full border px-3 py-2 text-center text-sm font-semibold ${detail.ticket.status === 'CHECKED_IN' ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
              {detail.ticket.status === 'CHECKED_IN' ? `Sudah check-in · ${formatDate(detail.checked_in_at)}` : 'Tiket aktif — tunjukkan QR ini saat check-in'}
            </div>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt={`QR tiket ${detail.attendee_name ?? ''}`} width={280} height={280} className={`h-auto w-full max-w-[280px] ${detail.ticket.status === 'CHECKED_IN' ? 'opacity-40' : ''}`} />
            ) : (
              <div className="flex aspect-square w-full max-w-[280px] items-center justify-center bg-zinc-100 text-sm text-zinc-500">Menyiapkan QR…</div>
            )}
            <p className="mt-4 text-center text-lg font-semibold">{detail.attendee_name}</p>
            <p className="mt-1 text-center text-xs text-zinc-500">Satu QR hanya bisa dipakai check-in sekali. Jangan bagikan ke orang lain.</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">
            {!detail.is_attendee && detail.payment_status === 'PAID'
              ? `Anda membayar seat untuk ${detail.attendee_name}. Tiket QR hanya dapat dibuka oleh ${detail.attendee_name} melalui akunnya atau email tiket.`
              : cancelled ? 'Reservasi ini dibatalkan.' : TICKET_NOTE[detail.action]}
          </p>
        )}
      </section>

      <section className="mt-6 border-y border-zinc-200 bg-white px-5 py-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-xs text-zinc-500">Jadwal</dt><dd className="mt-1 text-sm font-medium">{formatDate(detail.event_date)}</dd></div>
          <div><dt className="text-xs text-zinc-500">Lokasi</dt><dd className="mt-1 text-sm font-medium">{detail.event_location || 'Belum ditentukan'}</dd></div>
          {detail.final_options.length ? (
            <div><dt className="text-xs text-zinc-500">Pilihan final</dt><dd className="mt-1 text-sm font-medium">{detail.final_options.join(', ')}</dd></div>
          ) : null}
          <div><dt className="text-xs text-zinc-500">Nama peserta</dt><dd className="mt-1 text-sm font-medium">{detail.attendee_name ?? '-'}</dd></div>
          <div><dt className="text-xs text-zinc-500">Nomor rencana</dt><dd className="mt-1 text-sm font-medium">{detail.plan_number}</dd></div>
          <div><dt className="text-xs text-zinc-500">Harga seat</dt><dd className="mt-1 text-sm font-medium">{price}</dd></div>
          <div><dt className="text-xs text-zinc-500">Status pembayaran</dt><dd className="mt-1 text-sm font-medium">{paymentLabel}</dd></div>
          {detail.payment_deadline && ['PAY', 'PAYMENT_PENDING'].includes(detail.action) ? (
            <div><dt className="text-xs text-zinc-500">Batas pembayaran</dt><dd className="mt-1 text-sm font-medium">{formatDate(detail.payment_deadline)}</dd></div>
          ) : null}
        </dl>
        {detail.invoice_path ? (
          <div className="mt-5 flex flex-wrap gap-3 border-t border-zinc-200 pt-4">
            <Link
              href={`${basePath}${detail.invoice_path}`}
              className={['PAY', 'PAYMENT_PENDING'].includes(detail.action)
                ? 'inline-flex rounded bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white'
                : 'inline-flex rounded border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-900'}
            >
              {detail.action === 'PAY' ? 'Bayar seat' : detail.action === 'PAYMENT_PENDING' ? 'Lanjutkan pembayaran' : 'Lihat tagihan'}
            </Link>
          </div>
        ) : null}
      </section>
    </>,
  );
}
