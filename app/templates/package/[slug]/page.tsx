/**
 * Demo template PACKAGE untuk katalog & detail template di Studio:
 * /templates/package/<slug>?preview=1&name=...&theme_mode=...
 *
 * Me-render versi terbit terbaru (manifest katalog) lewat runtime dengan halaman
 * Beranda contoh dari manifest (`defaultPages`) + katalog contoh. Template bawaan
 * tetap memakai /templates/<slug> (renderer bawaan).
 */
import { notFound } from 'next/navigation';

import { TemplateRuntimeErrorView } from '../../../../components/template-runtime-error';
import { getTemplateBySlug } from '../../../../lib/api-client';
import { PACKAGE_TEMPLATE_DEMO_CATALOG } from '../../../../lib/package-template-demo';
import { buildTemplateDefaultsPreview, parseFooterSettingsParam } from '../../../../lib/template-data';
import { buildPreviewDocument } from '../../../../lib/template-demo-document';
import {
  getTemplateRuntimeVersion,
  renderTemplateThroughRuntime,
  sanitizeTemplateRuntimeProps,
  TemplateRuntimeError,
} from '../../../../lib/template-runtime-client';
import { extractTemplateTheme, parseThemeFromSearchParams } from '../../../../lib/website-theme';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Record<string, string | undefined>;

export const metadata = { robots: { index: false, follow: false } };

export default async function PackageTemplateDemo({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: SearchParams;
}) {
  const template = await getTemplateBySlug(params.slug).catch(() => null);
  const manifest = template?.manifest as { version?: string; isBuiltin?: boolean } | null | undefined;
  if (!template || template.source !== 'package' || !manifest?.version) notFound();

  const structure = template.structure ?? {};
  const defaults = buildTemplateDefaultsPreview(structure);
  const demoCatalog = {
    ...PACKAGE_TEMPLATE_DEMO_CATALOG,
    ...(defaults.products.length ? { products: defaults.products } : {}),
    ...(defaults.categories.length ? { categories: defaults.categories } : {}),
    ...(defaults.faqs.length ? { faqs: defaults.faqs } : {}),
  };
  const extraPages = (structure.extra_pages ?? []) as Array<{ slug: string; title: string }>;
  const name = searchParams.name?.trim() || 'Nama Bisnis Anda';

  try {
    // `?version=` = versi terbit tertentu dari pemilih versi Studio; runtime hanya melayani versi
    // yang dirilis ke registry (versi dicabut ditolak). Default = versi terbit terbaru katalog.
    const requestedVersion = typeof searchParams.version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(searchParams.version)
      ? searchParams.version
      : manifest.version;
    const version = getTemplateRuntimeVersion(template.slug, requestedVersion);
    if (!version) notFound();
    const props = sanitizeTemplateRuntimeProps({
      isPreview: true,
      profile: {
        name,
        tagline: searchParams.tagline,
        logoUrl: searchParams.logo ?? searchParams.logo_url,
        whatsapp: searchParams.whatsapp,
        phone: searchParams.phone,
        footerSettings: parseFooterSettingsParam(searchParams.footer_settings),
      },
      templateTheme: extractTemplateTheme(structure),
      websiteTheme: parseThemeFromSearchParams(searchParams),
      sections: defaults.sections.map((section, index) => ({ ...section, id: `demo-${index}` })),
      ...demoCatalog,
      websiteSlug: '/demo',
      pages: [
        { slug: 'home', title: 'Beranda', isHome: true, placement: 'header' },
        ...extraPages.map((page) => ({ slug: page.slug, title: page.title, placement: 'header' })),
      ],
      auth: { isLoggedIn: false, loginHref: '/demo/auth/login', cartHref: '/demo/cart' },
    } as Parameters<typeof sanitizeTemplateRuntimeProps>[0]);
    const rendered = await renderTemplateThroughRuntime({ slug: template.slug, version, props });
    const clientScript = rendered.clientBundle ? Buffer.from(rendered.clientBundle, 'base64').toString('utf8') : null;
    return (
      <iframe
        title={`Demo template ${template.name}`}
        sandbox={clientScript ? 'allow-scripts' : ''}
        referrerPolicy="no-referrer"
        srcDoc={buildPreviewDocument(rendered.html, clientScript, Boolean(clientScript))}
        style={{ display: 'block', width: '100%', height: '100vh', border: 0 }}
      />
    );
  } catch (error) {
    if (error instanceof TemplateRuntimeError) {
      return <TemplateRuntimeErrorView code={error.code} message={error.message} />;
    }
    throw error;
  }
}
