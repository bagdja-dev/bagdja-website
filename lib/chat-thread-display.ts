const REFERENCE_PREFIX = '__BAGDJA_CHAT_REFERENCE__';

export function shortChatRef(id?: string | null): string {
  const compact = (id ?? '').replace(/-/g, '');
  return compact.slice(0, 8) || '----';
}

export function formatChatThreadTitle(thread: {
  channel_type?: string | null;
  channel_label?: string | null;
  product_id?: string | null;
  order_id?: string | null;
  id?: string | null;
}): string {
  const type = thread.channel_type ?? '';
  const label = thread.channel_label?.trim() ?? '';

  if (type === 'product') return label || 'Produk';
  if (type === 'support') return label || 'Admin';

  if (type === 'transaction' || /^TRX\b/i.test(label)) {
    const raw = label.replace(/^TRX\s*#?/i, '').trim();
    return `TRX ${raw || shortChatRef(thread.order_id ?? thread.id)}`;
  }

  if (type === 'order' || /^Order\b/i.test(label)) {
    const raw = label.replace(/^Order\s*#?/i, '').trim();
    return `Order ${raw || shortChatRef(thread.order_id ?? thread.id)}`;
  }

  return label || 'Admin';
}

export function formatLastChatPreview(body?: string | null): string {
  if (!body?.trim()) return 'Belum ada pesan';
  if (body.startsWith(REFERENCE_PREFIX)) {
    try {
      const value = JSON.parse(body.slice(REFERENCE_PREFIX.length)) as { type?: string };
      if (value.type === 'product') return 'Referensi produk';
      if (value.type === 'transaction') return 'Referensi transaksi';
      if (value.type === 'order') return 'Referensi order';
    } catch {
      // fall through
    }
    return 'Referensi percakapan';
  }
  return body.replace(/\s+/g, ' ').trim();
}
