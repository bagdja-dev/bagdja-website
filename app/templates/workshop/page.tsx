/**
 * Live preview: /templates/workshop?preview=1&name=...
 *
 * Preview data is built from the persisted template structure so the admin
 * wizard and public renderer use the same defaults.
 */

import { WorkshopView } from '../../../components/templates/workshop/workshop-view';
import { getTemplateBySlug } from '../../../lib/api-client';
import { buildTemplateDefaultsPreview, resolveSections } from '../../../lib/template-data';
import { extractTemplateTheme, parseThemeFromSearchParams } from '../../../lib/website-theme';

type SearchParams = Record<string, string | undefined>;

export default async function WorkshopTemplate({ searchParams }: { searchParams: SearchParams }) {
  const isPreview = searchParams.preview === '1';
  const websiteTheme = parseThemeFromSearchParams(searchParams);

  let template = null;
  try {
    template = await getTemplateBySlug('workshop');
  } catch {
    template = null;
  }

  const previewData = template
    ? buildTemplateDefaultsPreview(template.structure)
    : {
        sections: resolveSections(null, null),
        products: [],
        categories: [],
        faqs: [],
      };

  return (
    <>
      {!isPreview ? (
        <a href="/" className="fixed left-4 top-4 z-20 rounded-full bg-black/60 px-4 py-2 text-xs font-medium text-white backdrop-blur">
          ← Kembali ke index
        </a>
      ) : null}
      <WorkshopView
        isPreview={isPreview}
        profile={{
          name: searchParams.name,
          tagline: searchParams.tagline,
          logoUrl: searchParams.logo ?? searchParams.logo_url,
          whatsapp: searchParams.whatsapp,
          phone: searchParams.phone,
          email: searchParams.email,
        }}
        templateTheme={template ? extractTemplateTheme(template.structure) : { mode: 'light', accent: 'orange' }}
        websiteTheme={websiteTheme}
        sections={previewData.sections}
        products={previewData.products}
        categories={previewData.categories}
        locations={[]}
        faqs={previewData.faqs}
      />
    </>
  );
}
