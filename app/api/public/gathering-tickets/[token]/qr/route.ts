import QRCode from 'qrcode';
import { NextResponse } from 'next/server';
import { publicBackendFetch } from '@/lib/backend-api';

interface RouteContext {
  params: { token: string };
}

/**
 * PNG QR tiket untuk email (klien email tidak menjalankan JS). Token divalidasi ke API
 * dan isi QR diambil dari `ticket_url` milik API, bukan dibentuk dari request.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const result = await publicBackendFetch<{ ticket_url?: string }>(`/api/public/gathering-tickets/${encodeURIComponent(params.token)}`);
  if (!result.data?.ticket_url) return new NextResponse('Not found', { status: 404 });
  const png = await QRCode.toBuffer(result.data.ticket_url, { type: 'png', width: 480, margin: 2, errorCorrectionLevel: 'M' });
  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
