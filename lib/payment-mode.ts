export type CheckoutPaymentMode = 'ADD_TO_CART' | 'ESCROW';

/**
 * Mode checkout Bagdja produk — sama dengan `resolvePaymentModeByProductType`
 * di bagdja-website-api: `digital` direct pay, selain itu escrow. Semua
 * produk dijual lewat Bagdja checkout (tidak ada lagi link eksternal).
 * `undefined` untuk gathering — masuk lewat "Rencanakan Gathering", bukan cart.
 */
export function resolveCheckoutPaymentMode(productType: string): CheckoutPaymentMode | undefined {
  if (productType === 'gathering') return undefined;
  return productType === 'digital' ? 'ADD_TO_CART' : 'ESCROW';
}

export interface PurchaseAction {
  label: string;
  /** true = langsung ke halaman detail order setelah draft dibuat; false = tetap di halaman (tambah ke keranjang). */
  directOrder: boolean;
}

/**
 * Label + perilaku tombol beli per tipe produk — SATU sumber untuk semua
 * template (tidak ada override label per template). Tombol selalu membuat
 * draft order (keranjang); bedanya cuma setelahnya:
 * - `product`  → "+ Keranjang", tetap di halaman (kumpulkan beberapa barang).
 * - `service`/`package`/`digital` → pesan 1 produk ini, langsung ke order.
 * Quotation ("Minta Penawaran") & stok habis ditangani di tombolnya.
 */
export function resolvePurchaseAction(productType: string): PurchaseAction {
  switch (productType) {
    case 'service':
      return { label: 'Pesan Jasa', directOrder: true };
    case 'package':
      return { label: 'Pesan Paket', directOrder: true };
    case 'digital':
      return { label: 'Beli', directOrder: true };
    default:
      return { label: '+ Keranjang', directOrder: false };
  }
}
