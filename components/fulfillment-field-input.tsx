'use client';

import { useState } from 'react';

import type { FulfillmentStepFormField } from './order-detail-content';

interface MediaValue {
  url: string;
  description: string;
}

function normalizeMediaValues(value: unknown): MediaValue[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string' && item) return [{ url: item, description: '' }];
      if (item && typeof item === 'object' && 'url' in item && typeof item.url === 'string') {
        return [{ url: item.url, description: typeof item.description === 'string' ? item.description : '' }];
      }
      return [];
    });
  }
  return typeof value === 'string' && value ? [{ url: value, description: '' }] : [];
}

export function FulfillmentFieldInput({
  field,
  value,
  onChange,
  orderId,
}: {
  field: FulfillmentStepFormField;
  value: unknown;
  onChange: (value: unknown) => void;
  orderId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const mediaValues = normalizeMediaValues(value);
  const textValue = typeof value === 'string' ? value : '';
  const maxFiles = Math.max(1, field.max_files ?? 5);

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setError('Browser tidak mendukung lokasi perangkat.');
      return;
    }
    setBusy(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange(`${position.coords.latitude}, ${position.coords.longitude}`);
        setBusy(false);
      },
      () => {
        setError('Izinkan akses lokasi lalu coba lagi.');
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const mediaType = ['pdf', 'foto', 'video'].includes(field.type) ? field.type : null;
  const uploadFiles = async (files: FileList | null) => {
    if (!files || !orderId || !mediaType) return;
    const selectedFiles = Array.from(files).slice(0, maxFiles - mediaValues.length);
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setError('');
    try {
      const uploaded: string[] = [];
      for (const file of selectedFiles) {
        const form = new FormData();
        form.append('file', file);
        const response = await fetch(`/api/orders/${orderId}`, { method: 'POST', body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.message ?? 'Upload gagal');
        uploaded.push(data.url);
      }
      onChange([...mediaValues, ...uploaded.map((url) => ({ url, description: '' }))]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload gagal');
    } finally {
      setUploading(false);
    }
  };

  if (field.type === 'lokasi') {
    return (
      <label className="flex flex-col gap-1 text-xs">
        <span style={{ color: 'var(--brand-muted)' }}>{field.label}{field.required && ' *'}</span>
        <input
          type="text"
          value={textValue}
          placeholder="Latitude, longitude"
          onChange={(event) => onChange(event.target.value)}
          className="rounded-md border px-2 py-1.5 text-sm"
          style={{ borderColor: 'var(--brand-border)' }}
        />
        <button type="button" onClick={captureLocation} disabled={busy} className="self-start rounded-full border px-3 py-1 text-xs disabled:opacity-50" style={{ borderColor: 'var(--brand-border)' }}>
          {busy ? 'Mengambil lokasi...' : 'Gunakan lokasi saya'}
        </button>
        {error && <span style={{ color: 'crimson' }}>{error}</span>}
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <label className="flex flex-col gap-1 text-xs">
        <span style={{ color: 'var(--brand-muted)' }}>{field.label}{field.required && ' *'}</span>
        <select value={textValue} onChange={(event) => onChange(event.target.value)} className="rounded-md border px-2 py-1.5 text-sm" style={{ borderColor: 'var(--brand-border)' }}>
          <option value="">Pilih...</option>
          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }

  if (mediaType) {
    return (
      <div className="flex flex-col gap-1.5 text-xs">
        <span style={{ color: 'var(--brand-muted)' }}>{field.label}{field.required && ' *'}</span>
        <input
          id={`fulfillment-upload-${field.key}`}
          type="file"
          accept={mediaType === 'pdf' ? 'application/pdf' : mediaType === 'foto' ? 'image/*' : 'video/*'}
          multiple
          disabled={uploading || !orderId || mediaValues.length >= maxFiles}
          onChange={(event) => void uploadFiles(event.target.files)}
          className="sr-only"
        />
        {mediaValues.length > 0 && <div className="flex flex-col gap-2">{mediaValues.map((item, index) => <div key={`${item.url}-${index}`} className="flex items-center gap-3 rounded-lg border p-2" style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}>
          {mediaType === 'foto' ? <img src={item.url} alt={`${field.label} ${index + 1}`} className="h-16 w-16 shrink-0 rounded-md object-cover" /> : <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md text-xs font-semibold uppercase" style={{ backgroundColor: 'var(--brand-muted)', color: 'var(--brand-on-accent)' }}>{mediaType}</div>}
          <div className="min-w-0 flex-1"><a href={item.url} target="_blank" rel="noreferrer" className="block truncate text-xs font-medium underline">Buka {mediaType} {index + 1}</a><input type="text" value={item.description} placeholder="Deskripsi file" onChange={(event) => onChange(mediaValues.map((current, itemIndex) => itemIndex === index ? { ...current, description: event.target.value } : current))} className="mt-1 w-full rounded-md border px-2 py-1 text-xs" style={{ borderColor: 'var(--brand-border)' }} /><p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>File {index + 1} dari {maxFiles}</p></div>
          <button type="button" onClick={() => onChange(mediaValues.filter((_, itemIndex) => itemIndex !== index))} className="shrink-0 rounded-lg px-2 py-1 text-xs" style={{ color: 'crimson' }}>Hapus</button>
        </div>)}</div>}
        <label htmlFor={`fulfillment-upload-${field.key}`} className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-3 text-center" style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}>
          <div className="relative flex flex-col items-center gap-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}>
              {uploading ? '...' : mediaType === 'pdf' ? 'PDF' : '+'}
            </span>
            <span className="max-w-full truncate text-xs font-semibold">{uploading ? 'Mengunggah file...' : mediaValues.length >= maxFiles ? 'Batas file tercapai' : `Pilih ${mediaType}`}</span>
            <span style={{ color: 'var(--brand-muted)' }}>{mediaValues.length}/{maxFiles} file</span>
          </div>
        </label>
        {error && <span style={{ color: 'crimson' }}>{error}</span>}
      </div>
    );
  }

  return (
    <label className="flex flex-col gap-1 text-xs">
      <span style={{ color: 'var(--brand-muted)' }}>{field.label}{field.required && ' *'}</span>
      {field.type === 'textarea' ? (
        <textarea value={textValue} onChange={(event) => onChange(event.target.value)} rows={3} className="rounded-md border px-2 py-1.5 text-sm" style={{ borderColor: 'var(--brand-border)' }} />
      ) : (
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={textValue}
          onChange={(event) => onChange(event.target.value)}
          placeholder={mediaType ? `Pilih ${mediaType} di bawah` : undefined}
          className="rounded-md border px-2 py-1.5 text-sm"
          style={{ borderColor: 'var(--brand-border)' }}
        />
      )}
    </label>
  );
}