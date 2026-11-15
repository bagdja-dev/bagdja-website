'use client';

import { useEffect, useId, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createTemplateRuntimeIntentBridge,
  createTemplateRuntimeOrderActionBridge,
  TemplateRuntimeActionError,
  TEMPLATE_RUNTIME_INTENT_CONFIRMATIONS,
  type TemplateRuntimeIdentity,
  type TemplateRuntimeOrderAction,
} from '../lib/template-runtime-bridge';
import {
  isTemplateRuntimeResizeMessage,
  createTemplateRuntimeSsrDocument,
  isTemplateRuntimeNavigationMessage,
  isTemplateRuntimeNotificationAnchorMessage,
  isTemplateRuntimePongMessage,
  createTemplateInlineBootstrap,
  sanitizeTemplateHtml,
} from '../lib/template-runtime-ssr-document';
import {
  installTemplateDocumentNavigation,
  loadInlineTemplate,
  scheduleTemplateClientScript,
  startInlineBootstrap,
  templateClientScriptRan,
} from '../lib/template-inline-runtime';
import {
  getAllowedTemplateNavigationUrl,
  getAllowedTemplateShareUrl,
  isGoogleMapsNavigationUrl,
  parseTemplateRuntimeRefreshMessage,
  parseTemplateRuntimeShareMessage,
  TEMPLATE_RUNTIME_REFRESH_RESULT,
  TEMPLATE_RUNTIME_SHARE_RESULT,
  type TemplateRuntimeShareOutcome,
} from '../lib/template-runtime-bridge';

/** Salin teks di halaman host (Clipboard API, fallback execCommand). */
async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // lanjut ke fallback
  }
  try {
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.append(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  } catch {
    return false;
  }
}

/** Bagikan via Web Share bila ada (HP), selain itu salin tautan. */
async function shareOrCopy(mode: 'share' | 'copy', url: string, title?: string): Promise<TemplateRuntimeShareOutcome> {
  if (mode === 'share' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ url, ...(title ? { title } : {}) });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyText(url)) ? 'copied' : 'failed';
}
import { NotificationBell } from './notification-bell';
import { loadTemplateBrowserBundle, type TemplateBrowserBundleRef } from '../lib/template-browser-bundle';
import type { ThemeColors } from '../lib/website-theme';

/** Berapa kali iframe dimuat ulang saat ping pengaman navigasi tidak dijawab, sebelum konten dihentikan. */
const NAVIGATION_GUARD_RELOADS = 2;

interface TemplateRuntimeSsrFrameProps {
  html: string;
  identity: TemplateRuntimeIdentity;
  tenantPathPrefix: string;
  clientBundle?: string | null;
  clientBundleSha256?: string | null;
  /**
   * Mode client (template-client-rendering-plan §5): template dirender di iframe dari browser.js
   * (diambil & diverifikasi halaman induk). `html` diabaikan (kosong).
   */
  clientRender?: { props: Record<string, unknown>; bundle: TemplateBrowserBundleRef } | null;
  /**
   * Render LANGSUNG di halaman tanpa iframe (D7). Hanya berlaku bersama `clientRender`.
   * Bridge aksi sama (postMessage ke jendela ini), client.js sekali per dokumen.
   */
  inline?: boolean;
  resizeToContent?: boolean;
  /**
   * `bottom` = navigasi bawah template (menempel di bawah layar, tinggi 0 bila template
   * menyembunyikannya, mis. di desktop).
   */
  placement?: 'top' | 'bottom';
  /** Reserve flow space when the page does not already account for the fixed dock. */
  reserveBottomSpace?: boolean;
  orderActionContext?: {
    transactionId: string;
    actions: readonly TemplateRuntimeOrderAction[];
  };
  /** Intent halaman sistem (keranjang, bayar, RSVP) — diteruskan ke /api/template-intents. */
  intentContext?: {
    tenantSlug: string;
    pageType: string;
    actions: readonly string[];
  };
  notificationContext?: {
    websiteId: string;
    basePath: string;
    isLoggedIn: boolean;
    theme: ThemeColors;
  };
}

