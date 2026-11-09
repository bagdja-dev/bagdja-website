# Bagdja Website (Public Renderer)

Renderer publik Next.js App Router + Tailwind CSS **murni** (tanpa UI library
eksternal) untuk website tenant Bagdja Website Builder.

## Stack

- Next.js 14 (App Router) + React 18
- TypeScript
- Tailwind CSS 3 (murni — hanya HTML5 semantik)

## Quick Start

```bash
cp .env.example .env.local
npm install
npm run dev
```

Default port: **5005** → `http://localhost:5005`

## Struktur

```
app/
├── layout.tsx                          # Root layout minimal
├── page.tsx                            # Index / directory
├── globals.css                         # Tailwind base
├── [website_slug]/                     # Dynamic route per tenant (Phase 7)
│   └── page.tsx
└── templates/                          # Koleksi template
    └── barber-classic/                 # Template pertama
        └── page.tsx
```

## Prinsip

- **Tidak ada library UI eksternal** — hanya HTML5 + Tailwind agar bundle kecil
  & SEO friendly.
- **Interaksi minimal JavaScript** — FAQ pakai `<details>`, dsb.
- Data tenant diambil dari API (`NEXT_PUBLIC_API_URL`) di server component.

## External template runtime

- Halaman tenant publik memakai runtime privat hanya jika pin versi website
  cocok persis dengan allowlist deployment. Tanpa pin, renderer built-in tetap
  dipakai; setelah pin dipilih, error runtime tidak fallback diam-diam.
- SSR eksternal ditampilkan di iframe opaque dengan markup aktif dibersihkan,
  CSP ketat, dan navigasi link tenant divalidasi host. Email dan token tidak
  dikirim; hanya nama tampilan non-email dan URL avatar publik dari storage
  yang disetujui (tanpa query/signature) yang dapat dipakai template. Navigasi
  keluar hanya mengizinkan tautan WhatsApp `https://wa.me/<nomor>` dengan nomor
  valid.
- Template eksternal dapat mendesain header dan menu akun sendiri menggunakan
  rute platform dan data profil minimum yang sudah disanitasi; email, token,
  dan identitas akun tidak diteruskan. Infrastruktur dan aksi bisnis tetap
  dimiliki Bagdja.
- Integrasi runtime eksternal saat ini mencakup homepage dan halaman konten,
  serta header-only pada halaman chat dan cart untuk template yang
  mendukungnya. Percakapan/SSE dan data serta aksi cart tetap dikelola Bagdja.
  Halaman cart, checkout, daftar transaksi, detail transaksi/pesanan draft,
  daftar tagihan, dan kalender acara memakai presentasi demo Store Classic
  khusus saat header runtime aktif; data, aksi cart, alamat, ongkir, pembayaran,
  filter, RSVP, dan navigasi detail tetap dikelola renderer host.
- Artifact yang memerlukan client bundle ditolak secara fail-closed. JavaScript
  template pihak ketiga belum dijalankan sampai isolasi navigasi/egress aman.
  Bundle JavaScript hanya boleh diaktifkan untuk versi yang dipin dan disetujui
  setelah origin eksekusi khusus tersedia dan isolasinya tervalidasi.
- Preview Studio adalah surface terpisah: iframe tetap inert dan tidak
  menjalankan script atau aksi template.
- Untuk mencoba artifact `store-classic` di preview katalog Studio saat
  development, aktifkan `TEMPLATE_RUNTIME_STUDIO_PREVIEW_ENABLED=true`.
  Preview hanya menggunakan versi `store-classic` yang tercantum di
  `TEMPLATE_RUNTIME_VERSION_MAP`, dan tidak mengubah pin website maupun jalur
  production.
- Dalam mode lokal yang sama, Editor Tema meneruskan tema draft ke preview
  template aktif; Editor Halaman meminta render ulang draft melalui endpoint
  server privat. Script template tetap tidak dijalankan, dan perubahan hanya
  tersimpan setelah pengguna menekan tombol simpan.
- Public tenant renderer di local development juga dapat menampilkan artifact
  SSR yang sama untuk template tanpa pin, selama flag development aktif dan
  slug/versinya ada di allowlist. Production tetap mewajibkan pin versi website
  yang disetujui.

## Phase 1 Checklist

- [x] Scaffold Next.js App Router
- [x] Tailwind config murni
- [x] Placeholder dynamic route `[website_slug]`
- [x] Placeholder template `barber-classic`

Lanjutan (Phase 7):

- [ ] Resolve tenant dari slug via API
- [ ] Loader template dinamis berdasar `template_id`
- [ ] Isi konten template Barber Classic (Hero, Services, Location, FAQ)
- [ ] Custom domain support
