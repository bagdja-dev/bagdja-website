import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { DisablePinchZoom } from '../components/disable-pinch-zoom';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Bagdja Website',
    template: '%s · Bagdja',
  },
  description: 'Website UMKM yang dibuat dengan Bagdja Website Builder.',
};

/**
 * Tampilan seperti aplikasi di HP: tanpa zoom. `maximumScale: 1` juga mencegah Safari iOS auto-zoom saat
 * input difokuskan (input template berukuran font < 16px); pinch di iOS diblokir oleh DisablePinchZoom.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen overflow-x-hidden bg-white text-zinc-900 antialiased">
        <DisablePinchZoom />
        {children}
      </body>
    </html>
  );
}
