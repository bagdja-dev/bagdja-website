'use client';

import { useEffect } from 'react';

/**
 * Safari iOS mengabaikan `user-scalable=no` untuk pinch-zoom (aksesibilitas), sehingga gestur zoom
 * diblokir di sini. Auto-zoom saat fokus input & double-tap zoom ditangani viewport (`maximumScale: 1`)
 * dan `touch-action: manipulation` di globals.css.
 */
export function DisablePinchZoom() {
  useEffect(() => {
    const prevent = (event: Event) => event.preventDefault();
    // `gesture*` hanya ada di WebKit iOS; peramban lain cukup dengan viewport.
    document.addEventListener('gesturestart', prevent);
    document.addEventListener('gesturechange', prevent);
    document.addEventListener('gestureend', prevent);
    return () => {
      document.removeEventListener('gesturestart', prevent);
      document.removeEventListener('gesturechange', prevent);
      document.removeEventListener('gestureend', prevent);
    };
  }, []);
  return null;
}
