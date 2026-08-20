'use client';

/**
 * Konten halaman Cart (keranjang) — W1b/W2/W2.5 cart server-side draft.
 * Client component, dirender DI DALAM template (section type `cart`) supaya
 * header/footer/theme konsisten dengan home & halaman lain.
 * - Fetch GET /api/orders (BFF → website-api) saat mount; filter status=PENDING.
 * - Draft server sebagai sumber utama; fallback ke useCart (localStorage).
 * - Item server: foto/nama/deskripsi/chip varian dari relasi product;
 *   qty editable (PATCH via BFF) + hapus (DELETE via BFF).
 * - Item lokal: qty/remove via useCart.
 */
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCart } from '../lib/cart';

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
  };
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: string;
  transaction_id: string | null;  payment_mode: string;
}

/** Item gabungan (server draft atau cart lokal) dengan semua data tampil. */
interface CartLine {
  key: string;
  isServer: boolean;
  orderId?: string;
  productId: string;
  name: string;
  description?: string;
  image?: string;
  unitPrice: number;
  quantity: number;
  paymentMode: string;
  variantAttributes?: Record<string, string>;
  isVariant: boolean;
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

export function CartContent({ slug }: { slug: string }) {
  const { items, removeItem, updateQuantity, clear } = useCart();

  const [serverOrders, setServerOrders] = useState<ServerOrder[] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const loadServerOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders', { cache: 'no-store' });
      if (!res.ok) {
        setServerError('Gagal memuat keranjang dari server');
        return;
      }
      const data = (await res.json()) as { data?: ServerOrder[] };
      const pending = (data?.data ?? []).filter(
        (o) => o.status === 'PENDING' && !o.transaction_id,
      );
      setServerOrders(pending);
    } catch {
      setServerError('Gagal memuat keranjang dari server');
    }
  }, []);

  useEffect(() => {
    void loadServerOrders();
  }, [loadServerOrders]);

  // Beri tahu CartBadge (header) supaya badge ikut ter-update saat item
  // server diubah/dihapus dari halaman cart — item server tidak lewat
  // CartProvider, jadi event `bagdja:cart-changed` tidak otomatis terpicu.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('bagdja:cart-changed'));
  }, [serverOrders]);

  const hasServerItems = Array.isArray(serverOrders) && serverOrders.length > 0;

  // Gabungkan server draft + cart lokal jadi satu list (server lebih dulu).
  const lines: CartLine[] = useMemo(() => {
    const serverLines: CartLine[] = (serverOrders ?? []).map((o) => ({
      key: `srv:${o.id}`,
      isServer: true,
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
    }));
    const localLines: CartLine[] = hasServerItems
      ? []
      : items.map((i) => ({
          key: `loc:${i.productId}`,
          isServer: false,
          productId: i.productId,
          name: i.name,
          image: i.image,
          unitPrice: i.price,
          quantity: i.quantity,
          paymentMode: i.paymentMode ?? 'ADD_TO_CART',
          isVariant: false,
        }));
    return [...serverLines, ...localLines];
  }, [serverOrders, items, hasServerItems]);

  // Default: semua item terpilih saat list pertama dimuat.
  useEffect(() => {
    setSelectedKeys(new Set(lines.map((l) => l.key)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length > 0 ? lines.map((l) => l.key).join('|') : '']);

  const displayCount = useMemo(
    () => lines.reduce((acc, l) => acc + l.quantity, 0),
    [lines],
  );

  const toggleLine = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedKeys((prev) => {
      const allKeys = lines.map((l) => l.key);
      const allSelected = allKeys.every((k) => prev.has(k));
      return allSelected ? new Set<string>() : new Set(allKeys);
    });
  }, [lines]);

  const allSelected = lines.length > 0 && lines.every((l) => selectedKeys.has(l.key));
  const selectedLines = useMemo(() => lines.filter((l) => selectedKeys.has(l.key)), [lines, selectedKeys]);
  const selectedCount = useMemo(
    () => selectedLines.reduce((acc, l) => acc + l.quantity, 0),
    [selectedLines],
  );
  const selectedTotal = useMemo(
    () => selectedLines.reduce((acc, l) => acc + l.unitPrice * l.quantity, 0),
    [selectedLines],
  );

  // Item server terpilih → order_ids utk checkout multi-item.
  const checkoutHref = useMemo(() => {
    const serverSelected = selectedLines
      .filter((l) => l.isServer && l.orderId)
      .map((l) => l.orderId as string);
    if (serverSelected.length > 0) {
      return `/${slug}/checkout?order_ids=${encodeURIComponent(serverSelected.join(','))}`;
    }
    // Tanpa item server → fallback cart lokal (alur legacy 1 item).
    return selectedLines.length > 0 ? `/${slug}/checkout` : '#';
  }, [selectedLines, slug]);

  // Update qty item server → PATCH via BFF → refresh list.
  const changeServerQty = useCallback(
    async (line: CartLine, nextQty: number) => {
      if (!line.orderId || nextQty < 1) return;
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
      if (!line.orderId) return;
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
          href={`/${slug}`}
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
          Keranjang
          <span className="ml-2 text-sm font-normal" style={{ color: 'var(--brand-muted)' }}>
            ({displayCount} item)
          </span>
        </h1>
        {!hasServerItems && (
          <button
            type="button"
            onClick={clear}
            className="text-xs font-semibold uppercase tracking-wide hover:opacity-70"
            style={{ color: 'var(--brand-muted)' }}
          >
            Kosongkan
          </button>
        )}
      </div>

      {actionError && (
        <p
          className="mt-4 rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: 'var(--brand-border)', color: 'crimson' }}
        >
          {actionError}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Daftar item */}
        <div>
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
            const isSelected = selectedKeys.has(line.key);
            return (
              <li
                key={line.key}
                className="flex gap-4 rounded-xl border p-4 transition-colors"
                style={{
                  backgroundColor: 'var(--brand-surface)',
                  borderColor: isSelected ? 'var(--brand-accent)' : 'var(--brand-border)',
                  opacity: isSelected ? 1 : 0.6,
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleLine(line.key)}
                  className="mt-1 shrink-0 self-start"
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
                    <button
                      type="button"
                      onClick={() => (line.isServer ? removeServerItem(line) : removeItem(line.productId))}
                      disabled={isBusy}
                      className="shrink-0 text-xs font-medium hover:opacity-70 disabled:opacity-50"
                      style={{ color: 'var(--brand-muted)' }}
                      aria-label={`Hapus ${line.name}`}
                    >
                      Hapus
                    </button>
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
                        onClick={() =>
                          line.isServer
                            ? changeServerQty(line, line.quantity - 1)
                            : updateQuantity(line.productId, line.quantity - 1)
                        }
                        disabled={isBusy || line.quantity <= 1}
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
                        onClick={() =>
                          line.isServer
                            ? changeServerQty(line, line.quantity + 1)
                            : updateQuantity(line.productId, line.quantity + 1)
                        }
                        disabled={isBusy}
                        className="flex h-8 w-8 items-center justify-center rounded-full border text-base transition-colors hover:opacity-70 disabled:opacity-40"
                        style={{ borderColor: 'var(--brand-border)' }}
                        aria-label="Tambah"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                        Rp {line.unitPrice.toLocaleString('id-ID')} × {line.quantity}
                      </p>
                      <p className="text-sm font-bold" style={{ color: 'var(--brand-accent-muted)' }}>
                        Rp {lineTotal.toLocaleString('id-ID')}
                      </p>
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
          className="h-fit rounded-xl border p-5"
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

          {selectedLines.length > 0 ? (
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
              Pilih item dulu
            </button>
          )}

          <p
            className="mt-4 rounded-lg border px-3 py-2 text-xs leading-relaxed"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}
          >
            Item terpilih akan di-checkout dalam satu transaksi. Item lain tetap
            di keranjang sampai transaksi ini selesai.
          </p>
        </aside>
      </div>
    </main>
  );
}
