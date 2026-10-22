const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5003';

const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'Content-Type': 'application/json; charset=utf-8',
};

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ message }), { status, headers: RESPONSE_HEADERS });
}

function isAssetLinksResponse(value: unknown): value is Array<{
  relation: string[];
  target: {
    namespace: 'android_app';
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}> {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== 'object') return false;
    const association = item as Record<string, unknown>;
    if (!Array.isArray(association.relation) || !association.relation.every((relation) => typeof relation === 'string')) {
      return false;
    }
    if (!association.target || typeof association.target !== 'object') return false;
    const target = association.target as Record<string, unknown>;
    return (
      target.namespace === 'android_app' &&
      typeof target.package_name === 'string' &&
      Array.isArray(target.sha256_cert_fingerprints) &&
      target.sha256_cert_fingerprints.every((fingerprint) => typeof fingerprint === 'string')
    );
  });
}

export async function GET(request: Request): Promise<Response> {
  const host = request.headers.get('host');
  if (!host) return jsonError(404, 'No Android app association for this host');

  const endpoint = new URL('/api/public/android-asset-links', API_URL);
  endpoint.searchParams.set('host', host);

  try {
    const upstream = await fetch(endpoint, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (upstream.status === 404) {
      return jsonError(404, 'No Android app association for this host');
    }
    if (!upstream.ok) {
      return jsonError(502, 'Android app association service is unavailable');
    }

    const payload: unknown = await upstream.json();
    if (!isAssetLinksResponse(payload)) {
      return jsonError(502, 'Android app association service returned an invalid response');
    }
    return new Response(JSON.stringify(payload), { status: 200, headers: RESPONSE_HEADERS });
  } catch {
    return jsonError(502, 'Android app association service is unavailable');
  }
}
