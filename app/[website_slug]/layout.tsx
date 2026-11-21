import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';

import { getWebsiteBySlug } from '../../lib/api-client';
import { TemplateLocaleProvider, resolveTemplateLocale } from '../../components/templates/shared/template-locale';
import { getAuthViewState } from '../../lib/auth-view';
import { toNavPage } from '../../lib/template-data';
import { renderTemplateShell } from '../../lib/template-runtime-route';
import { applyViewerTemplateTrial } from '../../lib/template-trial';
import { tenantRuntime, tenantTemplateTheme } from '../../lib/tenant-template';
import { resolveTenantLinkBase } from '../../lib/tenant-link-base';
import { sanitizeWebsiteTheme } from '../../lib/website-theme';

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

/**
 * Shell persisten template (template-client-rendering-plan D8): bila template menyatakan `shell` dan render
 * langsung aktif, header/menu/footer/navigasi bawah template dirender di sini SEKALI — layout App Router tidak
 * dipasang ulang saat berpindah halaman, jadi hanya isi di outlet yang berganti (tanpa glitch).
 */
export default async function TenantLayout({ params, children }: TenantLayoutProps) {
  const locale = resolveTemplateLocale((await headers()).get('accept-language'));
  const publicWebsite = await getWebsiteBySlug(params.website_slug);
  if (!publicWebsite?.template_runtime && !publicWebsite?.template_trial_active) {
    return <TemplateLocaleProvider locale={locale}>{children}</TemplateLocaleProvider>;
  }
  const website = await applyViewerTemplateTrial(publicWebsite);
  const runtime = tenantRuntime(website);
  if (!runtime?.pageOverrides.includes('shell')) {
    return <TemplateLocaleProvider locale={locale}>{children}</TemplateLocaleProvider>;
  }

  const linkBase = resolveTenantLinkBase(website.slug);
  // Shell tetap terpasang lintas halaman → login/logout kembali ke beranda tenant (bukan halaman saat shell dibuat).
  const auth = await getAuthViewState(linkBase || '/', linkBase);
  const shell = renderTemplateShell({
    runtime,
    tenantSlug: website.slug,
    props: {
      isPreview: false,
      profile: {
        name: website.name,
        tagline: website.tagline ?? undefined,
        logoUrl: website.logo_url ?? undefined,
        whatsapp: website.whatsapp ?? undefined,
        phone: website.phone ?? undefined,
        socialLinks: website.social_links,
        footerSettings: website.footer_settings,
      },
      templateTheme: tenantTemplateTheme(website),
      websiteTheme: sanitizeWebsiteTheme(website.theme),
      sections: [],
      products: [],
      locations: [],
      faqs: [],
      websiteSlug: linkBase,
      websiteId: website.id,
      tenantSlug: website.slug,
      pages: website.pages.map(toNavPage),
      auth: runtime.slug === 'kumpul' ? { ...auth, profileLogoutHref: auth.logoutHref } : auth,
    },
    children,
  });
  return <TemplateLocaleProvider locale={locale}>{shell ?? children}</TemplateLocaleProvider>;
}
