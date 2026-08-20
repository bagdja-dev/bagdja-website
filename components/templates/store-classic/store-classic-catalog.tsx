'use client';

/**
 * Grid produk/layanan yang punya "Muat Lebih Banyak" (genuinely fetch
 * halaman berikutnya dari API publik) + halaman listing kategori tersendiri
 * (breadcrumb + sort + grid + load more). Klik tile kategori (lihat
 * `CategoryGridSection` di store-classic-view.tsx) navigasi ke halaman
 * listing ini — bukan lagi filter di tempat.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { getProducts } from '../../../lib/api-client';
import { buildProductHref, toCatalogItem, type CatalogItem } from '../../../lib/template-data';
import { ProductCard, SectionHeading } from './store-classic-view';

const PAGE_SIZE = 8;

function ChevronDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 shrink-0 transition-transform ${className}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

/** Dropdown custom (bukan `<select>` bawaan browser) — konsisten tema via `--brand-*`. */
function CustomSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex min-w-[10rem] items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-left text-sm outline-none"
        style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)', color: 'var(--brand-text)' }}
      >
        {selected?.label}
        <ChevronDownIcon className={open ? 'rotate-180' : ''} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-20 mt-1 w-full overflow-hidden rounded-lg border shadow-lg"
          style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:opacity-80"
                style={{
                  color: isSelected ? 'var(--brand-accent)' : 'var(--brand-text)',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                {opt.label}
                {isSelected && <CheckIcon />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ProductGridSection({
  title,
  filterType,
  initialProducts,
  tenantSlug,
  websiteSlug,
}: {
  title: string;
  filterType?: string;
  initialProducts: CatalogItem[];
  tenantSlug?: string;
  websiteSlug?: string;
}) {
  const initialFiltered = initialProducts.filter((p) => !filterType || p.type === filterType);
  const [items, setItems] = useState<CatalogItem[]>(initialFiltered.slice(0, PAGE_SIZE));
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialFiltered.length > PAGE_SIZE);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    if (!tenantSlug || loading) return;
    setLoading(true);
    try {
      const nextPage = page + 1;
      const result = await getProducts(tenantSlug, { type: filterType, page: nextPage, size: PAGE_SIZE, topLevel: true });
      setItems((prev) => [...prev, ...result.data.map(toCatalogItem)]);
      setPage(nextPage);
      setHasMore(result.meta.currentPage < result.meta.totalPages);
    } finally {
      setLoading(false);
    }
  }

  if (!items.length) return null;

  return (
    <section id="catalog" className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <SectionHeading title={title} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <ProductCard key={item.id} item={item} websiteSlug={websiteSlug} tenantSlug={tenantSlug} />
        ))}
      </div>
      {hasMore && tenantSlug && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-full px-6 py-2.5 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
            style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
          >
            {loading ? 'Memuat...' : 'Muat Lebih Banyak'}
          </button>
        </div>
      )}
    </section>
  );
}

type SortValue = 'name:asc' | 'price:asc' | 'price:desc';

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'name:asc', label: 'Nama A-Z' },
  { value: 'price:asc', label: 'Harga Terendah' },
  { value: 'price:desc', label: 'Harga Tertinggi' },
];

export function CategoryListingSection({
  categoryId,
  categoryLabel,
  initialProducts,
  tenantSlug,
  websiteSlug,
  homeHref,
}: {
  categoryId: string;
  categoryLabel: string;
  /** Sudah difilter untuk kategori ini (dari hasil SSR) — dipakai render awal tanpa round-trip tambahan. */
  initialProducts: CatalogItem[];
  tenantSlug?: string;
  websiteSlug?: string;
  homeHref: string;
}) {
  const [sort, setSort] = useState<SortValue>('name:asc');
  const [items, setItems] = useState<CatalogItem[]>(initialProducts.slice(0, PAGE_SIZE));
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialProducts.length > PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    if (!tenantSlug) return;

    let cancelled = false;
    setLoading(true);
    getProducts(tenantSlug, { categoryId, sort, page: 1, size: PAGE_SIZE, topLevel: true })
      .then((result) => {
        if (cancelled) return;
        setItems(result.data.map(toCatalogItem));
        setPage(1);
        setHasMore(result.meta.currentPage < result.meta.totalPages);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  async function loadMore() {
    if (!tenantSlug || loading) return;
    setLoading(true);
    try {
      const nextPage = page + 1;
      const result = await getProducts(tenantSlug, { categoryId, sort, page: nextPage, size: PAGE_SIZE, topLevel: true });
      setItems((prev) => [...prev, ...result.data.map(toCatalogItem)]);
      setPage(nextPage);
      setHasMore(result.meta.currentPage < result.meta.totalPages);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav className="mb-4 flex items-center gap-2 text-sm" style={{ color: 'var(--brand-muted)' }}>
        <a href={homeHref} className="hover:underline">
          Home
        </a>
        <span>/</span>
        <span style={{ color: 'var(--brand-text)' }}>{categoryLabel}</span>
      </nav>

      <div className="mb-6 flex items-center justify-end">
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--brand-muted)' }}>
          <span>Urutkan:</span>
          <CustomSelect value={sort} options={SORT_OPTIONS} onChange={setSort} />
        </div>
      </div>

      {items.length === 0 && !loading ? (
        <p style={{ color: 'var(--brand-muted)' }}>Belum ada produk di kategori ini.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <ProductCard key={item.id} item={item} websiteSlug={websiteSlug} tenantSlug={tenantSlug} />
          ))}
        </div>
      )}

      {hasMore && tenantSlug && (
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-full px-6 py-2.5 text-sm font-semibold uppercase tracking-wide transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
            style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
          >
            {loading ? 'Memuat...' : 'Muat Lebih Banyak'}
          </button>
        </div>
      )}
    </section>
  );
}

