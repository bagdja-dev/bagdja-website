import { NextRequest, NextResponse } from 'next/server';

import { backendFetchFormData } from '@/lib/backend-api';

export async function POST(request: NextRequest) {
  const incoming = await request.formData();
  const file = incoming.get('file');
  const websiteId = incoming.get('website_id');
  if (!(file instanceof File) || !websiteId) {
    return NextResponse.json({ message: 'File gambar dan website wajib diisi.' }, { status: 400 });
  }

  const outgoing = new FormData();
  outgoing.append('file', file);
  outgoing.append('website_id', String(websiteId));
  outgoing.append('folder', 'gathering-invitations');
  const result = await backendFetchFormData<{ url: string; path: string }>('/api/uploads/asset', outgoing);
  if (!result.data || result.status >= 400) {
    return NextResponse.json({ message: result.error ?? 'Gagal mengunggah banner undangan.' }, { status: result.status });
  }
  return NextResponse.json(result.data, { status: result.status });
}