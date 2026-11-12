import { validateTemplatePage } from './template-page-contract';
import { createHash } from 'node:crypto';
import type { TemplateRenderProps } from './template-registry';

export interface TemplateRuntimeRenderRequest {
  slug: string;
  version: string;
  props: Record<string, unknown>;
}

export interface TemplateRuntimeRenderResult {
  slug: string;
  version: string;
  digest: string;
  html: string;
  clientBundle: string | null;
  clientBundleSha256: string | null;
}

function isSafeRelativePath(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length <= 2048 &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

function getSafeAvatarUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value);
    const allowedHost = ['.supabase.co', '.supabase.in', '.r2.dev', '.r2.cloudflarestorage.com']
      .some((suffix) => url.hostname.endsWith(suffix));
    if (
      url.protocol !== 'https:' ||
      url.port !== '' ||
      !allowedHost ||
      url.username !== '' ||
      url.password !== '' ||
      url.search !== '' ||
      url.hash !== ''
    ) return null;
    return url.href;
  } catch {
    return null;
  }
}

function safeTemplateText(value: unknown, maxLength = 1000): string | undefined {
  if (
    typeof value !== 'string' ||
    value.length > maxLength ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
  ) return undefined;
  return value;
}

/**
 * `props.page` hanya diteruskan bila lolos kontrak (gagal tertutup): tanpa email/token,
 * key opaque, tanggal ber-offset, uang integer, link relatif tenant, aksi yang berlaku.
 */
function sanitizeTemplatePage(page: TemplateRenderProps['page']): TemplateRenderProps['page'] | undefined {
  if (page === undefined || page === null) return undefined;
  const issues = validateTemplatePage(page);
  if (issues.length > 0) {
    console.error(`[template-runtime] props.page ${String(page.type)} ditolak: ${issues.slice(0, 5).join('; ')}`);
    return undefined;
  }
  return JSON.parse(JSON.stringify(page)) as TemplateRenderProps['page'];
}

export function sanitizeTemplateRuntimeProps(props: TemplateRenderProps): Record<string, unknown> {
  const { auth, page, profile, sections, ...publicProps } = props;
  const tenantProfile: TemplateRenderProps['profile'] =
    profile && typeof profile === 'object' && !Array.isArray(profile) ? profile : {};
  const safePage = sanitizeTemplatePage(page);
  const safeProfile = {
    ...(safeTemplateText(tenantProfile.name, 120) ? { name: safeTemplateText(tenantProfile.name, 120) } : {}),
    ...(safeTemplateText(tenantProfile.tagline, 240) ? { tagline: safeTemplateText(tenantProfile.tagline, 240) } : {}),
    ...(getSafeAvatarUrl(tenantProfile.logoUrl) ? { logoUrl: getSafeAvatarUrl(tenantProfile.logoUrl) } : {}),
    ...(safeTemplateText(tenantProfile.whatsapp, 40) ? { whatsapp: safeTemplateText(tenantProfile.whatsapp, 40) } : {}),
    ...(safeTemplateText(tenantProfile.phone, 40) ? { phone: safeTemplateText(tenantProfile.phone, 40) } : {}),
    ...(tenantProfile.socialLinks && typeof tenantProfile.socialLinks === 'object' && !Array.isArray(tenantProfile.socialLinks)
      ? { socialLinks: tenantProfile.socialLinks }
      : {}),
    ...(tenantProfile.footerSettings !== undefined ? { footerSettings: tenantProfile.footerSettings } : {}),
  };
  const publicPropsWithPage = {
    ...publicProps,
    profile: safeProfile,
    sections: Array.isArray(sections)
      ? sections.filter((section) => section?.type !== 'order_detail')
      : [],
    ...(safePage ? { page: safePage } : {}),
  };
  if (auth === null || typeof auth !== 'object' || Array.isArray(auth)) {
    return publicPropsWithPage;
  }
  const safeAuth: Record<string, unknown> = {
    isLoggedIn: auth.isLoggedIn === true,
  };
  for (const field of [
    'loginHref',
    'logoutHref',
    'cartHref',
    'ordersHref',
    'tagihanHref',
    'calendarHref',
    'profileHref',
    'chatHref',
  ] as const) {
    const value = auth[field];
    if (isSafeRelativePath(value)) safeAuth[field] = value;
  }
  const username = auth.username?.trim();
  if (
    username &&
    username.length <= 80 &&
    !/[\u0000-\u001f\u007f]/.test(username) &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)
  ) {
    safeAuth.username = username;
  }
  const avatar = getSafeAvatarUrl(auth.avatar);
  if (avatar) safeAuth.avatar = avatar;
  return { ...publicPropsWithPage, auth: safeAuth };
}

