'use client';

import { useEffect, useState } from 'react';

function formatLocalDate(value?: string | null) {
  if (!value) return 'Belum ditentukan';
  const date = new Date(value);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return Number.isNaN(date.getTime()) ? 'Belum ditentukan' : date.toLocaleString('id-ID', { timeZone });
}

interface InvitePreview {
  invitation: { invitee_name?: string | null; expires_at: string };
  group: {
    id: string;
    title: string;
    plan_number: string;
    initiator_name: string;
    invite_policy: 'OPEN' | 'INVITE_ONLY';
    workflow_step: string;
    invitation_banner_url?: string | null;
    invitation_description?: string | null;
  };
  occurrence: {
    status: string;
    price_per_seat: number | string;
    currency: string;
    min_attendees: number;
    max_attendees: number;
    final_schedule?: string | null;
    rsvp_close_at?: string | null;
    payment_deadline?: string | null;
    voting_results?: Record<string, { total_votes: number; options: Record<string, { votes: number; percentage: number }> }>;
    options: GatheringInviteOption[];
  };
  registration?: { id: string; registration_status: string; payment_status: string } | null;
}

interface GatheringInviteOption {
  product_option_id: string;
  option_group_key: string;
  option_key: string;
  label: string;
  description?: string | null;
  venue_location?: string | null;
}

