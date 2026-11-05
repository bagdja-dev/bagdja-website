'use client';

/**
 * R1 — error boundary tenant, KHUSUS untuk template yang tidak ter-build di
 * renderer ini (`UnsupportedTemplateError`, dikenali lewat `digest` karena
 * pesan error server disembunyikan di production). Error lain dilempar ulang
 * agar tetap ditangani boundary bawaan Next.js seperti sebelumnya.
 */
import { UNSUPPORTED_TEMPLATE_DIGEST } from '../../lib/template-manifests';

interface TenantErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TenantError({ error }: TenantErrorProps) {
  if (error.digest !== UNSUPPORTED_TEMPLATE_DIGEST) throw error;

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
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
          Tampilan Website Tidak Tersedia
        </h1>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: '#6b7280', margin: 0 }}>
          Template yang dipilih untuk website ini belum didukung oleh server
          tampilan. Silakan hubungi pemilik website atau coba lagi nanti.
        </p>
      </div>
    </main>
  );
}
