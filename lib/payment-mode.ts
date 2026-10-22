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
