'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PREVIEW_MESSAGE,
  PREVIEW_PROTOCOL_VERSION,
  parsePreviewInboundMessage,
} from '../../lib/preview-protocol';

interface TemplateRuntimePreviewProps {
  html: string;
  templateSlug: string;
  templateVersion: string;
  digest: string;
  pageSlug: string;
  allowedOrigins: string[];
  allowDemoImageHost?: boolean;
  draftEndpoint?: string;
  initialProps?: Record<string, unknown>;
  draftIsHome?: boolean;
  draftFallbackSections?: Array<{ id?: string; type: string; content: Record<string, unknown> }>;
}

function escapeAttribute(value: string): string {
  return value.replace(/[&"'<>]/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      case '<':
        return '&lt;';
      default:
        return '&gt;';
    }
  });
}

function createPreviewDocument(
  html: string,
  stylesheetUrls: string[],
  allowDemoImageHost: boolean,
  highlightedSectionId: string | null,
): string {
  const stylesheetSources = stylesheetUrls.length > 0 ? ` ${stylesheetUrls.join(' ')}` : '';
  const demoImageSource = allowDemoImageHost ? ' https://placehold.co' : '';
  const contentSecurityPolicy = [
    "default-src 'none'",
    "script-src 'none'",
    "connect-src 'none'",
    `img-src data: blob: https://*.supabase.co https://*.supabase.in https://*.r2.dev https://*.r2.cloudflarestorage.com${demoImageSource}`,
    `style-src 'unsafe-inline'${stylesheetSources}`,
    'font-src data:',
    'media-src data: blob:',
    "form-action 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
  ].join('; ');
  const stylesheets = stylesheetUrls
    .map((url) => `<link rel="stylesheet" href="${escapeAttribute(url)}">`)
    .join('');
  const highlightStyle = highlightedSectionId
    ? `<style>[data-bagdja-section="${highlightedSectionId.replace(/[\u0000-\u001f\u007f"\\]/g, (character) => `\\${character.charCodeAt(0).toString(16)} `)}"]{outline:2px solid #e0679a;outline-offset:-2px;box-shadow:inset 0 0 0 9999px rgba(224,103,154,.06)}</style>`
    : '';

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${escapeAttribute(contentSecurityPolicy)}">${stylesheets}${highlightStyle}</head><body>${html}</body></html>`;
}

