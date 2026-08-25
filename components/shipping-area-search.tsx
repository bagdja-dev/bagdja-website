'use client';

/**
 * Search-select tujuan pengiriman — panggil `GET /api/public/shipping-areas?q=`
 * (BFF proxy no-auth ke bagdja-shipping-service via bagdja-website-api).
 * Simpan `{id, name}` — `id` (providerAreaId) dipakai `destination_area_id`
 * saat hitung ongkir, `name` cuma untuk tampilan.
 */
import { useEffect, useRef, useState } from 'react';

export interface ShippingAreaValue {
  id: string;
  name: string;
}

interface ShippingAreaOption {
  providerAreaId: string;
  name: string;
  type: string;
}

export function ShippingAreaSearch({
  value,
  onChange,
  placeholder,
}: {
  value: ShippingAreaValue | null;
  onChange: (value: ShippingAreaValue | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [options, setOptions] = useState<ShippingAreaOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setQuery(value?.name ?? '');
  }, [value?.name]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed || trimmed === value?.name) {
      setOptions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/shipping-areas?q=${encodeURIComponent(trimmed)}`, {
          cache: 'no-store',
        });
        const data = res.ok ? await res.json() : [];
        setOptions(Array.isArray(data) ? data : []);
        setOpen(true);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <label className="relative block">
      <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--brand-muted)' }}>
        Kota/Kecamatan Tujuan <span style={{ color: 'var(--brand-accent)' }}>*</span>
      </span>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (value) onChange(null);
        }}
        onFocus={() => options.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder ?? 'Cari kota/kecamatan...'}
        className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:opacity-100"
        style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-bg)' }}
      />
      {loading && (
        <span className="mt-1 block text-xs" style={{ color: 'var(--brand-muted)' }}>
          Mencari area…
        </span>
      )}
      {open && options.length > 0 && (
        <ul
          className="absolute top-full z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border shadow-lg"
          style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)' }}
        >
          {options.map((opt) => (
            <li key={opt.providerAreaId}>
              <button
                type="button"
                className="block w-full px-3.5 py-2 text-left text-sm hover:opacity-80"
                onClick={() => {
                  onChange({ id: opt.providerAreaId, name: opt.name });
                  setQuery(opt.name);
                  setOpen(false);
                }}
              >
                {opt.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}
