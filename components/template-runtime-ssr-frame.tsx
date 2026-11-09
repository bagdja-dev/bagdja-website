'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TemplateRuntimeIdentity } from '../lib/template-runtime-bridge';
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
  resizeToContent?: boolean;
}

export function TemplateRuntimeSsrFrame({
  html,
  identity,
  tenantPathPrefix,
  resizeToContent = false,
}: TemplateRuntimeSsrFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [frameDocument, setFrameDocument] = useState('');
  const [frameHeight, setFrameHeight] = useState(76);
  const [error, setError] = useState<string | null>(null);
  const stableIdentity = useMemo(
    () => ({ slug: identity.slug, version: identity.version, digest: identity.digest }),
    [identity.digest, identity.slug, identity.version],
  );

  useEffect(() => {
    let active = true;
    setFrameDocument('');
    setError(null);
    void createTemplateRuntimeSsrDocument({
      html,
      identity: stableIdentity,
      parentOrigin: window.location.origin,
      tenantPathPrefix,
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
  }, [html, resizeToContent, stableIdentity, tenantPathPrefix]);

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