export class TemplateRuntimeError extends Error {
  constructor(
    message: string,
    readonly code: string = 'template_runtime_error',
    readonly status: number = 503,
  ) {
    super(message);
    this.name = 'TemplateRuntimeError';
  }
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const MAX_CLIENT_BUNDLE_BYTES = 512 * 1024;
const MAX_CLIENT_BUNDLE_BASE64_LENGTH = Math.ceil(MAX_CLIENT_BUNDLE_BYTES / 3) * 4;
const ALLOWED_ORDER_ACTIONS_FOR_TEMPLATE_PROPS = [
  'order.retry_payment',
  'order.cancel',
  'order.complete',
  'order.dispute',
] as const;

export function parseTemplateRuntimeVersionMap(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new TemplateRuntimeError('TEMPLATE_RUNTIME_VERSION_MAP is invalid JSON.', 'invalid_version_map', 500);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TemplateRuntimeError('TEMPLATE_RUNTIME_VERSION_MAP must be a JSON object.', 'invalid_version_map', 500);
  }
  for (const [slug, version] of Object.entries(parsed)) {
    if (!SLUG_PATTERN.test(slug) || typeof version !== 'string' || !VERSION_PATTERN.test(version)) {
      throw new TemplateRuntimeError('TEMPLATE_RUNTIME_VERSION_MAP contains an invalid slug or version.', 'invalid_version_map', 500);
    }
  }
  return parsed as Record<string, string>;
}

export function getTemplateRuntimeVersion(
  slug: string,
  tenantVersion: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (tenantVersion == null) return null;
  if (!VERSION_PATTERN.test(tenantVersion)) {
    throw new TemplateRuntimeError('Website template runtime version is invalid.', 'invalid_runtime_pin', 500);
  }
  if (env.TEMPLATE_RUNTIME_ENABLED !== 'true') {
    throw new TemplateRuntimeError('Template runtime is disabled for a pinned website.', 'runtime_disabled', 503);
  }
  const deploymentPin = parseTemplateRuntimeVersionMap(env.TEMPLATE_RUNTIME_VERSION_MAP)[slug];
  if (deploymentPin !== undefined && deploymentPin !== tenantVersion) {
    throw new TemplateRuntimeError(
      'Pinned template version is not approved by this renderer deployment.',
      'runtime_version_not_approved',
      503,
    );
  }
  return tenantVersion;
}

export function getTemplateRuntimeStudioPreviewVersion(
  slug: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (
    env.NODE_ENV === 'production' ||
    env.TEMPLATE_RUNTIME_STUDIO_PREVIEW_ENABLED !== 'true'
  ) {
    return null;
  }
  const approvedVersion = parseTemplateRuntimeVersionMap(env.TEMPLATE_RUNTIME_VERSION_MAP)[slug];
  if (approvedVersion === undefined) return null;
  return getTemplateRuntimeVersion(slug, approvedVersion, env);
}

/**
 * Versi runtime untuk route tenant. Hanya dari pin website (`template_runtime` API);
 * tidak ada lagi fallback "dev preview" lewat TEMPLATE_RUNTIME_VERSION_MAP, karena
 * fallback itu membuat template bawaan bernama sama (mis. store-classic) dirender
 * sebagai package eksternal.
 */
export function getTemplateRuntimeTenantVersion(
  slug: string,
  pinnedVersion: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  if (pinnedVersion === null || pinnedVersion === undefined) return null;
  return getTemplateRuntimeVersion(slug, pinnedVersion, env);
}

export function isTemplateRuntimeClientBundleApproved(
  _slug: string,
  version: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.TEMPLATE_RUNTIME_CLIENT_BUNDLE_ENABLED !== 'false' && VERSION_PATTERN.test(version);
}

export function getTemplateRuntimeClientConfig(env: NodeJS.ProcessEnv = process.env): {
  url: string;
  token: string;
  timeoutMs: number;
} {
  const url = env.TEMPLATE_RUNTIME_URL?.trim();
  const token = env.TEMPLATE_RUNTIME_TOKEN?.trim();
  if (!url || !token) {
    throw new TemplateRuntimeError('Template runtime URL/token is not configured.', 'runtime_not_configured', 503);
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new TemplateRuntimeError('Template runtime URL is invalid.', 'runtime_url_invalid', 500);
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new TemplateRuntimeError('Template runtime URL must use HTTP or HTTPS.', 'runtime_url_invalid', 500);
  }
  if (!parsedUrl.hostname) {
    throw new TemplateRuntimeError('Template runtime URL is invalid.', 'runtime_url_invalid', 500);
  }
  const timeoutMs = Number(env.TEMPLATE_RUNTIME_TIMEOUT_MS ?? 5000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
    throw new TemplateRuntimeError('Template runtime timeout is invalid.', 'runtime_timeout_invalid', 500);
  }
  return { url: parsedUrl.toString().replace(/\/$/, ''), token, timeoutMs };
}

