/**
 * Fase 5 paywall — halaman placeholder yang ditampilkan renderer publik
 * kalau website milik user yang subscription-nya tidak aktif
 * (CANCELLED / SUSPENDED / EXPIRED).
 *
 * Dipakai di semua halaman tenant (`[website_slug]/*`) via guard di page.tsx.
 */
export default function WebsiteInactiveNotice() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
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
          padding: '2.5rem 2rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: '0 auto 1rem',
            borderRadius: '50%',
            background: '#fee2e2',
            color: '#dc2626',
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
          Website Belum Aktif
        </h1>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: '#6b7280', margin: 0 }}>
          Website ini sedang tidak tersedia karena langganan pemiliknya belum
          aktif. Silakan hubungi pemilik website untuk informasi lebih lanjut.
        </p>
      </div>
    </main>
  );
}
