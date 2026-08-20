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
 * (mis. `/fashion-store`) — dipakai sebagai `next` di loginHref supaya
 * setelah login user kembali ke halaman asal, dan sebagai returnTo di
 * logoutHref supaya setelah logout juga kembali ke halaman yang sama.
 */
export async function getAuthViewState(pathname?: string): Promise<AuthViewState> {
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
    cartHref: safePath ? `${safePath}/cart` : '/cart',
    ordersHref: safePath ? `${safePath}/orders` : '/orders',
    profileHref: safePath ? `${safePath}/profile` : '/profile',
  };
}
