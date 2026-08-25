import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { getWebsiteBySlug } from '../../lib/api-client';

interface TenantLayoutProps {
  params: { website_slug: string };
  children: ReactNode;
}

/**
 * Favicon browser per-tenant = logo yang di-set tenant di admin CMS
 * (`website.logo_url`). Dipasang sekali di sini (bukan di tiap page.tsx)
 * karena Next.js App Router meng-override penuh `icons` milik parent kalau
 * child mendefinisikan `icons` sendiri — page-page tenant saat ini hanya
 * set `title`/`description`, jadi tidak akan menimpa ini.
 */
export async function generateMetadata({ params }: TenantLayoutProps): Promise<Metadata> {
  const website = await getWebsiteBySlug(params.website_slug);
  if (!website?.logo_url) return {};

  return {
    icons: {
      icon: website.logo_url,
      shortcut: website.logo_url,
      apple: website.logo_url,
    },
  };
}

export default function TenantLayout({ children }: TenantLayoutProps) {
  return children;
}
