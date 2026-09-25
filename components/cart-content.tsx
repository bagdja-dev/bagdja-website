'use client';

/**
 * Konten halaman Cart (keranjang) — client component, dirender DI DALAM
 * template (section type `cart`) supaya header/footer/theme konsisten
 * dengan home & halaman lain.
 *
 * Draft order server ADALAH satu-satunya sumber kebenaran (revisi
 * 2026-08-24) — fetch `GET /api/orders?cart=true` (difilter di
 * website-api: PENDING & belum di-claim transaksi), TIDAK ADA lagi
 * fallback ke cart lokal (localStorage). Fallback lokal yang lama bikin
 * produk yang SUDAH di-checkout muncul lagi seolah masih di keranjang
 * begitu draft server-nya habis (root cause: `AddToCartButton` dulu
 * menulis dobel ke server DAN localStorage, tidak pernah dibersihkan
 * setelah checkout) — lihat cart-button.tsx & checkout-content.tsx untuk
 * detail perbaikannya.
 *
 * Qty editable (PATCH via BFF) + hapus (DELETE via BFF).
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface ServerOrder {
  id: string;
  product_id: string;
  website_id: string;
  product?: {
    name?: string;
    description?: string | null;
    images?: string[];
    price?: number;
    parent_product_id?: string | null;
    metadata?: { variant_attributes?: Record<string, string> };
    quotable?: boolean;
    uom?: { symbol?: string } | null;
  };
  quantity: number;
  unit_price: number;
  total_amount: number;
  quoted_total_amount: number | null;
  quoteTermins?: Array<{ sequence: number; label: string; amount: number }>;
  status: string;
  transaction_id: string | null;  payment_mode: string;
  /** Ada kalau produknya punya step Praorder di Fulfillment Flow-nya — TERLEPAS dari harga (bisa produk harga fix yang tetap butuh survey/denah sebelum produksi). */
  praorderProgress?: { flowName: string; steps: { completed: boolean }[] } | null;
}

/** Item cart — 1:1 dengan 1 draft order server. */
interface CartLine {
  key: string;
  orderId: string;
  productId: string;
  name: string;
  description?: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  paymentMode: string;
  variantAttributes?: Record<string, string>;
  isVariant: boolean;
  hasIncompletePraorderSteps: boolean;
  isQuotable: boolean;
  quotedTotal: number | null;
  uomSymbol?: string;
  quoteTermins?: Array<{ sequence: number; label: string; amount: number }>;
}

function CartIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
      />
    </svg>
  );
}

function ViewOrderIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.5-6 9.75-6 9.75 6 9.75 6-3.5 6-9.75 6-9.75-6-9.75-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 .5 9m5-9-.5 9M5 6h14m-9-3h4l1 3H9l1-3Zm-3 3 .7 13h8.6L17 6" />
    </svg>
  );
}

