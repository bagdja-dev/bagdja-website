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
