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
 *
 * BUG (25 Agustus 2026, PARTIAL FIX): `Domain` attribute harus domain-match
 * host yang BENAR-BENAR melayani response (RFC 6265) — kalau tidak, browser
 * DIAM-DIAM membuang seluruh `Set-Cookie` itu (bukan error yang kelihatan).
 * Dulu `getCookieDomain()` selalu pakai `NEXT_PUBLIC_PLATFORM_URL` apa pun
 * host request sebenarnya — fix 25 Agustus di atas cuma menutup kasus
 * localhost (skip `domain` attribute total kalau host itu local), TAPI
 * untuk domain custom Owner sungguhan (`tokosaya.com`, BUKAN localhost DAN
 * BUKAN subdomain platform) `getCookieDomain()` MASIH SELALU balas
 * `.{platformHostname}` (`.sites.bagdja.com`) — domain mismatch yang sama
 * persis, cuma kasusnya belum pernah ketahuan karena fitur custom domain
 * belum pernah dipakai user nyata.
 *
 * BUG (9 September 2026, FIX PENUH): port `isPlatformHost()` dari
 * `bagdja-auction-web/lib/session.ts` (fitur custom domain SUDAH production
 * di sana, `pasarmolly.com` sejak 7 Sep 2026) — wildcard cookie
 * (`.{platformHostname}`) HANYA kalau target memang subdomain (atau sama
 * persis) platform kita sendiri; domain custom dapat cookie host-only
 * (`undefined`, otomatis ter-scope ke domain itu sendiri, tidak perlu
 * `Domain` attribute apa pun). Lihat plan/website-builder/custom-domain-adjustment-plan.md.
 */
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';

const TOKEN_COOKIE = 'site_token';
const USER_COOKIE = 'site_user';

/** Sama seperti middleware.ts — host dev lokal, tidak pernah domain-match subdomain wildcard produksi. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

/**
 * `true` kalau `targetHostname` adalah subdomain (atau sama persis)
 * platform kita sendiri (`NEXT_PUBLIC_PLATFORM_URL`) — dipakai `session.ts`
 * (tentukan cookie wildcard vs host-only) DAN `app/auth/callback/route.ts`
 * (tentukan perlu hop `/auth/session` handoff atau tidak), harus konsisten
 * di kedua tempat jadi diekspor dari sini, satu sumber kebenaran. Port
 * persis dari `bagdja-auction-web/lib/session.ts`.
 */
export function isPlatformHost(targetHostname: string): boolean {
  const platformUrl = process.env.NEXT_PUBLIC_PLATFORM_URL;
  if (!platformUrl) return false;

  try {
    const platformHostname = new URL(platformUrl).hostname;
    return targetHostname === platformHostname || targetHostname.endsWith(`.${platformHostname}`);
  } catch {
    return false;
  }
}

function getCookieDomain(targetHostname: string): string | undefined {
  if (LOCAL_HOSTS.has(targetHostname)) return undefined;
  if (!isPlatformHost(targetHostname)) return undefined;

  // isPlatformHost() sudah pastikan NEXT_PUBLIC_PLATFORM_URL valid & match —
  // aman parse ulang di sini buat ambil hostname-nya.
  const platformHostname = new URL(process.env.NEXT_PUBLIC_PLATFORM_URL!).hostname;
  return `.${platformHostname}`;
}

/** `targetHostname` = host yang benar-benar akan menerima response ini (lihat catatan BUG di atas) — WAJIB diisi benar, jangan diasumsikan dari env. */
function getCookieOptions(targetHostname: string) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
    domain: getCookieDomain(targetHostname),
  };
}

export interface SessionUser {
  userId: string;
  email?: string;
  username?: string;
  /** Avatar URL (dari profilePicture user di auth-service / payload.picture). */
  avatar?: string;
}

/**
 * Attach cookie sesi ke response yang akan di-return Route Handler.
 * `targetOrigin` = origin (scheme+host) yang BENAR-BENAR akan menerima
 * response ini — di callback route ini `decoded.origin ?? request.nextUrl.origin`,
 * BUKAN `request.url` (yang selalu host `redirect_uri` OAuth tetap). Dari
 * sinilah `Domain` attribute cookie diputuskan (lihat catatan BUG di atas).
 */
export function setSessionCookies(
  response: NextResponse,
  token: string,
  user: SessionUser,
  targetOrigin: string,
): void {
  const hostname = new URL(targetOrigin).hostname;
  const cookieOptions = getCookieOptions(hostname);
  response.cookies.set(TOKEN_COOKIE, token, cookieOptions);
  response.cookies.set(USER_COOKIE, JSON.stringify(user), {
    ...cookieOptions,
    httpOnly: false, // client needs to read user info
  });
  console.log(
    `[session] setSessionCookies OK userId=${user.userId} targetHostname=${hostname} domain=${cookieOptions.domain ?? '(host-only)'}`,
  );
}

/** Hapus cookie sesi dari response yang akan di-return Route Handler. `targetOrigin` — lihat catatan `setSessionCookies`. */
export function clearSessionCookies(response: NextResponse, targetOrigin: string): void {
  const hostname = new URL(targetOrigin).hostname;
  const cookieOptions = getCookieOptions(hostname);
  // Delete via .set(..., maxAge: 0) dengan domain/path yang SAMA persis
  // dengan saat di-set — .delete(name) tanpa domain tidak akan match cookie
  // yang di-set dengan Domain attribute (browser treat sebagai cookie beda).
  response.cookies.set(TOKEN_COOKIE, '', { ...cookieOptions, maxAge: 0 });
  response.cookies.set(USER_COOKIE, '', {
    ...cookieOptions,
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
