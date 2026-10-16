/**
 * Ditampilkan halaman detail transaksi (`[website_slug]/order/[transaction_id]`)
 * kalau API gagal memuat transaksi karena error server (5xx / jaringan) —
 * BUKAN 404, supaya gangguan layanan tidak terlihat seperti transaksi hilang.
 */
interface TransactionLoadErrorProps {
  retryHref: string;
  ordersHref: string;
}

export default function TransactionLoadError({ retryHref, ordersHref }: TransactionLoadErrorProps) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        background: '#fafafa',
        color: '#1f2937',
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: '2.5rem 1.5rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: '0 auto 1rem',
            borderRadius: '50%',
            background: '#fef3c7',
            color: '#d97706',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
          }}
          aria-hidden="true"
        >
          ⚠️
        </div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
          Gagal Memuat Transaksi
        </h1>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: '#6b7280', margin: '0 0 1.5rem' }}>
          Detail transaksi sedang tidak bisa dimuat karena gangguan pada server.
          Transaksi Anda tetap aman — silakan coba lagi beberapa saat lagi.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center' }}>
          <a
            href={retryHref}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: 8,
              background: '#111827',
              color: '#ffffff',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Coba Lagi
          </a>
          <a
            href={ordersHref}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              color: '#374151',
              fontSize: '0.875rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Daftar Pesanan
          </a>
        </div>
      </div>
    </main>
  );
}
