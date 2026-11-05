'use client';

/**
 * Host protokol preview v1 (template-contract.md §4) untuk route
 * `[website_slug]/__preview`. Tidak spesifik template: View apa pun dari
 * registry dirender di sini (client-side) dengan section dari state lokal —
 * awalnya versi tersimpan (dari server), lalu diganti draft kiriman Studio
 * lewat `postMessage` tanpa menyimpan apa pun.
 *
 * Alur:
 *  - mount → kirim `bagdja:preview:ready` ke parent (hanya origin admin yang diizinkan);
 *  - `bagdja:preview:sections` → render ulang dengan draft;
 *  - `bagdja:preview:highlight` → garis #E0679A + scroll ke section;
 *  - klik di dalam section → `bagdja:preview:select` (navigasi link/form diblok
 *    supaya iframe tidak keluar dari route preview).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { SectionMarkersContext } from '../templates/shared/section-marker';
import {
  PREVIEW_MESSAGE,
  PREVIEW_PROTOCOL_VERSION,
  PREVIEW_SECTION_ATTR,
  parsePreviewInboundMessage,
  type PreviewDraftSection,
} from '../../lib/preview-protocol';
import type { SectionEntry } from '../../lib/template-data';
import { getTemplateRenderer, type TemplateRenderProps } from '../../lib/template-registry';
import { sanitizeWebsiteTheme, type WebsiteTheme } from '../../lib/website-theme';

const HIGHLIGHT_COLOR = '#E0679A';
/** Ruang di atas section saat scroll otomatis (header lengket template). */
const SCROLL_OFFSET = 80;

