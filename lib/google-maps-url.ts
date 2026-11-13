/**
 * Tautan Google Maps lokasi gathering (plan/website-builder/gathering-option-location-plan.md L1).
 * Modul tanpa dependensi server agar aman dipakai komponen client; pola sama dengan
 * `GOOGLE_MAPS_NAVIGATION_URL` (template-runtime-bridge.ts) dan `googleMapsUrl` (template-pages.ts).
 */
const GOOGLE_MAPS_URL = /^https:\/\/(?:maps\.app\.goo\.gl\/|goo\.gl\/maps\/|maps\.google\.[a-z]{2,3}(?:\.[a-z]{2})?\/|(?:www\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?\/maps(?:\/|\?|$))[^\s<>"']*$/i;

export function safeGoogleMapsUrl(value: unknown): string | undefined {
  const url = typeof value === 'string' ? value.trim() : '';
  return url.length <= 1000 && GOOGLE_MAPS_URL.test(url) ? url : undefined;
}
