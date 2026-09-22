import type { FulfillmentStepFormField } from './order-detail-content';

export function FulfillmentFieldValue({
  field,
  value,
}: {
  field: FulfillmentStepFormField;
  value: unknown;
}) {
  const text = String(value ?? '').trim();
  if (!text) return null;

  if (field.type === 'foto') {
    return (
      <a href={text} target="_blank" rel="noreferrer" className="mt-1 block overflow-hidden rounded-lg border" style={{ borderColor: 'var(--brand-border)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={text} alt={field.label} className="max-h-56 w-full object-cover" />
      </a>
    );
  }

  if (field.type === 'video') {
    return <video src={text} controls className="mt-1 max-h-64 w-full rounded-lg border bg-black" style={{ borderColor: 'var(--brand-border)' }} />;
  }

  if (field.type === 'pdf') {
    return (
      <a href={text} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-medium" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-accent-muted)' }}>
        <span aria-hidden="true">PDF</span>
        <span className="max-w-xs truncate">Buka dokumen</span>
      </a>
    );
  }

  if (field.type === 'lokasi') {
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
    return <a href={mapUrl} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--brand-accent-muted)' }}>{text} · Buka peta</a>;
  }

  return <span className="whitespace-pre-wrap">{text}</span>;
}