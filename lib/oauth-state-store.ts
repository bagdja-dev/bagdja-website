/**
 * Penyimpanan `code_verifier` + `next` path sisi server (Redis biasa via
 * `ioredis`, bukan Upstash — deployment ini di Coolify yang sudah punya
 * Redis self-hosted, tidak perlu dependency ke Upstash cloud), dikunci oleh
 * ID pendek acak yang dikirim sebagai `state` OAuth.
 *
 * - Bukan cookie: Safari tidak konsisten menyimpan Set-Cookie yang menempel
 *   di response redirect → state_mismatch di iOS.
 * - `state` cuma ID pendek (~24 karakter) — tidak di-flag ad-blocker.
 *
 * Fallback priority (UNTUK DEV LOKAL):
 *   1. Redis — jika REDIS_URL dikonfigurasi → pakai ini
 *   2. globalThis memory store — jika Redis null + NODE_ENV !== production
 *      (pakai globalThis supaya tidak hilang saat Next.js hot-reload
 *      module-level state. Ditempatkan di globalForSite agar unik per app)
 *   3. Set-Cookie short-lived — JIKA semua gagal (defensif, hanya localhost:
 *      karena path /auth di-set sebelum redirect lintas domain ke Auth)
 */
import crypto from 'crypto';
import Redis from 'ioredis';
import { cookies } from 'next/headers';

const STATE_KEY_PREFIX = 'oauth_state:';
const DEFAULT_TTL_SECONDS = 600;
const COOKIE_STATE_PREFIX = 'oauthst_';

const SESSION_HANDOFF_KEY_PREFIX = 'session_handoff:';
/**
 * TTL pendek SENGAJA — handoff ini cuma dipakai untuk SATU redirect
 * berikutnya (dari host callback tetap ke `{origin-tenant}/auth/session`),
 * harusnya dikonsumsi dalam hitungan detik. Port dari
 * `bagdja-auction-web/lib/oauth-state-store.ts` — lihat docblock
 * `SessionHandoffPayload` untuk kenapa hop ini ada.
 */
const SESSION_HANDOFF_TTL_SECONDS = 60;
/** Grace window setelah handoff dikonsumsi — retry jaringan yang menyusul dalam window ini dapat payload yang sama, bukan `state_mismatch`. */
const CONSUMED_GRACE_SECONDS = 30;

export interface RendererOAuthStatePayload {
  codeVerifier: string;
  next: string | null;
  /** Origin (host) tempat login dimulai — dipakai callback utk redirect balik
   *  ke host asal (custom domain/subdomain), karena redirect_uri OAuth fixed
   *  ke localhost:5005 sehingga request.url di callback selalu localhost. */
  origin?: string;
}

/**
 * Payload dikirim lewat hop tambahan `/auth/session?handoff=<id>` — HANYA
 * dipakai untuk domain custom (bukan subdomain platform, lihat
 * `session.ts` `isPlatformHost`/`getCookieDomain`). Alasan hop ini ada:
 * `/auth/callback` SELALU jalan di host `redirect_uri` OAuth yang tetap
 * (mis. `sites.bagdja.com`) — server itu SECARA FUNDAMENTAL tidak bisa
 * men-set cookie untuk domain lain yang tidak terkait (`tokosaya.com`), apa
 * pun `Domain` attribute-nya (proteksi cookie browser, BUKAN bug yang bisa
 * di-workaround dari sisi kita). Solusinya: titipkan payload sesi di sini
 * (server-side, sekali pakai, TTL pendek), redirect balik ke ORIGIN TENANT
 * ASLI (`tokosaya.com`, lewat Traefik ke app yang sama) — baru DI SANA
 * cookie di-set, karena request itu genuinely dilayani "sebagai"
 * `tokosaya.com` dari sudut pandang browser. Port persis dari
 * `bagdja-auction-web/lib/oauth-state-store.ts`.
 */
export interface SessionHandoffPayload {
  accessToken: string;
  user: { userId: string; email?: string; username?: string; avatar?: string };
  redirectTo: string;
}

type MemoryEntry<T = RendererOAuthStatePayload> = { payload: T; expiresAt: number };

const GLOBAL_STORE_KEY = Symbol.for('bagdja.website.renderer.oauthMemoryStore');
const GLOBAL_HANDOFF_STORE_KEY = Symbol.for('bagdja.website.renderer.sessionHandoffMemoryStore');
const GLOBAL_CLIENT_KEY = Symbol.for('bagdja.website.renderer.redisClient');

type OAuthGlobal = {
  [GLOBAL_STORE_KEY]?: Map<string, MemoryEntry>;
  [GLOBAL_HANDOFF_STORE_KEY]?: Map<string, MemoryEntry<SessionHandoffPayload>>;
  [GLOBAL_CLIENT_KEY]?: Redis | null;
};

