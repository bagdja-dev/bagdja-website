'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { formatChatThreadTitle, formatLastChatPreview } from '../lib/chat-thread-display';
import { ChatReferenceCard } from './chat-reference-card';
import { parseChatReference } from './chat-reference';

interface Thread {
  id: string;
  topic_id?: string | null;
  website_id: string;
  channel_type: 'product' | 'support' | 'order' | 'transaction';
  channel_label?: string;
  status?: string;
  customer_user_id?: string;
  order_id?: string;
  last_message_at?: string;
  last_message_preview?: string;
  created_at?: string;
  updated_at?: string;
  unread_count?: number;
}

interface ThreadMessage {
  id: string;
  body: string;
  senderUserId?: string;
  senderDisplayName?: string;
  senderType?: 'admin' | 'customer';
  createdAt?: string;
  created_at?: string;
}

interface ApiData<T> {
  data?: T;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseRealtimeEvent(event: Record<string, unknown>) {
  const envelope = asRecord(event.data) ?? event;
  const eventName = typeof event.eventName === 'string'
    ? event.eventName
    : typeof envelope.eventName === 'string'
      ? envelope.eventName
      : '';
  const nested = asRecord(envelope.data);
  return { eventName, data: nested ?? envelope };
}

function eventString(data: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function matchesThread(thread: Thread, threadId: string, topicId: string) {
  return Boolean((threadId && thread.id === threadId) || (topicId && thread.topic_id === topicId));
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

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || 'Request failed');
  }

  return (await res.json()) as T;
}

