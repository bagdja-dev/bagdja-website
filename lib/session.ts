/**
 * Simple cookie-based session untuk web renderer publik (buyer).
 *
 * Cookie SENGAJA beda nama dari admin (`site_token` vs `bw_token`) karena
 * renderer (port 5005) dan admin (port 5004) berjalan di localhost yang sama
 * — kalau sama, login di satu app bisa menimpa/terbaca app lain.
 *
 * Server-side only (dipakai Route Handlers & Server Components).
 */
import { cookies } from 'next/headers';

const TOKEN_COOKIE = 'site_token';
const USER_COOKIE = 'site_user';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24, // 24 hours
};

export interface SessionUser {
  userId: string;
  email?: string;
  username?: string;
  /** Avatar URL (dari profilePicture user di auth-service / payload.picture). */
  avatar?: string;
}

export async function setSession(token: string, user: SessionUser) {
  const jar = await cookies();
  jar.set(TOKEN_COOKIE, token, COOKIE_OPTIONS);
  jar.set(USER_COOKIE, JSON.stringify(user), {
    ...COOKIE_OPTIONS,
    httpOnly: false, // client needs to read user info
  });
  console.log(
    `[session] setSession OK userId=${user.userId} cookieOptions=${JSON.stringify(COOKIE_OPTIONS)}`,
  );
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

export async function clearSession() {
  const jar = await cookies();
  jar.delete(TOKEN_COOKIE);
  jar.delete(USER_COOKIE);
}
