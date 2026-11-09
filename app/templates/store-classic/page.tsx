/**
 * Dev preview: /templates/store-classic?preview=1&name=...&c_accent=f59e0b&tf_head=Inter&...
 * Dipakai oleh admin (iframe live preview) & untuk browsing template secara manual.
 * Data katalog diambil dari master_defaults template sungguhan (lihat
 * `buildTemplateDefaultsPreview`) — tenant sungguhan dirender via [website_slug].
 */

import { StoreClassicView } from '../../../components/templates/store-classic/store-classic-view';
import { getTemplateBySlug } from '../../../lib/api-client';
import {
  buildTemplateDefaultsPreview,
  parseFooterSettingsParam,
  resolveSections,
} from '../../../lib/template-data';
import { parseThemeFromSearchParams } from '../../../lib/website-theme';
import { getAllowedAdminOrigins } from '../../../lib/preview-protocol';
import { TemplateRuntimePreview } from '../../../components/preview/template-runtime-preview';
import { TemplateRuntimeErrorView } from '../../../components/template-runtime-error';
import {
  getTemplateRuntimeStudioPreviewVersion,
  renderTemplateThroughRuntime,
  TemplateRuntimeError,
} from '../../../lib/template-runtime-client';

type SearchParams = Record<string, string | undefined>;

export default async function StoreClassicTemplate({ searchParams }: { searchParams: SearchParams }) {
  const isPreview = searchParams.preview === '1';
  const websiteTheme = parseThemeFromSearchParams(searchParams);
  const footerSettings = parseFooterSettingsParam(searchParams.footer_settings);

  let template = null;
  try {
    template = await getTemplateBySlug('store-classic');
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
  const { sections, products, categories, faqs } = previewData;

  let runtimeVersion: string | null;
  try {
    runtimeVersion = isPreview
      ? getTemplateRuntimeStudioPreviewVersion('store-classic')
      : null;
  } catch (error) {
    if (error instanceof TemplateRuntimeError) {
      return <TemplateRuntimeErrorView code={error.code} message={error.message} />;
    }
    throw error;
  }

  if (runtimeVersion) {
    try {
      const rendered = await renderTemplateThroughRuntime({
        slug: 'store-classic',
        version: runtimeVersion,
        props: {
          isPreview,
          profile: {
            name: searchParams.name,
            tagline: searchParams.tagline,
            logoUrl: searchParams.logo ?? searchParams.logo_url,
            whatsapp: searchParams.whatsapp,
            phone: searchParams.phone,
            email: searchParams.email,
            footerSettings,
          },
          websiteTheme,
          sections,
          products,
          categories,
          locations: [],
          faqs,
          blogPosts: [],
        },
      });
      if (rendered.clientBundle !== null) {
        throw new TemplateRuntimeError(
          'Template versi ini membutuhkan browser JavaScript yang belum diaktifkan untuk pratinjau Studio.',
          'template_client_bundle_not_supported',
          503,
        );
      }
      return (
        <TemplateRuntimePreview
          html={rendered.html}
          templateSlug={rendered.slug}
          templateVersion={rendered.version}
          digest={rendered.digest}
          pageSlug=""
          allowedOrigins={getAllowedAdminOrigins()}
          allowDemoImageHost
        />
      );
    } catch (error) {
      if (error instanceof TemplateRuntimeError) {
        return <TemplateRuntimeErrorView code={error.code} message={error.message} />;
      }
      throw error;
    }
  }

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
          footerSettings,
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
