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

export function FulfillmentFieldValue({
  field,
  value,
}: {
  field: FulfillmentStepFormField;
  value: unknown;
}) {
  const values = normalizeMediaValues(value);
  if (values.length === 0) return null;
  const text = values[0].url;

  if (field.type === 'foto') {
    return <div className="mt-1 flex flex-col gap-2">{values.map((item, index) => <div key={`${item.url}-${index}`} className="flex items-center gap-3"><a href={item.url} target="_blank" rel="noreferrer" className="inline-flex h-16 w-16 shrink-0 self-start overflow-hidden rounded-lg border bg-white" style={{ borderColor: 'var(--brand-border)' }}><img src={item.url} alt={`${field.label} ${index + 1}`} className="h-full w-full object-cover" /></a>{item.description && <span className="text-xs">{item.description}</span>}</div>)}</div>;
  }

  if (field.type === 'video') {
    return <div className="mt-1 flex flex-col gap-2">{values.map((item, index) => <div key={`${item.url}-${index}`} className="flex items-center gap-3"><video src={item.url} controls className="h-16 w-16 shrink-0 rounded-lg border bg-black object-cover" style={{ borderColor: 'var(--brand-border)' }} />{item.description && <span className="text-xs">{item.description}</span>}</div>)}</div>;
  }

  if (field.type === 'pdf') {
    return (
      <div className="mt-1 flex flex-col gap-2">{values.map((item, index) => <div key={`${item.url}-${index}`} className="flex items-center gap-3"><a href={item.url} target="_blank" rel="noreferrer" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border text-xs font-bold" style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-accent-muted)', backgroundColor: 'var(--brand-surface)' }}><span aria-hidden="true">PDF {index + 1}</span></a>{item.description && <span className="text-xs">{item.description}</span>}</div>)}</div>
    );
  }

  if (field.type === 'lokasi') {
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
    return <a href={mapUrl} target="_blank" rel="noreferrer" className="underline" style={{ color: 'var(--brand-accent-muted)' }}>{text} · Buka peta</a>;
  }

  return <span className="whitespace-pre-wrap">{text}</span>;
}