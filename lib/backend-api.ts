/**
 * Server-side helper untuk memanggil Website API (bagdja-website-api)
 * dengan session token dari httpOnly cookie renderer (`site_token`).
 */
import { getSession } from './session';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5003';

export async function backendFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T | null; status: number; error?: string }> {
  const { token } = await getSession();

  if (!token) {
    console.error(`[backendFetch] ${path} -> no site_token cookie on request`);
    return { data: null, status: 401, error: 'Not authenticated' };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
    Authorization: `Bearer ${token}`,
  };

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      const body = await res.text();
      return { data: null, status: res.status, error: body || res.statusText };
    }

    if (res.status === 204) {
      return { data: null, status: res.status };
    }

    const data = (await res.json()) as T;
    return { data, status: res.status };
  } catch (err) {
    return {
      data: null,
      status: 500,
      error: err instanceof Error ? err.message : 'Request failed',
    };
  }
}

/**
 * Trigger user upsert di bagdja-website-api setelah OAuth callback,
 * supaya users table terisi (pola admin syncUserToBackend — tapi Website
 * api punya endpoint /api/user/websites untuk sync user).
 */
export async function syncUserToBackend(accessToken: string): Promise<boolean> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5003';
  try {
    const res = await fetch(`${apiBase}/api/user/websites`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    return res.ok;
  } catch (err) {
    console.error('[syncUserToBackend] error:', err);
    return false;
  }
}
