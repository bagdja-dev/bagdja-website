/**
 * OAuth 2.0 PKCE helpers untuk Bagdja Auth integration (web renderer publik).
 *
 * Flow:
 *   1. Generate code_verifier + code_challenge (S256)
 *   2. Redirect ke Bagdja Auth /oauth/authorize
 *   3. Auth redirects back dengan ?code=…&state=…
 *   4. Exchange code + code_verifier → access_token (server-side)
 *
 * Client app: REUSE `bagdja-website` (keputusan W1, 2026-08-17) —
 * redirect URI renderer (`http://localhost:5005/auth/callback`) harus
 * ditambahkan ke `oauthRedirectUris` client tsb di bagdja-auth.
 */

function base64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64url(array.buffer);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64url(digest);
}

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://localhost:4001';
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID ?? 'bagdja-website';
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_REDIRECT_URI ?? 'http://localhost:5005/auth/callback';

export function buildAuthorizeUrl(
  state: string,
  codeChallenge: string,
  forceLogin = false,
): string {
  const url = new URL('/oauth/authorize', AUTH_URL);
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  // Renderer selalu arahkan ke halaman login (prompt=login) — sama seperti
  // admin: walau ada akun terlogin di browser, user harus pilih akun / masuk
  // lagi (login service clear SSO cookie + tampil form login).
  url.searchParams.set('prompt', 'login');
  if (forceLogin) {
    url.searchParams.set('prompt', 'login');
  }
  return url.toString();
}