/** Tujuan redirect hasil intent: path tenant di origin sendiri, atau halaman pembayaran http(s). */
function safeIntentRedirect(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.username || url.password) return null;
    if (url.origin === window.location.origin) return `${url.pathname}${url.search}${url.hash}`;
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function TemplateRuntimeSsrFrame({
  html,
  identity,
  tenantPathPrefix,
  clientBundle = null,
  clientBundleSha256 = null,
  clientRender = null,
  inline: inlineRequested = false,
  resizeToContent = false,
  placement = 'top',
  reserveBottomSpace = true,
  orderActionContext,
  intentContext,
  notificationContext,
}: TemplateRuntimeSsrFrameProps) {
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const inline = inlineRequested && clientRender !== null;
  const inlineRootRef = useRef<HTMLDivElement>(null);
  const instanceId = useId();
  // Pengaman navigasi: setiap `load`, host bertanya ke isi frame (ping) apakah masih dokumen Bagdja.
  // Menghitung jumlah `load` tidak andal (load dokumen lama/kosong bisa datang terlambat di HP).
  // Hanya bila TIDAK ada jawaban sama sekali — isi frame sudah halaman lain — konten dihentikan.
  const navigationCheckRef = useRef<{ requestId: string; retry: number; deadline: number } | null>(null);
  // Ping tak terjawab → iframe dimuat ulang dulu (maks. NAVIGATION_GUARD_RELOADS) sebelum konten dihentikan.
  // Iframe yang nyaris tak terlihat (navigasi bawah 1px) bisa tertahan sesaat oleh throttle browser; memuat
  // ulang juga memulihkan dokumen Bagdja bila template benar-benar menavigasi frame-nya.
  const guardReloadsRef = useRef(0);
  const [frameNonce, setFrameNonce] = useState(0);
  const [frameDocument, setFrameDocument] = useState('');
  const [frameHeight, setFrameHeight] = useState(0);
  const [notificationAnchor, setNotificationAnchor] = useState<{ left: number; top: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Refresh lembut setelah intent: dokumen lama tetap tampil (dengan overlay) sampai dokumen baru siap.
  const [refreshing, setRefreshing] = useState(false);
  const [refreshPending, startRefresh] = useTransition();
  // Permintaan "Muat ulang" dari template: dibalas saat refresh selesai tanpa dokumen baru.
  const pendingRefreshRef = useRef<string | null>(null);
  const lastManualRefreshRef = useRef(0);
  const stableIdentity = useMemo(() => {
    if (!inline) return { slug: identity.slug, version: identity.version, digest: identity.digest };
    // Render langsung: header, isi, & navigasi bawah berbagi jendela → digest unik per bagian agar pesan bridge
    // tidak ditangani bagian lain (deterministik dari useId, sama di server & browser).
    const idHex = Array.from(instanceId, (character) => character.charCodeAt(0).toString(16).padStart(2, '0')).join('');
    return { slug: identity.slug, version: identity.version, digest: `${idHex}${identity.digest}`.slice(0, 64) };
  }, [identity.digest, identity.slug, identity.version, inline, instanceId]);
  // Iframe: pesan dari dokumen sandbox (origin 'null'). Render langsung: jendela ini sendiri.
  const messageOrigin = inline ? (typeof window === 'undefined' ? '' : window.location.origin) : 'null';
  const bridgeTarget = (): Window | null => (inline ? window : frameRef.current?.contentWindow ?? null);
  // Render langsung: data baru = dokumen baru (client.js template dijalankan sekali per dokumen).
  const reloadData = () => {
    if (inline) window.location.reload();
    else {
      setRefreshing(true);
      startRefresh(() => router.refresh());
    }
  };

  // Props mode client dibandingkan per isi (bukan referensi objek) agar dokumen hanya dibuat ulang bila data berubah.
  const clientRenderProps = clientRender ? JSON.stringify(clientRender.props) : null;
  const clientRenderUrl = clientRender?.bundle.url ?? null;
  const clientRenderSha256 = clientRender?.bundle.sha256 ?? null;
  const scriptsInFrame = clientBundle !== null || clientRender !== null;

  // Render langsung (D7): browser.js sekali per dokumen → render ke root → bootstrap bridge → client.js sekali.
  useEffect(() => {
    if (!inline || !clientRenderUrl || !clientRenderSha256 || clientRenderProps === null) return;
    const root = inlineRootRef.current;
    if (!root) return;
    if (templateClientScriptRan()) {
      // client.js sudah memasang listener untuk DOM lama di dokumen ini → perlu dokumen segar.
      window.location.reload();
      return;
    }
    let active = true;
    installTemplateDocumentNavigation();
    loadInlineTemplate({ url: clientRenderUrl, sha256: clientRenderSha256 })
      .then((template) => {
        if (!active) return;
        const rendered = template.render(JSON.parse(clientRenderProps) as Record<string, unknown>);
        if (typeof rendered !== 'string') throw new Error('Template tidak menghasilkan HTML.');
        root.innerHTML = sanitizeTemplateHtml(rendered, window.location.origin).html;
        startInlineBootstrap(root, createTemplateInlineBootstrap({
          identity: stableIdentity,
          parentOrigin: window.location.origin,
          tenantPathPrefix,
        }));
        root.dispatchEvent(new CustomEvent('bagdja:template:rendered'));
        scheduleTemplateClientScript(template);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Template tidak dapat ditampilkan.');
      });
    return () => {
      active = false;
    };
  }, [clientRenderProps, clientRenderSha256, clientRenderUrl, inline, stableIdentity, tenantPathPrefix]);

  // Navigasi bawah render langsung: tinggi = elemen template di root (biasanya position:fixed).
  useEffect(() => {
    if (!inline || placement !== 'bottom') return;
    const root = inlineRootRef.current;
    if (!root) return;
    const measure = () => {
      const height = Array.from(root.children).reduce(
        (max, child) => Math.max(max, Math.round(child.getBoundingClientRect().height)),
        0,
      );
      setFrameHeight(height);
    };
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    const children = new MutationObserver(() => {
      Array.from(root.children).forEach((child) => observer.observe(child));
      measure();
    });
    children.observe(root, { childList: true });
    return () => {
      observer.disconnect();
      children.disconnect();
    };
  }, [inline, placement]);

  useEffect(() => {
    if (inline) return;
    let active = true;
    // Dokumen lama dibiarkan tampil sampai dokumen baru siap (tanpa layar kosong saat refresh).
    setError(null);
    const bundleRef = clientRenderUrl && clientRenderSha256 ? { url: clientRenderUrl, sha256: clientRenderSha256 } : null;
    void (bundleRef ? loadTemplateBrowserBundle(bundleRef) : Promise.resolve(null)).then((bundleBase64) => createTemplateRuntimeSsrDocument({
      html: bundleRef ? '' : html,
      identity: stableIdentity,
      parentOrigin: window.location.origin,
      tenantPathPrefix,
      clientBundle,
      clientBundleSha256,
      clientRender: bundleRef && bundleBase64 !== null && clientRenderProps !== null
        ? {
            props: JSON.parse(clientRenderProps) as Record<string, unknown>,
            bundleBase64,
            bundleSha256: bundleRef.sha256,
          }
        : null,
      resizeToContent,
      minHeight: placement === 'bottom' ? 0 : 56,
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
    })).then((frameDocument) => {
      if (!active) return;
      setFrameDocument(frameDocument);
    }).catch((cause: unknown) => {
      if (active) {
        setError(cause instanceof Error ? cause.message : 'Template tidak dapat disiapkan.');
      }
    });
    return () => {
      active = false;
    };
  }, [
    clientBundle,
    clientBundleSha256,
    inline,
    clientRenderProps,
    clientRenderSha256,
    clientRenderUrl,
    html,
    placement,
    resizeToContent,
    stableIdentity,
    tenantPathPrefix,
  ]);

  // Navigasi bawah template: bilah lain yang menempel di bawah layar (mis. tombol Beli)
  // naik setinggi navigasi lewat `bottom: var(--template-bottom-nav-height, 0px)`.
  useEffect(() => {
    if (placement !== 'bottom') return;
    const root = document.documentElement;
    root.style.setProperty('--template-bottom-nav-height', `${frameHeight}px`);
    return () => {
      root.style.removeProperty('--template-bottom-nav-height');
    };
  }, [frameHeight, placement]);

  useEffect(() => {
    const frameElement: HTMLElement | null = inline ? inlineRootRef.current : frameRef.current;
    const frame = inline ? window : frameRef.current?.contentWindow;
    if (!frameElement || !frame) return;
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== frame || event.origin !== messageOrigin) return;
      if (stableIdentity.slug === 'kumpul' && isTemplateRuntimeNotificationAnchorMessage(event.data, stableIdentity)) {
        const anchor = event.data;
        // Iframe: koordinat relatif dokumen frame. Render langsung: koordinat halaman → relatif root.
        const rootRect = inline ? frameElement.getBoundingClientRect() : null;
        const x = rootRect ? anchor.x - (rootRect.left + window.scrollX) : anchor.x;
        const y = rootRect ? anchor.y - (rootRect.top + window.scrollY) : anchor.y;
        if (
          x <= frameElement.clientWidth &&
          y >= 0 &&
          y <= 160
        ) {
          setNotificationAnchor({
            left: (inline ? 0 : frameElement.offsetLeft) + x,
            top: (inline ? 0 : frameElement.offsetTop) + y,
          });
        }
        return;
      }
      if (isTemplateRuntimePongMessage(event.data, stableIdentity)) {
        if (navigationCheckRef.current?.requestId === event.data.requestId) {
          const check = navigationCheckRef.current;
          window.clearInterval(check.retry);
          window.clearTimeout(check.deadline);
          navigationCheckRef.current = null;
          guardReloadsRef.current = 0;
        }
        return;
      }
      if (resizeToContent && isTemplateRuntimeResizeMessage(event.data, stableIdentity)) {
        setFrameHeight(event.data.height);
        return;
      }
      const refresh = parseTemplateRuntimeRefreshMessage(event.data, stableIdentity);
      if (refresh) {
        const now = Date.now();
        // Batasi tap beruntun: satu refresh tiap 2 detik.
        if (now - lastManualRefreshRef.current < 2000) {
          frame.postMessage({ protocol: 1, type: TEMPLATE_RUNTIME_REFRESH_RESULT, ...stableIdentity, requestId: refresh.requestId, ok: false }, '*');
          return;
        }
        lastManualRefreshRef.current = now;
        pendingRefreshRef.current = refresh.requestId;
        reloadData();
        return;
      }
      const share = parseTemplateRuntimeShareMessage(event.data, stableIdentity);
      if (share) {
        const target = getAllowedTemplateShareUrl(share.href, window.location.origin, tenantPathPrefix);
        void (target ? shareOrCopy(share.mode, target.href, share.title) : Promise.resolve<TemplateRuntimeShareOutcome>('failed'))
          .then((outcome) => frame.postMessage({
            protocol: 1,
            type: TEMPLATE_RUNTIME_SHARE_RESULT,
            ...stableIdentity,
            requestId: share.requestId,
            outcome,
          }, '*'));
        return;
      }
      if (!isTemplateRuntimeNavigationMessage(event.data, stableIdentity)) return;
      const destination = getAllowedTemplateNavigationUrl(
        event.data.href,
        window.location.origin,
        tenantPathPrefix,
      );
      if (!destination) return;
      // Peta lokasi gathering → tab baru; tautan tenant & WhatsApp → tab ini.
      if (isGoogleMapsNavigationUrl(destination)) window.open(destination.href, '_blank', 'noopener,noreferrer');
      else window.location.assign(destination.href);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
    // frameNonce: iframe dipasang ulang → contentWindow baru harus didengarkan.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadData hanya bergantung pada inline/router
  }, [frameNonce, inline, messageOrigin, resizeToContent, router, stableIdentity, tenantPathPrefix]);

  useEffect(() => {
    const frame = bridgeTarget();
    if (!frame || !orderActionContext) return;
    const handleOrderAction = createTemplateRuntimeOrderActionBridge({
      frame,
      messageOrigin,
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
        if (inline) window.location.reload();
        else router.refresh();
      },
    });
    window.addEventListener('message', handleOrderAction);
    return () => window.removeEventListener('message', handleOrderAction);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bridgeTarget hanya bergantung pada inline
  }, [inline, messageOrigin, orderActionContext, router, stableIdentity]);

  useEffect(() => {
    const frame = bridgeTarget();
    if (!frame || !intentContext || intentContext.actions.length === 0) return;
    const handleIntent = createTemplateRuntimeIntentBridge({
      frame,
      messageOrigin,
      identity: stableIdentity,
      allowedActions: intentContext.actions,
      onIntent: async (intent) => {
        const confirmation = TEMPLATE_RUNTIME_INTENT_CONFIRMATIONS[intent.action];
        // Template boleh menampilkan popup konfirmasinya sendiri (intent.confirmed, divalidasi bootstrap).
        const hasTemplateConfirmation = intent.confirmed === true || (stableIdentity.slug === 'kumpul'
          && intent.action === 'gathering.invitations.submit');
        if (confirmation && !hasTemplateConfirmation && !window.confirm(confirmation)) {
          throw new TemplateRuntimeActionError('action_cancelled', 'Aksi dibatalkan.');
        }
        const { bannerFile, confirmed: _confirmed, ...jsonIntent } = intent;
        // pagePath: halaman undangan memetakan token dari path (diverifikasi server terhadap key intent).
        const payload = {
          tenantSlug: intentContext.tenantSlug,
          pageType: intentContext.pageType,
          pagePath: window.location.pathname,
          intent: jsonIntent,
        };
        let requestInit: RequestInit;
        if (bannerFile) {
          // Banner undangan: file ikut sebagai multipart, intent tetap JSON di field `payload`.
          const form = new FormData();
          form.append('payload', JSON.stringify(payload));
          form.append('banner', bannerFile, bannerFile instanceof File ? bannerFile.name : 'banner');
          requestInit = { method: 'POST', body: form };
        } else {
          requestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
        }
        const response = await fetch('/api/template-intents', requestInit);
        let body: { ok?: boolean; redirect?: unknown; message?: unknown } | null = null;
        try {
          body = await response.json();
        } catch {
          body = null;
        }
        if (response.status === 401) {
          const returnTo = `${window.location.pathname}${window.location.search}`;
          window.location.assign(`/auth/login?next=${encodeURIComponent(returnTo)}`);
          throw new TemplateRuntimeActionError('authentication_required', 'Login diperlukan untuk melanjutkan.');
        }
        if (!response.ok || body?.ok !== true) {
          throw new TemplateRuntimeActionError(
            'intent_failed',
            typeof body?.message === 'string'
              ? body.message
              : response.ok
                ? 'Server mengirim respons aksi yang tidak valid.'
                : `Aksi gagal diproses (HTTP ${response.status}).`,
          );
        }
        const redirect = safeIntentRedirect(body.redirect);
        if (redirect) {
          window.location.assign(redirect);
          return;
        }
        // Refresh lembut: data server dimuat ulang tanpa reload halaman; iframe diganti saat dokumen baru siap.
        // Render langsung: muat ulang halaman (client.js template butuh dokumen segar).
        reloadData();
      },
    });
    window.addEventListener('message', handleIntent);
    return () => window.removeEventListener('message', handleIntent);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bridgeTarget/reloadData hanya bergantung pada inline
  }, [inline, intentContext, messageOrigin, router, stableIdentity]);

  // Batalkan pemeriksaan navigasi yang masih berjalan saat komponen dilepas.
  useEffect(() => () => {
    const check = navigationCheckRef.current;
    if (check) {
      window.clearInterval(check.retry);
      window.clearTimeout(check.deadline);
    }
  }, []);

  // Refresh selesai tanpa dokumen baru (data tidak berubah) → hapus overlay.
  useEffect(() => {
    if (!refreshing || refreshPending) return;
    const timer = window.setTimeout(() => {
      setRefreshing(false);
      const requestId = pendingRefreshRef.current;
      pendingRefreshRef.current = null;
      if (requestId) {
        frameRef.current?.contentWindow?.postMessage({
          protocol: 1, type: TEMPLATE_RUNTIME_REFRESH_RESULT, ...stableIdentity, requestId, ok: true,
        }, '*');
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [refreshPending, refreshing, stableIdentity]);

  if (error) {
    // Navigasi bawah bersifat tambahan: gagal = tidak ditampilkan (header & isi halaman tetap tampil).
    if (placement === 'bottom') return null;
    return <p role="alert" className="p-6 text-sm text-red-700">{error}</p>;
  }

  const stopNavigationCheck = () => {
    const check = navigationCheckRef.current;
    if (!check) return;
    window.clearInterval(check.retry);
    window.clearTimeout(check.deadline);
    navigationCheckRef.current = null;
  };
  const verifyFrameDocument = () => {
    stopNavigationCheck();
    const target = frameRef.current?.contentWindow;
    if (!target) return;
    const requestId = window.crypto.randomUUID();
    const ping = () => target.postMessage({ protocol: 1, type: 'bagdja:template:ping', ...stableIdentity, requestId }, '*');
    // Diulang: bootstrap dokumen baru mungkin belum memasang listener saat `load` (terlambat) tiba.
    const retry = window.setInterval(ping, 500);
    const deadline = window.setTimeout(() => {
      stopNavigationCheck();
      if (guardReloadsRef.current < NAVIGATION_GUARD_RELOADS) {
        guardReloadsRef.current += 1;
        console.warn(`[template-frame] ${placement} frame did not answer the ping; reloading (${guardReloadsRef.current}/${NAVIGATION_GUARD_RELOADS}).`);
        setFrameNonce((nonce) => nonce + 1);
        return;
      }
      console.warn(`[template-frame] ${placement} frame stopped: no Bagdja document after ${NAVIGATION_GUARD_RELOADS} reloads.`);
      setError('Template mencoba menavigasi keluar dari frame terisolasi, sehingga konten dihentikan.');
    }, 4000);
    navigationCheckRef.current = { requestId, retry, deadline };
    ping();
  };

  const frame = inline ? (
    // Render langsung (D7): HTML template dipasang ke root ini oleh effect di atas.
    <div ref={inlineRootRef} data-bagdja-template-root="" className="w-full" />
  ) : (
    <iframe
      key={frameNonce}
      ref={frameRef}
      title={`Website template ${stableIdentity.slug} ${stableIdentity.version}`}
      className={`block w-full border-0 ${
        placement === 'bottom'
          ? 'overflow-hidden'
          : resizeToContent ? 'absolute left-0 top-0 z-20 overflow-hidden' : ''
      }`}
      // Navigasi bawah: jangan pernah 0px — Chrome Android (TWA) men-throttle iframe lintas-origin yang
      // tak terlihat, sehingga rAF/ResizeObserver di dalamnya tidak jalan dan tinggi tak pernah dilaporkan.
      // Halaman penuh: tinggi = layar yang TERLIHAT (dvh, bukan vh yang di Android lebih tinggi dari layar)
      // dikurangi navigasi bawah template — modal/bottom sheet di dalam iframe menempel ke bawah iframe,
      // jadi tidak tertutup navigasi bawah maupun bar sistem.
      style={
        resizeToContent
          ? { height: placement === 'bottom' ? Math.max(frameHeight, 1) : frameHeight }
          : { height: 'calc(100dvh - var(--template-bottom-nav-height, 0px))' }
      }
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={frameDocument || '<!doctype html><html><body></body></html>'}
      onLoad={() => {
        if (!frameDocument) return;
        if (scriptsInFrame) verifyFrameDocument();
        pendingRefreshRef.current = null;
        setRefreshing(false);
      }}
    />
  );
  const refreshOverlay = refreshing ? (
    <div
      role="status"
      aria-label="Memperbarui halaman"
      className="absolute inset-0 z-30 flex items-start justify-center bg-white/45 pt-24 backdrop-blur-[1px] transition-opacity"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-zinc-300 border-t-zinc-700" />
    </div>
  ) : null;
  const notification = notificationContext?.isLoggedIn ? (
    <div
      className="absolute z-50 max-[620px]:!left-auto max-[620px]:!right-3 max-[620px]:!top-3 max-[620px]:!translate-y-0"
      style={notificationAnchor
        ? { left: notificationAnchor.left, top: notificationAnchor.top, transform: 'translateY(-50%)' }
        : { right: 'max(16px, calc(50vw - 612px))', top: 18 }}
    >
      <NotificationBell
        websiteId={notificationContext.websiteId}
        basePath={notificationContext.basePath}
        isLoggedIn
        unreadOnly
        theme={notificationContext.theme}
      />
    </div>
  ) : null;

  if (placement === 'bottom') {
    return (
      <>
        {reserveBottomSpace ? <div aria-hidden="true" style={{ height: frameHeight }} /> : null}
        <div className="fixed inset-x-0 bottom-0 z-40">{frame}</div>
      </>
    );
  }

  if (resizeToContent) {
    return (
      <div className="relative z-20 w-full" style={inline ? undefined : { height: frameHeight }}>
        {frame}
        {refreshOverlay}
        {notification}
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {frame}
      {refreshOverlay}
      {notification}
    </div>
  );
}
