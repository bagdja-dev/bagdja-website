import type { ReactNode } from 'react';
import type { TemplateRenderProps } from './template-registry';
import { resolveTenantLinkBase } from './tenant-link-base';
import {
  getTemplateRuntimeTenantVersion,
  renderTemplateThroughRuntime,
  sanitizeTemplateRuntimeProps,
  TemplateRuntimeError,
} from './template-runtime-client';
import { TemplateRuntimeSsrFrame } from '../components/template-runtime-ssr-frame';
import { TemplateRuntimeErrorView } from '../components/template-runtime-error';

export interface PinnedTenantHeaderResult {
  node: ReactNode | null;
  active: boolean;
}

function renderRuntimeError(error: TemplateRuntimeError): ReactNode {
  return <TemplateRuntimeErrorView code={error.code} message={error.message} />;
}

export async function renderPinnedTenantTemplate({
  templateSlug,
  pinnedVersion,
  tenantSlug,
  props,
}: {
  templateSlug: string;
  pinnedVersion: string | null | undefined;
  tenantSlug: string;
  props: TemplateRenderProps;
}): Promise<ReactNode | null> {
  try {
    const version = getTemplateRuntimeTenantVersion(templateSlug, pinnedVersion);
    if (version === null) return null;

    const rendered = await renderTemplateThroughRuntime({
      slug: templateSlug,
      version,
      props: sanitizeTemplateRuntimeProps(props),
    });
    if (rendered.clientBundle !== null) {
      throw new TemplateRuntimeError(
        'Template versi ini membutuhkan browser JavaScript yang belum diaktifkan untuk halaman tenant.',
        'template_client_bundle_not_supported',
        503,
      );
    }

    return (
      <TemplateRuntimeSsrFrame
        html={rendered.html}
        identity={{ slug: rendered.slug, version: rendered.version, digest: rendered.digest }}
        tenantPathPrefix={resolveTenantLinkBase(tenantSlug) || '/'}
      />
    );
  } catch (error) {
    if (error instanceof TemplateRuntimeError) return renderRuntimeError(error);
    throw error;
  }
}

export async function renderPinnedTenantHeader({
  templateSlug,
  pinnedVersion,
  tenantSlug,
  props,
}: {
  templateSlug: string;
  pinnedVersion: string | null | undefined;
  tenantSlug: string;
  props: TemplateRenderProps;
}): Promise<PinnedTenantHeaderResult> {
  try {
    const version = getTemplateRuntimeTenantVersion(templateSlug, pinnedVersion);
    if (version === null) return { node: null, active: false };

    const rendered = await renderTemplateThroughRuntime({
      slug: templateSlug,
      version,
      props: {
        ...sanitizeTemplateRuntimeProps({
          isPreview: false,
          profile: { name: props.profile.name, logoUrl: props.profile.logoUrl },
          templateTheme: props.templateTheme,
          websiteTheme: props.websiteTheme,
          sections: [],
          products: [],
          locations: [],
          faqs: [],
          websiteSlug: props.websiteSlug,
          pages: props.pages ?? [],
          auth: props.auth,
        }),
        headerOnly: true,
      },
    });
    if (rendered.clientBundle !== null) {
      throw new TemplateRuntimeError(
        'Template versi ini membutuhkan browser JavaScript yang belum diaktifkan untuk halaman tenant.',
        'template_client_bundle_not_supported',
        503,
      );
    }

    return {
      node: (
        <TemplateRuntimeSsrFrame
          html={rendered.html}
          identity={{ slug: rendered.slug, version: rendered.version, digest: rendered.digest }}
          tenantPathPrefix={resolveTenantLinkBase(tenantSlug) || '/'}
          resizeToContent
        />
      ),
      active: true,
    };
  } catch (error) {
    if (error instanceof TemplateRuntimeError) {
      return { node: renderRuntimeError(error), active: false };
    }
    throw error;
  }
}
