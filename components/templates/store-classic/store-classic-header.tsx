'use client';

import { useEffect, useRef, useState } from 'react';

import type { SocialLink } from '../../../lib/template-data';
import { CloseIcon, HamburgerIcon, SocialIcon } from './store-classic-icons';

const DRAWER_TRANSITION_MS = 300;

export interface HeaderNavLink {
  href: string;
  label: string;
}

/** W1 auth renderer: state login buyer (diteruskan dari server component). */
export interface HeaderAuthState {
  isLoggedIn: boolean;
  username?: string;
  avatar?: string;
  loginHref?: string;
  logoutHref?: string;
  cartHref?: string;
  ordersHref?: string;
  profileHref?: string;
}

interface StoreClassicHeaderProps {
  title: string;
  logoUrl?: string;
  homeHref: string;
  waHref?: string;
  showWhatsappCta: boolean;
  leftNavLinks: HeaderNavLink[];
  rightNavLinks: HeaderNavLink[];
  socialLinks?: SocialLink[];
  auth?: HeaderAuthState;
}

export function StoreClassicHeader({
  title,
  logoUrl,
  homeHref,
  waHref,
  showWhatsappCta,
  leftNavLinks,
  rightNavLinks,
  socialLinks = [],
  auth,
}: StoreClassicHeaderProps) {
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openDrawer = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    setDrawerMounted(true);
    requestAnimationFrame(() => setDrawerVisible(true));
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    closeTimeoutRef.current = setTimeout(() => setDrawerMounted(false), DRAWER_TRANSITION_MS);
  };

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const navLinks = [...leftNavLinks, ...rightNavLinks];
  const hasNav = navLinks.length > 0;

  return (
    <header
      className="sticky top-0 z-20 border-b-2"
      style={{ borderColor: 'var(--brand-accent)', backgroundColor: 'var(--brand-bg)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <a href={homeHref} className="flex shrink-0 items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-9 rounded object-contain" />
          ) : (
            <span
              className="text-base font-bold uppercase tracking-[0.2em] sm:text-lg"
              style={{ fontFamily: 'var(--font-heading)', fontWeight: 'var(--font-heading-weight)' }}
            >
              {title}
            </span>
          )}
        </a>

        <nav className="hidden flex-1 items-center justify-start gap-8 sm:ml-8 sm:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap text-xs font-semibold uppercase tracking-wider transition-colors hover:opacity-70"
              style={{ color: 'var(--brand-text)' }}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          {showWhatsappCta && waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-transform hover:scale-105 sm:inline-flex"
              style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
            >
              Hubungi Kami
            </a>
          )}
          {auth &&
            (auth.isLoggedIn ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 transition-colors hover:opacity-80"
                  style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                >
                  {auth.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={auth.avatar}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold uppercase"
                      style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
                      aria-hidden="true"
                    >
                      {(auth.username ?? 'U').charAt(0)}
                    </span>
                  )}
                  <span className="hidden max-w-[100px] truncate text-xs font-semibold uppercase tracking-wide sm:inline">
                    {auth.username}
                  </span>
                </button>

                {accountOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-xl border shadow-lg"
                    style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}
                  >
                    {[
                      { href: auth.cartHref, label: 'Cart' },
                      { href: auth.ordersHref, label: 'Transaction' },
                      { href: auth.profileHref, label: 'Profile' },
                    ].map(
                      (item) =>
                        item.href && (
                          <a
                            key={item.label}
                            href={item.href}
                            role="menuitem"
                            onClick={() => setAccountOpen(false)}
                            className="block border-b px-4 py-3 text-xs font-semibold uppercase tracking-wide transition-colors hover:opacity-70"
                            style={{ borderColor: 'var(--brand-border)' }}
                          >
                            {item.label}
                          </a>
                        ),
                    )}
                    {auth.logoutHref && (
                      <a
                        href={auth.logoutHref}
                        role="menuitem"
                        onClick={() => setAccountOpen(false)}
                        className="block px-4 py-3 text-xs font-semibold uppercase tracking-wide transition-colors hover:opacity-70"
                        style={{ color: 'var(--brand-text)' }}
                      >
                        Logout
                      </a>
                    )}
                  </div>
                )}
              </div>
            ) : (
              auth.loginHref && (
                <a
                  href={auth.loginHref}
                  className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-transform hover:scale-105"
                  style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
                >
                  Masuk
                </a>
              )
            ))}
          {hasNav && (
            <button
              type="button"
              className="rounded-lg p-1 transition-colors hover:opacity-80 sm:hidden"
              style={{ color: 'var(--brand-text)' }}
              onClick={openDrawer}
              aria-label="Buka menu"
            >
              <HamburgerIcon />
            </button>
          )}
        </div>
      </div>

      {drawerMounted && (
        <div className="fixed inset-0 z-30">
          <button
            type="button"
            className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
              drawerVisible ? 'opacity-100' : 'opacity-0'
            }`}
            aria-label="Tutup menu"
            onClick={closeDrawer}
          />
          <div
            className={`absolute right-0 top-0 flex h-full w-80 max-w-[85vw] flex-col shadow-2xl transition-transform duration-300 ease-out ${
              drawerVisible ? 'translate-x-0' : 'translate-x-full'
            }`}
            style={{ backgroundColor: 'var(--brand-surface)' }}
          >
            <div className="flex shrink-0 items-center justify-end px-4 pt-4">
              <button
                type="button"
                className="rounded-lg p-1 transition-colors hover:opacity-80"
                style={{ color: 'var(--brand-text)' }}
                onClick={closeDrawer}
                aria-label="Tutup menu"
              >
                <CloseIcon />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={closeDrawer}
                  className="block border-b px-6 py-5 text-sm font-semibold uppercase tracking-wide transition-colors hover:opacity-80"
                  style={{ color: 'var(--brand-text)', borderColor: 'var(--brand-border)' }}
                >
                  {link.label}
                </a>
              ))}
            </nav>

            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mx-6 mb-4 rounded-full py-3 text-center text-xs font-semibold uppercase tracking-wide"
                style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
              >
                Hubungi Kami
              </a>
            )}

            {auth &&
              (auth.isLoggedIn ? (
                <div className="mx-6 mb-4 rounded-xl border" style={{ borderColor: 'var(--brand-border)' }}>
                  <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'var(--brand-border)' }}>
                    {auth.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={auth.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold uppercase"
                        style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
                        aria-hidden="true"
                      >
                        {(auth.username ?? 'U').charAt(0)}
                      </span>
                    )}
                    <span className="truncate text-sm font-semibold" style={{ color: 'var(--brand-text)' }}>
                      {auth.username}
                    </span>
                  </div>
                  {[
                    { href: auth.cartHref, label: 'Cart' },
                    { href: auth.ordersHref, label: 'Transaction' },
                    { href: auth.profileHref, label: 'Profile' },
                  ].map(
                    (item) =>
                      item.href && (
                        <a
                          key={item.label}
                          href={item.href}
                          onClick={closeDrawer}
                          className="block border-b px-4 py-3 text-xs font-semibold uppercase tracking-wide transition-colors hover:opacity-70"
                          style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}
                        >
                          {item.label}
                        </a>
                      ),
                  )}
                  {auth.logoutHref && (
                    <a
                      href={auth.logoutHref}
                      onClick={closeDrawer}
                      className="block px-4 py-3 text-xs font-semibold uppercase tracking-wide transition-colors hover:opacity-70"
                      style={{ color: 'var(--brand-text)' }}
                    >
                      Logout
                    </a>
                  )}
                </div>
              ) : (
                auth.loginHref && (
                  <a
                    href={auth.loginHref}
                    onClick={closeDrawer}
                    className="mx-6 mb-4 block rounded-full py-3 text-center text-xs font-semibold uppercase tracking-wide"
                    style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
                  >
                    Masuk
                  </a>
                )
              ))}

            {socialLinks.length > 0 && (
              <div
                className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t px-6 py-5"
                style={{ borderColor: 'var(--brand-border)' }}
              >
                {socialLinks.map((social) => (
                  <a
                    key={social.platform}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.platform}
                    className="flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:opacity-80"
                    style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}
                  >
                    <SocialIcon platform={social.platform} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
