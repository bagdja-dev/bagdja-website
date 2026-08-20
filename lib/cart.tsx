'use client';

/**
 * Cart (keranjang) client-side untuk web renderer publik — W1b plan website.
 *
 * State di localStorage per website (key `bagdja_cart_<slug>`), sehingga:
 * - cart tidak campur antar tenant,
 * - persist lintas halaman/navigasi (per-browser),
 * - cukup untuk dogfooding (tanpa backend cart — YAGNI sampai butuh lintas device).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
  /** Mode pembayaran produk (ADD_TO_CART / ESCROW) — dipakai checkout nanti. */
  paymentMode?: 'ADD_TO_CART' | 'ESCROW';
  /** Stok (dari metadata) — opsional, dipakai guard quantity di cart/checkout. */
  stock?: number;
  /** Order draft server-side (PENDING di website_orders) — diisi setelah API sukses. */
  orderId?: string;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (item: Omit<CartItem, 'quantity' | 'orderId'>, quantity?: number, orderId?: string) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function storageKey(slug: string): string {
  return `bagdja_cart_${slug}`;
}

function readStored(slug: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load sekali saat mount (client-only — localStorage tidak ada di SSR).
  useEffect(() => {
    setItems(readStored(slug));
  }, [slug]);

  // Persist setiap perubahan.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey(slug), JSON.stringify(items));
    } catch {
      // kuota penuh / private mode — abaikan, cart tetap hidup di memory
    }
  }, [items, slug]);

  // Beri tahu komponen lain (CartBadge) bahwa cart berubah — badge header
  // fetch ulang jumlah draft dari server supaya selalu sinkron.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('bagdja:cart-changed'));
  }, [items]);

  const addItem = useCallback(
    (item: Omit<CartItem, 'quantity' | 'orderId'>, quantity = 1, orderId?: string) => {
      const qty = Math.max(1, Math.floor(quantity || 1));
      setItems((prev) => {
        const existing = prev.find((i) => i.productId === item.productId);
        if (existing) {
          return prev.map((i) =>
            i.productId === item.productId
              ? { ...i, quantity: i.quantity + qty, orderId: orderId ?? i.orderId }
              : i,
          );
        }
        return [...prev, { ...item, quantity: qty, orderId }];
      });
    },
    [],
  );

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((acc, i) => acc + i.quantity, 0);
    const total = items.reduce((acc, i) => acc + i.price * i.quantity, 0);
    return { items, count, total, addItem, removeItem, updateQuantity, clear };
  }, [items, addItem, removeItem, updateQuantity, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider');
  }
  return ctx;
}