export function CartContent({ basePath, websiteId }: { basePath: string; websiteId: string }) {
  const router = useRouter();
  const [serverOrders, setServerOrders] = useState<ServerOrder[] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const loadServerOrders = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders?cart=true&website_id=${encodeURIComponent(websiteId)}`, { cache: 'no-store' });
      if (!res.ok) {
        setServerError('Gagal memuat keranjang dari server');
        setServerOrders([]);
        return;
      }
      const data = (await res.json()) as { data?: ServerOrder[] };
      setServerOrders(data?.data ?? []);
    } catch {
      setServerError('Gagal memuat keranjang dari server');
      setServerOrders([]);
    }
  }, [websiteId]);

  useEffect(() => {
    void loadServerOrders();
  }, [loadServerOrders]);

  // Beri tahu CartBadge (header) supaya badge ikut ter-update saat item
  // diubah/dihapus dari halaman cart.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('bagdja:cart-changed'));
  }, [serverOrders]);

  const lines: CartLine[] = useMemo(
    () =>
      (serverOrders ?? []).map((o) => ({
        key: o.id,
        orderId: o.id,
        productId: o.product_id,
        name: o.product?.name ?? 'Produk',
        description: o.product?.description ?? undefined,
        image: o.product?.images?.[0],
        unitPrice: Number(o.unit_price),
        quantity: o.quantity,
        paymentMode: o.payment_mode,
        variantAttributes: o.product?.metadata?.variant_attributes,
        isVariant: Boolean(o.product?.parent_product_id),
        hasIncompletePraorderSteps: Boolean(o.praorderProgress?.steps?.some((s) => !s.completed)),
        isQuotable: Boolean(o.product?.quotable),
        quotedTotal: o.quoted_total_amount != null ? Number(o.quoted_total_amount) : null,
        uomSymbol: o.product?.uom?.symbol,
        quoteTermins: o.quoteTermins,
      })),
    [serverOrders],
  );

  // Default: semua item terpilih saat list pertama dimuat.
  useEffect(() => {
    setSelectedKeys(new Set(lines.filter((l) => !l.isQuotable || l.quotedTotal !== null).map((l) => l.key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length > 0 ? lines.map((l) => l.key).join('|') : '']);

  const displayCount = useMemo(
    () => lines.reduce((acc, l) => acc + l.quantity, 0),
    [lines],
  );

  const toggleLine = useCallback((key: string) => {
    const line = lines.find((item) => item.key === key);
    if (!line || (line.isQuotable && line.quotedTotal === null)) return;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedKeys((prev) => {
      const allKeys = lines
        .filter((l) => !l.isQuotable || l.quotedTotal !== null)
        .map((l) => l.key);
      const allSelected = allKeys.every((k) => prev.has(k));
      return allSelected ? new Set<string>() : new Set(allKeys);
    });
  }, [lines]);

  const selectableLines = lines.filter((l) => !l.isQuotable || l.quotedTotal !== null);
  const allSelected = selectableLines.length > 0 && selectableLines.every((l) => selectedKeys.has(l.key));
  const selectedLines = useMemo(() => lines.filter((l) => selectedKeys.has(l.key)), [lines, selectedKeys]);
  const selectedCount = useMemo(
    () => selectedLines.reduce((acc, l) => acc + l.quantity, 0),
    [selectedLines],
  );
  const selectedTotal = useMemo(
    () => selectedLines.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0),
    [selectedLines],
  );
  const hasUnquotedSelected = selectedLines.some((line) => line.isQuotable && line.quotedTotal === null);

  // Item terpilih → order_ids utk checkout multi-item. `basePath` kosong
  // ('') di subdomain/custom domain, `/{slug}` cuma di path-based (local
  // dev) — lihat `resolveTenantLinkBase`. JANGAN prefix `/${slug}` manual,
  // itu bikin URL dobel slug di subdomain (mis.
  // `fashion-store.sites.bagdja.com/fashion-store`).
  const checkoutHref = useMemo(() => {
    if (selectedLines.length === 0) return '#';
    const orderIds = selectedLines.map((l) => l.orderId);
    return `${basePath}/checkout?order_ids=${encodeURIComponent(orderIds.join(','))}`;
  }, [selectedLines, basePath]);

  // Update qty item server → PATCH via BFF → refresh list.
  const changeServerQty = useCallback(
    async (line: CartLine, nextQty: number) => {
      if (nextQty < 1) return;
      setBusyKey(line.key);
      setActionError(null);
      try {
        const res = await fetch(`/api/orders/${line.orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: nextQty }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.message ?? 'Gagal mengubah jumlah item');
        }
        await loadServerOrders();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Gagal mengubah jumlah item');
      } finally {
        setBusyKey(null);
      }
    },
    [loadServerOrders],
  );

  // Hapus item server → DELETE via BFF → refresh list.
  const removeServerItem = useCallback(
    async (line: CartLine) => {
      setBusyKey(line.key);
      setActionError(null);
      try {
        const res = await fetch(`/api/orders/${line.orderId}`, { method: 'DELETE' });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.message ?? 'Gagal menghapus item');
        }
        await loadServerOrders();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Gagal menghapus item');
      } finally {
        setBusyKey(null);
      }
    },
    [loadServerOrders],
  );

  const variantChips = useCallback((line: CartLine) => {
    const attrs = line.variantAttributes;
    if (!attrs || Object.keys(attrs).length === 0) return null;
    return (
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {Object.entries(attrs).map(([axis, value]) => (
          <span
            key={axis}
            className="rounded-lg border px-2 py-0.5 text-xs"
            style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}
          >
            <span style={{ color: 'var(--brand-muted)' }}>{axis}:</span>{' '}
            <span className="font-medium">{value}</span>
          </span>
        ))}
      </div>
    );
  }, []);

  if (serverOrders === null) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-16 text-center">
        <span
          className="h-10 w-10 animate-spin rounded-full border-4 border-current border-t-transparent"
          style={{ color: 'var(--brand-accent)' }}
          role="status"
          aria-label="Memuat keranjang"
        />
        <p className="mt-4 text-sm" style={{ color: 'var(--brand-muted)' }}>
          Memuat keranjang...
        </p>
      </main>
    );
  }

  if (lines.length === 0) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--brand-muted)', color: 'var(--brand-on-accent)' }}
        >
          <CartIcon className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          Keranjang Anda kosong
        </h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--brand-muted)' }}>
          {serverError ?? 'Belum ada produk di keranjang. Yuk mulai belanja!'}
        </p>
        <Link
          href={basePath || '/'}
          className="mt-6 inline-flex rounded-full px-6 py-3 text-xs font-semibold uppercase tracking-wide transition-transform hover:scale-105"
          style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
        >
          Lihat Produk
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
          Pesanan
          <span className="ml-2 text-sm font-normal" style={{ color: 'var(--brand-muted)' }}>
            ({displayCount} item)
          </span>
        </h1>
      </div>

      {actionError && (
        <p
          className="mt-4 rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: 'var(--brand-border)', color: 'crimson' }}
        >
          {actionError}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Daftar item */}
        <div className="min-w-0">
          <button
            type="button"
            onClick={toggleAll}
            className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide hover:opacity-70"
            style={{ color: 'var(--brand-muted)' }}
            role="checkbox"
            aria-checked={allSelected}
          >
            <span
              className="flex h-4 w-4 items-center justify-center rounded border text-[10px] font-bold"
              style={{
                borderColor: allSelected ? 'var(--brand-accent)' : 'var(--brand-border)',
                backgroundColor: allSelected ? 'var(--brand-accent)' : 'transparent',
                color: allSelected ? 'var(--brand-on-accent)' : 'transparent',
              }}
            >
              ✓
            </span>
            {allSelected ? 'Batalkan semua' : 'Pilih semua'}
          </button>
          <ul className="flex flex-col gap-4">
          {lines.map((line) => {
            const isBusy = busyKey === line.key;
            const lineTotal = line.unitPrice * line.quantity;
            const quantityLocked = line.isQuotable && line.quotedTotal !== null;
            const quotationPending = line.isQuotable && line.quotedTotal === null;
            const isSelected = selectedKeys.has(line.key);
            return (
              <li
                key={line.key}
                className="flex cursor-pointer gap-4 rounded-xl border p-4 transition-colors hover:shadow-sm"
                role="link"
                tabIndex={0}
                onClick={(event) => {
                  const target = event.target as HTMLElement;
                  if (target.closest('a,button,input,select,textarea')) return;
                  router.push(`${basePath}/cart/order/${line.orderId}`);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    router.push(`${basePath}/cart/order/${line.orderId}`);
                  }
                }}
                style={{
                  backgroundColor: 'var(--brand-surface)',
                  borderColor: isSelected ? 'var(--brand-accent)' : 'var(--brand-border)',
                  opacity: isSelected ? 1 : 0.6,
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleLine(line.key)}
                  disabled={quotationPending}
                  className="mt-1 shrink-0 self-start disabled:cursor-not-allowed disabled:opacity-40"
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={`Pilih ${line.name}`}
                >
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded border text-[11px] font-bold transition-colors"
                    style={{
                      borderColor: isSelected ? 'var(--brand-accent)' : 'var(--brand-border)',
                      backgroundColor: isSelected ? 'var(--brand-accent)' : 'transparent',
                      color: isSelected ? 'var(--brand-on-accent)' : 'transparent',
                    }}
                  >
                    ✓
                  </span>
                </button>
                {line.image ? (
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={line.image}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div
                    className="flex h-24 w-24 shrink-0 items-center justify-center rounded-lg text-lg font-bold uppercase"
                    style={{ backgroundColor: 'var(--brand-muted)', color: 'var(--brand-on-accent)' }}
                  >
                    {line.name.charAt(0)}
                  </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium" style={{ fontFamily: 'var(--font-heading)' }}>
                        {line.name}
                      </p>
                      {line.isVariant && (
                        <p className="mt-0.5 text-xs" style={{ color: 'var(--brand-muted)' }}>
                          Varian produk
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`${basePath}/cart/order/${line.orderId}`}
                        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/5"
                        style={{ color: 'var(--brand-muted)' }}
                        aria-label={`Lihat detail order ${line.name}`}
                        title="Lihat detail pesanan draft"
                      >
                        <ViewOrderIcon />
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeServerItem(line)}
                        disabled={isBusy}
                        className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/5 disabled:opacity-50"
                        style={{ color: 'var(--brand-muted)' }}
                        aria-label={`Hapus ${line.name}`}
                        title="Hapus item"
                      >
                        <RemoveIcon />
                      </button>
                    </div>
                  </div>

                  {line.description && (
                    <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--brand-muted)' }}>
                      {line.description}
                    </p>
                  )}

                  {variantChips(line)}

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                    {/* Qty stepper */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => changeServerQty(line, line.quantity - 1)}
                        disabled={isBusy || quantityLocked || line.quantity <= 1}
                        className="flex h-8 w-8 items-center justify-center rounded-full border text-base transition-colors hover:opacity-70 disabled:opacity-40"
                        style={{ borderColor: 'var(--brand-border)' }}
                        aria-label="Kurangi"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-sm font-semibold" aria-live="polite">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeServerQty(line, line.quantity + 1)}
                        disabled={isBusy || quantityLocked}
                        className="flex h-8 w-8 items-center justify-center rounded-full border text-base transition-colors hover:opacity-70 disabled:opacity-40"
                        style={{ borderColor: 'var(--brand-border)' }}
                        aria-label="Tambah"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right">
                      {line.unitPrice <= 0 ? (
                        <Link
                          href={`${basePath}/cart/order/${line.orderId}`}
                          className="text-sm font-semibold underline"
                          style={{ color: 'var(--brand-accent-muted)' }}
                        >
                          Lihat Progres Penawaran
                        </Link>
                      ) : (
                        <>
                          {line.quotedTotal !== null ? (
                            <>
                              <p
                                className="text-[11px] font-medium uppercase tracking-wide"
                                style={{ color: 'var(--brand-muted)' }}
                              >
                                Harga final
                              </p>
                              <p className="text-lg font-bold leading-tight" style={{ color: 'var(--brand-accent-muted)' }}>
                                Rp {line.quotedTotal.toLocaleString('id-ID')}
                              </p>
                              <div className="mt-1.5 space-y-0.5 text-xs">
                                {(line.quoteTermins ?? []).map((termin) => (
                                  <p
                                    key={termin.sequence}
                                    className={termin.sequence === 1 ? 'font-semibold' : undefined}
                                    style={{
                                      color: termin.sequence === 1 ? 'var(--brand-text)' : 'var(--brand-muted)',
                                    }}
                                  >
                                    {termin.label} — Rp {termin.amount.toLocaleString('id-ID')}
                                  </p>
                                ))}
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                                Rp {line.unitPrice.toLocaleString('id-ID')}{line.uomSymbol ? `/${line.uomSymbol}` : ''} × {line.quantity}{line.uomSymbol ? ` ${line.uomSymbol}` : ''}
                              </p>
                              <p className="text-sm font-bold" style={{ color: 'var(--brand-accent-muted)' }}>
                                Rp {lineTotal.toLocaleString('id-ID')}
                              </p>
                            </>
                          )}
                          {line.hasIncompletePraorderSteps && (
                            <Link
                              href={`${basePath}/cart/order/${line.orderId}`}
                              className="mt-1 block text-xs font-semibold underline"
                              style={{ color: 'var(--brand-accent-muted)' }}
                            >
                              Lengkapi Data Praorder
                            </Link>
                          )}
                          {quantityLocked && (
                            <p className="mt-2 text-[11px]" style={{ color: 'var(--brand-muted)' }}>
                              Jumlah terkunci setelah quotation
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
          </ul>
        </div>

        {/* Ringkasan */}
        <aside
          className="h-fit min-w-0 rounded-xl border p-5"
          style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
        >
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--font-heading)' }}>
            Ringkasan
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt style={{ color: 'var(--brand-muted)' }}>Subtotal ({selectedCount} item terpilih)</dt>
              <dd className="font-semibold">Rp {selectedTotal.toLocaleString('id-ID')}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt style={{ color: 'var(--brand-muted)' }}>Biaya lain</dt>
              <dd style={{ color: 'var(--brand-muted)' }}>—</dd>
            </div>
            <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: 'var(--brand-border)' }}>
              <dt className="font-semibold">Total</dt>
              <dd className="text-xl font-bold">Rp {selectedTotal.toLocaleString('id-ID')}</dd>
            </div>
          </dl>

          {selectedLines.length > 0 && !hasUnquotedSelected ? (
            <Link
              href={checkoutHref}
              className="mt-5 block rounded-full px-6 py-3 text-center text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-[1.03] active:scale-95"
              style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
            >
              Checkout ({selectedLines.length})
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="mt-5 block w-full cursor-not-allowed rounded-full px-6 py-3 text-center text-sm font-semibold uppercase tracking-wide opacity-50"
              style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
            >
              {selectedLines.length > 0 && hasUnquotedSelected ? 'Menunggu Penawaran' : 'Pilih item dulu'}
            </button>
          )}

          <p
            className="mt-4 rounded-lg border px-3 py-2 text-xs leading-relaxed"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}
          >
            {hasUnquotedSelected
              ? 'Harga final sedang disiapkan oleh admin. Checkout aktif setelah penawaran tersedia.'
              : 'Item terpilih akan di-checkout dalam satu transaksi. Item lain tetap di keranjang sampai transaksi ini selesai.'}
          </p>
        </aside>
      </div>
    </main>
  );
}
