'use client';

import { useEffect, useState } from 'react';

import type { FulfillmentStepFormField } from './order-detail-content';

export function FulfillmentFieldInput({
  field,
  value,
  onChange,
  orderId,
}: {
  field: FulfillmentStepFormField;
  value: string;
  onChange: (value: string) => void;
  orderId?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => () => {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

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
  const uploadFile = async (file: File | null) => {
    if (!file || !orderId || !mediaType) return;
    setUploading(true);
    setError('');
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch(`/api/orders/${orderId}`, { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message ?? 'Upload gagal');
      onChange(data.url);
      setFileName(file.name);
      URL.revokeObjectURL(localPreview);
      setPreviewUrl(data.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload gagal');
      URL.revokeObjectURL(localPreview);
      setPreviewUrl('');
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
          value={value}
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
        <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-md border px-2 py-1.5 text-sm" style={{ borderColor: 'var(--brand-border)' }}>
          <option value="">Pilih...</option>
          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }

  if (mediaType) {
    const preview = previewUrl || value;
    return (
      <div className="flex flex-col gap-1.5 text-xs">
        <span style={{ color: 'var(--brand-muted)' }}>{field.label}{field.required && ' *'}</span>
        <input
          id={`fulfillment-upload-${field.key}`}
          type="file"
          accept={mediaType === 'pdf' ? 'application/pdf' : mediaType === 'foto' ? 'image/*' : 'video/*'}
          disabled={uploading || !orderId}
          onChange={(event) => void uploadFile(event.target.files?.[0] ?? null)}
          className="sr-only"
        />
        <label htmlFor={`fulfillment-upload-${field.key}`} className="group relative flex min-h-28 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed p-3 text-center" style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-surface)' }}>
          {preview && mediaType === 'foto' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Preview" className="absolute inset-0 h-full w-full object-cover opacity-90" />
          )}
          {preview && mediaType === 'video' && <video src={preview} muted playsInline className="absolute inset-0 h-full w-full object-cover opacity-90" />}
          <div className={`relative flex flex-col items-center gap-1 ${preview && mediaType !== 'pdf' ? 'rounded-lg bg-black/55 px-4 py-2 text-white' : ''}`}>
            <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}>
              {uploading ? '...' : mediaType === 'pdf' ? 'PDF' : '+'}
            </span>
            <span className="max-w-full truncate text-xs font-semibold">
              {uploading ? 'Mengunggah file...' : fileName || (preview ? 'Klik untuk mengganti file' : `Pilih ${mediaType}`)}
            </span>
            {!preview && <span style={{ color: 'var(--brand-muted)' }}>{mediaType === 'foto' ? 'JPG, PNG, atau WebP' : mediaType === 'video' ? 'MP4, WebM, atau MOV' : 'Dokumen PDF'}</span>}
          </div>
        </label>
        {preview && mediaType === 'pdf' && <a href={preview} target="_blank" rel="noreferrer" className="truncate text-primary underline">Buka dokumen PDF</a>}
        {error && <span style={{ color: 'crimson' }}>{error}</span>}
      </div>
    );
  }

  return (
    <label className="flex flex-col gap-1 text-xs">
      <span style={{ color: 'var(--brand-muted)' }}>{field.label}{field.required && ' *'}</span>
      {field.type === 'textarea' ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="rounded-md border px-2 py-1.5 text-sm" style={{ borderColor: 'var(--brand-border)' }} />
      ) : (
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={mediaType ? `Pilih ${mediaType} di bawah` : undefined}
          className="rounded-md border px-2 py-1.5 text-sm"
          style={{ borderColor: 'var(--brand-border)' }}
        />
      )}
    </label>
  );
}