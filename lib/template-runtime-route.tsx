import type { ReactNode } from 'react';
import type { TemplateRenderProps } from './template-registry';
import { resolveTenantLinkBase } from './tenant-link-base';
import {
  getTemplateRuntimeTenantVersion,
  isTemplateRuntimeClientBundleApproved,
  renderTemplateThroughRuntime,
  sanitizeTemplateRuntimeProps,
  TemplateRuntimeError,
} from './template-runtime-client';
import type { TemplateRuntimeOrderAction } from './template-runtime-bridge';
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
  orderActionContext,
}: {
  templateSlug: string;
  pinnedVersion: string | null | undefined;
  tenantSlug: string;
  props: TemplateRenderProps;
  orderActionContext?: {
    transactionId: string;
    actions: readonly TemplateRuntimeOrderAction[];
  };
}): Promise<ReactNode | null> {
  try {
    const version = getTemplateRuntimeTenantVersion(templateSlug, pinnedVersion);
    if (version === null) return null;

    const safeProps = sanitizeTemplateRuntimeProps(props);
    const rendered = await renderTemplateThroughRuntime({
      slug: templateSlug,
      version,
      props: safeProps,
    });
    let clientBundle: string | null = null;
    let clientBundleSha256: string | null = null;
    if (rendered.clientBundle !== null) {
      if (!isTemplateRuntimeClientBundleApproved(templateSlug, version)) {
        throw new TemplateRuntimeError(
          'Browser JavaScript belum disetujui untuk versi template ini.',
          'template_client_bundle_not_approved',
          503,
        );
      }
      clientBundle = rendered.clientBundle;
      clientBundleSha256 = rendered.clientBundleSha256;
    }

    return (
      <TemplateRuntimeSsrFrame
        html={rendered.html}
        identity={{ slug: rendered.slug, version: rendered.version, digest: rendered.digest }}
        tenantPathPrefix={resolveTenantLinkBase(tenantSlug) || '/'}
        clientBundle={clientBundle}
        clientBundleSha256={clientBundleSha256}
        orderActionContext={orderActionContext}
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
      if (!isTemplateRuntimeClientBundleApproved(templateSlug, version)) {
        throw new TemplateRuntimeError(
          'Browser JavaScript belum disetujui untuk versi template ini.',
          'template_client_bundle_not_approved',
          503,
        );
      }
    }

    return {
      node: (
        <TemplateRuntimeSsrFrame
          html={rendered.html}
          identity={{ slug: rendered.slug, version: rendered.version, digest: rendered.digest }}
          tenantPathPrefix={resolveTenantLinkBase(tenantSlug) || '/'}
          clientBundle={rendered.clientBundle}
          clientBundleSha256={rendered.clientBundleSha256}
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
