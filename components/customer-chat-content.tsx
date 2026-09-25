'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { formatChatThreadTitle, formatLastChatPreview } from '../lib/chat-thread-display';
import { ChatReferenceCard } from './chat-reference-card';
import { parseChatReference } from './chat-reference';

interface Thread {
  id: string;
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

export function CustomerChatContent({ websiteId, basePath = '' }: { websiteId: string; basePath?: string }) {
  const chatRootRef = useRef<HTMLElement | null>(null);
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

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [selectedThreadId, threads],
  );

  const ensureSupportThread = useCallback(async (nextThreads: Thread[]) => {
    if (nextThreads.length > 0) {
      if (!selectedThreadId) {
        setSelectedThreadId(nextThreads[0].id);
      }
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
  }, [selectedThreadId, websiteId]);

  const loadThreads = useCallback(async () => {
    if (!websiteId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchJson<ApiData<Thread[]>>(`/api/chat/threads?website_id=${encodeURIComponent(websiteId)}`);
      const nextThreads = Array.isArray(result.data) ? result.data : [];
      setThreads(nextThreads);
      await ensureSupportThread(nextThreads);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat chat');
    } finally {
      setLoading(false);
    }
  }, [ensureSupportThread, websiteId]);

  const loadMessages = useCallback(async (threadId: string) => {
    if (!threadId) return;

    setLoadingMessages(true);
    try {
      const result = await fetchJson<ApiData<{ items?: ThreadMessage[] } | ThreadMessage[]>>(
        `/api/chat/threads/${threadId}/messages?website_id=${encodeURIComponent(websiteId)}`,
      );
      const payload = result.data;
      const items = Array.isArray(payload) ? payload : payload?.items ?? [];
      setMessages(items.slice().reverse());
    } catch (err) {
      setMessages([]);
      console.error('Failed to load chat messages', err);
    } finally {
      setLoadingMessages(false);
    }
  }, [websiteId]);

  const markThreadRead = useCallback(async (threadId: string) => {
    try {
      await fetchJson(`/api/chat/threads/${threadId}/read?website_id=${encodeURIComponent(websiteId)}`, {
        method: 'POST',
      });
      setThreads((current) => current.map((thread) => (thread.id === threadId ? { ...thread, unread_count: 0 } : thread)));
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
    const threadId = selectedThreadId;
    if (!threadId) return;

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
          const eventName = typeof event.eventName === 'string' ? event.eventName : '';
          const rawData = event.data;
          const eventData = rawData && typeof rawData === 'object' && 'data' in rawData
            ? (rawData as { data?: unknown }).data
            : rawData;
          if (eventName !== 'website.chat.message.created' || !eventData || typeof eventData !== 'object') return;

          const data = eventData as Record<string, unknown>;
          if (data.websiteId !== websiteId || data.threadId !== threadId) return;

          void loadMessages(threadId);
          void markThreadRead(threadId);
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
  }, [loadMessages, markThreadRead, selectedThreadId, websiteId]);

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
      await loadThreads();
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
          <aside className={`w-full shrink-0 overflow-y-auto border-black/10 sm:block sm:w-80 sm:border-r ${selectedThreadId ? 'hidden' : 'block'}`}>
            <div className="border-b border-black/10 px-4 py-4">
              <p className="text-sm font-semibold">Percakapan</p>
              <p className="mt-1 text-xs opacity-60">Pesan Anda dengan admin</p>
            </div>
            {loading ? (
              <p className="p-4 text-sm opacity-60">Memuat...</p>
            ) : threads.length === 0 ? (
              <p className="p-4 text-sm opacity-60">Menyiapkan channel Admin...</p>
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
          </aside>

          <section className={`min-w-0 flex-1 flex-col ${selectedThreadId ? 'flex' : 'hidden sm:flex'}`}>
            {!selectedThread ? (
              <div className="flex flex-1 items-center justify-center px-4 text-center text-sm opacity-60">Pilih percakapan di sebelah kiri.</div>
            ) : (
              <>
                <div className="flex shrink-0 items-center gap-3 border-b border-black/10 px-4 py-4">
                  <button type="button" onClick={() => setSelectedThreadId(null)} aria-label="Kembali ke daftar percakapan" className="text-xl opacity-60 sm:hidden">←</button>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-accent,#17202a)] text-xs font-semibold text-[var(--brand-on-accent,#fff)]">H</span>
                  <div><p className="text-sm font-semibold">{formatChatThreadTitle(selectedThread)}</p><p className="truncate text-xs opacity-60">{formatLastChatPreview(selectedThread.last_message_preview)}</p></div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
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
