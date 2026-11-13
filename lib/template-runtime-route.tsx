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
import { TEMPLATE_RUNTIME_INTENTS, type TemplateRuntimeOrderAction } from './template-runtime-bridge';
import { TemplateRuntimeSsrFrame } from '../components/template-runtime-ssr-frame';
import { TemplateRuntimeErrorView } from '../components/template-runtime-error';
import { TemplateTrialBanner } from '../components/template-trial-banner';
import { resolveTheme } from './website-theme';

export interface PinnedTenantHeaderResult {
  node: ReactNode | null;
  active: boolean;
}

function renderRuntimeError(error: TemplateRuntimeError): ReactNode {
  return <TemplateRuntimeErrorView code={error.code} message={error.message} />;
}

function getNotificationContext(templateSlug: string, tenantSlug: string, props: TemplateRenderProps) {
  if (templateSlug !== 'kumpul' || !props.websiteId || !props.auth?.isLoggedIn) return undefined;
  return {
    websiteId: props.websiteId,
    basePath: resolveTenantLinkBase(tenantSlug) || '/',
    isLoggedIn: true,
    theme: resolveTheme(props.templateTheme, props.websiteTheme).colors,
  };
}

export async function renderPinnedTenantTemplate({
  templateSlug,
  pinnedVersion,
  tenantSlug,
  props,
  orderActionContext,
  candidateDigest,
}: {
  templateSlug: string;
  pinnedVersion: string | null | undefined;
  /** Uji kandidat belum terbit (lib/template-trial.ts). */
  candidateDigest?: string;
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
    const notificationContext = props.hideHeader
      ? undefined
      : getNotificationContext(templateSlug, tenantSlug, props);

    // Bridge aksi aktif hanya untuk intent yang dinyatakan props.page (keputusan P2).
    const pageActions = Array.isArray(props.page?.actions)
      ? (props.page.actions as unknown[]).filter((action): action is string =>
        typeof action === 'string' && (TEMPLATE_RUNTIME_INTENTS as readonly string[]).includes(action))
      : [];
    const intentContext = props.page && pageActions.length > 0
      ? { tenantSlug, pageType: props.page.type, actions: pageActions }
      : undefined;
    const bridgeAvailable = Boolean(intentContext) || (orderActionContext?.actions.length ?? 0) > 0;
    const safeProps = sanitizeTemplateRuntimeProps(bridgeAvailable ? { ...props, bridgeVersion: 1 } : props);
    const rendered = await renderTemplateThroughRuntime({
      slug: templateSlug,
      version,
      props: safeProps,
      ...(candidateDigest ? { candidateDigest } : {}),
    });
    let clientBundle: string | null = null;
    let clientBundleSha256: string | null = null;
    if (rendered.clientBundle !== null) {
      if (!isTemplateRuntimeClientBundleApproved(templateSlug, version)) {
        throw new TemplateRuntimeError(
          'Browser JavaScript dinonaktifkan pada deployment ini.',
          'template_client_bundle_disabled',
          503,
        );
      }
      clientBundle = rendered.clientBundle;
      clientBundleSha256 = rendered.clientBundleSha256;
    }

    return (
      <>
        <TemplateRuntimeSsrFrame
          html={rendered.html}
          identity={{ slug: rendered.slug, version: rendered.version, digest: rendered.digest }}
          tenantPathPrefix={resolveTenantLinkBase(tenantSlug) || '/'}
          clientBundle={clientBundle}
          clientBundleSha256={clientBundleSha256}
          orderActionContext={orderActionContext}
          intentContext={intentContext}
          notificationContext={notificationContext}
        />
        {candidateDigest ? <TemplateTrialBanner slug={rendered.slug} version={rendered.version} /> : null}
      </>
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
  candidateDigest,
  bottomNav = false,
  reserveBottomSpace = true,
}: {
  templateSlug: string;
  pinnedVersion: string | null | undefined;
  candidateDigest?: string;
  tenantSlug: string;
  props: TemplateRenderProps;
  /** Manifest menyatakan `bottom_nav`: render juga navigasi bawah template (menempel di bawah layar). */
  bottomNav?: boolean;
  /** Set false when the page itself measures and reserves the fixed dock's inset. */
  reserveBottomSpace?: boolean;
}): Promise<PinnedTenantHeaderResult> {
  try {
    const version = getTemplateRuntimeTenantVersion(templateSlug, pinnedVersion);
    if (version === null) return { node: null, active: false };
    const notificationContext = getNotificationContext(templateSlug, tenantSlug, props);

    const chromeProps = sanitizeTemplateRuntimeProps({
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
    });
    const navNode = bottomNav
      ? await renderPinnedTenantBottomNav({
          templateSlug,
          version,
          tenantSlug,
          chromeProps,
          candidateDigest,
          reserveBottomSpace,
        })
      : null;
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
      ...(candidateDigest ? { candidateDigest } : {}),
    });
    if (rendered.clientBundle !== null) {
      if (!isTemplateRuntimeClientBundleApproved(templateSlug, version)) {
        throw new TemplateRuntimeError(
          'Browser JavaScript dinonaktifkan pada deployment ini.',
          'template_client_bundle_disabled',
          503,
        );
      }
    }

    return {
      node: (
        <>
          <TemplateRuntimeSsrFrame
            html={rendered.html}
            identity={{ slug: rendered.slug, version: rendered.version, digest: rendered.digest }}
            tenantPathPrefix={resolveTenantLinkBase(tenantSlug) || '/'}
            clientBundle={rendered.clientBundle}
            clientBundleSha256={rendered.clientBundleSha256}
            resizeToContent
            notificationContext={notificationContext}
          />
          {candidateDigest ? <TemplateTrialBanner slug={rendered.slug} version={rendered.version} /> : null}
          {navNode}
        </>
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

/**
 * Navigasi bawah template untuk halaman yang isinya dikelola Bagdja (`bottom_nav` di manifest).
 * Dirender terpisah dari header karena elemen `fixed` di iframe header hanya menempel ke iframe
 * itu, bukan ke layar. Gagal render = tanpa navigasi bawah (header & isi halaman tetap tampil).
 */
async function renderPinnedTenantBottomNav({
  templateSlug,
  version,
  tenantSlug,
  chromeProps,
  candidateDigest,
  reserveBottomSpace,
}: {
  templateSlug: string;
  version: string;
  tenantSlug: string;
  chromeProps: Record<string, unknown>;
  candidateDigest?: string;
  reserveBottomSpace: boolean;
}): Promise<ReactNode | null> {
  try {
    const rendered = await renderTemplateThroughRuntime({
      slug: templateSlug,
      version,
      props: { ...chromeProps, bottomNavOnly: true },
      ...(candidateDigest ? { candidateDigest } : {}),
    });
    if (rendered.clientBundle !== null && !isTemplateRuntimeClientBundleApproved(templateSlug, version)) return null;
    return (
      <TemplateRuntimeSsrFrame
        html={rendered.html}
        identity={{ slug: rendered.slug, version: rendered.version, digest: rendered.digest }}
        tenantPathPrefix={resolveTenantLinkBase(tenantSlug) || '/'}
        clientBundle={rendered.clientBundle}
        clientBundleSha256={rendered.clientBundleSha256}
        resizeToContent
        placement="bottom"
        reserveBottomSpace={reserveBottomSpace}
      />
    );
  } catch (error) {
    if (error instanceof TemplateRuntimeError) return null;
    throw error;
  }
}
