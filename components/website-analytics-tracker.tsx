'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const VISITOR_KEY_PREFIX = 'bagdja-analytics-session:';
const SOURCE_KEY_PREFIX = 'bagdja-analytics-source:';
const CTA_LABEL_PATTERN = /pesan|beli|booking|reservasi|penawaran|hubungi|konsultasi|whatsapp|daftar|jadwalkan|order|checkout|contact|buy|book/i;

type AnalyticsEventType = 'page_view' | 'cta_click';

function isTrackingDisabled(): boolean {
  return navigator.doNotTrack === '1';
}

function createUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function getSessionValue(key: string, create: () => string): string {
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    const value = create();
    sessionStorage.setItem(key, value);
    return value;
  } catch {
    return create();
  }
}

function getVisitorId(slug: string): string {
  return getSessionValue(`${VISITOR_KEY_PREFIX}${slug}`, createUuid);
}

function safeSource(value: string): string {
  return value.replace(/[^a-zA-Z0-9._ -]/g, '').trim().slice(0, 120) || 'Langsung';
}

function getSource(slug: string): string {
  return getSessionValue(`${SOURCE_KEY_PREFIX}${slug}`, () => {
    const campaignSource = new URLSearchParams(window.location.search).get('utm_source');
    if (campaignSource) return safeSource(campaignSource);
    if (document.referrer) {
      try {
        const referrer = new URL(document.referrer);
        if (referrer.origin !== window.location.origin) return safeSource(referrer.hostname);
      } catch {
        return 'Langsung';
      }
    }
    return 'Langsung';
  });
}

function normalizedPagePath(pathname: string, slug: string): string | null {
  let path = pathname || '/';
  const tenantPrefix = `/${slug}`;
  if (path === tenantPrefix) path = '/';
  else if (path.startsWith(`${tenantPrefix}/`)) path = path.slice(tenantPrefix.length) || '/';
  if (
    path.startsWith('/api/')
    || path.startsWith('/_next/')
    || path === '/__preview'
    || path.startsWith('/__preview/')
    || /^\/(auth|cart|checkout|orders|order|tagihan|calendar|profile|chat)(\/|$)/.test(path)
  ) return null;
  return path.slice(0, 500);
}

function normalizedCtaLabel(target: Element): string | null {
  const explicit = target.closest<HTMLElement>('[data-analytics-cta]')?.dataset.analyticsCta;
  const text = explicit || target.closest<HTMLElement>('[data-primary-cta]')?.innerText || target.textContent || '';
  const label = text.replace(/\s+/g, ' ').trim().replace(/[^\p{L}\p{N} ._+-]/gu, '').slice(0, 100);
  if (!label) return null;

  const anchor = target.closest<HTMLAnchorElement>('a[href]');
  const href = anchor?.getAttribute('href')?.toLowerCase() ?? '';
  if (/^(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com)\//.test(href)) return 'WhatsApp';
  if (href.startsWith('tel:')) return 'Telepon';
  if (href.startsWith('mailto:')) return 'Email';
  return target.closest('[data-analytics-cta], [data-primary-cta]') || CTA_LABEL_PATTERN.test(label)
    ? label
    : null;
}

export function WebsiteAnalyticsTracker({ websiteSlug }: { websiteSlug: string }) {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!websiteSlug || isTrackingDisabled()) return;
    const pagePath = normalizedPagePath(window.location.pathname || pathname || '/', websiteSlug);
    if (!pagePath || lastTrackedPath.current === pagePath) return;
    lastTrackedPath.current = pagePath;
    void sendEvent(websiteSlug, 'page_view', pagePath);
  }, [pathname, websiteSlug]);

  useEffect(() => {
    if (!websiteSlug || isTrackingDisabled()) return;
    const trackClick = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const target = event.target.closest('a, button, [role="button"]');
      if (!target) return;
      if (target.closest('[data-bagdja-template-root]')) return;
      const label = normalizedCtaLabel(target);
      if (!label) return;
      const path = normalizedPagePath(window.location.pathname || '/', websiteSlug);
      if (path) void sendEvent(websiteSlug, 'cta_click', path, label);
    };
    const trackRuntimeClick = (event: Event) => {
      const label = (event as CustomEvent<{ label?: unknown }>).detail?.label;
      if (typeof label !== 'string') return;
      const path = normalizedPagePath(window.location.pathname || '/', websiteSlug);
      if (path) void sendEvent(websiteSlug, 'cta_click', path, label);
    };

    document.addEventListener('click', trackClick, true);
    window.addEventListener('bagdja:analytics-cta', trackRuntimeClick);
    return () => {
      document.removeEventListener('click', trackClick, true);
      window.removeEventListener('bagdja:analytics-cta', trackRuntimeClick);
    };
  }, [websiteSlug]);

  return null;
}

function sendEvent(websiteSlug: string, eventType: AnalyticsEventType, pagePath: string, label?: string): Promise<void> {
  const payload = {
    event_type: eventType,
    visitor_id: getVisitorId(websiteSlug),
    page_path: pagePath,
    source: getSource(websiteSlug),
    ...(label ? { label } : {}),
  };
  return fetch(`/api/public/analytics/${encodeURIComponent(websiteSlug)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).then((response) => {
    if (!response.ok) console.warn(`[website-analytics] event was not recorded (${response.status})`);
  }).catch((error: unknown) => {
    console.warn('[website-analytics] event could not be sent', error);
  });
}
