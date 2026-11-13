/**
 * Katalog contoh untuk demo template package di katalog Studio
 * (/templates/package/[slug]). Disalin dari fixture standar runtime
 * (bagdja-website-template-runtime/fixtures/home.json) agar section katalog
 * template tidak tampil kosong; ditambah contoh produk bertipe `gathering` untuk
 * template bertema acara. Bukan data tenant.
 */
import type { TemplateRenderProps } from './template-registry';

type DemoCatalog = Pick<TemplateRenderProps, 'products' | 'categories' | 'locations' | 'faqs' | 'blogPosts'>;

export const PACKAGE_TEMPLATE_DEMO_CATALOG = {
  "products": [
    {
      "id": "p-1",
      "name": "Tas Kulit Arunika",
      "slug": "tas-kulit-arunika",
      "description": "Tas kulit untuk aktivitas harian.",
      "price": 750000,
      "priceLabel": "Rp750.000",
      "category": "Tas",
      "type": "product",
      "images": [
        {
          "url": "https://assets.bagdja.com/fixtures/placeholder-800x600.jpg",
          "alt": "Tas kulit"
        }
      ]
    },
    {
      "id": "p-2",
      "name": "Lampu Meja Senja",
      "slug": "lampu-meja-senja",
      "description": "Lampu meja dengan cahaya hangat.",
      "price": 325000,
      "priceLabel": "Rp325.000",
      "category": "Rumah",
      "type": "product",
      "images": []
    },
    {
      "id": "s-1",
      "name": "Jasa Pemasangan",
      "slug": "jasa-pemasangan",
      "description": "Pemasangan di lokasi pelanggan.",
      "price": 150000,
      "priceLabel": "Rp150.000",
      "category": "Layanan",
      "type": "service",
      "images": []
    },
    {
      "id": "family-camp",
      "name": "Family Camp Lembang — Edisi Libur Sekolah",
      "slug": "family-camp-lembang",
      "description": "Gathering keluarga untuk menikmati waktu bersama di alam terbuka.",
      "priceLabel": "Rp 350K / keluarga",
      "type": "gathering",
      "category": "Family"
    },
    {
      "id": "ceramic-workshop",
      "name": "Workshop Keramik & Kopi Slow Bar",
      "slug": "workshop-keramik",
      "description": "Belajar membuat keramik sambil menikmati kopi pilihan.",
      "priceLabel": "Rp 185K / orang",
      "type": "gathering",
      "category": "Workshop"
    },
    {
      "id": "trail-run",
      "name": "Trail Run Sentul — Sunrise Batch",
      "slug": "trail-run-sentul",
      "description": "Mulai pagi dengan rute lari dan pemandangan perbukitan.",
      "priceLabel": "Rp 125K / tiket",
      "type": "gathering",
      "category": "Outdoor"
    },
    {
      "id": "community-reading",
      "name": "Komunitas Baca: Diskusi Sore di Taman",
      "slug": "komunitas-baca",
      "description": "Sesi baca dan diskusi santai terbuka untuk semua.",
      "priceLabel": "Gratis — RSVP",
      "type": "gathering",
      "category": "Komunitas"
    }
  ],
  "categories": [
    {
      "id": "cat-1",
      "label": "Tas",
      "description": "Koleksi tas",
      "images": [
        {
          "url": "https://assets.bagdja.com/fixtures/placeholder-800x600.jpg"
        }
      ]
    },
    {
      "id": "cat-2",
      "label": "Rumah",
      "description": "Perlengkapan rumah",
      "images": []
    }
  ],
  "locations": [
    {
      "id": "loc-1",
      "name": "Toko Utama",
      "type": "branch",
      "isPrimary": true,
      "addressLine": "Jl. Contoh No. 1",
      "city": "Bandung",
      "lat": -6.9175,
      "lng": 107.6191
    }
  ],
  "faqs": [
    {
      "id": "faq-1",
      "question": "Berapa lama pengiriman?",
      "answer": "2–4 hari kerja untuk Pulau Jawa.",
      "category": "Pengiriman"
    }
  ],
  "blogPosts": [
    {
      "id": "post-1",
      "slug": "tips-merawat-tas-kulit",
      "title": "Tips merawat tas kulit",
      "excerpt": "Lima langkah sederhana.",
      "coverImage": "https://assets.bagdja.com/fixtures/placeholder-800x600.jpg",
      "content": "<p>Isi artikel.</p>"
    }
  ]
} as unknown as DemoCatalog;
