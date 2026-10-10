const PLATFORM_HOSTNAMES = new Set(['sites.bagdja.com', 'website.bagdja.com']);

try {
  const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_URL;
  if (platformUrl) PLATFORM_HOSTNAMES.add(new URL(platformUrl).hostname);
} catch {
  // Ignore invalid configuration and keep the standard platform hostnames.
}

export function resolvePlatformSubdomain(hostname: string): string | null {
  for (const platformHostname of PLATFORM_HOSTNAMES) {
    const suffix = `.${platformHostname}`;
    if (!hostname.endsWith(suffix)) continue;

    const slug = hostname.slice(0, -suffix.length);
    return /^[a-z0-9-]+$/.test(slug) ? slug : null;
  }
  return null;
}