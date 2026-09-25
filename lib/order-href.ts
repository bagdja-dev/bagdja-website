/**
 * Dua URL publik yang sengaja dipisah:
 * - draft (belum checkout) → /{slug}/cart/order/:orderId
 * - transaksi (sudah checkout) → /{slug}/order/:transactionId
 */
export function draftOrderHref(basePath: string, orderId: string): string {
  return `${basePath}/cart/order/${orderId}`;
}

export function transactionHref(basePath: string, transactionId: string): string {
  return `${basePath}/order/${transactionId}`;
}