export function GatheringInvitationPreview({ token, websiteName }: { token: string; websiteName: string }) {
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState('');
  const [attendeeName, setAttendeeName] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [votingResults, setVotingResults] = useState<Record<string, { total_votes: number; options: Record<string, { votes: number; percentage: number }> }>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reservationId, setReservationId] = useState('');
  const [reservationExpiresAt, setReservationExpiresAt] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [rsvpError, setRsvpError] = useState('');
  const [registrationId, setRegistrationId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('UNPAID');
  const [paymentUrl, setPaymentUrl] = useState('');
  const [paying, setPaying] = useState(false);
  const [addingReservation, setAddingReservation] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/public/gathering-invitations/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as InvitePreview | { message?: string } | null;
        if (!response.ok) throw new Error((payload as { message?: string } | null)?.message || 'Undangan tidak valid atau sudah kedaluwarsa.');
        if (!cancelled) {
          const invitePreview = payload as InvitePreview;
          setPreview(invitePreview);
          setVotingResults(invitePreview.occurrence.voting_results ?? {});
          const storedRegistrationId = window.sessionStorage.getItem(`gathering-rsvp:${paramsSafeToken(token)}`);
          if (storedRegistrationId) setRegistrationId(storedRegistrationId);
          const storedOptions = window.sessionStorage.getItem(`gathering-rsvp-options:${paramsSafeToken(token)}`);
          if (storedOptions) {
            try { setSelectedOptions(JSON.parse(storedOptions) as Record<string, string>); } catch { window.sessionStorage.removeItem(`gathering-rsvp-options:${paramsSafeToken(token)}`); }
          }
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Undangan tidak dapat dimuat.');
      });
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    if (preview?.group.invite_policy !== 'INVITE_ONLY') return;
    let cancelled = false;
    void fetch(`/api/public/gathering-invitations/${encodeURIComponent(token)}/private-status`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = await response.json().catch(() => null) as { registration?: { id: string; payment_status: string; selected_options?: Record<string, string> } | null } | null;
        if (cancelled || !payload?.registration) return;
        setRegistrationId(payload.registration.id);
        setPaymentStatus(payload.registration.payment_status ?? 'UNPAID');
        if (payload.registration.selected_options) {
          setSelectedOptions(payload.registration.selected_options);
          window.sessionStorage.setItem(`gathering-rsvp-options:${paramsSafeToken(token)}`, JSON.stringify(payload.registration.selected_options));
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [preview?.group.invite_policy, token]);

  useEffect(() => {
    const storedRegistrationId = window.sessionStorage.getItem(`gathering-rsvp:${paramsSafeToken(token)}`);
    if (storedRegistrationId) setRegistrationId(storedRegistrationId);
  }, [token]);

  useEffect(() => {
    if (!registrationId) return;
    let cancelled = false;
    void fetch(`/api/gathering/registrations/${encodeURIComponent(registrationId)}/receipt`, { cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as { payment_status?: string; checkout_url?: string | null } | null;
        if (response.ok && !cancelled && payload?.payment_status) {
          setPaymentStatus(payload.payment_status);
          setPaymentUrl(payload.checkout_url ?? '');
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [registrationId]);

  if (error) {
    return <main className="mx-auto max-w-xl px-5 py-16"><h1 className="text-xl font-semibold">Undangan tidak tersedia</h1><p className="mt-3 text-sm text-zinc-600">{error}</p></main>;
  }
  if (!preview) {
    return <main className="mx-auto max-w-xl px-5 py-16"><p className="text-sm text-zinc-500">Memuat undangan…</p></main>;
  }

  const { occurrence } = preview;
  const price = new Intl.NumberFormat('id-ID', { style: 'currency', currency: occurrence.currency || 'IDR', maximumFractionDigits: 0 }).format(Number(occurrence.price_per_seat));
  const privateInvite = preview.group.invite_policy === 'INVITE_ONLY';
  const groupedOptions = new Map<string, GatheringInviteOption[]>();
  occurrence.options.forEach((option) => groupedOptions.set(option.option_group_key, [...(groupedOptions.get(option.option_group_key) ?? []), option]));
  const rsvpAvailable = occurrence.status === 'RSVP_OPEN'
    && (!occurrence.rsvp_close_at || new Date(occurrence.rsvp_close_at) > new Date());

  async function submitRsvp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setRsvpError('');
    const body = {
      attendee_name: attendeeName.trim(),
      email: email.trim(),
      whatsapp: whatsapp.trim() || undefined,
      selected_options: selectedOptions,
    };
    try {
      const endpoint = privateInvite
        ? `/api/public/gathering-invitations/${encodeURIComponent(token)}/private-rsvp`
        : `/api/public/gathering-invitations/${encodeURIComponent(token)}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as { id?: string; reservation_id?: string; expires_at?: string; selected_options?: Record<string, string>; voting_results?: typeof votingResults; message?: string } | null;
      if (!response.ok) {
        if (privateInvite && response.status === 401) {
          const next = `${window.location.pathname}${window.location.search}`;
          window.location.assign(`/auth/login?next=${encodeURIComponent(next)}`);
          return;
        }
        throw new Error(payload?.message || 'RSVP gagal dikirim.');
      }
      if (!privateInvite) {
        if (!payload?.reservation_id) throw new Error(payload?.message || 'Reservasi tidak dapat disiapkan.');
        setReservationId(payload.reservation_id);
        setReservationExpiresAt(payload.expires_at ?? '');
        setSubmitted(false);
        return;
      }
      if (!payload?.id) throw new Error('RSVP terkirim tetapi status pendaftaran tidak dapat dimuat.');
      setRegistrationId(payload.id);
      if (payload.selected_options) setSelectedOptions(payload.selected_options);
      if (payload.voting_results) setVotingResults(payload.voting_results);
      window.sessionStorage.setItem(`gathering-rsvp:${paramsSafeToken(token)}`, payload.id);
      window.sessionStorage.setItem(`gathering-rsvp-options:${paramsSafeToken(token)}`, JSON.stringify(payload.selected_options ?? selectedOptions));
      setSubmitted(true);
      const refreshed = await fetch(`/api/public/gathering-invitations/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const updatedPreview = await refreshed.json().catch(() => null) as InvitePreview | null;
      if (refreshed.ok && updatedPreview) {
        setPreview(updatedPreview);
        setVotingResults(updatedPreview.occurrence.voting_results ?? {});
      }
    } catch (cause) {
      setRsvpError(cause instanceof Error ? cause.message : 'RSVP gagal dikirim.');
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyRsvp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verifying || !reservationId) return;
    setVerifying(true);
    setRsvpError('');
    try {
      const response = await fetch(`/api/public/gathering-invitations/${encodeURIComponent(token)}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: reservationId, code: verificationCode.trim() }),
      });
      const payload = await response.json().catch(() => null) as { id?: string; selected_options?: Record<string, string>; voting_results?: typeof votingResults; message?: string } | null;
      if (!response.ok || !payload?.id) throw new Error(payload?.message || 'Kode verifikasi tidak valid.');
      setRegistrationId(payload.id);
      if (payload.selected_options) setSelectedOptions(payload.selected_options);
      if (payload.voting_results) setVotingResults(payload.voting_results);
      setPaymentStatus('UNPAID');
      window.sessionStorage.setItem(`gathering-rsvp:${paramsSafeToken(token)}`, payload.id);
      window.sessionStorage.setItem(`gathering-rsvp-options:${paramsSafeToken(token)}`, JSON.stringify(payload.selected_options ?? selectedOptions));
      setReservationId('');
      setVerificationCode('');
      setSubmitted(true);
      setAddingReservation(false);
      const refreshed = await fetch(`/api/public/gathering-invitations/${encodeURIComponent(token)}`, { cache: 'no-store' });
      const updatedPreview = await refreshed.json().catch(() => null) as InvitePreview | null;
      if (refreshed.ok && updatedPreview) {
        setPreview(updatedPreview);
        setVotingResults(updatedPreview.occurrence.voting_results ?? {});
      }
    } catch (cause) {
      setRsvpError(cause instanceof Error ? cause.message : 'Kode verifikasi tidak valid.');
    } finally {
      setVerifying(false);
    }
  }

  async function resendVerificationCode() {
    if (resending) return;
    setResending(true);
    setRsvpError('');
    try {
      const response = await fetch(`/api/public/gathering-invitations/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendee_name: attendeeName.trim(),
          email: email.trim(),
          whatsapp: whatsapp.trim() || undefined,
          selected_options: selectedOptions,
        }),
      });
      const payload = await response.json().catch(() => null) as { reservation_id?: string; expires_at?: string; message?: string } | null;
      if (!response.ok || !payload?.reservation_id) throw new Error(payload?.message || 'Kode baru belum dapat dikirim.');
      setReservationId(payload.reservation_id);
      setReservationExpiresAt(payload.expires_at ?? '');
      setVerificationCode('');
    } catch (cause) {
      setRsvpError(cause instanceof Error ? cause.message : 'Kode baru belum dapat dikirim.');
    } finally {
      setResending(false);
    }
  }

  async function payForSeat() {
    if (!registrationId || paying) return;
    setPaying(true);
    setRsvpError('');
    try {
      // Selalu lewat seat-order (jangan buka paymentUrl tersimpan): untuk checkout yang
      // masih pending, backend menerbitkan ulang sesi Pay UI karena link lama bisa sudah kedaluwarsa.
      const orderResponse = await fetch(`/api/gathering/registrations/${encodeURIComponent(registrationId)}/seat-order`, { method: 'POST' });
      const order = await orderResponse.json().catch(() => null) as { id?: string; checkout_url?: string | null; message?: string } | null;
      if (orderResponse.status === 401) {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.assign(`/auth/login?next=${encodeURIComponent(next)}`);
        return;
      }
      if (!orderResponse.ok || !order?.id) throw new Error(order?.message || 'Gagal menyiapkan order seat.');
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
      if (!checkoutResponse.ok || !checkoutUrl) throw new Error(checkout?.message || 'Checkout pembayaran tidak berhasil disiapkan.');
      window.location.assign(checkoutUrl);
    } catch (cause) {
      setRsvpError(cause instanceof Error ? cause.message : 'Gagal membuka pembayaran seat.');
    } finally {
      setPaying(false);
    }
  }

  function startAnotherReservation() {
    setAttendeeName('');
    setEmail('');
    setWhatsapp('');
    setSelectedOptions({});
    setRsvpError('');
    setSubmitted(false);
    setAddingReservation(true);
  }

  const reservationForm = (
    <form onSubmit={submitRsvp} className="mt-6 border-y border-zinc-200 py-5">
      <h2 className="text-sm font-semibold">Ajukan reservasi</h2>
      <p className="mt-1 text-xs text-zinc-600">Harga seat {price}. Setelah mengirim, masukkan kode email untuk mengonfirmasi reservasi.</p>
      {privateInvite ? <p className="mt-3 border-l-2 border-zinc-400 pl-3 text-xs text-zinc-600">Undangan privat: masuk dengan akun yang memakai email undangan untuk mengonfirmasi.</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-medium">Nama peserta<input required maxLength={255} value={attendeeName} onChange={(event) => setAttendeeName(event.target.value)} className="mt-1.5 w-full rounded border border-zinc-300 px-3 py-2.5 text-sm" /></label>
        <label className="text-xs font-medium">Email<input required type="email" maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded border border-zinc-300 px-3 py-2.5 text-sm" /></label>
        <label className="block text-xs font-medium sm:col-span-2">WhatsApp (opsional)<input type="tel" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="+62…" className="mt-2 block w-full rounded border border-zinc-300 px-3 py-2.5 text-sm sm:max-w-sm" /></label>
      </div>
      {[...groupedOptions.entries()].map(([groupKey, options]) => (
        <fieldset key={groupKey} className="mt-5">
          <legend className="text-xs font-semibold">{groupKey}</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {options.map((option) => (
              <GatheringVoteOptionCard
                key={option.product_option_id}
                option={option}
                votes={votingResults[groupKey]?.options[option.product_option_id]?.votes ?? 0}
                totalVotes={votingResults[groupKey]?.total_votes ?? 0}
                percentage={votingResults[groupKey]?.options[option.product_option_id]?.percentage ?? 0}
                selected={selectedOptions[groupKey] === option.product_option_id}
                onSelect={() => setSelectedOptions((current) => ({ ...current, [groupKey]: option.product_option_id }))}
                name={`option-${groupKey}`}
              />
            ))}
          </div>
        </fieldset>
      ))}
      {rsvpError ? <p role="alert" className="mt-4 text-sm text-red-700">{rsvpError}</p> : null}
      {submitted ? <p role="status" className="mt-4 text-sm text-green-700">RSVP berhasil dikirim.</p> : null}
      <button type="submit" disabled={submitting} className="mt-5 rounded bg-zinc-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Mengirim kode…' : privateInvite ? 'Konfirmasi RSVP' : 'Kirim kode verifikasi'}</button>
    </form>
  );

  return (
    <main className="min-h-screen bg-white text-zinc-900">
      <header className="border-b border-zinc-200"><div className="mx-auto max-w-2xl px-5 py-4 text-sm font-semibold">{websiteName}</div></header>
      <article className="mx-auto max-w-2xl px-5 py-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Undangan gathering</p>
        {preview.group.invitation_banner_url ? <img src={preview.group.invitation_banner_url} alt={`Banner ${preview.group.title}`} className="mt-4 aspect-[16/8] w-full object-cover" /> : null}
        <h1 className="mt-2 text-2xl font-semibold">{preview.group.title}</h1>
        <p className="mt-1 text-xs text-zinc-500">Nomor rencana: {preview.group.plan_number}</p>
        <p className="mt-2 text-sm text-zinc-600">Diprakarsai oleh <strong className="font-semibold text-zinc-800">{preview.group.initiator_name}</strong></p>
        {preview.invitation.invitee_name ? <p className="mt-2 text-sm text-zinc-600">Untuk {preview.invitation.invitee_name}</p> : null}
        {preview.group.invitation_description ? <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-zinc-700">{preview.group.invitation_description}</p> : null}
        <dl className="mt-6 grid gap-4 border-y border-zinc-200 py-5 sm:grid-cols-2">
          <div><dt className="text-xs uppercase text-zinc-500">Harga per peserta</dt><dd className="mt-1 font-semibold">{price}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Batas peserta</dt><dd className="mt-1 font-semibold">Min. {occurrence.min_attendees} · Maks. {occurrence.max_attendees}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Jadwal</dt><dd className="mt-1 font-semibold">{formatLocalDate(occurrence.final_schedule)}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Batas RSVP</dt><dd className="mt-1 font-semibold">{formatLocalDate(occurrence.rsvp_close_at)}</dd></div>
          <div><dt className="text-xs uppercase text-zinc-500">Status</dt><dd className="mt-1 font-semibold">{occurrence.status === 'PREORDER' ? 'Perencanaan' : occurrence.status === 'RSVP_OPEN' ? 'Pendaftaran dibuka' : occurrence.status === 'PAYMENT_OPEN' ? 'Pembayaran dibuka' : occurrence.status}</dd></div>
        </dl>
        <p className="mt-6 border-l-2 border-zinc-500 pl-3 text-sm text-zinc-600">Undangan ini valid sampai {new Date(preview.invitation.expires_at).toLocaleDateString('id-ID')}.</p>
        {registrationId && Object.keys(selectedOptions).length > 0 ? (
          <section className="mt-6">
            <h2 className="text-sm font-semibold">Pilihan voting Anda</h2>
            <p className="mt-1 text-xs text-zinc-500">Opsi lain disembunyikan setelah RSVP dikonfirmasi.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {[...groupedOptions.entries()].flatMap(([groupKey, options]) => {
                const option = options.find((item) => item.product_option_id === selectedOptions[groupKey]);
                if (!option) return [];
                const result = votingResults[groupKey]?.options[option.product_option_id] ?? { votes: 0, percentage: 0 };
                const totalVotes = votingResults[groupKey]?.total_votes ?? 0;
                return [<GatheringVoteOptionCard key={option.product_option_id} option={option} votes={result.votes} totalVotes={totalVotes} percentage={result.percentage} selected voted />];
              })}
            </div>
          </section>
        ) : null}
        {reservationId ? (
          <form onSubmit={verifyRsvp} className="mt-6 border-y border-zinc-200 py-5">
            <h2 className="text-sm font-semibold">Konfirmasi email</h2>
            <p className="mt-1 text-sm text-zinc-600">Reservasi sementara sudah dibuat. Masukkan kode 6 digit yang dikirim ke <strong>{email.trim()}</strong> untuk mengonfirmasi RSVP.</p>
            {reservationExpiresAt ? <p className="mt-1 text-xs text-zinc-500">Kode berlaku sampai {new Date(reservationExpiresAt).toLocaleTimeString('id-ID')}.</p> : null}
            <label className="mt-4 block text-xs font-medium">Kode verifikasi
              <input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className="mt-2 block w-full rounded border border-zinc-300 px-3 py-2.5 text-lg tracking-[0.3em] sm:max-w-xs" />
            </label>
            {rsvpError ? <p role="alert" className="mt-4 text-sm text-red-700">{rsvpError}</p> : null}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={verifying || verificationCode.length !== 6} className="rounded bg-zinc-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{verifying ? 'Memverifikasi…' : 'Verifikasi & konfirmasi reservasi'}</button>
              <button type="button" onClick={() => void resendVerificationCode()} disabled={resending} className="px-2 py-2 text-sm font-semibold underline disabled:opacity-50">{resending ? 'Mengirim kode…' : 'Kirim ulang kode'}</button>
            </div>
          </form>
        ) : registrationId ? (
          <>
            <section className="mt-6 border-y border-zinc-200 py-5" role="status">
              <h2 className="text-sm font-semibold">RSVP sudah tercatat</h2>
              <p className="mt-2 text-sm text-zinc-600">Status peserta: Terdaftar. Pembayaran: {paymentStatus === 'PAID' ? 'Lunas' : paymentStatus === 'PENDING_PAYMENT' ? 'Menunggu pembayaran' : 'Belum dibayar'}.</p>
              {occurrence.status === 'PAYMENT_OPEN' && paymentStatus !== 'PAID' ? <button type="button" onClick={() => void payForSeat()} disabled={paying} className="mt-4 rounded bg-zinc-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{paying ? 'Menyiapkan pembayaran…' : paymentUrl ? 'Lanjutkan pembayaran' : 'Bayar seat'}</button> : null}
              {rsvpAvailable ? <button type="button" onClick={startAnotherReservation} className="mt-4 rounded border border-zinc-300 px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50">Tambah reservasi</button> : null}
              {rsvpError ? <p role="alert" className="mt-3 text-sm text-red-700">{rsvpError}</p> : null}
              {occurrence.status !== 'PAYMENT_OPEN' ? <p className="mt-2 text-xs text-zinc-500">Pemilik gathering akan membuka pembayaran setelah konfirmasi reservasi.</p> : null}
            </section>
            {addingReservation && rsvpAvailable ? reservationForm : null}
          </>
        ) : rsvpAvailable ? reservationForm : (
          <p className="mt-6 border-l-2 border-zinc-400 pl-3 text-sm text-zinc-600">RSVP belum dibuka atau masa reservasi sudah berakhir.</p>
        )}
      </article>
    </main>
  );
}

function paramsSafeToken(token: string) {
  return token.replace(/[^A-Za-z0-9_-]/g, '_');
}

function GatheringVoteOptionCard({
  option,
  votes,
  totalVotes,
  percentage,
  selected,
  voted = false,
  onSelect,
  name,
}: {
  option: GatheringInviteOption;
  votes: number;
  totalVotes: number;
  percentage: number;
  selected: boolean;
  voted?: boolean;
  onSelect?: () => void;
  name?: string;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block font-semibold">{option.label}</span>
          <span className="mt-1 block text-xs text-zinc-500">{option.option_group_key}{option.venue_location ? ` · ${option.venue_location}` : ''}</span>
          {option.description ? <span className="mt-2 block text-xs font-normal text-zinc-600">{option.description}</span> : null}
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-lg font-bold tabular-nums">{percentage}%</span>
          <span className="block text-[11px] text-zinc-500">{votes} suara</span>
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden bg-zinc-100" role="progressbar" aria-label={`${option.label}: ${percentage}% suara`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
        <div className="h-full bg-zinc-800 transition-[width] duration-300" style={{ width: `${percentage}%` }} />
      </div>
      <span className="mt-2 block text-[11px] text-zinc-500">{totalVotes} suara terverifikasi{selected ? ' · pilihan Anda' : ''}</span>
    </>
  );

  if (voted) {
    return <article className="border-2 border-zinc-900 bg-white p-4 text-sm" aria-label={`${option.label}, pilihan Anda`}>{content}</article>;
  }

  return (
    <label className={`block cursor-pointer border-2 p-4 text-sm transition-colors ${selected ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-400'}`}>
      <input type="radio" required name={name} checked={selected} onChange={onSelect} className="sr-only" />
      {content}
    </label>
  );
}
