'use client';

import { useEffect, useRef, useState } from 'react';

import {
  CUSTOM_HTML_MAX_HEIGHT,
  CUSTOM_HTML_MESSAGE,
  CUSTOM_HTML_SANDBOX_FLAGS,
  getCustomHtmlSandboxUrl,
} from '../../../lib/custom-html-sandbox';

/**
 * Section HTML Kustom: selalu dirender di iframe sandbox (lihat lib/custom-html-sandbox.ts)
 * supaya JS tenant jalan untuk UI tanpa akses ke sesi pembeli atau jaringan.
 */
export function CustomHtmlSection({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(0);
  const hasContent = html.trim().length > 0;

  useEffect(() => {
    if (!hasContent) return undefined;
    const iframe = iframeRef.current;
    if (!iframe) return undefined;

    const sendHtml = () => {
      iframe.contentWindow?.postMessage(
        { type: CUSTOM_HTML_MESSAGE.render, html, baseUrl: window.location.href },
        '*',
      );
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const data = event.data as { type?: unknown; height?: unknown } | null;
      if (!data || typeof data !== 'object') return;
      if (data.type === CUSTOM_HTML_MESSAGE.ready) {
        sendHtml();
      } else if (data.type === CUSTOM_HTML_MESSAGE.height && typeof data.height === 'number' && Number.isFinite(data.height)) {
        setHeight(Math.max(0, Math.min(CUSTOM_HTML_MAX_HEIGHT, Math.ceil(data.height))));
      }
    };

    window.addEventListener('message', onMessage);
    // Iframe bisa selesai dimuat sebelum hidrasi; bootstrap mengulang "ready", tapi kirim juga sekarang.
    sendHtml();
    return () => window.removeEventListener('message', onMessage);
  }, [hasContent, html]);

  if (!hasContent) return null;
  return (
    <iframe
      // Remount saat HTML berubah (preview Studio) supaya script lama tidak tertinggal.
      key={html}
      ref={iframeRef}
      src={getCustomHtmlSandboxUrl()}
      sandbox={CUSTOM_HTML_SANDBOX_FLAGS}
      referrerPolicy="no-referrer"
      title="Konten kustom"
      className="custom-html-section block w-full border-0"
      style={{ height }}
    />
  );
}
