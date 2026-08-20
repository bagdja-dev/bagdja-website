'use client';

import { useEffect, useRef, useState } from 'react';

import type { SocialLink } from '../../../lib/template-data';
import { SocialIcon } from './barber-classic-icons';
import { CartBadge } from '../../cart-badge';

const DRAWER_TRANSITION_MS = 300;

export interface HeaderNavLink {
  href: string;
  label: string;
}

export interface HeaderAuthState {
  isLoggedIn: boolean;
  username?: string;
  email?: string;
  avatar?: string;
  loginHref?: string;
  logoutHref?: string;
  cartHref?: string;
  ordersHref?: string;
  profileHref?: string;
}

interface BarberClassicHeaderProps {
  title: string;
  logoUrl?: string;
  homeHref: string;
  waHref?: string;
  showWhatsappCta: boolean;
  /** halaman placement='regular' — tampil di sisi kiri header */
  leftNavLinks: HeaderNavLink[];
  /** halaman placement='header' — tampil di sisi kanan header */
  rightNavLinks: HeaderNavLink[];
  socialLinks?: SocialLink[];
  auth?: HeaderAuthState;
  cartHref?: string;
}

function HamburgerIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

export function BarberClassicHeader({
  title,
  logoUrl,
  homeHref,
  waHref,
  showWhatsappCta,
  leftNavLinks,
  rightNavLinks,
  socialLinks = [],
  auth,
  cartHref,
}: BarberClassicHeaderProps) {
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

  const drawerLinks = [...leftNavLinks, ...rightNavLinks];
  const hasNav = drawerLinks.length > 0;

  const linkStyle = { color: 'var(--brand-muted)' };

  return (
    <header className="sticky top-0 z-20 border-b" style={{ borderColor: 'var(--brand-border)', backgroundColor: 'var(--brand-bg)' }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex flex-1 items-center gap-4">
          {hasNav && (
            <button
              type="button"
              className="shrink-0 rounded-lg p-1 transition-colors hover:opacity-80"
              style={{ color: 'var(--brand-text)' }}
              onClick={openDrawer}
              aria-label="Buka menu"
            >
              <HamburgerIcon />
            </button>
          )}
          <nav className="hidden items-center gap-6 sm:flex">
            {leftNavLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="whitespace-nowrap text-sm font-medium transition-colors hover:opacity-80"
                style={linkStyle}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <a href={homeHref} className="flex shrink-0 items-center gap-2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-8  rounded-lg object-cover" />
          ) : null}
          <span
            className="whitespace-nowrap text-sm tracking-widest sm:text-lg"
            style={{
              color: 'var(--brand-accent-muted)',
              fontFamily: 'var(--font-heading)',
              fontWeight: 'var(--font-heading-weight)',
            }}
          >
            { logoUrl ? '' : title.toUpperCase()}
          </span>
        </a>

        <div className="flex flex-1 items-center justify-end gap-3">
          {cartHref && auth?.isLoggedIn && (
            <CartBadge href={cartHref} isLoggedIn={auth.isLoggedIn} />
          )}
          <nav className="hidden items-center gap-6 sm:flex">
            {rightNavLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="whitespace-nowrap text-sm font-medium transition-colors hover:opacity-80"
                style={linkStyle}
              >
                {link.label}
              </a>
            ))}
          </nav>
          {auth &&
            (auth.isLoggedIn ? (
              <div className="relative hidden sm:block">
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
                      {(auth.username ?? auth.email ?? 'U').charAt(0)}
                    </span>
                  )}
                  <span className="hidden max-w-[100px] truncate text-xs font-semibold uppercase tracking-wide sm:inline">
                    {auth.username ?? auth.email}
                  </span>
                </button>

                {accountOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-xl border shadow-lg"
                    style={{ backgroundColor: 'var(--brand-surface)', borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}
                  >
                    {[
                      { href: auth.cartHref, label: 'Keranjang' },
                      { href: auth.ordersHref, label: 'Transaksi' },
                      { href: auth.profileHref, label: 'Profil' },
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
                      >
                        Keluar
                      </a>
                    )}
                  </div>
                )}
              </div>
            ) : (
              auth.loginHref && (
                <a
                  href={auth.loginHref}
                  className="hidden rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-transform hover:scale-105 sm:inline-flex"
                  style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
                >
                  Masuk
                </a>
              )
            ))}
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
            className={`absolute left-0 top-0 flex h-full w-80 max-w-[85vw] flex-col shadow-2xl transition-transform duration-300 ease-out ${
              drawerVisible ? 'translate-x-0' : '-translate-x-full'
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
              {drawerLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={closeDrawer}
                  className="block border-b px-6 py-5 text-base font-medium uppercase tracking-wide transition-colors hover:opacity-80"
                  style={{ color: 'var(--brand-text)', borderColor: 'var(--brand-border)' }}
                >
                  {link.label}
                </a>
              ))}
            </nav>

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
                        {(auth.username ?? auth.email ?? 'U').charAt(0)}
                      </span>
                    )}
                    <span className="truncate text-sm font-semibold" style={{ color: 'var(--brand-text)' }}>
                      {auth.username ?? auth.email}
                    </span>
                  </div>
                  {[
                    { href: auth.cartHref, label: 'Keranjang' },
                    { href: auth.ordersHref, label: 'Transaksi' },
                    { href: auth.profileHref, label: 'Profil' },
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
                      Keluar
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
