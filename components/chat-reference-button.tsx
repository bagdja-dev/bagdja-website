'use client';

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { shortChatRef } from '../lib/chat-thread-display';
import { createChatReferenceMessage, type ChatReference } from './chat-reference';

function threadLabelFromReference(reference: ChatReference): string {
  if (reference.type === 'product') return reference.title;
  if (reference.type === 'transaction') return `TRX ${shortChatRef(reference.id)}`;
  return `Order ${shortChatRef(reference.id)}`;
}

interface ChatReferenceButtonProps {
  websiteId: string;
  basePath?: string;
  loginHref?: string;
  reference: ChatReference;
  productId?: string;
  orderId?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function ChatReferenceButton({
  websiteId,
  basePath = '',
  loginHref,
  reference,
  productId,
  orderId,
  className,
  style,
  children,
}: ChatReferenceButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function openChat() {
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat/threads', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website_id: websiteId,
          channel_type: reference.type,
          channel_label: threadLabelFromReference(reference),
          product_id: productId,
          order_id: orderId,
          initial_message: createChatReferenceMessage(reference),
        }),
      });

      if (response.status === 401) {
        if (loginHref) window.location.href = loginHref;
        return;
      }
      if (!response.ok) throw new Error('Gagal menyiapkan percakapan');

      const payload = (await response.json()) as { data?: { id?: string } };
      const threadId = payload.data?.id;
      const targetUrl = threadId
        ? `${basePath}/chat?thread=${encodeURIComponent(threadId)}`
        : `${basePath}/chat`;
      window.location.href = targetUrl;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal membuka chat');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={() => void openChat()} disabled={loading} className={className} style={style}>
        {loading ? 'Menyiapkan chat...' : children}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
