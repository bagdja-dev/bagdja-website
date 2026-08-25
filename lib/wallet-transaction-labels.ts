const WALLET_TX_TYPE_LABELS: Record<string, string> = {
  TOPUP_CREDIT: 'Topup Saldo',
  SALE_PROCEEDS: 'Hasil Penjualan',
  ESCROW_CREDIT: 'Dana Escrow Masuk',
  ESCROW_RELEASE_CREDIT: 'Dana Pesanan Dicairkan',
  TRANSFER_IN: 'Transfer Masuk',
  SUBSCRIPTION_REVENUE: 'Pendapatan Subscription',
  LICENSE_REVENUE: 'Pendapatan Lisensi',
  PAYMENT_DEBIT: 'Pembayaran',
  TRANSACTION_FEE: 'Biaya Transaksi',
  PLATFORM_FEE: 'Biaya Platform',
  ESCROW_HOLD: 'Dana Ditahan (Escrow)',
  ESCROW_RELEASE: 'Pelepasan Dana Escrow',
  ESCROW_FEE: 'Biaya Escrow',
  TRANSFER_OUT: 'Penarikan Dana',
  SUBSCRIPTION_CHARGE: 'Biaya Subscription',
  LICENSE_CHARGE: 'Biaya Lisensi',
  ADMIN_FEE: 'Biaya Admin',
};

export function formatWalletTransactionType(type: string): string {
  return WALLET_TX_TYPE_LABELS[type] ?? type;
}
