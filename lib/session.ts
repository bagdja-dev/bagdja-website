/**
 * Simple cookie-based session untuk web renderer publik (buyer).
 *
 * Cookie SENGAJA beda nama dari admin (`site_token` vs `bw_token`) karena
 * renderer (port 5005) dan admin (port 5004) berjalan di localhost yang sama
 * — kalau sama, login di satu app bisa menimpa/terbaca app lain.
 *
 * Write (`setSessionCookies`/`clearSessionCookies`) SENGAJA nempel langsung
 * ke object `NextResponse` yang benar-benar di-return oleh Route Handler —
 * BUKAN lewat `cookies()` ambient dari `next/headers`. Di production
 * (Coolify, di belakang Traefik) mutasi cookie ambient yang di-attach ke
 * response yang dikonstruksi belakangan (`NextResponse.redirect(...)`
 * terpisah) terbukti tidak konsisten ke-merge — cookie sesi tidak pernah
 * sampai ke browser walau `set()` tidak error. Attach langsung ke response
 * itu satu-satunya cara yang dijamin benar.
 *
 * Read (`getSession`) tetap lewat `cookies()` ambient — itu satu-satunya
 * cara baca cookie di Server Component (read-only, tidak ada response untuk
 * di-attach).
 *
 * OAuth `redirect_uri` HARUS satu host tetap (fixed, teregistrasi di
 * bagdja-auth) — tidak bisa per-subdomain tenant karena OAuth mensyaratkan
 * redirect_uri yang statis (proteksi open-redirect). Callback karena itu
 * selalu jalan di host platform tetap (`NEXT_PUBLIC_PLATFORM_URL`, mis.
 * sites.bagdja.com), BUKAN di subdomain tenant (fashion-store.sites.bagdja.com).
 * Tanpa `Domain=.sites.bagdja.com` di cookie, cookie itu ke-scope host-only
 * ke host callback saja dan tidak pernah sampai ke subdomain tenant setelah
 * redirect kedua (lihat app/auth/callback/route.ts). `getCookieDomain()`
 * menurunkan suffix ini dari env yang sama dipakai middleware.ts (PLATFORM_HOST)
 * supaya konsisten satu sumber kebenaran.
 */
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

const TOKEN_COOKIE = 'site_token';
const USER_COOKIE = 'site_user';

function getCookieDomain(): string | undefined {
  const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_URL;
  if (!platformUrl) return undefined;
  try {
    return `.${new URL(platformUrl).hostname}`;
  } catch {
    return undefined;
  }
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24, // 24 hours
  domain: getCookieDomain(),
};

export interface SessionUser {
  userId: string;
  email?: string;
  username?: string;
  /** Avatar URL (dari profilePicture user di auth-service / payload.picture). */
  avatar?: string;
}

/** Attach cookie sesi ke response yang akan di-return Route Handler. */
export function setSessionCookies(
  response: NextResponse,
  token: string,
  user: SessionUser,
): void {
  response.cookies.set(TOKEN_COOKIE, token, COOKIE_OPTIONS);
  response.cookies.set(USER_COOKIE, JSON.stringify(user), {
    ...COOKIE_OPTIONS,
    httpOnly: false, // client needs to read user info
  });
  console.log(`[session] setSessionCookies OK userId=${user.userId}`);
}

/** Hapus cookie sesi dari response yang akan di-return Route Handler. */
export function clearSessionCookies(response: NextResponse): void {
  // Delete via .set(..., maxAge: 0) dengan domain/path yang SAMA persis
  // dengan saat di-set — .delete(name) tanpa domain tidak akan match cookie
  // yang di-set dengan Domain attribute (browser treat sebagai cookie beda).
  response.cookies.set(TOKEN_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
  response.cookies.set(USER_COOKIE, '', {
    ...COOKIE_OPTIONS,
    httpOnly: false,
    maxAge: 0,
  });
}

export async function getSession(): Promise<{
  token: string | null;
  user: SessionUser | null;
}> {
  const jar = await cookies();
  const token = jar.get(TOKEN_COOKIE)?.value ?? null;
  const userStr = jar.get(USER_COOKIE)?.value ?? null;

  let user: SessionUser | null = null;
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch {
      user = null;
    }
  }

  console.log(
    `[session] getSession all_cookie_names=[${jar.getAll().map((c) => c.name).join(', ')}] hasToken=${Boolean(token)} hasUser=${Boolean(user)}`,
  );

  return { token, user };
}