function getOAuthGlobal(): OAuthGlobal {
  const g = globalThis as unknown as OAuthGlobal;
  if (!g[GLOBAL_STORE_KEY]) {
    g[GLOBAL_STORE_KEY] = new Map<string, MemoryEntry>();
  }
  if (!g[GLOBAL_HANDOFF_STORE_KEY]) {
    g[GLOBAL_HANDOFF_STORE_KEY] = new Map<string, MemoryEntry<SessionHandoffPayload>>();
  }
  return g;
}

function getMemoryStore(): Map<string, MemoryEntry> {
  return getOAuthGlobal()[GLOBAL_STORE_KEY]!;
}

function getHandoffMemoryStore(): Map<string, MemoryEntry<SessionHandoffPayload>> {
  return getOAuthGlobal()[GLOBAL_HANDOFF_STORE_KEY]!;
}

function purgeExpiredEntries<T>(store: Map<string, MemoryEntry<T>>): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

function getCachedRedisClient(): Redis | null | undefined {
  return getOAuthGlobal()[GLOBAL_CLIENT_KEY];
}

function setCachedRedisClient(value: Redis | null): void {
  getOAuthGlobal()[GLOBAL_CLIENT_KEY] = value;
}

function getRedisClient(): Redis | null {
  const cached = getCachedRedisClient();
  if (cached !== undefined) return cached;

  const url = process.env.REDIS_URL;
  const isConfigured = Boolean(
    url && /^rediss?:\/\//.test(url) && !url.includes('change-me'),
  );

  if (!isConfigured) {
    setCachedRedisClient(null);
    return null;
  }

  const client = new Redis(url!, {
    lazyConnect: false,
    maxRetriesPerRequest: 1,
  });
  // ioredis emits 'error' on every connection hiccup — tanpa listener ini
  // Node akan crash (unhandled 'error' event). Reconnect ditangani ioredis
  // sendiri; kita cuma log supaya tidak silent.
  client.on('error', (err) => {
    console.error(`[oauth-state] redis client error: ${err?.message ?? err}`);
  });

  setCachedRedisClient(client);
  return client;
}

function isMemoryFallbackAllowed(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function purgeExpiredMemoryEntries(): void {
  const store = getMemoryStore();
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) store.delete(key);
  }
}

export function generateStateId(): string {
  return crypto.randomBytes(18).toString('base64url');
}

function cookieKeyFor(stateId: string): string {
  return `${COOKIE_STATE_PREFIX}${stateId.slice(0, 8)}`;
}