export function TemplateRuntimePreview({
  html,
  templateSlug,
  templateVersion,
  digest,
  pageSlug,
  allowedOrigins,
  allowDemoImageHost = false,
  draftEndpoint,
  initialProps,
  draftIsHome = false,
  draftFallbackSections = [],
}: TemplateRuntimePreviewProps) {
  const [renderedHtml, setRenderedHtml] = useState(html);
  const [renderedDigest, setRenderedDigest] = useState(digest);
  const [stylesheetUrls, setStylesheetUrls] = useState<string[]>([]);
  const [highlightedSectionId, setHighlightedSectionId] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRequest = useRef<AbortController | null>(null);
  const draftInFlight = useRef(false);
  const pendingDraft = useRef<{ props: Record<string, unknown>; generation: number } | null>(null);
  const draftGeneration = useRef(0);

  const previewDocument = useMemo(
    () => createPreviewDocument(renderedHtml, stylesheetUrls, allowDemoImageHost, highlightedSectionId),
    [allowDemoImageHost, highlightedSectionId, renderedHtml, stylesheetUrls],
  );

  useEffect(() => {
    setRenderedHtml(html);
    setRenderedDigest(digest);
    setDraftError(null);
  }, [digest, html]);

  useEffect(() => {
    setStylesheetUrls(Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'))
      .map((link) => {
        try {
          const url = new URL(link.href, window.location.href);
          return url.origin === window.location.origin ? url.href : null;
        } catch {
          return null;
        }
      })
      .filter((url): url is string => url !== null));
  }, []);

  useEffect(() => {
    if (window.parent === window) return;
    const message = {
      protocol: PREVIEW_PROTOCOL_VERSION,
      type: PREVIEW_MESSAGE.ready,
      templateSlug,
      templateVersion,
      digest,
      pageSlug,
    };
    for (const origin of allowedOrigins) window.parent.postMessage(message, origin);
  }, [allowedOrigins, digest, pageSlug, templateSlug, templateVersion]);

  useEffect(() => {
    if (!draftEndpoint || !initialProps) return;

    const renderDraft = async (props: Record<string, unknown>, generation: number) => {
      if (draftInFlight.current) {
        pendingDraft.current = { props, generation };
        return;
      }
      draftInFlight.current = true;
      const controller = new AbortController();
      draftRequest.current = controller;
      try {
        const response = await fetch(draftEndpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ slug: templateSlug, version: templateVersion, props }),
          cache: 'no-store',
          signal: controller.signal,
        });
        const result: unknown = await response.json();
        if (generation !== draftGeneration.current) return;
        if (!response.ok) {
          const error = result as { error?: { message?: unknown } };
          throw new Error(
            typeof error.error?.message === 'string'
              ? error.error.message
              : 'Pratinjau draft eksternal gagal diperbarui.',
          );
        }
        const rendered = result as {
          slug?: unknown;
          version?: unknown;
          digest?: unknown;
          html?: unknown;
        };
        if (
          rendered.slug !== templateSlug ||
          rendered.version !== templateVersion ||
          typeof rendered.digest !== 'string' ||
          !/^[a-f0-9]{64}$/.test(rendered.digest) ||
          typeof rendered.html !== 'string'
        ) {
          throw new Error('Runtime mengirim hasil pratinjau draft yang tidak valid.');
        }
        setRenderedHtml(rendered.html);
        setRenderedDigest(rendered.digest);
        setDraftError(null);
      } catch (error) {
        if (controller.signal.aborted || generation !== draftGeneration.current) return;
        setDraftError(error instanceof Error ? error.message : 'Pratinjau draft eksternal gagal diperbarui.');
      } finally {
        if (draftRequest.current === controller) draftRequest.current = null;
        draftInFlight.current = false;
        const nextDraft = pendingDraft.current;
        pendingDraft.current = null;
        if (nextDraft) void renderDraft(nextDraft.props, nextDraft.generation);
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (
        event.source !== window.parent ||
        !allowedOrigins.includes(event.origin)
      ) return;
      const message = parsePreviewInboundMessage(event.data);
      if (!message) return;

      if (message.type === PREVIEW_MESSAGE.highlight) {
        setHighlightedSectionId(message.sectionId);
        return;
      }
      if (message.pageSlug !== pageSlug) return;
      const props = {
        ...initialProps,
        sections: message.sections.length === 0 && draftIsHome
          ? draftFallbackSections
          : message.sections,
        ...(message.theme ? { websiteTheme: message.theme } : {}),
      };
      const generation = ++draftGeneration.current;
      setDraftError(null);
      if (draftTimer.current) clearTimeout(draftTimer.current);
      pendingDraft.current = { props, generation };
      draftTimer.current = setTimeout(() => {
        const latestDraft = pendingDraft.current;
        pendingDraft.current = null;
        if (latestDraft) void renderDraft(latestDraft.props, latestDraft.generation);
      }, 200);
    };

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (draftTimer.current) clearTimeout(draftTimer.current);
      pendingDraft.current = null;
      draftRequest.current?.abort();
    };
  }, [
    allowedOrigins,
    draftEndpoint,
    draftFallbackSections,
    draftIsHome,
    initialProps,
    pageSlug,
    templateSlug,
    templateVersion,
  ]);

  return (
    <main
      className="template-runtime-preview relative min-h-screen w-full"
      data-template-slug={templateSlug}
      data-template-version={templateVersion}
      data-template-digest={renderedDigest}
    >
      <iframe
        title={`Preview ${templateSlug} ${templateVersion}`}
        className="block min-h-screen w-full border-0"
        sandbox=""
        referrerPolicy="no-referrer"
        srcDoc={previewDocument}
      />
      {draftError ? (
        <p role="alert" className="fixed bottom-3 left-3 right-3 z-10 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700 shadow">
          Pratinjau draft gagal diperbarui: {draftError}
        </p>
      ) : null}
    </main>
  );
}
