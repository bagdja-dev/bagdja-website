'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';

import { playNotificationSound, unlockNotificationAudio } from '../lib/notification-sound';

interface WebsiteNotification {
  id: string;
  title: string;
  message: string;
  action_url: string;
  read_at?: string | null;
  created_at: string;
}

function formatNotificationTime(value?: string) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '';
  }
}

function resolveActionHref(actionUrl: string, basePath = '') {
  if (!actionUrl) return basePath || '/';
  if (actionUrl.startsWith('http')) return actionUrl;
  const prefix = basePath.replace(/\/$/, '');
  return `${prefix}${actionUrl.startsWith('/') ? actionUrl : `/${actionUrl}`}`;
}

function readSiteUserId() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)site_user=([^;]*)/);
  if (!match?.[1]) return null;
  try {
    const user = JSON.parse(decodeURIComponent(match[1])) as { userId?: string };
    return user.userId ?? null;
  } catch {
    return null;
  }
}

export function NotificationBell({
  websiteId,
  basePath = '',
  isLoggedIn,
}: {
  websiteId: string;
  basePath?: string;
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<WebsiteNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<WebsiteNotification[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundUrl, setSoundUrl] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const seenRef = useRef(new Set<string>());

  const loadNotifications = useCallback(async () => {
    if (!websiteId || !isLoggedIn) return;
    try {
      const [listRes, unreadRes] = await Promise.all([
        fetch(`/api/notifications?website_id=${encodeURIComponent(websiteId)}&limit=20`, { cache: 'no-store', credentials: 'same-origin' }),
        fetch(`/api/notifications/unread-count?website_id=${encodeURIComponent(websiteId)}`, { cache: 'no-store', credentials: 'same-origin' }),
      ]);
      if (listRes.ok) {
        const payload = (await listRes.json()) as { data?: { items?: WebsiteNotification[] } };
        setItems(payload.data?.items ?? []);
      }
      if (unreadRes.ok) {
        const payload = (await unreadRes.json()) as { data?: { count?: number } };
        setUnreadCount(payload.data?.count ?? 0);
      }
    } catch {
      // Keep last known bell state.
    }
  }, [isLoggedIn, websiteId]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const refresh = () => void loadNotifications();
    window.addEventListener('website-notifications-refresh', refresh);
    return () => window.removeEventListener('website-notifications-refresh', refresh);
  }, [loadNotifications]);

  useEffect(() => {
    if (!websiteId || !isLoggedIn) return;
    fetch(`/api/notifications/sound-config?website_id=${encodeURIComponent(websiteId)}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    })
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { data?: { enabled?: boolean; url?: string | null } };
        setSoundEnabled(payload.data?.enabled !== false);
        setSoundUrl(payload.data?.url ?? null);
      })
      .catch(() => undefined);
  }, [isLoggedIn, websiteId]);

  useEffect(() => {
    const unlock = () => unlockNotificationAudio();
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    if (!websiteId || !isLoggedIn) return;

    let cancelled = false;
    let socket: ReturnType<typeof io> | null = null;

    const connectRealtime = async () => {
      try {
        const response = await fetch('/api/realtime/ws-token', { cache: 'no-store' });
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as { access_token?: string };
        if (!payload.access_token || cancelled) return;

        const eventServiceUrl = process.env.NEXT_PUBLIC_EVENT_API ?? 'http://localhost:4085';
        socket = io(`${eventServiceUrl.replace(/\/$/, '')}/events`, {
          auth: { token: payload.access_token },
          transports: ['websocket'],
        });

        socket.on('event', (event: Record<string, unknown>) => {
          const envelope = event.data && typeof event.data === 'object' ? event.data as Record<string, unknown> : event;
          const eventName = typeof event.eventName === 'string'
            ? event.eventName
            : typeof envelope.eventName === 'string'
              ? envelope.eventName
              : '';
          const nested = envelope.data && typeof envelope.data === 'object' ? envelope.data as Record<string, unknown> : null;
          const data = nested ?? envelope;
          if (data.websiteId && data.websiteId !== websiteId) return;
          const currentUserId = readSiteUserId();
          if (currentUserId && data.userId && data.userId !== currentUserId) return;
          if (eventName === 'website.chat.unread.updated') {
            void loadNotifications();
            return;
          }
          if (eventName !== 'website.notification.created') return;
          const notificationId = String(data.notificationId ?? data.id ?? '');
          if (notificationId && seenRef.current.has(notificationId)) return;
          if (notificationId) seenRef.current.add(notificationId);
          playNotificationSound({ enabled: soundEnabled, url: soundUrl });
          if (typeof data.title === 'string') {
            const toast: WebsiteNotification = {
              id: notificationId || `${Date.now()}`,
              title: data.title,
              message: typeof data.message === 'string' ? data.message : '',
              action_url: typeof data.actionUrl === 'string'
                ? data.actionUrl
                : typeof data.action_url === 'string'
                  ? data.action_url
                  : '/chat',
              created_at: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
            };
            setToasts((current) => [toast, ...current].slice(0, 4));
            window.setTimeout(() => {
              setToasts((current) => current.filter((item) => item.id !== toast.id));
            }, 6000);
          }
          void loadNotifications();
        });
      } catch (error) {
        console.error('[NotificationBell] realtime connection failed:', error);
      }
    };

    void connectRealtime();
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [isLoggedIn, loadNotifications, soundEnabled, soundUrl, websiteId]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const markAllRead = useCallback(async () => {
    if (!websiteId || unreadCount === 0) return;
    try {
      await fetch(`/api/notifications/read-all?website_id=${encodeURIComponent(websiteId)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
      });
      setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      // Keep current unread state if the request fails.
    }
  }, [unreadCount, websiteId]);

  const openNotification = useCallback(async (notification: WebsiteNotification) => {
    if (!notification.read_at) {
      try {
        await fetch(`/api/notifications/${notification.id}/read?website_id=${encodeURIComponent(websiteId)}`, {
          method: 'PATCH',
          credentials: 'same-origin',
        });
        setItems((current) => current.map((item) => (
          item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
        )));
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch {
        // Navigation still proceeds if mark-read fails.
      }
    }
    setOpen(false);
    window.location.href = resolveActionHref(notification.action_url, basePath);
  }, [basePath, websiteId]);

  if (!isLoggedIn || !websiteId) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        aria-label="Notifikasi"
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:opacity-80"
        style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 1-5.714 0M6.75 17.25h10.5a2.25 2.25 0 0 0 1.892-3.526L17.2 11.2A4.2 4.2 0 0 1 16.5 8.25V7.5A4.5 4.5 0 0 0 12 3a4.5 4.5 0 0 0-4.5 4.5v.75a4.2 4.2 0 0 1-.7 2.95l-1.942 2.524A2.25 2.25 0 0 0 6.75 17.25Z" />
        </svg>
        {unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
            style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-12 z-30 w-80 overflow-hidden rounded-xl border bg-[var(--brand-bg,#fff)] shadow-xl"
          style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-text)' }}
        >
          <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: 'var(--brand-border)' }}>
            <p className="text-sm font-semibold">Notifikasi</p>
            {unreadCount > 0 && (
              <button type="button" onClick={() => void markAllRead()} className="text-[11px] font-medium opacity-70">
                Tandai semua dibaca
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm opacity-60">Tidak ada notifikasi.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openNotification(item)}
                  className={`block w-full border-b px-3 py-2.5 text-left last:border-b-0 ${item.read_at ? 'opacity-70' : ''}`}
                  style={{ borderColor: 'var(--brand-border)' }}
                >
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs opacity-70">{item.message}</p>
                  <p className="mt-1 text-[10px] opacity-50">{formatNotificationTime(item.created_at)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
      {typeof document !== 'undefined' && toasts.length > 0
        ? createPortal(
            <div className="pointer-events-none fixed right-4 top-20 z-[80] flex w-80 flex-col gap-2">
              {toasts.map((toast) => (
                <button
                  key={toast.id}
                  type="button"
                  onClick={() => void openNotification(toast)}
                  className="pointer-events-auto rounded-xl border p-3 text-left shadow-xl"
                  style={{
                    borderColor: 'var(--brand-border)',
                    backgroundColor: 'var(--brand-bg, #fff)',
                    color: 'var(--brand-text)',
                  }}
                >
                  <p className="text-sm font-semibold">{toast.title}</p>
                  {toast.message && <p className="mt-1 line-clamp-2 text-xs opacity-70">{toast.message}</p>}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
