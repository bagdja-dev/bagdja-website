'use client';

import { useState } from 'react';

export function GatheringInvitationAppearance({
  groupId,
  websiteId,
  initialBannerUrl,
  initialDescription,
  onSaved,
}: {
  groupId: string;
  websiteId: string;
  initialBannerUrl: string;
  initialDescription: string;
  onSaved: (content: { bannerUrl: string; description: string }) => void;
}) {
  const [bannerUrl, setBannerUrl] = useState(initialBannerUrl);
  const [description, setDescription] = useState(initialDescription);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const contentUrl = `/api/gathering/plans/${encodeURIComponent(groupId)}/invitation-content?website_id=${encodeURIComponent(websiteId)}`;

  async function uploadBanner(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Pilih file gambar untuk banner.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran gambar maksimal 5 MB.');
      return;
    }

    setUploading(true);
    setError('');
    setSaved(false);
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch(`/api/gathering/plans/${encodeURIComponent(groupId)}/invitation-banner?website_id=${encodeURIComponent(websiteId)}`, { method: 'POST', body: form });
      const payload = await response.json().catch(() => null) as { url?: string; message?: string } | null;
      if (!response.ok || !payload?.url) throw new Error(payload?.message || 'Gagal mengunggah banner.');
      setBannerUrl(payload.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal mengunggah banner.');
    } finally {
      setUploading(false);
    }
  }

  async function saveContent() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const response = await fetch(contentUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitation_banner_url: bannerUrl || null,
          invitation_description: description || null,
        }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || 'Gagal menyimpan konten undangan.');
      onSaved({ bannerUrl, description });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Gagal menyimpan konten undangan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 border-y py-5" style={{ borderColor: 'var(--brand-border)' }}>
      <h2 className="text-sm font-semibold">Tampilan undangan</h2>
      <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>Tambahkan banner dan deskripsi agar halaman undangan lebih personal.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div>
          <label className="block text-xs font-medium" htmlFor="gathering-invitation-banner">Banner undangan</label>
          <input id="gathering-invitation-banner" type="file" accept="image/*" disabled={uploading} onChange={(event) => { void uploadBanner(event.target.files?.[0]); event.currentTarget.value = ''; }} className="mt-2 block w-full max-w-md text-xs file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-xs file:font-semibold" />
          <p className="mt-1 text-xs" style={{ color: 'var(--brand-muted)' }}>Gambar maksimal 5 MB.</p>
          {bannerUrl ? (
            <div className="mt-3">
              <img src={bannerUrl} alt="Preview banner undangan" className="aspect-[16/7] w-full max-w-md border object-cover" style={{ borderColor: 'var(--brand-border)' }} />
              <button type="button" onClick={() => { setBannerUrl(''); setSaved(false); }} className="mt-2 text-xs font-semibold underline">Hapus banner</button>
            </div>
          ) : null}
          {uploading ? <p className="mt-2 text-xs" role="status">Mengunggah banner…</p> : null}
        </div>
        <label className="block text-xs font-medium" htmlFor="gathering-invitation-description">
          Deskripsi undangan
          <textarea id="gathering-invitation-description" maxLength={3000} rows={7} value={description} onChange={(event) => { setDescription(event.target.value); setSaved(false); }} className="mt-2 block w-full resize-y rounded border bg-transparent px-3 py-2.5 text-sm" style={{ borderColor: 'var(--brand-border)' }} placeholder="Ceritakan rencana acara dan informasi penting untuk peserta." />
          <span className="mt-1 block text-right text-xs font-normal" style={{ color: 'var(--brand-muted)' }}>{description.length}/3000</span>
        </label>
      </div>
      {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
      <button type="button" onClick={() => void saveContent()} disabled={saving || uploading} className="mt-4 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: 'var(--brand-accent)', color: 'var(--brand-on-accent)' }}>
        {saving ? 'Menyimpan…' : 'Simpan tampilan undangan'}
      </button>
      {saved ? <span role="status" className="ml-3 text-xs text-green-700">Tampilan undangan tersimpan.</span> : null}
    </section>
  );
}