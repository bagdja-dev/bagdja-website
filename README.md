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

- Halaman tenant publik memakai runtime privat hanya untuk versi exact yang
  dipin pada website dan berstatus `published` di registry runtime. Allowlist
  deployment tambahan bersifat opsional. Tanpa pin, renderer built-in tetap
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
- Pengecualian proof-of-concept: pin `store-classic@1.0.6` dapat memiliki
  markup/layout halaman penuh detail transaksi melalui view-model `order_detail`.
  Aksi yang ditampilkan tetap merupakan intent bernama yang divalidasi host
  terhadap transaksi dan statusnya sebelum memanggil API Bagdja. Data yang
  diteruskan ke template dibatasi ke ringkasan tampilan; tidak ada token atau
  akses API langsung. Semua pin lain tetap memakai perilaku terdahulu. Package
  `1.0.6` belum dipublish atau dideploy dan tidak otomatis aktif hanya dengan
  perubahan kode ini.
- Bundle browser pada artifact yang sudah dipublikasikan dapat berjalan tanpa
  allowlist JavaScript per paket. `TEMPLATE_RUNTIME_CLIENT_BUNDLE_ENABLED=false`
  tetap tersedia sebagai sakelar darurat global.
  Bundle harus menjadi bagian artefak immutable dan hash diverifikasi lagi di
  browser. Eksekusi memakai iframe opaque `sandbox="allow-scripts"` tanpa
  `allow-same-origin`, popup, form, worker, frame turunan, atau koneksi fetch/
  websocket. CSP mengizinkan hanya hash bootstrap host dan bundle blob yang
  dibuat bootstrap; gambar hanya diizinkan dari storage origin yang ditemukan
  di markup SSR. Preview Studio tetap inert.
- Bundle dijalankan hanya dalam iframe pada halaman yang memakai renderer
  eksternal; detail transaksi dapat memakai renderer tersebut, sehingga review
  harus mempertimbangkan data yang terlihat di halaman. Interaksi tulis data
  hanya lewat action bridge bertipe milik Bagdja. Link biasa disaring host; CSP
  `navigate-to 'none'` dipasang sebagai
  defense-in-depth, tetapi Chromium belum mendukung directive tersebut.
  Pemantau iframe menghentikan konten setelah mendeteksi navigasi dokumen
  lanjutan, namun tidak dapat menjamin bahwa request navigasi tak sempat keluar.
  Karena itu review bundle sebelum publikasi tetap penting; versi website tetap
  dipin exact ke artifact published di registry runtime.
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
  slug/versinya tercantum di `TEMPLATE_RUNTIME_VERSION_MAP`. Production tetap
  mewajibkan pin versi website yang published.

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
