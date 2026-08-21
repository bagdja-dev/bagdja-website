import { getSession } from './session';

/**
 * State auth untuk view template (W1 auth renderer).
 * Dibaca server-side dari cookie session renderer (`site_token`), lalu
 * diteruskan sebagai prop `auth` ke TemplateRenderProps.
 */
export interface AuthViewState {
  isLoggedIn: boolean;
  username?: string;
  email?: string;
  avatar?: string;
  loginHref: string;
  logoutHref: string;
  /** Menu dropdown akun (dipakai header template saat sudah login). */
  cartHref?: string;
  ordersHref?: string;
  profileHref?: string;
}

/**
 * State auth untuk view template. `pathname` = path tenant saat ini
 * (mis. `/fashion-store/blog/post-a`) — dipakai HANYA sebagai `next` di
 * loginHref supaya setelah login user kembali ke halaman asal, dan sebagai
 * returnTo di logoutHref supaya setelah logout juga kembali ke halaman yang
 * sama. `linkBase` = hasil `resolveTenantLinkBase(slug)` (`''` untuk akses
 * subdomain/custom-domain, `/{slug}` untuk localhost/apex) — dipakai untuk
 * membangun cartHref/ordersHref/profileHref. JANGAN reuse `pathname` untuk
 * ini: `pathname` adalah path HALAMAN SAAT INI (bisa `/fashion-store/blog/x`
 * atau, saat subdomain, literal `/`), bukan base tenant — reuse itu pernah
 * menghasilkan `//cart` (protocol-relative → browser resolve ke
 * `https://cart/`) saat pathname="/" dipakai sebagai base.
 */
export async function getAuthViewState(
  pathname?: string,
  linkBase = '',
): Promise<AuthViewState> {
  const { user } = await getSession();
  const safePath =
    pathname && pathname.startsWith('/') && !pathname.startsWith('//')
      ? pathname
      : undefined;
  return {
    isLoggedIn: Boolean(user?.userId),
    username: user?.username ?? user?.email,
    email: user?.email,
    avatar: user?.avatar,
    loginHref: safePath
      ? `/auth/login?next=${encodeURIComponent(safePath)}`
      : '/auth/login',
    logoutHref: safePath
      ? `/auth/logout?returnTo=${encodeURIComponent(safePath)}`
      : '/auth/logout',
    // Menu dropdown akun — route ini diprotect middleware (wajib login).
    // `ordersHref` = list daftar transaksi; `/order/:id` untuk detail.
    cartHref: `${linkBase}/cart`,
    ordersHref: `${linkBase}/orders`,
    profileHref: `${linkBase}/profile`,
  };
}
