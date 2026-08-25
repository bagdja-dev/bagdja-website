'use client';

import { useEffect, useState } from 'react';

import { formatWalletTransactionType } from '../lib/wallet-transaction-labels';

interface WalletBalance {
  currency_code: string;
  balance: number;
  held_balance: number;
  is_active: boolean;
}

interface WalletTransactionRow {
  id: string;
  amount: number | string;
  type: string;
  description: string | null;
  currency: string | null;
  created_at: string;
}

interface WalletTransactionsResult {
  data: WalletTransactionRow[];
  meta: { totalPages: number; currentPage: number };
}

interface ProfileContentProps {
  /** Kosong ('') di subdomain/custom domain, `/{slug}` di path-based (local dev). */
  basePath: string;
  auth?: {
    username?: string;
    email?: string;
    avatar?: string;
  };
}

function formatMoney(v: number | string, currency = 'IDR'): string {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!Number.isFinite(n)) return '-';
  return currency === 'IDR' ? `Rp ${n.toLocaleString('id-ID')}` : `${currency} ${n.toLocaleString('id-ID')}`;
}

function formatDate(v: string): string {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ProfileContent({ auth }: ProfileContentProps) {
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);

  const [transactions, setTransactions] = useState<WalletTransactionRow[]>([]);
  const [txPage, setTxPage] = useState(1);
  const [txTotalPages, setTxTotalPages] = useState(1);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setWalletLoading(true);
      setWalletError(null);
      try {
        const res = await fetch('/api/wallet/balance', { credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) setWalletError('Gagal memuat saldo.');
          return;
        }
        const data = (await res.json()) as WalletBalance;
        if (!cancelled) setWallet(data);
      } catch {
        if (!cancelled) setWalletError('Terjadi kesalahan jaringan.');
      } finally {
        if (!cancelled) setWalletLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadTransactions(page: number) {
    setTxLoading(true);
    setTxError(null);
    try {
      const res = await fetch(`/api/wallet/transactions?page=${page}&size=10`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setTransactions([]);
        setTxError('Gagal memuat riwayat transaksi.');
        return;
      }
      const result = (await res.json()) as WalletTransactionsResult;
      setTransactions(Array.isArray(result?.data) ? result.data : []);
      setTxTotalPages(result?.meta?.totalPages || 1);
      setTxPage(result?.meta?.currentPage || page);
    } catch {
      setTransactions([]);
      setTxError('Terjadi kesalahan jaringan.');
    } finally {
      setTxLoading(false);
    }
  }

  useEffect(() => {
    void loadTransactions(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName = auth?.username || auth?.email || 'Pengguna';
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <h1
          className="text-2xl font-bold sm:text-3xl"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
        >
          Profil Saya
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--brand-muted)' }}>
          Info akun, saldo, dan riwayat transaksi Anda.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {/* Card Akun */}
        <div
          className="flex items-center gap-4 rounded-xl border p-5"
          style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}
        >
          {auth?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={auth.avatar} alt={displayName} className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold"
              style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
            >
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{displayName}</p>
            {auth?.email && (
              <p className="truncate text-sm" style={{ color: 'var(--brand-muted)' }}>
                {auth.email}
              </p>
            )}
          </div>
        </div>

        {/* Card Saldo */}
        <div
          className="rounded-xl border p-5"
          style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}
        >
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
            Saldo
          </h2>
          {walletLoading ? (
            <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
              Memuat saldo…
            </p>
          ) : walletError ? (
            <p className="text-sm" style={{ color: 'rgb(185, 28, 28)' }}>
              {walletError}
            </p>
          ) : (
            <div>
              <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                Saldo tersedia
              </p>
              <p className="text-2xl font-bold">
                {formatMoney(wallet?.balance ?? 0, wallet?.currency_code ?? 'IDR')}
              </p>
            </div>
          )}
        </div>

        {/* Card Riwayat Transaksi */}
        <div
          className="rounded-xl border p-5"
          style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}
        >
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
            Riwayat Transaksi
          </h2>

          {txLoading ? (
            <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
              Memuat riwayat…
            </p>
          ) : txError ? (
            <p className="text-sm" style={{ color: 'rgb(185, 28, 28)' }}>
              {txError}
            </p>
          ) : transactions.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
              Belum ada mutasi saldo.
            </p>
          ) : (
            <>
              {/* Tabel — layar sm ke atas */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr style={{ color: 'var(--brand-muted)' }}>
                      <th className="pb-2 pr-3 font-medium">Waktu</th>
                      <th className="pb-2 pr-3 font-medium">Jenis</th>
                      <th className="pb-2 pr-3 font-medium">Keterangan</th>
                      <th className="pb-2 font-medium">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((row) => {
                      const isCredit = Number(row.amount) >= 0;
                      return (
                        <tr key={row.id} style={{ borderTop: '1px solid var(--brand-border)' }}>
                          <td className="py-2 pr-3">{formatDate(row.created_at)}</td>
                          <td className="py-2 pr-3">{formatWalletTransactionType(row.type)}</td>
                          <td className="py-2 pr-3">{row.description || '—'}</td>
                          <td
                            className="py-2 font-medium"
                            style={{ color: isCredit ? 'rgb(22, 163, 74)' : 'rgb(220, 38, 38)' }}
                          >
                            {isCredit ? '+' : '-'}
                            {formatMoney(Math.abs(Number(row.amount)), row.currency || 'IDR')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Kartu — layar kecil */}
              <div className="space-y-2 sm:hidden">
                {transactions.map((row) => {
                  const isCredit = Number(row.amount) >= 0;
                  return (
                    <div
                      key={row.id}
                      className="rounded-lg border p-3"
                      style={{ borderColor: 'var(--brand-border)' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{formatWalletTransactionType(row.type)}</p>
                          {row.description && (
                            <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--brand-muted)' }}>
                              {row.description}
                            </p>
                          )}
                        </div>
                        <span
                          className="shrink-0 text-sm font-semibold"
                          style={{ color: isCredit ? 'rgb(22, 163, 74)' : 'rgb(220, 38, 38)' }}
                        >
                          {isCredit ? '+' : '-'}
                          {formatMoney(Math.abs(Number(row.amount)), row.currency || 'IDR')}
                        </span>
                      </div>
                      <p className="mt-2 text-xs" style={{ color: 'var(--brand-muted)' }}>
                        {formatDate(row.created_at)}
                      </p>
                    </div>
                  );
                })}
              </div>

              {txTotalPages > 1 && (
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    disabled={txPage <= 1}
                    onClick={() => void loadTransactions(txPage - 1)}
                    className="rounded-full border px-4 py-1.5 text-sm font-medium disabled:opacity-40"
                    style={{ borderColor: 'var(--brand-border)' }}
                  >
                    Sebelumnya
                  </button>
                  <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                    Halaman {txPage} dari {txTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={txPage >= txTotalPages}
                    onClick={() => void loadTransactions(txPage + 1)}
                    className="rounded-full border px-4 py-1.5 text-sm font-medium disabled:opacity-40"
                    style={{ borderColor: 'var(--brand-border)' }}
                  >
                    Berikutnya
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