export interface PreviewShellProps {
  templateSlug: string;
  /** Slug halaman yang dirender — draft untuk halaman lain diabaikan. */
  pageSlug: string;
  isHome: boolean;
  viewProps: TemplateRenderProps;
  /** Fallback section template untuk home bila draft kosong (sama dengan route publik). */
  fallbackSections: SectionEntry[];
  /** `flow_id` → `flow_steps` hasil suntikan tenant-loader, dipakai ulang untuk draft. */
  flowStepsByFlowId: Record<string, unknown>;
  allowedOrigins: string[];
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function findMarker(sectionId: string): Element | null {
  const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(sectionId) : sectionId.replace(/"/g, '\\"');
  return document.querySelector(`[${PREVIEW_SECTION_ATTR}="${escaped}"]`);
}

/** Marker memakai `display: contents` → ukuran diambil dari gabungan elemen anaknya. */
function measureSection(sectionId: string): Box | null {
  const marker = findMarker(sectionId);
  if (!marker) return null;
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const child of Array.from(marker.children)) {
    const rect = child.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    top = Math.min(top, rect.top);
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }
  if (!Number.isFinite(top)) return null;
  return { top: top + window.scrollY, left: left + window.scrollX, width: right - left, height: bottom - top };
}

function sameBox(a: Box | null, b: Box | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

export function PreviewShell({
  templateSlug,
  pageSlug,
  isHome,
  viewProps,
  fallbackSections,
  flowStepsByFlowId,
  allowedOrigins,
}: PreviewShellProps) {
  const Renderer = useMemo(() => getTemplateRenderer(templateSlug), [templateSlug]);
  const [sections, setSections] = useState<SectionEntry[]>(viewProps.sections);
  const [websiteTheme, setWebsiteTheme] = useState<WebsiteTheme | undefined>(viewProps.websiteTheme);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [highlightBox, setHighlightBox] = useState<Box | null>(null);
  const [hoverBox, setHoverBox] = useState<Box | null>(null);
  const [mounted, setMounted] = useState(false);
  const parentOriginRef = useRef<string | null>(null);
  const pendingScrollRef = useRef(false);

  const postToParent = useCallback(
    (message: Record<string, unknown>) => {
      if (window.parent === window) return;
      const payload = { ...message, protocol: PREVIEW_PROTOCOL_VERSION };
      // Sebelum parent terverifikasi, kirim ke tiap origin admin yang diizinkan —
      // browser membuang pesan bila origin parent tidak cocok dengan target.
      const targets = parentOriginRef.current ? [parentOriginRef.current] : allowedOrigins;
      for (const origin of targets) window.parent.postMessage(payload, origin);
    },
    [allowedOrigins],
  );

  const toEntries = useCallback(
    (draft: PreviewDraftSection[]): SectionEntry[] => {
      if (draft.length === 0) return isHome ? fallbackSections : [];
      return draft.map((section) => {
        const flowId = section.content.flow_id;
        if (
          section.type === 'service_process_section' &&
          typeof flowId === 'string' &&
          flowStepsByFlowId[flowId] &&
          section.content.flow_steps === undefined
        ) {
          return { id: section.id, type: section.type, content: { ...section.content, flow_steps: flowStepsByFlowId[flowId] } };
        }
        return { id: section.id, type: section.type, content: section.content };
      });
    },
    [fallbackSections, flowStepsByFlowId, isHome],
  );

  // Pesan masuk — handler terbaru disimpan di ref supaya listener & `ready` cukup sekali per mount.
  const onMessageRef = useRef<(event: MessageEvent) => void>(() => undefined);
  onMessageRef.current = (event: MessageEvent) => {
    if (event.source !== window.parent || !allowedOrigins.includes(event.origin)) return;
    const message = parsePreviewInboundMessage(event.data);
    if (!message) return;
    parentOriginRef.current = event.origin;

    if (message.type === PREVIEW_MESSAGE.sections) {
      if (message.pageSlug !== pageSlug) return;
      setSections(toEntries(message.sections));
      if (message.theme) setWebsiteTheme(sanitizeWebsiteTheme(message.theme));
      return;
    }
    pendingScrollRef.current = message.sectionId !== null;
    setHighlightId(message.sectionId);
  };

  const readyRef = useRef({ templateSlug, pageSlug, postToParent });
  useEffect(() => {
    setMounted(true);
    const onMessage = (event: MessageEvent) => onMessageRef.current(event);
    window.addEventListener('message', onMessage);
    const ready = readyRef.current;
    ready.postToParent({ type: PREVIEW_MESSAGE.ready, templateSlug: ready.templateSlug, pageSlug: ready.pageSlug });
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Klik → pilih section; navigasi & submit diblok di mode preview.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const marker = target.closest(`[${PREVIEW_SECTION_ATTR}]`);
      if (target.closest('a[href]') || marker) event.preventDefault();
      if (!marker) return;
      event.stopPropagation();
      const sectionId = marker.getAttribute(PREVIEW_SECTION_ATTR);
      if (!sectionId) return;
      pendingScrollRef.current = false;
      setHighlightId(sectionId);
      postToParent({ type: PREVIEW_MESSAGE.select, sectionId });
    };
    const onSubmit = (event: Event) => event.preventDefault();
    const onOver = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const marker = target?.closest(`[${PREVIEW_SECTION_ATTR}]`);
      setHoverId(marker?.getAttribute(PREVIEW_SECTION_ATTR) ?? null);
    };
    const onLeave = () => setHoverId(null);

    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('mouseover', onOver);
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      document.removeEventListener('mouseover', onOver);
      document.documentElement.removeEventListener('mouseleave', onLeave);
    };
  }, [postToParent]);

  // Ukur ulang garis penanda saat pilihan/draft/ukuran halaman berubah.
  useEffect(() => {
    const update = () => {
      const nextHighlight = highlightId ? measureSection(highlightId) : null;
      const nextHover = hoverId && hoverId !== highlightId ? measureSection(hoverId) : null;
      setHighlightBox((prev) => (sameBox(prev, nextHighlight) ? prev : nextHighlight));
      setHoverBox((prev) => (sameBox(prev, nextHover) ? prev : nextHover));
      return nextHighlight;
    };

    const box = update();
    if (pendingScrollRef.current && box) {
      pendingScrollRef.current = false;
      const viewportTop = window.scrollY;
      const viewportBottom = viewportTop + window.innerHeight;
      const fullyVisible = box.top >= viewportTop + SCROLL_OFFSET && box.top + box.height <= viewportBottom;
      if (!fullyVisible) window.scrollTo({ top: Math.max(0, box.top - SCROLL_OFFSET), behavior: 'smooth' });
    }

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => update()) : null;
    observer?.observe(document.body);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [highlightId, hoverId, sections]);

  const highlightType = useMemo(
    () => (highlightId ? sections.find((section) => section.id === highlightId)?.type : undefined),
    [highlightId, sections],
  );

  // Elemen di-memo: perubahan hover/highlight tidak merender ulang View.
  const page = useMemo(
    () => <Renderer {...viewProps} sections={sections} websiteTheme={websiteTheme} />,
    [Renderer, sections, viewProps, websiteTheme],
  );

  return (
    <SectionMarkersContext.Provider value>
      {page}
      {mounted
        ? createPortal(
            <>
              {hoverBox ? (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: hoverBox.top,
                    left: hoverBox.left,
                    width: hoverBox.width,
                    height: hoverBox.height,
                    outline: `1px dashed ${HIGHLIGHT_COLOR}`,
                    outlineOffset: -1,
                    pointerEvents: 'none',
                    zIndex: 2147483000,
                  }}
                />
              ) : null}
              {highlightBox ? (
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: highlightBox.top,
                    left: highlightBox.left,
                    width: highlightBox.width,
                    height: highlightBox.height,
                    outline: `2px solid ${HIGHLIGHT_COLOR}`,
                    outlineOffset: -2,
                    boxShadow: `inset 0 0 0 9999px rgba(224, 103, 154, 0.06)`,
                    pointerEvents: 'none',
                    zIndex: 2147483001,
                  }}
                >
                  {highlightType ? (
                    <span
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        padding: '2px 8px',
                        background: HIGHLIGHT_COLOR,
                        color: '#ffffff',
                        font: '600 11px/16px "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
                        borderBottomRightRadius: 6,
                      }}
                    >
                      {highlightType}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </>,
            document.body,
          )
        : null}
      <style>{`[${PREVIEW_SECTION_ATTR}] > * { cursor: pointer; }`}</style>
    </SectionMarkersContext.Provider>
  );
}
