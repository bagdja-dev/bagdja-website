'use client';

import { useEffect, useState } from 'react';

function formatLocalDate(value?: string | null) {
  if (!value) return 'Belum ditentukan';
  const date = new Date(value);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return Number.isNaN(date.getTime()) ? 'Belum ditentukan' : date.toLocaleString('id-ID', { timeZone });
}

interface PublicGatheringInvoice {
  id: string;
  invoice_id: string;
  gathering_title: string;
  initiator_name: string;
  attendee_name: string;
  amount: number;
  currency: string;
  payment_status: string;
  invoice_issued_at: string;
  payment_deadline?: string | null;
  event_date?: string | null;
  payment_open: boolean;
}

export function GatheringInvoicePage({ registrationId, websiteName }: { registrationId: string; websiteName: string }) {
  const [invoice, setInvoice] = useState<PublicGatheringInvoice | null>(null);
  const [loadError, setLoadError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/public/gathering-invoices/${encodeURIComponent(registrationId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as PublicGatheringInvoice | { message?: string } | null;
        if (!response.ok) throw new Error((payload as { message?: string } | null)?.message || 'Tagihan tidak ditemukan.');
        if (!cancelled) setInvoice(payload as PublicGatheringInvoice);
      })
      .catch((error) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Tagihan tidak dapat dimuat.'); });
    return () => { cancelled = true; };
  }, [registrationId]);

  async function loginAndPay() {
    if (paying || !invoice?.payment_open || ['PAID', 'REFUNDED'].includes(invoice.payment_status)) return;
    setPaying(true);
    setPaymentError('');
    try {
      const orderResponse = await fetch(`/api/gathering/registrations/${encodeURIComponent(registrationId)}/seat-order`, { method: 'POST' });
      const order = await orderResponse.json().catch(() => null) as { id?: string; checkout_url?: string | null; message?: string } | null;
      if (orderResponse.status === 401) {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.assign(`/auth/login?next=${encodeURIComponent(next)}`);
        return;
      }
      if (!orderResponse.ok || !order?.id) throw new Error('Login dengan email yang sama seperti RSVP, atau minta initiator membayar tagihan ini.');
      if (order.checkout_url) {
        window.location.assign(order.checkout_url);
        return;
      }

      const checkoutResponse = await fetch('/api/transactions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_ids: [order.id] }),
      });
      const checkout = await checkoutResponse.json().catch(() => null) as { checkout_url?: string; checkoutUrl?: string; message?: string } | null;
      if (checkoutResponse.status === 401) {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.assign(`/auth/login?next=${encodeURIComponent(next)}`);
        return;
      }
      const checkoutUrl = checkout?.checkout_url ?? checkout?.checkoutUrl;
      if (!checkoutResponse.ok || !checkoutUrl) throw new Error(checkout?.message || 'Checkout belum dapat disiapkan.');
      window.location.assign(checkoutUrl);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Pembayaran belum dapat disiapkan.');
      setPaying(false);
    }
  }

  if (loadError) {
    return <main className="mx-auto max-w-xl px-5 py-16"><h1 className="text-xl font-semibold">Tagihan tidak tersedia</h1><p className="mt-3 text-sm text-zinc-600">{loadError}</p></main>;
  }
  if (!invoice) return <main className="mx-auto max-w-xl px-5 py-16"><p className="text-sm text-zinc-500">Memuat tagihan…</p></main>;

  const amount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: invoice.currency || 'IDR', maximumFractionDigits: 0 }).format(invoice.amount);
  const statusLabel = invoice.payment_status === 'PAID' ? 'Lunas' : invoice.payment_status === 'PENDING_PAYMENT' ? 'Pembayaran sedang diproses' : invoice.payment_status === 'REFUNDED' ? 'Direfund' : 'Belum dibayar';

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white"><div className="mx-auto max-w-2xl px-5 py-4 text-sm font-semibold">{websiteName}</div></header>
      <article className="mx-auto max-w-2xl px-5 py-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Tagihan gathering</p>
        <h1 className="mt-2 text-2xl font-semibold">{invoice.gathering_title}</h1>
        <section className="mt-6 border-y border-zinc-200 bg-white px-5 py-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div><dt className="text-xs text-zinc-500">Nomor tagihan</dt><dd className="mt-1 font-medium">{invoice.invoice_id}</dd></div>
            <div><dt className="text-xs text-zinc-500">Nama peserta</dt><dd className="mt-1 font-medium">{invoice.attendee_name}</dd></div>
            <div><dt className="text-xs text-zinc-500">Initiator gathering</dt><dd className="mt-1 font-medium">{invoice.initiator_name}</dd></div>
            <div><dt className="text-xs text-zinc-500">Batas pembayaran</dt><dd className="mt-1 font-medium">{formatLocalDate(invoice.payment_deadline)}</dd></div>
            <div><dt className="text-xs text-zinc-500">Tanggal acara</dt><dd className="mt-1 font-medium">{formatLocalDate(invoice.event_date)}</dd></div>
          </dl>
          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-3 border-t border-zinc-200 pt-4">
            <span className="text-sm text-zinc-600">Status: {statusLabel}</span>
            <strong className="text-xl">{amount}</strong>
          </div>
          {invoice.payment_status === 'PENDING_PAYMENT' ? <p className="mt-4 text-sm text-zinc-600">Pembayaran untuk tagihan ini sedang diproses. Tidak perlu memulai pembayaran baru.</p> : null}
        </section>
        {invoice.payment_status !== 'PAID' && invoice.payment_status !== 'REFUNDED' && invoice.payment_status !== 'PENDING_PAYMENT' ? (
          <section className="mt-6 border-l-2 border-zinc-500 pl-4">
            <h2 className="text-sm font-semibold">Mengapa perlu login untuk membayar?</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Akun Bagdja digunakan untuk menghubungkan pembayaran escrow dengan peserta dan membuat dompet tujuan refund. Jika acara dibatalkan, dana dikembalikan ke dompet pihak yang membayar.</p>
            <p className="mt-2 text-xs text-zinc-500">Untuk membayar sendiri, masuk dengan email yang digunakan saat RSVP. Initiator juga dapat membayar beberapa tagihan sekaligus dari halaman gathering.</p>
          </section>
        ) : null}
        {paymentError ? <p role="alert" className="mt-4 text-sm text-red-700">{paymentError}</p> : null}
        {invoice.payment_status !== 'PAID' && invoice.payment_status !== 'REFUNDED' ? (
          <button type="button" onClick={() => void loginAndPay()} disabled={paying || !invoice.payment_open} className="mt-6 rounded bg-zinc-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {paying ? 'Menyiapkan pembayaran…' : !invoice.payment_open ? 'Pembayaran belum dibuka' : invoice.payment_status === 'PENDING_PAYMENT' ? 'Lanjutkan pembayaran' : 'Login untuk membayar'}
          </button>
        ) : null}
      </article>
    </main>
  );
}