export async function saveOAuthState(
  stateId: string,
  payload: RendererOAuthStatePayload,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<boolean> {
  const redis = getRedisClient();
  const key = `${STATE_KEY_PREFIX}${stateId}`;

  if (redis) {
    try {
      const result = await redis.set(key, JSON.stringify(payload), 'EX', ttlSeconds);
      console.log(`[oauth-state] save OK (redis) stateId=${stateId} result=${String(result).slice(0, 20)}`);
      return true;
    } catch (error: any) {
      console.error(`[oauth-state] save REDIS FAIL stateId=${stateId}: ${error?.message ?? error}`);
    }
  }

  if (!isMemoryFallbackAllowed()) {
    console.error('[oauth-state] save: production mode & no redis → fail');
    return false;
  }

  purgeExpiredMemoryEntries();
  getMemoryStore().set(key, { payload, expiresAt: Date.now() + ttlSeconds * 1000 });
  console.log(
    `[oauth-state] save OK (memory) stateId=${stateId} store_size=${getMemoryStore().size} ttl=${ttlSeconds}s`,
  );

  try {
    const jar = await cookies();
    jar.set(cookieKeyFor(stateId), JSON.stringify(payload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth',
      maxAge: ttlSeconds,
    });
    console.log(`[oauth-state] save OK (cookie-backup) stateId=${stateId}`);
  } catch (cookieErr) {
    console.log(`[oauth-state] save cookie fallback skip (${String(cookieErr).slice(0, 80)})`);
  }

  return true;
}

export async function consumeOAuthState(
  stateId: string,
): Promise<RendererOAuthStatePayload | null> {
  const redis = getRedisClient();
  const key = `${STATE_KEY_PREFIX}${stateId}`;

  if (redis) {
    try {
      // GET+DEL (bukan GETDEL) supaya tidak bergantung pada versi Redis
      // server (GETDEL baru ada sejak Redis 6.2). Race kecil antara GET dan
      // DEL bisa diterima — state token cuma dipakai sekali oleh 1 request.
      const raw = await redis.get(key);
      if (raw) {
        await redis.del(key);
        const payload = JSON.parse(raw) as RendererOAuthStatePayload;
        if (payload?.codeVerifier) {
          console.log(`[oauth-state] consume OK (redis) stateId=${stateId}`);
          return payload;
        }
      }
    } catch (error: any) {
      console.error(`[oauth-state] consume REDIS FAIL stateId=${stateId}: ${error?.message ?? error}`);
    }
  }

  if (isMemoryFallbackAllowed()) {
    const store = getMemoryStore();
    const entry = store.get(key);
    store.delete(key);
    if (entry && entry.expiresAt > Date.now()) {
      console.log(`[oauth-state] consume OK (memory) stateId=${stateId} remaining_store=${store.size}`);
      return entry.payload;
    }
    if (entry) {
      console.log(`[oauth-state] consume memory EXPIRED stateId=${stateId} expiresAt=${entry.expiresAt} now=${Date.now()}`);
    } else {
      console.log(
        `[oauth-state] consume memory MISS stateId=${stateId} — store_keys=[${Array.from(store.keys()).slice(0, 3).join(', ')}${store.size > 3 ? `,...(${store.size})` : ''}]`,
      );
    }

    try {
      const jar = await cookies();
      const ck = cookieKeyFor(stateId);
      const rawCookie = jar.get(ck)?.value ?? null;
      if (rawCookie) {
        const parsed = JSON.parse(rawCookie) as RendererOAuthStatePayload;
        jar.delete(ck);
        if (parsed?.codeVerifier) {
          console.log(`[oauth-state] consume OK (cookie-backup) stateId=${stateId}`);
          return parsed;
        }
      }
    } catch (cookieErr) {
      console.log(`[oauth-state] consume cookie fallback skip (${String(cookieErr).slice(0, 80)})`);
    }
  }

  console.error(`[oauth-state] consume FAIL (all layers) stateId=${stateId}`);
  return null;
}

/** Lihat docblock `SessionHandoffPayload` — dipanggil `auth/callback/route.ts` sebelum redirect ke `/auth/session` di origin tenant asli. */
export async function saveSessionHandoff(
  handoffId: string,
  payload: SessionHandoffPayload,
): Promise<boolean> {
  const redis = getRedisClient();
  const key = `${SESSION_HANDOFF_KEY_PREFIX}${handoffId}`;

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(payload), 'EX', SESSION_HANDOFF_TTL_SECONDS);
      console.log(`[session-handoff] save OK (redis) handoffId=${handoffId}`);
      return true;
    } catch (error: any) {
      console.error(`[session-handoff] save REDIS FAIL handoffId=${handoffId}: ${error?.message ?? error}`);
    }
  }

  if (!isMemoryFallbackAllowed()) {
    console.error('[session-handoff] save: production mode & no redis → fail');
    return false;
  }

  const store = getHandoffMemoryStore();
  purgeExpiredEntries(store);
  store.set(key, { payload, expiresAt: Date.now() + SESSION_HANDOFF_TTL_SECONDS * 1000 });
  console.log(`[session-handoff] save OK (memory) handoffId=${handoffId}`);
  return true;
}

/** Sekali pakai — pola sama `consumeOAuthState` tapi dengan grace window (lihat `CONSUMED_GRACE_SECONDS`), bukan langsung hapus. */
export async function consumeSessionHandoff(handoffId: string): Promise<SessionHandoffPayload | null> {
  const redis = getRedisClient();
  const key = `${SESSION_HANDOFF_KEY_PREFIX}${handoffId}`;

  if (redis) {
    try {
      const raw = await redis.get(key);
      if (raw) {
        await redis.expire(key, CONSUMED_GRACE_SECONDS);
        const payload = JSON.parse(raw) as SessionHandoffPayload;
        if (payload?.accessToken) {
          console.log(`[session-handoff] consume OK (redis) handoffId=${handoffId}`);
          return payload;
        }
      }
    } catch (error: any) {
      console.error(`[session-handoff] consume REDIS FAIL handoffId=${handoffId}: ${error?.message ?? error}`);
    }
  }

  if (isMemoryFallbackAllowed()) {
    const store = getHandoffMemoryStore();
    const entry = store.get(key);
    if (entry) store.set(key, { ...entry, expiresAt: Date.now() + CONSUMED_GRACE_SECONDS * 1000 });
    if (entry && entry.expiresAt > Date.now()) {
      console.log(`[session-handoff] consume OK (memory) handoffId=${handoffId}`);
      return entry.payload;
    }
  }

  console.error(`[session-handoff] consume FAIL (all layers) handoffId=${handoffId}`);
  return null;
}
