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

export interface RendererOAuthStatePayload {
  codeVerifier: string;
  next: string | null;
  /** Origin (host) tempat login dimulai — dipakai callback utk redirect balik
   *  ke host asal (custom domain/subdomain), karena redirect_uri OAuth fixed
   *  ke localhost:5005 sehingga request.url di callback selalu localhost. */
  origin?: string;
}

type MemoryEntry = { payload: RendererOAuthStatePayload; expiresAt: number };

const GLOBAL_STORE_KEY = Symbol.for('bagdja.website.renderer.oauthMemoryStore');
const GLOBAL_CLIENT_KEY = Symbol.for('bagdja.website.renderer.redisClient');

type OAuthGlobal = {
  [GLOBAL_STORE_KEY]?: Map<string, MemoryEntry>;
  [GLOBAL_CLIENT_KEY]?: Redis | null;
};

function getOAuthGlobal(): OAuthGlobal {
  const g = globalThis as unknown as OAuthGlobal;
  if (!g[GLOBAL_STORE_KEY]) {
    g[GLOBAL_STORE_KEY] = new Map<string, MemoryEntry>();
  }
  return g;
}

function getMemoryStore(): Map<string, MemoryEntry> {
  return getOAuthGlobal()[GLOBAL_STORE_KEY]!;
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
