import { NextResponse } from 'next/server';

import {
  buildCustomHtmlSandboxCsp,
  CUSTOM_HTML_SANDBOX_DOCUMENT,
  parseAssetOrigins,
} from '../../../../lib/custom-html-sandbox';

// Header CSP dibaca dari env runtime (CUSTOM_HTML_ASSET_ORIGINS), jangan dibekukan saat build.
export const dynamic = 'force-dynamic';

/** Dokumen bootstrap sandbox section HTML Kustom — lihat lib/custom-html-sandbox.ts. */
export function GET() {
  return new NextResponse(CUSTOM_HTML_SANDBOX_DOCUMENT, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': buildCustomHtmlSandboxCsp(parseAssetOrigins(process.env.CUSTOM_HTML_ASSET_ORIGINS)),
      'Cache-Control': 'public, max-age=300',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
