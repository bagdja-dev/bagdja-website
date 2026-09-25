import { draftOrderHref, transactionHref } from '../lib/order-href';

export type ChatReference = {
  type: 'product' | 'order' | 'transaction';
  id: string;
  title: string;
  imageUrl?: string | null;
  meta?: string | null;
  href?: string | null;
};

const REFERENCE_PREFIX = '__BAGDJA_CHAT_REFERENCE__';

export function createChatReferenceMessage(reference: ChatReference): string {
  return `${REFERENCE_PREFIX}${JSON.stringify(reference)}`;
}

export function parseChatReference(body?: string | null): ChatReference | null {
  if (!body?.startsWith(REFERENCE_PREFIX)) return null;

  try {
    const value = JSON.parse(body.slice(REFERENCE_PREFIX.length)) as Partial<ChatReference>;
    if ((value.type !== 'product' && value.type !== 'order' && value.type !== 'transaction') || typeof value.id !== 'string' || typeof value.title !== 'string') {
      return null;
    }
    return value as ChatReference;
  } catch {
    return null;
  }
}

export function getChatReferenceLabel(type: ChatReference['type']): string {
  if (type === 'product') return 'produk';
  if (type === 'transaction') return 'transaksi';
  return 'order';
}

/**
 * Path publik untuk kartu referensi. `basePath` mengikuti
 * `resolveTenantLinkBase` (`''` di subdomain/custom domain, `/{slug}` di local).
 */
export function buildChatReferenceHref(
  type: ChatReference['type'],
  basePath: string,
  target: { productSlug?: string; entityId?: string },
): string | undefined {
  if (type === 'product' && target.productSlug) {
    return `${basePath}/products/${target.productSlug}`;
  }
  if (type === 'order' && target.entityId) {
    return draftOrderHref(basePath, target.entityId);
  }
  if (type === 'transaction' && target.entityId) {
    return transactionHref(basePath, target.entityId);
  }
  return undefined;
}

export function resolveChatReferenceHref(reference: ChatReference, basePath = ''): string | null {
  const stored = typeof reference.href === 'string' ? reference.href.trim() : '';

  if (reference.type === 'product') {
    const productSlug = extractSegment(stored, 'products') ?? (isProbablySlug(reference.id) ? reference.id : null);
    return productSlug ? `${basePath}/products/${productSlug}` : null;
  }

  if (reference.type === 'order') {
    const orderId = extractSegment(stored, 'cart/order') ?? extractSegment(stored, 'order') ?? reference.id;
    return orderId ? draftOrderHref(basePath, orderId) : null;
  }

  if (reference.type === 'transaction') {
    const transactionId = extractSegment(stored, 'order') ?? reference.id;
    return transactionId ? transactionHref(basePath, transactionId) : null;
  }

  return null;
}

function extractSegment(href: string, kind: 'products' | 'order' | 'orders' | 'cart/order'): string | null {
  if (!href) return null;
  const match = href.match(new RegExp(`(?:^|/)(?:${kind})/([^/?#]+)`));
  return match?.[1] ?? null;
}

function isProbablySlug(value?: string): boolean {
  return Boolean(value && !value.includes('/'));
}
