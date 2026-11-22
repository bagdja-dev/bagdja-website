import type { Metadata } from 'next';

const DEFAULT_PLATFORM_URL = 'https://sites.bagdja.com';

export interface ContentSeoFields {
  seo_title?: string | null;
  seo_description?: string | null;
  seo_image?: string | null;
  seo_no_index?: boolean;
}

export function tenantCanonicalUrl(
  slug: string,
  path: string,
  website?: { domain?: string | null; domain_verified_at?: string | null } | null,
): string {
  const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_URL || DEFAULT_PLATFORM_URL;
  let origin: URL;
  try {
    origin = new URL(platformUrl);
  } catch {
    origin = new URL(DEFAULT_PLATFORM_URL);
  }

  const verifiedDomain = website?.domain_verified_at && website.domain
    ? website.domain.trim().toLowerCase()
    : null;
  let tenantOrigin: URL;
  try {
    tenantOrigin = verifiedDomain
      ? new URL(`https://${verifiedDomain}`)
      : new URL(`${origin.protocol}//${slug}.${origin.host}`);
  } catch {
    tenantOrigin = new URL(`${origin.protocol}//${slug}.${origin.host}`);
  }
  return new URL(path.startsWith('/') ? path : `/${path}`, tenantOrigin).toString();
}

export function contentMetadata({
  slug,
  path,
  title,
  description,
  image,
  noIndex,
  website,
}: {
  slug: string;
  path: string;
  title: string;
  description?: string | null;
  image?: string | null;
  noIndex?: boolean;
  website?: { domain?: string | null; domain_verified_at?: string | null } | null;
}): Metadata {
  const canonical = tenantCanonicalUrl(slug, path, website);
  let imageUrl: string | undefined;
  if (image?.trim()) {
    try {
      const parsed = new URL(image, canonical);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') imageUrl = parsed.toString();
    } catch {
      imageUrl = undefined;
    }
  }
  const metadata: Metadata = {
    title: { absolute: title },
    alternates: { canonical },
    robots: noIndex ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: 'website',
      title,
      ...(description ? { description } : {}),
      url: canonical,
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title,
      ...(description ? { description } : {}),
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
  if (description) metadata.description = description;
  return metadata;
}

export function jsonLd(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