/** Urutan axis default kalau labelnya dikenal — axis lain (custom) diurutkan alfabetis di belakangnya. */
const AXIS_PRIORITY = ['Warna', 'Ukuran', 'Bahan'];

function sortAxisKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ai = AXIS_PRIORITY.indexOf(a);
    const bi = AXIS_PRIORITY.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/**
 * Pemilih varian bertingkat (tree cascading) — pilih axis pertama (mis.
 * Warna) dulu, axis berikutnya (mis. Ukuran) otomatis menyesuaikan opsi mana
 * yang benar-benar tersedia untuk pilihan itu. Kombinasi yang tidak ada
 * datanya tetap ditampilkan (gambarnya) tapi digrayscale + nonaktif, bukan
 * disembunyikan. Begitu kombinasi lengkap & valid ketemu, navigasi ke
 * halaman produk varian itu.
 */
export function VariantTreeSelector({
  family,
  currentId,
  websiteSlug,
}: {
  family: CatalogItem[];
  currentId: string;
  websiteSlug?: string;
}) {
  const router = useRouter();
  const current = family.find((p) => p.id === currentId);
  const axisKeys = sortAxisKeys(Array.from(new Set(family.flatMap((p) => Object.keys(p.variantAttributes ?? {})))));

  const [selected, setSelected] = useState<Record<string, string>>(() => ({ ...(current?.variantAttributes ?? {}) }));

  if (family.length <= 1 || axisKeys.length === 0) return null;

  function handleSelect(axisKey: string, value: string) {
    const axisIndex = axisKeys.indexOf(axisKey);
    const next: Record<string, string> = { ...selected, [axisKey]: value };
    // Axis di bawah axisKey ini (turunan) di-reset karena kombinasi lama
    // mungkin sudah tidak valid lagi untuk pilihan baru ini.
    axisKeys.slice(axisIndex + 1).forEach((k) => delete next[k]);
    setSelected(next);

    const isComplete = axisKeys.every((k) => next[k] !== undefined);
    if (!isComplete || websiteSlug === undefined) return;
    const match = family.find((p) => axisKeys.every((k) => p.variantAttributes?.[k] === next[k]));
    if (match) router.push(buildProductHref(websiteSlug, match.slug));
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {axisKeys.map((axisKey, axisIndex) => {
        const representativeByValue = new Map<string, CatalogItem>();
        for (const p of family) {
          const value = p.variantAttributes?.[axisKey];
          if (value && !representativeByValue.has(value)) representativeByValue.set(value, p);
        }
        if (representativeByValue.size === 0) return null;

        // Kandidat yang cocok dengan pilihan axis-axis DI ATAS axisKey ini —
        // menentukan opsi mana yang "tersedia" vs "tidak tersedia" di axis ini.
        const precedingKeys = axisKeys.slice(0, axisIndex);
        const constrained = family.filter((p) => precedingKeys.every((k) => p.variantAttributes?.[k] === selected[k]));

        return (
          <div key={axisKey}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
              {axisKey}
              {selected[axisKey] ? ` · ${selected[axisKey]}` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {[...representativeByValue.entries()].map(([value, member]) => {
                const isActive = selected[axisKey] === value;
                const isAvailable = constrained.some((p) => p.variantAttributes?.[axisKey] === value);
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => handleSelect(axisKey, value)}
                    title={isAvailable ? value : `${value} — tidak tersedia untuk pilihan ini`}
                    className={`relative overflow-hidden rounded-lg border-2 transition-colors ${
                      member.image ? 'h-14 w-14' : 'px-4 py-2 text-sm font-medium'
                    } ${isAvailable ? '' : 'cursor-not-allowed grayscale'}`}
                    style={{
                      borderColor: isActive ? 'var(--brand-accent)' : 'var(--brand-border)',
                      backgroundColor: 'var(--brand-surface)',
                      opacity: isAvailable ? 1 : 0.4,
                    }}
                  >
                    {member.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={member.image} alt={value} className="h-full w-full object-cover" />
                    ) : (
                      value
                    )}
                    {!isAvailable && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0"
                        style={{ backgroundImage: 'linear-gradient(to top right, transparent 47%, var(--brand-border) 50%, transparent 53%)' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
