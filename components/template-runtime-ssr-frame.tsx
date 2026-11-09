'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createTemplateRuntimeOrderActionBridge,
  TemplateRuntimeActionError,
  type TemplateRuntimeIdentity,
  type TemplateRuntimeOrderAction,
} from '../lib/template-runtime-bridge';
import {
  isTemplateRuntimeResizeMessage,
  createTemplateRuntimeSsrDocument,
  isTemplateRuntimeNavigationMessage,
} from '../lib/template-runtime-ssr-document';
import { getAllowedTemplateNavigationUrl } from '../lib/template-runtime-bridge';

interface TemplateRuntimeSsrFrameProps {
  html: string;
  identity: TemplateRuntimeIdentity;
  tenantPathPrefix: string;
  clientBundle?: string | null;
  clientBundleSha256?: string | null;
  resizeToContent?: boolean;
  orderActionContext?: {
    transactionId: string;
    actions: readonly TemplateRuntimeOrderAction[];
  };
}

export function TemplateRuntimeSsrFrame({
  html,
  identity,
  tenantPathPrefix,
  clientBundle = null,
  clientBundleSha256 = null,
  resizeToContent = false,
  orderActionContext,
}: TemplateRuntimeSsrFrameProps) {
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const frameLoadedRef = useRef(false);
  const [frameDocument, setFrameDocument] = useState('');
  const [frameHeight, setFrameHeight] = useState(76);
  const [error, setError] = useState<string | null>(null);
  const stableIdentity = useMemo(
    () => ({ slug: identity.slug, version: identity.version, digest: identity.digest }),
    [identity.digest, identity.slug, identity.version],
  );

  useEffect(() => {
    let active = true;
    frameLoadedRef.current = false;
    setFrameDocument('');
    setError(null);
    void createTemplateRuntimeSsrDocument({
      html,
      identity: stableIdentity,
      parentOrigin: window.location.origin,
      tenantPathPrefix,
      clientBundle,
      clientBundleSha256,
      resizeToContent,
      stylesheetUrls: Array.from(window.document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'))
        .map((link) => {
          try {
            const stylesheet = new URL(link.href, window.location.href);
            return stylesheet.origin === window.location.origin ? stylesheet.href : null;
          } catch {
            return null;
          }
        })
        .filter((url): url is string => url !== null),
    }).then((frameDocument) => {
      if (active) setFrameDocument(frameDocument);
    }).catch((cause: unknown) => {
      if (active) {
        setError(cause instanceof Error ? cause.message : 'Template tidak dapat disiapkan.');
      }
    });
    return () => {
      active = false;
    };
  }, [clientBundle, clientBundleSha256, html, resizeToContent, stableIdentity, tenantPathPrefix]);

  useEffect(() => {
    const frame = frameRef.current?.contentWindow;
    if (!frame) return;
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== frame || event.origin !== 'null') return;
      if (resizeToContent && isTemplateRuntimeResizeMessage(event.data, stableIdentity)) {
        setFrameHeight(event.data.height);
        return;
      }
      if (!isTemplateRuntimeNavigationMessage(event.data, stableIdentity)) return;
      const destination = getAllowedTemplateNavigationUrl(
        event.data.href,
        window.location.origin,
        tenantPathPrefix,
      );
      if (destination) window.location.assign(destination.href);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [resizeToContent, stableIdentity, tenantPathPrefix]);

  useEffect(() => {
    const frame = frameRef.current?.contentWindow;
    if (!frame || !orderActionContext) return;
    const handleOrderAction = createTemplateRuntimeOrderActionBridge({
      frame,
      identity: stableIdentity,
      allowedActions: orderActionContext.actions,
      onAction: async (action) => {
        const confirmations: Partial<Record<TemplateRuntimeOrderAction, string>> = {
          'order.cancel': 'Pesanan ini akan dibatalkan dan tidak bisa diurungkan. Lanjutkan?',
          'order.complete': 'Dana akan langsung dicairkan ke penjual dan tidak bisa dibatalkan. Konfirmasi barang telah diterima?',
          'order.dispute': 'Dana akan ditahan sementara sampai komplain diselesaikan. Ajukan komplain?',
        };
        const confirmation = confirmations[action];
        if (confirmation && !window.confirm(confirmation)) {
          throw new TemplateRuntimeActionError('action_cancelled', 'Aksi dibatalkan.');
        }

        const endpoint = action === 'order.retry_payment'
          ? `/api/transactions/${encodeURIComponent(orderActionContext.transactionId)}/retry-checkout`
          : `/api/transactions/${encodeURIComponent(orderActionContext.transactionId)}/${action.slice('order.'.length)}`;
        const response = await fetch(endpoint, { method: 'POST' });
        if (response.status === 401) {
          const returnTo = `${window.location.pathname}${window.location.search}`;
          window.location.assign(`/auth/login?next=${encodeURIComponent(returnTo)}`);
          throw new TemplateRuntimeActionError('authentication_required', 'Login diperlukan untuk melanjutkan aksi.');
        }
        if (!response.ok) {
          let message = 'Aksi transaksi gagal diproses.';
          try {
            const body: unknown = await response.json();
            if (
              body !== null &&
              typeof body === 'object' &&
              'message' in body &&
              typeof body.message === 'string'
            ) message = body.message;
          } catch {
            message = 'Aksi transaksi gagal diproses.';
          }
          throw new TemplateRuntimeActionError('order_action_failed', message);
        }

        if (action === 'order.retry_payment') {
          const body: unknown = await response.json();
          if (
            body === null ||
            typeof body !== 'object' ||
            !('checkout_url' in body) ||
            typeof body.checkout_url !== 'string'
          ) {
            throw new TemplateRuntimeActionError('invalid_checkout_response', 'Link pembayaran tidak tersedia.');
          }
          let checkoutUrl: URL;
          try {
            checkoutUrl = new URL(body.checkout_url);
          } catch {
            throw new TemplateRuntimeActionError('invalid_checkout_response', 'Link pembayaran tidak valid.');
          }
          if (
            (checkoutUrl.protocol !== 'https:' && checkoutUrl.protocol !== 'http:') ||
            checkoutUrl.username !== '' ||
            checkoutUrl.password !== ''
          ) {
            throw new TemplateRuntimeActionError('invalid_checkout_response', 'Link pembayaran tidak valid.');
          }
          window.location.assign(checkoutUrl.href);
          return;
        }
        router.refresh();
      },
    });
    window.addEventListener('message', handleOrderAction);
    return () => window.removeEventListener('message', handleOrderAction);
  }, [orderActionContext, router, stableIdentity]);

  if (error) return <p role="alert" className="p-6 text-sm text-red-700">{error}</p>;

  const frame = (
    <iframe
      ref={frameRef}
      title={`Website template ${stableIdentity.slug} ${stableIdentity.version}`}
      className={`block w-full border-0 ${resizeToContent ? 'absolute left-0 top-0 z-20 overflow-hidden' : 'min-h-screen'}`}
      style={resizeToContent ? { height: frameHeight } : undefined}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={frameDocument || '<!doctype html><html><body></body></html>'}
      onLoad={() => {
        if (!frameDocument) return;
        if (frameLoadedRef.current && clientBundle !== null) {
          setError('Template mencoba menavigasi keluar dari frame terisolasi, sehingga konten dihentikan.');
          return;
        }
        frameLoadedRef.current = true;
      }}
    />
  );

  if (resizeToContent) {
    return (
      <div className="relative z-20 h-[76px] w-full">
        {frame}
      </div>
    );
  }

  return (
    frame
  );
}
