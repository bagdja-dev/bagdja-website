import { safeGoogleMapsUrl } from '../lib/google-maps-url';

/**
 * Alamat + tautan Google Maps lokasi pilihan gathering
 * (plan/website-builder/gathering-option-location-plan.md). Tautan non-Google Maps tidak ditampilkan.
 */
export function VenueLocation({
  address,
  mapUrl,
  className = 'mt-1 block text-xs',
}: {
  address?: string | null;
  mapUrl?: string | null;
  className?: string;
}) {
  const href = safeGoogleMapsUrl(mapUrl);
  const text = address?.trim();
  if (!text && !href) return null;
  return (
    <span className={className} style={{ color: 'var(--brand-muted)' }}>
      {text ? <span className="block">{text}</span> : null}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 inline-block font-semibold underline underline-offset-2"
          style={{ color: 'var(--brand-accent)' }}
        >
          Buka di Google Maps
        </a>
      ) : null}
    </span>
  );
}