export function CustomerChatContent({
  websiteId,
  basePath = '',
  chatHref,
  whatsapp,
  email,
}: {
  websiteId: string;
  basePath?: string;
  chatHref?: string;
  whatsapp?: string;
  email?: string;
}) {
  const chatRootRef = useRef<HTMLElement | null>(null);
  const messagesPaneRef = useRef<HTMLDivElement | null>(null);
  const selectedThreadIdRef = useRef<string | null>(null);
  const threadsRef = useRef<Thread[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [composer, setComposer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [selectedThreadId, threads],
  );

  const adminWhatsappHref = whatsapp ? `https://wa.me/${String(whatsapp).replace(/\D+/g, '')}` : undefined;
  const adminEmailHref = email ? `mailto:${email}` : undefined;

  selectedThreadIdRef.current = selectedThreadId;
  threadsRef.current = threads;

  const scrollMessagesToBottom = useCallback(() => {
    const pane = messagesPaneRef.current;
    if (!pane) return;
    requestAnimationFrame(() => {
      pane.scrollTop = pane.scrollHeight;
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const ensureSupportThread = useCallback(async (nextThreads: Thread[]) => {
    const adminThread = nextThreads.find((thread) => thread.channel_type === 'support' || thread.channel_label === 'Admin');
    if (adminThread) {
      setSelectedThreadId((current) => current ?? adminThread.id);
      return;
    }

    setInitializing(true);
    setError(null);

    try {
      const response = await fetchJson<ApiData<Thread>>(`/api/chat/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website_id: websiteId,
          channel_type: 'support',
          channel_label: 'Admin',
          initial_message: 'Halo admin, saya ingin bertanya.',
        }),
      });

      if (!response.data) throw new Error('Thread Admin tidak tersedia');
      setThreads([response.data]);
      setSelectedThreadId(response.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat chat Admin');
    } finally {
      setInitializing(false);
    }
  }, [websiteId]);

  const loadThreads = useCallback(async (silent = false) => {
    if (!websiteId) return;

    const isSearch = Boolean(debouncedSearch);
    if (!silent && !isSearch) setLoading(true);
    if (!silent) setError(null);

    try {
      const params = new URLSearchParams({ website_id: websiteId });
      if (isSearch) params.set('search', debouncedSearch);
      const result = await fetchJson<ApiData<Thread[]>>(`/api/chat/threads?${params.toString()}`);
      const nextThreads = Array.isArray(result.data) ? result.data : [];
      setThreads(nextThreads);
      const preferredAdminThread = nextThreads.find((thread) => thread.channel_type === 'support' || thread.channel_label === 'Admin');
      setSelectedThreadId((current) => {
        if (current && nextThreads.some((thread) => thread.id === current)) return current;
        return preferredAdminThread?.id ?? null;
      });
      if (!isSearch) await ensureSupportThread(nextThreads);
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'Gagal memuat chat');
    } finally {
      if (!silent && !isSearch) setLoading(false);
    }
  }, [debouncedSearch, ensureSupportThread, websiteId]);

  const loadMessages = useCallback(async (threadId: string, silent = false) => {
    if (!threadId) return;

    if (!silent) setLoadingMessages(true);
    try {
      const result = await fetchJson<ApiData<{ items?: ThreadMessage[] } | ThreadMessage[]>>(
        `/api/chat/threads/${threadId}/messages?website_id=${encodeURIComponent(websiteId)}`,
      );
      const payload = result.data;
      const items = Array.isArray(payload) ? payload : payload?.items ?? [];
      setMessages(items.slice().reverse());
    } catch (err) {
      if (!silent) setMessages([]);
      console.error('Failed to load chat messages', err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, [websiteId]);

  const markThreadRead = useCallback(async (threadId: string) => {
    setThreads((current) => current.map((thread) => (thread.id === threadId ? { ...thread, unread_count: 0 } : thread)));
    try {
      await fetchJson(`/api/chat/threads/${threadId}/read?website_id=${encodeURIComponent(websiteId)}`, {
        method: 'POST',
      });
      window.dispatchEvent(new CustomEvent('website-notifications-refresh'));
    } catch {
      // Read state is best-effort; the message history remains usable if it fails.
    }
  }, [websiteId]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (selectedThreadId) {
      void loadMessages(selectedThreadId);
      void markThreadRead(selectedThreadId);
    }
  }, [loadMessages, markThreadRead, selectedThreadId]);

  useEffect(() => {
    if (!websiteId) return;

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
          const { eventName, data } = parseRealtimeEvent(event);
          const eventWebsiteId = eventString(data, 'websiteId', 'website_id');
          if (eventWebsiteId && websiteId && eventWebsiteId !== websiteId) return;

          if (eventName === 'website.chat.unread.updated') {
            const eventUserId = eventString(data, 'userId', 'user_id');
            const currentUserId = readSiteUserId();
            if (!currentUserId || !eventUserId || eventUserId !== currentUserId) return;

            const eventThreadId = eventString(data, 'threadId', 'thread_id');
            const eventTopicId = eventString(data, 'topicId', 'topic_id');
            const unreadCount = Number(data.unreadCount ?? data.unread_count ?? 0);
            if (!eventThreadId && !eventTopicId) return;
            setThreads((current) => current.map((thread) => (
              matchesThread(thread, eventThreadId, eventTopicId)
                ? { ...thread, unread_count: Number.isFinite(unreadCount) ? unreadCount : 0 }
                : thread
            )));
            return;
          }

          if (eventName !== 'website.chat.message.created' && eventName !== 'bagdja.chat.message.created') return;

          const eventThreadId = eventString(data, 'threadId', 'thread_id');
          const eventTopicId = eventString(data, 'topicId', 'topic_id');
          if (!eventThreadId && !eventTopicId) return;

          const body = eventString(data, 'body', 'message');
          const preview = body.replace(/\s+/g, ' ').trim().slice(0, 140);
          const createdAt = eventString(data, 'createdAt', 'created_at') || new Date().toISOString();
          const messageId = eventString(data, 'messageId', 'id') || `evt-${createdAt}`;
          const matched = threadsRef.current.find((thread) => matchesThread(thread, eventThreadId, eventTopicId));
          const openThreadId = selectedThreadIdRef.current;
          const isOpen = Boolean(matched && openThreadId && matched.id === openThreadId);

          if (!matched) {
            void loadThreads(true);
            return;
          }

          setThreads((current) => current.map((thread) => (
            matchesThread(thread, eventThreadId, eventTopicId)
              ? {
                  ...thread,
                  last_message_preview: preview || thread.last_message_preview,
                  last_message_at: createdAt,
                  unread_count: isOpen ? 0 : Number(thread.unread_count ?? 0) + 1,
                }
              : thread
          )));

          if (!isOpen) return;

          const incoming: ThreadMessage = {
            id: messageId,
            body,
            senderUserId: eventString(data, 'senderUserId', 'sender_user_id') || undefined,
            senderDisplayName: eventString(data, 'senderDisplayName', 'sender_display_name') || undefined,
            senderType: data.senderType === 'admin' || data.senderType === 'customer'
              ? data.senderType
              : undefined,
            createdAt,
          };
          setMessages((current) => (current.some((message) => message.id === incoming.id) ? current : [...current, incoming]));
          void markThreadRead(matched.id);
        });
      } catch (error) {
        console.error('[CustomerChat] realtime connection failed:', error);
      }
    };

    void connectRealtime();

    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [loadThreads, markThreadRead, websiteId]);

  useEffect(() => {
    if (loadingMessages) return;
    scrollMessagesToBottom();
  }, [loadingMessages, messages, selectedThreadId, scrollMessagesToBottom]);

  useEffect(() => {
    const root = chatRootRef.current;
    if (!root) return;

    const updateAvailableHeight = () => {
      const footer = root.parentElement?.querySelector('footer');
      const footerHeight = footer?.getBoundingClientRect().height ?? 0;
      const top = root.getBoundingClientRect().top;
      setAvailableHeight(Math.max(320, window.innerHeight - top - footerHeight));
    };

    updateAvailableHeight();
    window.addEventListener('resize', updateAvailableHeight);
    const observer = new ResizeObserver(updateAvailableHeight);
    observer.observe(root);
    const footer = root.parentElement?.querySelector('footer');
    if (footer) observer.observe(footer);

    return () => {
      window.removeEventListener('resize', updateAvailableHeight);
      observer.disconnect();
    };
  }, []);

  async function handleSendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = composer.trim();
    if (!selectedThreadId || !text || sending) return;

    setSending(true);
    setError(null);

    try {
      const response = await fetchJson<ApiData<ThreadMessage>>(`/api/chat/threads/${selectedThreadId}/messages?website_id=${encodeURIComponent(websiteId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: text,
          author_name: 'Customer',
        }),
      });

      if (!response.data) throw new Error('Pesan tidak diterima server');
      setMessages((current) => [...current, response.data as ThreadMessage]);
      setComposer('');
      setThreads((current) => current.map((thread) => (
        thread.id === selectedThreadId
          ? { ...thread, last_message_preview: text.replace(/\s+/g, ' ').slice(0, 140), last_message_at: new Date().toISOString() }
          : thread
      )));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim pesan');
    } finally {
      setSending(false);
    }
  }

  return (
    <main
      ref={chatRootRef}
      className="flex min-h-0 flex-col bg-[var(--brand-bg,#f7f7f5)] text-[var(--brand-text,#17202a)]"
      style={availableHeight ? { height: `${availableHeight}px` } : undefined}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden px-0 py-0 sm:px-6 sm:py-6">
        <div className="hidden shrink-0 pb-4 sm:block">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-60">Pusat bantuan</p>
          <h1 className="mt-1 text-2xl font-semibold">Hubungi Kami</h1>
        </div>

        {error && <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mb-3 sm:rounded-lg">{error}</div>}
        {initializing && <div className="shrink-0 border-b border-black/10 bg-white/70 px-4 py-3 text-sm opacity-70 sm:mb-3 sm:rounded-lg">Menyiapkan percakapan...</div>}

        <div className="flex min-h-0 flex-1 overflow-hidden border-y border-black/10 bg-white sm:rounded-xl sm:border sm:shadow-sm">
          <aside className={`min-h-0 w-full shrink-0 flex-col border-black/10 sm:w-80 sm:border-r ${selectedThreadId ? 'hidden sm:flex' : 'flex'}`}>
            <div className="sticky top-0 z-10 shrink-0 border-b border-black/10 bg-white px-4 py-3">
              <p className="text-sm font-semibold">Percakapan</p>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="search"
                placeholder="Cari percakapan..."
                aria-label="Cari percakapan"
                className="mt-2 w-full rounded-xl border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent,#17202a)]"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <p className="p-4 text-sm opacity-60">Memuat...</p>
              ) : threads.length === 0 ? (
                <p className="p-4 text-sm opacity-60">
                  {debouncedSearch ? 'Tidak ada percakapan yang cocok.' : 'Menyiapkan channel Admin...'}
                </p>
              ) : (
                <ul className="divide-y divide-black/10">
                  {threads.map((thread) => (
                    <li key={thread.id}>
                      <button type="button" onClick={() => setSelectedThreadId(thread.id)} className={`flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-black/[0.03] ${selectedThreadId === thread.id ? 'bg-black/[0.04]' : ''}`}>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent,#17202a)] text-sm font-semibold text-[var(--brand-on-accent,#fff)]">H</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{formatChatThreadTitle(thread)}</span>
                          <span className="mt-1 block truncate text-xs opacity-60">{formatLastChatPreview(thread.last_message_preview)}</span>
                        </span>
                        {Number(thread.unread_count ?? 0) > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">{Number(thread.unread_count) > 99 ? '99+' : thread.unread_count}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          <section className={`min-w-0 flex-1 flex-col ${selectedThreadId ? 'flex' : 'hidden sm:flex'}`}>
            {!selectedThread ? (
              <div className="flex flex-1 items-center justify-center px-4 text-center text-sm opacity-60">Pilih percakapan di sebelah kiri.</div>
            ) : (
              <>
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-black/10 px-4 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <button type="button" onClick={() => setSelectedThreadId(null)} aria-label="Kembali ke daftar percakapan" className="text-xl opacity-60 sm:hidden">←</button>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-accent,#17202a)] text-xs font-semibold text-[var(--brand-on-accent,#fff)]">H</span>
                    <div className="min-w-0"><p className="truncate text-sm font-semibold">{formatChatThreadTitle(selectedThread)}</p><p className="truncate text-xs opacity-60">{formatLastChatPreview(selectedThread.last_message_preview)}</p></div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {adminWhatsappHref && (
                      <a
                        href={adminWhatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Hubungi WhatsApp admin"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--brand-accent,#17202a)] transition hover:opacity-80"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
                          <path d="M12.04 2C6.58 2 2.16 6.39 2.16 11.84c0 1.92.55 3.8 1.58 5.43L2 22l4.89-1.54A9.8 9.8 0 0 0 12.04 21C17.5 21 21.92 16.61 21.92 11.16S17.5 2 12.04 2Zm5.24 14.08c-.2.58-1.15 1.06-1.59 1.12-.42.05-.95.08-3.06-.66-2.58-.9-4.26-3.23-4.39-3.38-.13-.15-1.07-1.43-1.07-2.72s.67-1.92.91-2.18c.2-.21.47-.32.76-.32h.54c.18 0 .43.02.67.5l.94 2.26c.08.2.15.43.04.7-.06.18-.14.29-.28.45-.13.15-.27.33-.41.48-.13.13-.27.27-.11.52.15.25.7 1.17 1.5 1.89.99.9 1.83 1.18 2.09 1.3.27.13.42.1.57-.06.15-.16.65-.76.83-1.03.18-.27.37-.22.62-.13.25.08 1.65.78 1.93.36.13.64.19.92.19.28 0 .58-.07.94-.2.36-.13 1.16-.65 1.32-1.26.17-.61.17-1.14.12-1.25Z"/>
                        </svg>
                      </a>
                    )}
                    {adminEmailHref && (
                      <a
                        href={adminEmailHref}
                        aria-label="Kirim email ke admin"
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--brand-accent,#17202a)] transition hover:opacity-80"
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[1.8]">
                          <rect x="3" y="5" width="18" height="14" rx="2" />
                          <path d="m4 7 8 6 8-6" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
                <div ref={messagesPaneRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                  {loadingMessages ? <p className="py-8 text-center text-sm opacity-60">Memuat pesan...</p> : messages.length === 0 ? <p className="py-8 text-center text-sm opacity-60">Belum ada pesan. Mulai percakapan!</p> : messages.map((message) => {
                    const isCustomer = message.senderUserId === selectedThread.customer_user_id || message.senderType === 'customer';
                    const reference = parseChatReference(message.body);

                    return (
                      <div key={message.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${isCustomer ? 'bg-[var(--brand-accent,#17202a)] text-[var(--brand-on-accent,#fff)]' : 'bg-black/[0.06]'}`}>
                          {reference ? (
                            <ChatReferenceCard
                              reference={reference}
                              basePath={basePath}
                              extra={<p className="mt-2 text-xs opacity-75">Saya ingin bertanya tentang ini.</p>}
                            />
                          ) : (
                            <p className="whitespace-pre-wrap leading-relaxed">{message.body}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form onSubmit={handleSendMessage} className="flex shrink-0 items-end gap-2 border-t border-black/10 p-3 sm:p-4">
                  <textarea
                    value={composer}
                    onChange={(event) => setComposer(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    disabled={sending}
                    rows={1}
                    maxLength={2000}
                    placeholder="Tulis pesan..."
                    aria-label="Pesan untuk admin"
                    className="min-h-10 flex-1 resize-none rounded-2xl border border-black/15 bg-transparent px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-accent,#17202a)] disabled:opacity-60"
                  />
                  <button type="submit" disabled={sending || !composer.trim()} aria-label="Kirim pesan" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent,#17202a)] text-sm font-semibold text-[var(--brand-on-accent,#fff)] disabled:opacity-40">{sending ? '...' : '↑'}</button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
