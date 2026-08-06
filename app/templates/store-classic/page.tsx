/**
 * Dev preview: /templates/store-classic?preview=1&name=...&c_accent=f59e0b&tf_head=Inter&...
 * Dipakai oleh admin (iframe live preview) & untuk browsing template secara manual.
 * Data katalog diambil dari master_defaults template sungguhan (lihat
 * `buildTemplateDefaultsPreview`) — tenant sungguhan dirender via [website_slug].
 */

import { StoreClassicView } from '../../../components/templates/store-classic/store-classic-view';
import { getTemplateBySlug } from '../../../lib/api-client';
import { buildTemplateDefaultsPreview } from '../../../lib/template-data';
import { parseThemeFromSearchParams } from '../../../lib/website-theme';

type SearchParams = Record<string, string | undefined>;

export default async function StoreClassicTemplate({ searchParams }: { searchParams: SearchParams }) {
  const isPreview = searchParams.preview === '1';
  const websiteTheme = parseThemeFromSearchParams(searchParams);
  const template = await getTemplateBySlug('store-classic');
  const { sections, products, categories, faqs } = buildTemplateDefaultsPreview(template?.structure);

  return (
    <>
      {!isPreview && (
        <a
          href="/"
          className="fixed left-4 top-4 z-20 rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white backdrop-blur transition-colors hover:bg-black/80"
        >
          ← Kembali ke index
        </a>
      )}
      <StoreClassicView
        isPreview={isPreview}
        profile={{
          name: searchParams.name,
          tagline: searchParams.tagline,
          logoUrl: searchParams.logo ?? searchParams.logo_url,
          whatsapp: searchParams.whatsapp,
          phone: searchParams.phone,
          email: searchParams.email,
        }}
        websiteTheme={websiteTheme}
        sections={sections}
        products={products}
        categories={categories}
        locations={[]}
        faqs={faqs}
      />
    </>
  );
}