export async function renderTemplateThroughRuntime(
  request: TemplateRuntimeRenderRequest,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<TemplateRuntimeRenderResult> {
  if (!SLUG_PATTERN.test(request.slug) || !VERSION_PATTERN.test(request.version)) {
    throw new TemplateRuntimeError('Template slug or version is invalid.', 'invalid_render_request', 400);
  }
  if (request.props === null || typeof request.props !== 'object' || Array.isArray(request.props)) {
    throw new TemplateRuntimeError('Template props must be a JSON object.', 'invalid_render_request', 400);
  }
  const config = getTemplateRuntimeClientConfig(env);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetchImpl(`${config.url}/v1/render`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.token}`,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(request),
      cache: 'no-store',
      signal: controller.signal,
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new TemplateRuntimeError('Template runtime returned invalid JSON.', 'invalid_runtime_response', 502);
    }
    if (!response.ok) {
      const errorBody = body as { error?: { code?: string; message?: string } };
      throw new TemplateRuntimeError(
        errorBody.error?.message ?? 'Template runtime rendering failed.',
        errorBody.error?.code ?? 'runtime_render_failed',
        response.status,
      );
    }
    const result = body as Partial<TemplateRuntimeRenderResult> & { clientEntryUrl?: unknown };
    const hasLegacyClientEntry = Object.prototype.hasOwnProperty.call(result, 'clientEntryUrl');
    if (
      result.slug !== request.slug ||
      result.version !== request.version ||
      typeof result.digest !== 'string' || !/^[a-f0-9]{64}$/.test(result.digest) ||
      typeof result.html !== 'string'
    ) {
      throw new TemplateRuntimeError('Template runtime returned an invalid response.', 'invalid_runtime_response', 502);
    }
    if (hasLegacyClientEntry) {
      if (result.clientEntryUrl !== null) {
        throw new TemplateRuntimeError(
          'Template versi ini membutuhkan browser JavaScript yang belum diaktifkan.',
          'template_client_bundle_not_supported',
          503,
        );
      }
      if (result.clientBundle !== undefined || result.clientBundleSha256 !== undefined) {
        throw new TemplateRuntimeError('Template runtime returned an invalid response.', 'invalid_runtime_response', 502);
      }
      return { ...result, clientBundle: null, clientBundleSha256: null } as TemplateRuntimeRenderResult;
    }
    const clientBundle = result.clientBundle;
    const hasClientBundle = typeof clientBundle === 'string';
    const clientBundleBytes = hasClientBundle && clientBundle.length <= MAX_CLIENT_BUNDLE_BASE64_LENGTH
      ? Buffer.from(clientBundle, 'base64')
      : null;
    const clientBundleDigest = clientBundleBytes
      ? createHash('sha256').update(clientBundleBytes).digest('hex')
      : null;
    if (
      (result.clientBundle !== null &&
        (typeof result.clientBundle !== 'string' ||
          !clientBundleBytes ||
          clientBundleBytes.length === 0 ||
          clientBundleBytes.length > MAX_CLIENT_BUNDLE_BYTES ||
          clientBundleBytes.toString('base64') !== result.clientBundle)) ||
      (result.clientBundleSha256 !== null &&
        (typeof result.clientBundleSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(result.clientBundleSha256))) ||
      (hasClientBundle
        ? !result.clientBundleSha256 || result.clientBundleSha256 !== clientBundleDigest
        : result.clientBundleSha256 !== null)
    ) {
      throw new TemplateRuntimeError('Template runtime returned an invalid response.', 'invalid_runtime_response', 502);
    }
    return result as TemplateRuntimeRenderResult;
  } catch (error) {
    if (error instanceof TemplateRuntimeError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TemplateRuntimeError('Template runtime rendering timed out.', 'runtime_timeout', 504);
    }
    throw new TemplateRuntimeError('Template runtime is unavailable.', 'runtime_unavailable', 503);
  } finally {
    clearTimeout(timeout);
  }
}
